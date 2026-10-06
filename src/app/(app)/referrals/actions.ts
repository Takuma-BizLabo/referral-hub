"use server";
import { runWithFlash } from "@/lib/flash";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertAdmin, assertUser } from "@/lib/auth";
import { recordHistory } from "@/lib/history";
import { notifyAdmins } from "@/lib/notifications";
import { errorState, type ActionState } from "@/lib/action-state";
import { fmtReward, money, parseDateInput, parseDateTimeInput, str } from "@/lib/utils";
import { REFERRAL_LABEL, REFERRAL_REQUIRES_VENDOR_DONE, REWARD_LABEL } from "@/lib/labels";
import type { MeetingFormat, ReferralStatus, RewardStatus } from "@prisma/client";

function revalidateReferral(id: number, vendorId: number, contactId: number) {
  revalidatePath("/referrals");
  revalidatePath(`/referrals/${id}`);
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/rewards");
  revalidatePath("/approvals");
  revalidatePath("/meetings/calendar");
  revalidatePath("/");
}

function meetingFields(formData: FormData) {
  const f = str(formData.get("meetingFormat"));
  return {
    meetingAt: parseDateTimeInput(formData.get("meetingAt")),
    meetingFormat: (f === "ONLINE" || f === "VISIT" ? f : null) as MeetingFormat | null,
    meetingPlace: str(formData.get("meetingPlace")),
    meetingResult: str(formData.get("meetingResult")),
    nextAction: str(formData.get("nextAction")),
    nextActionDue: parseDateInput(formData.get("nextActionDue")),
    pickupNote: str(formData.get("pickupNote")),
    memo: str(formData.get("memo")),
  };
}

export async function createReferralAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: number;
  try {
    const user = await assertUser();
    const vendorId = Number(formData.get("vendorId"));
    const contactId = Number(formData.get("contactId"));
    if (!vendorId) throw new Error("ベンダーを選んでください");
    if (!contactId) throw new Error("紹介先（繋がり）を選んでください");
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId } });

    if (formData.get("ignoreDuplicate") !== "1") {
      const dup = await prisma.referral.findFirst({
        where: { vendorId, contactId },
        include: { contact: true },
        orderBy: { id: "desc" },
      });
      if (dup) {
        return {
          error: `重複の可能性：「${dup.contact.name}」は既にこのベンダーに紹介されています（現在：${REFERRAL_LABEL[dup.status]}）。それでも登録する場合は「重複を無視して登録」にチェックしてください。`,
        };
      }
    }
    const rewardUndetermined = formData.get("rewardUndetermined") === "on";
    const rewardAmount = rewardUndetermined ? 0 : money(formData.get("rewardAmount"), vendor.referralFee);
    const r = await prisma.$transaction(async (tx) => {
      const created = await tx.referral.create({
        data: {
          vendorId,
          contactId,
          pickedUpAt: parseDateInput(formData.get("pickedUpAt")) ?? new Date(),
          rewardAmount,
          rewardUndetermined,
          ...meetingFields(formData),
        },
      });
      await recordHistory(tx, {
        entityType: "REFERRAL",
        entityId: created.id,
        field: "status",
        fromValue: null,
        toValue: "RECEIVED",
        changedById: user.id,
      });
      return created;
    });
    id = r.id;
    revalidateReferral(r.id, vendorId, contactId);
  } catch (e) {
    return errorState(e);
  }
  redirect(`/referrals/${id}`);
}

export async function updateReferralAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = Number(formData.get("id"));
  try {
    await assertUser();
    const before = await prisma.referral.findUniqueOrThrow({ where: { id } });
    const data = {
      ...meetingFields(formData),
      pickedUpAt: parseDateInput(formData.get("pickedUpAt")) ?? before.pickedUpAt,
      rewardUndetermined: formData.get("rewardUndetermined") === "on",
      rewardAmount: formData.get("rewardUndetermined") === "on" ? 0 : money(formData.get("rewardAmount"), before.rewardAmount),
    };
    await prisma.referral.update({ where: { id }, data });
    revalidateReferral(id, before.vendorId, before.contactId);
  } catch (e) {
    return errorState(e);
  }
  redirect(`/referrals/${id}`);
}

/**
 * 紹介ステータス変更の本体。ベンダーMTG未実施（かつ強制解除なし）なら打診中以降へ進めず "blocked" を返す。
 */
async function changeReferralStatus(user: { id: number }, id: number, status: ReferralStatus): Promise<"ok" | "unchanged" | "blocked"> {
  const r = await prisma.referral.findUniqueOrThrow({ where: { id }, include: { vendor: true, contact: true } });
  if (r.status === status) return "unchanged";
  if (REFERRAL_REQUIRES_VENDOR_DONE.includes(status) && r.vendor.meetingStatus !== "DONE" && !r.forceUnlocked) return "blocked";

  const becameDone = status === "MEETING_DONE" && r.status !== "MEETING_DONE";
  const applyReward = becameDone && r.rewardStatus === "UNFIXED";
  await prisma.$transaction(async (tx) => {
    await tx.referral.update({
      where: { id },
      data: {
        status,
        statusChangedAt: new Date(),
        ...(becameDone ? { meetingDoneAt: r.meetingDoneAt ?? new Date() } : {}),
        ...(applyReward ? { rewardStatus: "APPLIED" } : {}),
      },
    });
    await recordHistory(tx, {
      entityType: "REFERRAL",
      entityId: id,
      field: "status",
      fromValue: r.status,
      toValue: status,
      changedById: user.id,
    });
    if (applyReward) {
      await recordHistory(tx, {
        entityType: "REFERRAL",
        entityId: id,
        field: "rewardStatus",
        fromValue: "UNFIXED",
        toValue: "APPLIED",
        note: "面談実施済に伴い自動で計上申請",
        changedById: user.id,
      });
    }
  });
  if (applyReward) {
    await notifyAdmins({
      type: "APPROVAL_PENDING",
      title: `【計上申請】${r.vendor.name} × ${r.contact.name} の報酬 ${fmtReward(r.rewardAmount, r.rewardUndetermined)}`,
      body: r.rewardUndetermined ? "面談実施済になりました。単価が未定です。紹介案件で金額を入力してから承認してください。" : "面談実施済になりました。承認キューで確認してください。",
      linkUrl: `/referrals/${id}`,
    });
  }
  revalidateReferral(id, r.vendorId, r.contactId);
  return "ok";
}

/** 紹介ステータス変更。ベンダーMTG未実施なら打診中以降へ進めない。 */
export async function setReferralStatusAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const user = await assertUser();
    const id = Number(formData.get("id"));
    const status = String(formData.get("status")) as ReferralStatus;
    if (!(status in REFERRAL_LABEL)) throw new Error("不正なステータスです");
    const result = await changeReferralStatus(user, id, status);
    if (result === "blocked") redirect(`/referrals/${id}?blocked=${status}`);
  });
}

/** ベンダーMTG実施後に「ピックアップ受付」の案件をまとめて「紹介先に打診中」へ進める */
export async function advanceToContactingAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const user = await assertUser();
    const ids = formData
      .getAll("ids")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) throw new Error("進める紹介案件を選んでください");
    let done = 0;
    let blocked = 0;
    for (const id of ids) {
      const r = await prisma.referral.findUnique({ where: { id }, select: { status: true } });
      if (!r || r.status !== "RECEIVED") continue; // 他の人が先に進めた場合などは触らない
      const result = await changeReferralStatus(user, id, "CONTACTING");
      if (result === "ok") done++;
      if (result === "blocked") blocked++;
    }
    revalidatePath("/meetings", "layout");
    if (blocked > 0 && done === 0) throw new Error("ベンダーの「MTG状態」が実施済になっていないため進められません。ベンダー詳細でMTG状態を実施済にしてください。");
    return { notice: `${done} 件を「紹介先に打診中」へ進めました${blocked ? `（${blocked} 件はベンダーMTG未実施のため保留）` : ""}` };
  });
}

export async function forceUnlockAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const admin = await assertAdmin();
    const id = Number(formData.get("id"));
    const reason = str(formData.get("reason"));
    const r = await prisma.referral.findUniqueOrThrow({ where: { id } });
    await prisma.$transaction(async (tx) => {
      await tx.referral.update({ where: { id }, data: { forceUnlocked: true, forceUnlockReason: reason } });
      await recordHistory(tx, {
        entityType: "REFERRAL",
        entityId: id,
        field: "forceUnlocked",
        fromValue: "false",
        toValue: "true",
        note: reason ?? "ベンダーMTG未実施のブロックを強制解除",
        changedById: admin.id,
      });
    });
    revalidateReferral(id, r.vendorId, r.contactId);
  });
}

// ---------- 報酬 ----------

export async function approveRewardAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const admin = await assertAdmin();
    const id = Number(formData.get("id"));
    const r = await prisma.referral.findUniqueOrThrow({ where: { id } });
    if (r.rewardStatus !== "APPLIED") throw new Error("計上申請中の報酬のみ承認できます");
    if (r.rewardUndetermined || r.rewardAmount <= 0) throw new Error("報酬額が未定です。紹介案件で金額を入力してから承認してください");
    await prisma.$transaction(async (tx) => {
      await tx.referral.update({ where: { id }, data: { rewardStatus: "APPROVED", rewardApprovedAt: new Date() } });
      await recordHistory(tx, {
        entityType: "REFERRAL",
        entityId: id,
        field: "rewardStatus",
        fromValue: "APPLIED",
        toValue: "APPROVED",
        changedById: admin.id,
      });
    });
    revalidateReferral(id, r.vendorId, r.contactId);
  });
}

/** 報酬ステータスの変更（承認済→請求済→入金済 など）。承認は管理者のみ。 */
export async function setRewardStatusAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const user = await assertUser();
    const id = Number(formData.get("id"));
    const status = String(formData.get("status")) as RewardStatus;
    if (!(status in REWARD_LABEL)) throw new Error("不正なステータスです");
    const r = await prisma.referral.findUniqueOrThrow({ where: { id } });
    if (r.rewardStatus === status) return;
    if ((status === "APPROVED" || (r.rewardStatus === "APPROVED" && status === "APPLIED")) && user.role !== "ADMIN") {
      throw new Error("報酬の承認・取消は管理者のみ行えます");
    }
    // 承認を飛ばした請求・入金は管理者のみ（商談担当者が「計上申請」から直接「請求済」「入金済」へ進めない）
    if ((status === "INVOICED" || status === "PAID") && (r.rewardStatus === "UNFIXED" || r.rewardStatus === "APPLIED") && user.role !== "ADMIN") {
      throw new Error("管理者の承認（計上確定）が済んでいないため、請求済・入金済にはできません");
    }
    // 単価が未定（または0円）の報酬は、承認・請求・入金のいずれにも進められない
    if ((status === "APPROVED" || status === "INVOICED" || status === "PAID") && (r.rewardUndetermined || r.rewardAmount <= 0)) {
      throw new Error("報酬額が未定です。紹介案件で金額を入力してから進めてください");
    }
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.referral.update({
        where: { id },
        data: {
          rewardStatus: status,
          // 管理者が承認を飛ばして請求済・入金済にした場合も、月次の計上集計に載るよう承認日時を入れる
          ...((status === "APPROVED" || status === "INVOICED" || status === "PAID") && !r.rewardApprovedAt ? { rewardApprovedAt: now } : {}),
          ...(status === "INVOICED" && !r.invoicedAt ? { invoicedAt: now } : {}),
          ...(status === "PAID" && !r.paidAt ? { paidAt: now } : {}),
        },
      });
      await recordHistory(tx, {
        entityType: "REFERRAL",
        entityId: id,
        field: "rewardStatus",
        fromValue: r.rewardStatus,
        toValue: status,
        changedById: user.id,
      });
    });
    revalidateReferral(id, r.vendorId, r.contactId);
  });
}

export async function saveRewardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertUser();
    const id = Number(formData.get("id"));
    const r = await prisma.referral.findUniqueOrThrow({ where: { id } });
    await prisma.referral.update({
      where: { id },
      data: {
        rewardAmount: formData.get("rewardUndetermined") === "on" ? 0 : money(formData.get("rewardAmount"), r.rewardAmount),
        rewardUndetermined: formData.get("rewardUndetermined") === "on",
        invoicedAt: parseDateInput(formData.get("invoicedAt")),
        paymentDueAt: parseDateInput(formData.get("paymentDueAt")),
        paidAt: parseDateInput(formData.get("paidAt")),
      },
    });
    revalidateReferral(id, r.vendorId, r.contactId);
    return { success: "保存しました" };
  } catch (e) {
    return errorState(e);
  }
}
