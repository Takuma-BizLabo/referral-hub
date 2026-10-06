import { endOfMonth, parse, startOfMonth } from "date-fns";
import { prisma } from "./db";

export function monthRange(yearMonth: string) {
  const base = parse(yearMonth, "yyyy-MM", new Date());
  return { start: startOfMonth(base), end: endOfMonth(base) };
}

/** 月次の実績（MTG件数・紹介件数・報酬計上/入金） */
export async function monthlyActuals(yearMonth: string) {
  const { start, end } = monthRange(yearMonth);
  const [meetingsByUser, referralCount, accrual, paid] = await Promise.all([
    prisma.vendorMeeting.groupBy({
      by: ["assigneeId"],
      where: { executionStatus: "DONE", doneAt: { gte: start, lte: end } },
      _count: { _all: true },
    }),
    prisma.referral.count({ where: { pickedUpAt: { gte: start, lte: end } } }),
    prisma.referral.aggregate({
      where: { rewardApprovedAt: { gte: start, lte: end }, rewardStatus: { in: ["APPROVED", "INVOICED", "PAID"] } },
      _sum: { rewardAmount: true },
    }),
    prisma.referral.aggregate({
      where: { paidAt: { gte: start, lte: end }, rewardStatus: "PAID" },
      _sum: { rewardAmount: true },
    }),
  ]);
  const meetingsPerUser: Record<number, number> = {};
  for (const g of meetingsByUser) meetingsPerUser[g.assigneeId] = g._count._all;
  return {
    meetingsTotal: meetingsByUser.reduce((a, g) => a + g._count._all, 0),
    meetingsPerUser,
    referralCount,
    rewardAccrual: accrual._sum.rewardAmount ?? 0,
    rewardPaid: paid._sum.rewardAmount ?? 0,
  };
}

export async function monthlyGoals(yearMonth: string) {
  const goals = await prisma.monthlyGoal.findMany({ where: { yearMonth } });
  const overall = goals.find((g) => g.userId === null) ?? null;
  const perUser: Record<number, number> = {};
  for (const g of goals) if (g.userId !== null) perUser[g.userId] = g.meetingTarget;
  return { overall, perUser };
}
