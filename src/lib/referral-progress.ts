import type { Prisma, PrismaClient } from "@prisma/client";
import { recordHistory } from "./history";

/** 面談の日程が決まった（面談日時が入った・面談確定・面談実施済）なら、先方も人事も OK したということ */
export function isScheduled(r: { meetingAt: Date | null; status: string }) {
  return !!r.meetingAt || r.status === "MEETING_CONFIRMED" || r.status === "MEETING_DONE";
}

/**
 * 日程が決まった紹介案件の「先方の回答」「人事の回答」を、確認待ちなら OK にする（NG は触らない）。
 * 面談日時の入力・ステータス変更・登録/編集のあとに呼ぶ。
 */
export async function approveByProgress(db: Prisma.TransactionClient | PrismaClient, id: number, changedById: number | null) {
  const r = await db.referral.findUnique({ where: { id }, select: { meetingAt: true, status: true, vendorApproval: true, contactApproval: true } });
  if (!r || !isScheduled(r)) return;
  const data: Prisma.ReferralUpdateInput = {};
  if (r.vendorApproval === "PENDING") data.vendorApproval = "OK";
  if (r.contactApproval === "PENDING") data.contactApproval = "OK";
  if (!Object.keys(data).length) return;
  await db.referral.update({ where: { id }, data });
  for (const field of ["vendorApproval", "contactApproval"] as const) {
    if (!data[field]) continue;
    await recordHistory(db, { entityType: "REFERRAL", entityId: id, field, fromValue: "PENDING", toValue: "OK", note: "面談の日程が決まったため自動で OK", changedById });
  }
}
