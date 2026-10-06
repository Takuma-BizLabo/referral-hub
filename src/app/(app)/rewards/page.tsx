import Link from "next/link";
import { format, subMonths } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { StatusSelect } from "@/components/StatusSelect";
import { VendorTag } from "@/components/VendorTag";
import { REWARD_LABEL, REWARD_ORDER } from "@/lib/labels";
import { cn, fmtDate, fmtYen, yearMonthOf } from "@/lib/utils";
import { monthRange } from "@/lib/stats";
import { setRewardStatusAction } from "../referrals/actions";
import type { Prisma, RewardStatus } from "@prisma/client";

export const metadata = { title: "報酬管理" };

export default async function RewardsPage({ searchParams }: { searchParams: Promise<{ status?: string; month?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const status = sp.status && sp.status in REWARD_LABEL ? (sp.status as RewardStatus) : undefined;
  const where: Prisma.ReferralWhereInput = status ? { rewardStatus: status } : { rewardStatus: { not: "UNFIXED" } };
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [rows, counts] = await Promise.all([
    prisma.referral.findMany({
      where,
      include: { vendor: true, contact: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 500,
    }),
    prisma.referral.groupBy({ by: ["rewardStatus"], _count: { _all: true }, _sum: { rewardAmount: true } }),
  ]);

  // 直近6ヶ月の月次集計
  const months = Array.from({ length: 6 }, (_, i) => yearMonthOf(subMonths(new Date(), i)));
  const summary = await Promise.all(
    months.map(async (ym) => {
      const { start, end } = monthRange(ym);
      const [accrual, paid, invoiced] = await Promise.all([
        prisma.referral.aggregate({
          where: { rewardApprovedAt: { gte: start, lte: end }, rewardStatus: { in: ["APPROVED", "INVOICED", "PAID"] } },
          _sum: { rewardAmount: true },
          _count: { _all: true },
        }),
        prisma.referral.aggregate({ where: { paidAt: { gte: start, lte: end }, rewardStatus: "PAID" }, _sum: { rewardAmount: true }, _count: { _all: true } }),
        prisma.referral.aggregate({ where: { invoicedAt: { gte: start, lte: end } }, _sum: { rewardAmount: true }, _count: { _all: true } }),
      ]);
      return { ym, accrual, paid, invoiced };
    }),
  );

  const countOf = (s: RewardStatus) => counts.find((c) => c.rewardStatus === s);

  return (
    <div className="space-y-4">
      <PageHeader
        title="報酬管理"
        description="紹介報酬の計上・請求・入金状況"
        actions={
          <a href={`/api/rewards/export${status ? `?status=${status}` : ""}`} className="btn-secondary">
            CSV出力
          </a>
        }
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {REWARD_ORDER.map((s) => {
          const c = countOf(s);
          return (
            <Link key={s} href={`/rewards?status=${s}`} className={cn("card px-3 py-2 hover:bg-gray-50", status === s && "ring-2 ring-blue-300")}>
              <div className="text-xs text-gray-500">{REWARD_LABEL[s]}</div>
              <div className="text-lg font-semibold">{fmtYen(c?._sum.rewardAmount ?? 0)}</div>
              <div className="text-xs text-gray-400">{c?._count._all ?? 0} 件</div>
            </Link>
          );
        })}
      </div>

      <Card title="月次集計（直近6ヶ月）">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>月</th>
                <th className="text-right">計上ベース（承認月）</th>
                <th className="text-right">請求ベース（請求月）</th>
                <th className="text-right">入金ベース（入金月）</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.ym}>
                  <td className="font-medium">{s.ym.replace("-", "年")}月</td>
                  <td className="text-right">
                    {fmtYen(s.accrual._sum.rewardAmount ?? 0)} <span className="text-xs text-gray-400">({s.accrual._count._all})</span>
                  </td>
                  <td className="text-right">
                    {fmtYen(s.invoiced._sum.rewardAmount ?? 0)} <span className="text-xs text-gray-400">({s.invoiced._count._all})</span>
                  </td>
                  <td className="text-right">
                    {fmtYen(s.paid._sum.rewardAmount ?? 0)} <span className="text-xs text-gray-400">({s.paid._count._all})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div>
        <Tabs
          items={[
            { href: "/rewards", label: "確定以降すべて", active: !status },
            ...REWARD_ORDER.map((s) => ({ href: `/rewards?status=${s}`, label: REWARD_LABEL[s], active: status === s })),
          ]}
        />
        <div className="card overflow-x-auto">
          {rows.length === 0 ? (
            <EmptyState message="該当する報酬はありません" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ベンダー</th>
                  <th>紹介先</th>
                  <th>面談実施</th>
                  <th className="text-right">報酬額</th>
                  <th>状態</th>
                  <th>承認日</th>
                  <th>請求日</th>
                  <th>入金予定</th>
                  <th>入金日</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const late = r.rewardStatus !== "PAID" && r.paymentDueAt && r.paymentDueAt < today;
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/referrals/${r.id}`}>
                          <VendorTag id={r.vendor.id} name={r.vendor.name} link={false} />
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">
                        {r.contact.name}
                        <div className="text-xs text-gray-500">{r.contact.company}</div>
                      </td>
                      <td className="whitespace-nowrap">{fmtDate(r.meetingDoneAt)}</td>
                      <td className="text-right whitespace-nowrap font-medium">{fmtYen(r.rewardAmount)}</td>
                      <td>
                        <StatusSelect
                          action={setRewardStatusAction}
                          id={r.id}
                          value={r.rewardStatus}
                          options={REWARD_ORDER.map((s) => ({ value: s, label: REWARD_LABEL[s] }))}
                        />
                      </td>
                      <td className="whitespace-nowrap">{fmtDate(r.rewardApprovedAt)}</td>
                      <td className="whitespace-nowrap">{fmtDate(r.invoicedAt)}</td>
                      <td className={cn("whitespace-nowrap", late && "text-rose-600 font-medium")}>
                        {fmtDate(r.paymentDueAt)}
                        {late && <Badge value="REJECTED" label="遅延" className="ml-1" />}
                      </td>
                      <td className="whitespace-nowrap">{fmtDate(r.paidAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
