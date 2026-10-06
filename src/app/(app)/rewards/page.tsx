import Link from "next/link";
import { subMonths } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { StatusSelect } from "@/components/StatusSelect";
import { VendorTag } from "@/components/VendorTag";
import { REWARD_LABEL, REWARD_ORDER } from "@/lib/labels";
import { cleanParams } from "@/lib/params";
import { cn, fmtDate, fmtReward, fmtYen, yearMonthOf } from "@/lib/utils";
import { monthRange } from "@/lib/stats";
import { setRewardStatusAction } from "../referrals/actions";
import type { Prisma, RewardStatus } from "@prisma/client";

export const metadata = { title: "報酬管理" };

const SORTS: Record<string, { label: string; orderBy: Prisma.ReferralOrderByWithRelationInput[] }> = {
  updated: { label: "更新順", orderBy: [{ updatedAt: "desc" }] },
  due: { label: "入金予定が近い順", orderBy: [{ paymentDueAt: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }] },
  approved: { label: "承認日が新しい順", orderBy: [{ rewardApprovedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }] },
  done: { label: "面談実施日が新しい順", orderBy: [{ meetingDoneAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }] },
};

export default async function RewardsPage({ searchParams }: { searchParams: Promise<{ status?: string; month?: string; sort?: string }> }) {
  await requireUser();
  const sp = cleanParams(await searchParams, { sort: Object.keys(SORTS) });
  const status = sp.status && Object.hasOwn(REWARD_LABEL, sp.status) ? (sp.status as RewardStatus) : undefined;
  const where: Prisma.ReferralWhereInput = status ? { rewardStatus: status } : { rewardStatus: { not: "UNFIXED" } };
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [rows, counts] = await Promise.all([
    prisma.referral.findMany({
      where,
      include: { vendor: true, contact: true },
      orderBy: (SORTS[sp.sort ?? ""] ?? SORTS.updated).orderBy,
      take: 500,
    }),
    prisma.referral.groupBy({ by: ["rewardStatus"], _count: { _all: true }, _sum: { rewardAmount: true } }),
  ]);

  // 直近6ヶ月の月次集計（対象期間の行を1回で取得してまとめる）
  const months = Array.from({ length: 6 }, (_, i) => yearMonthOf(subMonths(new Date(), i)));
  const windowStart = monthRange(months[months.length - 1]).start;
  const windowRows = await prisma.referral.findMany({
    where: { OR: [{ rewardApprovedAt: { gte: windowStart } }, { paidAt: { gte: windowStart } }, { invoicedAt: { gte: windowStart } }] },
    select: { rewardAmount: true, rewardStatus: true, rewardApprovedAt: true, paidAt: true, invoicedAt: true },
  });
  const agg = (rows: typeof windowRows) => ({ _sum: { rewardAmount: rows.reduce((a, r) => a + r.rewardAmount, 0) }, _count: { _all: rows.length } });
  const summary = months.map((ym) => {
    const { start, end } = monthRange(ym);
    const inMonth = (d: Date | null) => !!d && d >= start && d <= end;
    return {
      ym,
      accrual: agg(windowRows.filter((r) => inMonth(r.rewardApprovedAt) && ["APPROVED", "INVOICED", "PAID"].includes(r.rewardStatus))),
      paid: agg(windowRows.filter((r) => inMonth(r.paidAt) && r.rewardStatus === "PAID")),
      invoiced: agg(windowRows.filter((r) => inMonth(r.invoicedAt))),
    };
  });

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
                <th className="text-right">
                  <span className="md:hidden">計上</span>
                  <span className="hidden md:inline">計上ベース（承認月）</span>
                </th>
                <th className="text-right">
                  <span className="md:hidden">請求</span>
                  <span className="hidden md:inline">請求ベース（請求月）</span>
                </th>
                <th className="text-right">
                  <span className="md:hidden">入金</span>
                  <span className="hidden md:inline">入金ベース（入金月）</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.ym}>
                  <td className="font-medium whitespace-nowrap">{s.ym.replace("-", "/")}</td>
                  <td className="text-right whitespace-nowrap">
                    {fmtYen(s.accrual._sum.rewardAmount ?? 0)} <span className="text-xs text-gray-400">({s.accrual._count._all})</span>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {fmtYen(s.invoiced._sum.rewardAmount ?? 0)} <span className="text-xs text-gray-400">({s.invoiced._count._all})</span>
                  </td>
                  <td className="text-right whitespace-nowrap">
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
            { href: sp.sort ? `/rewards?sort=${sp.sort}` : "/rewards", label: "確定以降すべて", active: !status },
            ...REWARD_ORDER.map((s) => ({ href: `/rewards?status=${s}${sp.sort ? `&sort=${sp.sort}` : ""}`, label: REWARD_LABEL[s], active: status === s })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs">
          <span className="text-gray-500">並び順:</span>
          {Object.entries(SORTS).map(([k, v]) => {
            const active = (sp.sort ?? "updated") === k;
            const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(k !== "updated" ? { sort: k } : {}) }).toString();
            return (
              <Link key={k} href={qs ? `/rewards?${qs}` : "/rewards"} className={cn("chip py-1 text-xs", active && "chip-active")}>
                {v.label}
              </Link>
            );
          })}
        </div>
        {rows.length === 0 ? (
          <div className="card">
            <EmptyState message="該当する報酬はありません" />
          </div>
        ) : (
          <>
            {/* スマホ: カード表示 */}
            <ul className="md:hidden space-y-2">
              {rows.map((r) => {
                const late = r.rewardStatus !== "PAID" && r.paymentDueAt && r.paymentDueAt < today;
                return (
                  <li key={r.id} className={cn("card p-3", late && "border-rose-300")}>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/referrals/${r.id}`} className="min-w-0">
                        <VendorTag id={r.vendor.id} name={r.vendor.name} link={false} />
                        <div className="text-sm mt-1 truncate">
                          {r.contact.name}
                          <span className="text-xs text-gray-500 ml-1">{r.contact.company}</span>
                        </div>
                      </Link>
                      <span className={cn("text-base whitespace-nowrap font-semibold", r.rewardUndetermined && "text-amber-700")}>{fmtReward(r.rewardAmount, r.rewardUndetermined)}</span>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-600 mt-1.5">
                      <div>面談実施 {fmtDate(r.meetingDoneAt)}</div>
                      <div>承認 {fmtDate(r.rewardApprovedAt)}</div>
                      <div>請求 {fmtDate(r.invoicedAt)}</div>
                      <div className={cn(late && "text-rose-600 font-medium")}>
                        入金予定 {fmtDate(r.paymentDueAt)}
                        {late && " 遅延"}
                      </div>
                      <div>入金 {fmtDate(r.paidAt)}</div>
                    </dl>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">状態</span>
                      <StatusSelect action={setRewardStatusAction} id={r.id} value={r.rewardStatus} options={REWARD_ORDER.map((s) => ({ value: s, label: REWARD_LABEL[s] }))} />
                    </div>
                  </li>
                );
              })}
            </ul>
            {/* PC: テーブル表示 */}
            <div className="card overflow-x-auto hidden md:block">
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
                      <td className={cn("text-right whitespace-nowrap font-medium", r.rewardUndetermined && "text-amber-700")}>{fmtReward(r.rewardAmount, r.rewardUndetermined)}</td>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
