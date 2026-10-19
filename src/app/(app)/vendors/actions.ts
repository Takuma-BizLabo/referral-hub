"use server";
import { runWithFlash } from "@/lib/flash";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/auth";
import { recordHistory } from "@/lib/history";
import { errorState, type ActionState } from "@/lib/action-state";
import { httpUrl, money, str } from "@/lib/utils";
import { Prisma, type VendorApproval, type VendorMeetingStatus } from "@prisma/client";
import { parseFeeTable, rewardFor } from "@/lib/fee-table";
import { parseVendorCriteria, setNameOf } from "@/lib/candidates";

function vendorData(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) throw new Error("社名は必須です");
  return {
    name,
    contactName: str(formData.get("contactName")),
    contactEmail: str(formData.get("contactEmail")),
    contactPhone: str(formData.get("contactPhone")),
    serviceSummary: str(formData.get("serviceSummary")),
    referralFee: money(formData.get("referralFee")),
    saleshubUrl: httpUrl(str(formData.get("saleshubUrl")), "セールスハブ案件URL"),
    memo: str(formData.get("memo")),
    introSteps: str(formData.get("introSteps")),
    introMessage: str(formData.get("introMessage")),
    feeTable: feeTableOf(formData),
  };
}

/** 単価表（空なら null） */
function feeTableOf(formData: FormData) {
  let json: unknown = [];
  try {
    json = JSON.parse(String(formData.get("feeTable") ?? "[]"));
  } catch {
    throw new Error("単価表の形式が正しくありません");
  }
  const rules = parseFeeTable(json);
  if (Array.isArray(json) && rules.length !== json.length) throw new Error("単価表に正しくない行があります（従業員数の上限は下限より大きく、金額は0以上の整数にしてください）");
  return rules.length ? rules : Prisma.DbNull;
}

export async function createVendorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: number;
  try {
    await assertUser();
    const vendor = await prisma.vendor.create({ data: vendorData(formData) });
    id = vendor.id;
  } catch (e) {
    return errorState(e);
  }
  revalidatePath("/vendors");
  redirect(`/vendors/${id}`);
}

export async function updateVendorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = Number(formData.get("id"));
  try {
    await assertUser();
    await prisma.vendor.update({ where: { id }, data: vendorData(formData) });
  } catch (e) {
    return errorState(e);
  }
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  redirect(`/vendors/${id}`);
}

/** ベンダーMTGの状態（未実施／実施済）を手動で切り替える */
export async function setVendorMeetingStatusAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const user = await assertUser();
    const id = Number(formData.get("id"));
    const status = String(formData.get("status")) as VendorMeetingStatus;
    if (status !== "DONE" && status !== "NOT_DONE" && status !== "NOT_REQUIRED") throw new Error("不正な値です");
    await prisma.$transaction(async (tx) => {
      const v = await tx.vendor.findUniqueOrThrow({ where: { id } });
      await tx.vendor.update({ where: { id }, data: { meetingStatus: status } });
      await recordHistory(tx, {
        entityType: "VENDOR",
        entityId: id,
        field: "meetingStatus",
        fromValue: v.meetingStatus,
        toValue: status,
        changedById: user.id,
      });
    });
    revalidatePath(`/vendors/${id}`);
    revalidatePath("/vendors");
    revalidatePath("/meetings", "layout");
    revalidatePath("/referrals", "layout");
  });
}

export async function toggleVendorActiveAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    await assertUser();
    const id = Number(formData.get("id"));
    const v = await prisma.vendor.findUniqueOrThrow({ where: { id } });
    await prisma.vendor.update({ where: { id }, data: { isActive: !v.isActive } });
    revalidatePath(`/vendors/${id}`);
    revalidatePath("/vendors");
  });
}

function revalidateVendorReferrals(vendorId: number) {
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/referrals");
  revalidatePath("/meetings");
  revalidatePath("/");
}

/** ベンダーに提案した人事を追加する（紹介案件「ピックアップ受付」として登録。報酬は単価表で自動入力） */
export async function proposeContactsAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const user = await assertUser();
    const vendorId = Number(formData.get("vendorId"));
    const ids = formData
      .getAll("contactId")
      .map((v) => Number(v))
      .filter((n) => Number.isSafeInteger(n) && n > 0);
    if (ids.length === 0) throw new Error("追加する人事を選んでください");
    if (ids.length > 100) throw new Error("一度に追加できるのは100人までです");
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId } });
    const contacts = await prisma.contact.findMany({ where: { id: { in: ids }, isActive: true, referrals: { none: { vendorId } } } });
    for (const c of contacts) {
      const fee = rewardFor(vendor, c);
      const r = await prisma.referral.create({
        data: {
          vendorId,
          contactId: c.id,
          rewardAmount: fee.rewardAmount,
          rewardUndetermined: fee.rewardUndetermined,
          pickupNote: `${c.company ?? c.name}${c.title ? " / " + c.title : ""}（ベンダーに提案）${fee.reason ? "／" + fee.reason : ""}`,
          memo: "ベンダー詳細の「提案した人事」から追加",
        },
      });
      await recordHistory(prisma, { entityType: "REFERRAL", entityId: r.id, field: "status", fromValue: null, toValue: "RECEIVED", note: "ベンダーに提案", changedById: user.id });
    }
    revalidateVendorReferrals(vendorId);
    return { notice: `${contacts.length} 人を提案に追加しました${contacts.length < ids.length ? `（${ids.length - contacts.length} 人は登録済みのためスキップ）` : ""}` };
  });
}

const APPROVALS: VendorApproval[] = ["PENDING", "OK", "NG"];

/**
 * 提案した人事への回答（先方＝ベンダー側／人事側）。OK／NG／確認待ち。
 * どちらかが NG なら紹介見送りに、NG を取り消して両方 NG でなくなったらピックアップ受付に戻す。
 */
export async function setVendorApprovalAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const user = await assertUser();
    const id = Number(formData.get("id"));
    const side = formData.get("side") === "contact" ? "contact" : "vendor";
    const approval = formData.get("approval") as VendorApproval;
    if (!APPROVALS.includes(approval)) throw new Error("不正な値です");
    const r = await prisma.referral.findUniqueOrThrow({ where: { id } });
    const before = side === "contact" ? r.contactApproval : r.vendorApproval;
    if (before === approval) return;
    const vendorAfter = side === "vendor" ? approval : r.vendorApproval;
    const contactAfter = side === "contact" ? approval : r.contactApproval;
    const anyNg = vendorAfter === "NG" || contactAfter === "NG";
    const wasNg = r.vendorApproval === "NG" || r.contactApproval === "NG";
    // 面談実施済まで進んだ案件は変えない（報酬に関わるため）
    const toDeclined = anyNg && ["RECEIVED", "CONTACTING", "SCHEDULING", "MEETING_CONFIRMED"].includes(r.status);
    const fromDeclined = !anyNg && wasNg && r.status === "DECLINED";
    const status = toDeclined ? "DECLINED" : fromDeclined ? "RECEIVED" : r.status;
    await prisma.referral.update({
      where: { id },
      data: {
        ...(side === "contact" ? { contactApproval: approval } : { vendorApproval: approval }),
        ...(status !== r.status ? { status, statusChangedAt: new Date() } : {}),
      },
    });
    if (status !== r.status) {
      await recordHistory(prisma, {
        entityType: "REFERRAL",
        entityId: id,
        field: "status",
        fromValue: r.status,
        toValue: status,
        note: toDeclined ? (side === "contact" ? "人事側がNG" : "ベンダーが先方NG") : "NGを取り消し",
        changedById: user.id,
      });
    }
    revalidateVendorReferrals(r.vendorId);
    revalidatePath(`/referrals/${id}`);
  });
}

/** ベンダーの紹介条件（複数）を保存する。ベンダー詳細の「紹介の条件」から */
export async function saveVendorCriteriaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = Number(formData.get("vendorId"));
  try {
    await assertUser();
    let json: unknown;
    try {
      json = JSON.parse(String(formData.get("criteriaJson") ?? "{}"));
    } catch {
      throw new Error("条件の形式が正しくありません");
    }
    const vc = parseVendorCriteria(json);
    vc.sets.forEach((c, i) => {
      if (c.minEmployees != null && c.maxEmployees != null && c.maxEmployees <= c.minEmployees)
        throw new Error(`${setNameOf(c, i)}：従業員数の「未満」は「以上」より大きくしてください`);
    });
    await prisma.vendor.update({
      where: { id },
      data: { criteria: vc.sets.length || vc.excludeCompanies.length ? vc : Prisma.DbNull },
    });
  } catch (e) {
    return errorState(e);
  }
  revalidatePath(`/vendors/${id}`);
  return { success: "紹介の条件を保存しました" };
}
