import Link from "next/link";
import { addMonths, format } from "date-fns";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, PageHeader, ProgressBar } from "@/components/ui";
import { monthlyActuals, monthlyGoals } from "@/lib/stats";
import { fmtYen, yearMonthOf } from "@/lib/utils";
import { GoalsForm } from "./GoalsForm";

export const metadata = { title: "目標設定" };

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const { month } = await searchParams;
  const ym = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : yearMonthOf(new Date());
  const base = new Date(`${ym}-01T00:00:00`);
  const [users, goals, actuals] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    monthlyGoals(ym),
    monthlyActuals(ym),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="目標設定"
        description="月ごとの目標を設定します。ダッシュボードに達成率が表示されます。"
        actions={
          <>
            <Link href={`/goals?month=${format(addMonths(base, -1), "yyyy-MM")}`} className="btn-secondary">
              ← 前月
            </Link>
            <span className="text-sm font-medium px-2">{ym.replace("-", "年")}月</span>
            <Link href={`/goals?month=${format(addMonths(base, 1), "yyyy-MM")}`} className="btn-secondary">
              翌月 →
            </Link>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="目標入力">
          <GoalsForm
            yearMonth={ym}
            overall={goals.overall}
            users={users.map((u) => ({ id: u.id, name: u.name, target: goals.perUser[u.id] ?? 0 }))}
          />
        </Card>
        <Card title="現在の実績">
          <div className="space-y-4 text-sm">
            <div>
              <div className="flex justify-between mb-1">
                <span>ベンダーMTG件数（全体）</span>
                <span>
                  {actuals.meetingsTotal} / {goals.overall?.meetingTarget ?? 0}
                </span>
              </div>
              <ProgressBar value={actuals.meetingsTotal} target={goals.overall?.meetingTarget ?? 0} />
            </div>
            {users.map((u) => (
              <div key={u.id} className="pl-4">
                <div className="flex justify-between mb-1 text-gray-600">
                  <span>└ {u.name}</span>
                  <span>
                    {actuals.meetingsPerUser[u.id] ?? 0} / {goals.perUser[u.id] ?? 0}
                  </span>
                </div>
                <ProgressBar value={actuals.meetingsPerUser[u.id] ?? 0} target={goals.perUser[u.id] ?? 0} />
              </div>
            ))}
            <div>
              <div className="flex justify-between mb-1">
                <span>紹介件数</span>
                <span>
                  {actuals.referralCount} / {goals.overall?.referralTarget ?? 0}
                </span>
              </div>
              <ProgressBar value={actuals.referralCount} target={goals.overall?.referralTarget ?? 0} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>報酬（計上ベース）</span>
                <span>
                  {fmtYen(actuals.rewardAccrual)} / {fmtYen(goals.overall?.rewardAccrualTarget ?? 0)}
                </span>
              </div>
              <ProgressBar value={actuals.rewardAccrual} target={goals.overall?.rewardAccrualTarget ?? 0} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>報酬（入金ベース）</span>
                <span>
                  {fmtYen(actuals.rewardPaid)} / {fmtYen(goals.overall?.rewardPaidTarget ?? 0)}
                </span>
              </div>
              <ProgressBar value={actuals.rewardPaid} target={goals.overall?.rewardPaidTarget ?? 0} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
