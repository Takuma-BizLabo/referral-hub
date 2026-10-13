import type { HistoryEntity, Prisma } from "@prisma/client";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function recordHistory(
  tx: Tx,
  params: {
    entityType: HistoryEntity;
    entityId: number;
    field: string;
    fromValue: string | null | undefined;
    toValue: string | null | undefined;
    note?: string | null;
    changedById: number | null;
  },
) {
  if ((params.fromValue ?? null) === (params.toValue ?? null)) return;
  await tx.statusHistory.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      field: params.field,
      fromValue: params.fromValue ?? null,
      toValue: params.toValue ?? null,
      note: params.note ?? null,
      changedById: params.changedById,
    },
  });
}

/**
 * ベンダーMTGが再び動き出した（日程調整中・確定・リスケ、または新しいMTG）とき、
 * 「初回MTGなし」で自動的に「不要」にしたベンダーのMTG状態を「未実施」に戻す。
 * 人が手で「不要」にした場合はそのままにする。
 */
export async function reopenVendorMeetingStatus(tx: Tx, vendorId: number, meetingId: number, changedById: number | null) {
  const v = await tx.vendor.findUnique({ where: { id: vendorId }, select: { meetingStatus: true } });
  if (v?.meetingStatus !== "NOT_REQUIRED") return;
  const last = await tx.statusHistory.findFirst({
    where: { entityType: "VENDOR", entityId: vendorId, field: "meetingStatus" },
    orderBy: { changedAt: "desc" },
  });
  if (!last || last.toValue !== "NOT_REQUIRED" || !last.note?.includes("初回MTGなし")) return;
  await tx.vendor.update({ where: { id: vendorId }, data: { meetingStatus: "NOT_DONE" } });
  await recordHistory(tx, {
    entityType: "VENDOR",
    entityId: vendorId,
    field: "meetingStatus",
    fromValue: "NOT_REQUIRED",
    toValue: "NOT_DONE",
    note: `MTG #${meetingId} が再び進行中になったため`,
    changedById,
  });
}
