import { prisma } from "./db";

/** 同じベンダーの、まとめ先にするMTG（このMTG以外で、キャンセル・初回MTGなし以外。打ち合わせURLがあるもの・日時が新しいものを優先） */
export async function mergeTargetFor(m: { id: number; vendorId: number }) {
  const others = await prisma.vendorMeeting.findMany({
    where: { vendorId: m.vendorId, id: { not: m.id }, executionStatus: { notIn: ["CANCELLED", "NO_MEETING"] } },
    orderBy: [{ scheduledAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
  });
  return others.find((o) => o.place) ?? others[0] ?? null;
}
