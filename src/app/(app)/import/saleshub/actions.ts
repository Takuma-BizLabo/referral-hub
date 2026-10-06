"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/auth";
import { recordHistory } from "@/lib/history";
import { notify, notifyAdmins } from "@/lib/notifications";
import { errorState, type ActionState } from "@/lib/action-state";
import { money, parseDateInput, parseDateTimeInput, str } from "@/lib/utils";
import { normalizeCompanyName, parseSaleshubText, type ParsedSaleshub } from "@/lib/saleshub-parse";
import type { MeetingFormat } from "@prisma/client";

export type MatchedContact = { id: number; name: string; company: string | null; title: string | null; referredBefore: boolean };
export type AnalyzeResult = {
  parsed: ParsedSaleshub;
  vendorMatch: { id: number; name: string; referralFee: number; meetingStatus: string } | null;
  candidateMatches: { company: string; dept: string | null; contacts: MatchedContact[] }[];
};

/** 貼り付けたチャット本文を解析し、既存ベンダー・繋がりと突き合わせる */
export async function analyzeSaleshubAction(text: string): Promise<AnalyzeResult> {
  await assertUser();
  const parsed = parseSaleshubText(text);
  let vendorMatch: AnalyzeResult["vendorMatch"] = null;
  if (parsed.vendorName) {
    const n = normalizeCompanyName(parsed.vendorName);
    const vendors = await prisma.vendor.findMany({ where: { isActive: true } });
    const v = vendors.find((x) => normalizeCompanyName(x.name) === n || normalizeCompanyName(x.name).includes(n) || n.includes(normalizeCompanyName(x.name)));
    if (v) vendorMatch = { id: v.id, name: v.name, referralFee: v.referralFee, meetingStatus: v.meetingStatus };
  }
  const candidateMatches: AnalyzeResult["candidateMatches"] = [];
  for (const c of parsed.candidates) {
    const n = normalizeCompanyName(c.company);
    const contacts = await prisma.contact.findMany({ where: { isActive: true, company: { not: null } }, include: { referrals: vendorMatch ? { where: { vendorId: vendorMatch.id } } : false } });
    const hits = contacts.filter((x) => {
      const cn = normalizeCompanyName(x.company ?? "");
      return cn && (cn === n || cn.includes(n) || n.includes(cn));
    });
    candidateMatches.push({
      company: c.company,
      dept: c.dept,
      contacts: hits.map((h) => ({
        id: h.id,
        name: h.name,
        company: h.company,
        title: h.title,
        referredBefore: Array.isArray((h as unknown as { referrals?: unknown[] }).referrals) && ((h as unknown as { referrals: unknown[] }).referrals.length > 0),
      })),
    });
  }
  return { parsed, vendorMatch, candidateMatches };
}

/** 解析結果を確認したうえで、ベンダー／MTGタスク／紹介案件（候補）をまとめて登録 */
export async function registerSaleshubAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let meetingId: number | null = null;
  try {
    const user = await assertUser();
    const rawText = str(formData.get("rawText")) ?? "";
    const vendorIdRaw = str(formData.get("vendorId"));
    const vendorName = str(formData.get("vendorName"));
    const assigneeId = Number(formData.get("assigneeId"));
    if (!assigneeId) throw new Error("商談担当者を選んでください");

    const result = await prisma.$transaction(async (tx) => {
      // ベンダー
      let vendorId = vendorIdRaw ? Number(vendorIdRaw) : 0;
      if (!vendorId) {
        if (!vendorName) throw new Error("ベンダー名を入力してください");
        const v = await tx.vendor.create({
          data: {
            name: vendorName,
            contactName: str(formData.get("vendorContactName")),
            referralFee: money(formData.get("referralFee")),
            saleshubUrl: str(formData.get("saleshubUrl")),
            serviceSummary: str(formData.get("serviceSummary")),
          },
        });
        vendorId = v.id;
      } else {
        const url = str(formData.get("saleshubUrl"));
        if (url) await tx.vendor.update({ where: { id: vendorId }, data: { saleshubUrl: url } });
      }
      const vendor = await tx.vendor.findUniqueOrThrow({ where: { id: vendorId } });

      // ベンダーMTG（タスク）
      let meeting: { id: number } | null = null;
      if (formData.get("createMeeting") === "on") {
        meeting = await tx.vendorMeeting.create({
          data: {
            vendorId,
            assigneeId,
            scheduledAt: parseDateTimeInput(formData.get("scheduledAt")),
            format: ((str(formData.get("format")) ?? "ONLINE") as MeetingFormat),
            place: str(formData.get("place")),
            nextAction: str(formData.get("nextAction")) ?? "ベンダーと日程調整して確定する",
            nextActionDue: parseDateInput(formData.get("nextActionDue")),
            requestNote: str(formData.get("requestNote")) ?? rawText.slice(0, 2000),
            approvalStatus: "PENDING",
          },
        });
        await recordHistory(tx, {
          entityType: "VENDOR_MEETING",
          entityId: meeting.id,
          field: "approvalStatus",
          fromValue: null,
          toValue: "PENDING",
          note: "セールスハブ取込",
          changedById: user.id,
        });
      }

      // 紹介候補（ピックアップ受付）
      const contactIds = formData.getAll("contactIds").map(Number).filter(Boolean);
      const pickupNote = str(formData.get("pickupNote"));
      const referralIds: number[] = [];
      for (const contactId of contactIds) {
        // 同じベンダー×繋がりの紹介案件が既にあれば作らない（二重送信・再取込での重複防止）
        if (await tx.referral.findFirst({ where: { vendorId, contactId }, select: { id: true } })) continue;
        const r = await tx.referral.create({
          data: { vendorId, contactId, rewardAmount: vendor.referralFee, pickupNote, memo: "セールスハブ取込" },
        });
        await recordHistory(tx, {
          entityType: "REFERRAL",
          entityId: r.id,
          field: "status",
          fromValue: null,
          toValue: "RECEIVED",
          note: "セールスハブ取込",
          changedById: user.id,
        });
        referralIds.push(r.id);
      }
      return { vendor, meeting, referralIds };
    });

    meetingId = result.meeting?.id ?? null;
    if (result.meeting) {
      const m = result.meeting;
      await notifyAdmins({
        type: "APPROVAL_PENDING",
        title: `【承認待ち】${result.vendor.name} のベンダーMTG（セールスハブ取込）`,
        linkUrl: `/meetings/${m.id}`,
      });
      if (assigneeId !== user.id) {
        await notify({
          userId: assigneeId,
          type: "TASK_ASSIGNED",
          title: `【MTG担当】${result.vendor.name} との事前MTGをお願いします`,
          body: str(formData.get("nextAction")) ?? "ベンダーと日程調整して確定してください",
          linkUrl: `/meetings/${m.id}`,
        });
      }
    }
    revalidatePath("/", "layout");
  } catch (e) {
    return errorState(e);
  }
  redirect(meetingId ? `/meetings/${meetingId}` : "/referrals");
}
