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
