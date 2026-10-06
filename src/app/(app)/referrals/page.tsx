import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { StatusSelect } from "@/components/StatusSelect";
import { VendorChips, VendorTag } from "@/components/VendorTag";
import { CountChips } from "@/components/CountChips";
import { FilterPanel } from "@/components/FilterPanel";
import { REFERRAL_LABEL, REFERRAL_ORDER, REWARD_LABEL, REWARD_ORDER } from "@/lib/labels";
import { cn, fmtDate, fmtDateTime, fmtReward } from "@/lib/utils";
import { setReferralStatusAction } from "./actions";
import type { Prisma, ReferralStatus, RewardStatus } from "@prisma/client";

export const metadata = { title: "紹介案件" };

type SP = { view?: string; vendor?: string; status?: string; reward?: string; q?: string; stagnant?: string; sort?: string };

const SORTS: Record<string, { label: string; orderBy: Prisma.ReferralOrderByWithRelationInput[] }> = {
  updated: { label: "ステータス更新が新しい順", orderBy: [{ statusChangedAt: "desc" }] },
  meeting: { label: "面談日時が早い順", orderBy: [{ meetingAt: { sort: "asc", nulls: "last" } }, { statusChangedAt: "desc" }] },
  due: { label: "期限が近い順", orderBy: [{ nextActionDue: { sort: "asc", nulls: "last" } }, { statusChangedAt: "desc" }] },
  picked: { label: "ピックアップが新しい順", orderBy: [{ pickedUpAt: "desc" }, { id: "desc" }] },
  stale: { label: "停滞が長い順", orderBy: [{ statusChangedAt: "asc" }] },
};

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const view = sp.view === "kanban" ? "kanban" : "list";
  const where: Prisma.ReferralWhereInput = {
    ...(sp.vendor ? { vendorId: Number(sp.vendor) } : {}),
    ...(sp.status ? { status: sp.status as ReferralStatus } : {}),
    ...(sp.reward ? { rewardStatus: sp.reward as RewardStatus } : {}),
    ...(sp.q
      ? { contact: { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { company: { contains: sp.q, mode: "insensitive" } }] } }
      : {}),
  };
  const [referrals, vendors, stagnationDays, allForCounts] = await Promise.all([
    prisma.referral.findMany({
      where,
      include: { vendor: true, contact: true },
      orderBy: (SORTS[sp.sort ?? ""] ?? SORTS.updated).orderBy,
      take: 500,
    }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.setting.findUnique({ where: { key: "stagnationDays" } }).then((s) => Number(s?.value ?? 7)),
    prisma.referral.findMany({ where: { ...where, vendorId: undefined, status: undefined }, select: { vendorId: true, status: true } }),
  ]);
  const vendorCounts: Record<number, number> = {};
  for (const r of allForCounts) vendorCounts[r.vendorId] = (vendorCounts[r.vendorId] ?? 0) + 1;
  const statusCounts: Record<string, number> = {};
  for (const r of allForCounts.filter((x) => !sp.vendor || x.vendorId === Number(sp.vendor))) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  const linkWith = (patch: Record<string, string | undefined>) => {
    const o: Record<string, string> = { ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v) as [string, string][]), view };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete o[k];
      else o[k] = v;
    }
    return `/referrals?${new URLSearchParams(o)}`;
  };
  const qs = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "view") as [string, string][]);
  const withView = (v: string) => `/referrals?${new URLSearchParams({ ...qs, view: v })}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const stagnantSince = new Date(Date.now() - stagnationDays * 24 * 60 * 60 * 1000);
  const isStagnant = (r: (typeof referrals)[number]) =>
    !["MEETING_DONE", "DECLINED"].includes(r.status) && r.statusChangedAt < stagnantSince;

  return (
    <div>
      <PageHeader
        title="紹介案件"
        description="ベンダーへの繋がり紹介〜面談〜報酬"
        actions={
          <Link href="/referrals/new" className="btn-primary">
            + 紹介案件登録
          </Link>
        }
      />
      <Tabs
        items={[
          { href: withView("list"), label: "リスト", active: view === "list" },
          { href: withView("kanban"), label: "カンバン", active: view === "kanban" },
        ]}
      />
      <VendorChips
        vendors={vendors.filter((v) => vendorCounts[v.id])}
        counts={vendorCounts}
        activeId={sp.vendor ? Number(sp.vendor) : undefined}
        hrefFor={(id) => linkWith({ vendor: String(id) })}
        total={allForCounts.length}
        allHref={linkWith({ vendor: undefined })}
      />
      <CountChips
        items={REFERRAL_ORDER.map((s) => ({ value: s, label: REFERRAL_LABEL[s], count: statusCounts[s] ?? 0, href: linkWith({ status: s, view: "list" }) }))}
        active={sp.status}
        totalLabel="全件"
        total={Object.values(statusCounts).reduce((a, b) => a + b, 0)}
        allHref={linkWith({ status: undefined })}
      />
      <FilterPanel activeCount={[sp.q, sp.vendor, sp.status, sp.reward].filter(Boolean).length}>
      <form className="card p-3 mb-3 flex flex-wrap gap-2 items-end">
        <input type="hidden" name="view" value={view} />
        <div className="min-w-40">
          <label className="label">紹介先</label>
          <input name="q" defaultValue={sp.q} className="input" placeholder="氏名・会社名" />
        </div>
        <div>
          <label className="label">ベンダー</label>
          <select name="vendor" defaultValue={sp.vendor ?? ""} className="input">
            <option value="">すべて</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        {view === "list" && (
          <div>
            <label className="label">ステータス</label>
            <select name="status" defaultValue={sp.status ?? ""} className="input">
              <option value="">すべて</option>
              {REFERRAL_ORDER.map((s) => (
                <option key={s} value={s}>
                  {REFERRAL_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">報酬</label>
          <select name="reward" defaultValue={sp.reward ?? ""} className="input">
            <option value="">すべて</option>
            {REWARD_ORDER.map((s) => (
              <option key={s} value={s}>
                {REWARD_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">並び順</label>
          <select name="sort" defaultValue={sp.sort ?? "updated"} className="input">
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary">絞り込む</button>
        <Link href={`/referrals?view=${view}`} className="btn-secondary">
          クリア
        </Link>
      </form>
      </FilterPanel>

      {view === "list" ? (
        referrals.length === 0 ? (
          <div className="card">
            <EmptyState message="該当する紹介案件がありません" />
          </div>
        ) : (
          <>
            {/* スマホ: カード表示 */}
            <ul className="md:hidden space-y-2">
              {referrals.map((r) => {
                const overdue = r.nextActionDue && r.nextActionDue < today && !["MEETING_DONE", "DECLINED"].includes(r.status);
                return (
                  <li key={r.id} className={cn("card p-3", isStagnant(r) && "border-amber-300")}>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/referrals/${r.id}`} className="min-w-0">
                        <div className="font-medium text-blue-700 truncate">{r.contact.name}</div>
                        <div className="text-xs text-gray-500 truncate">{r.contact.company}</div>
                      </Link>
                      <span className={cn("text-sm whitespace-nowrap font-medium", r.rewardUndetermined && "text-amber-700")}>{fmtReward(r.rewardAmount, r.rewardUndetermined)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <VendorTag id={r.vendor.id} name={r.vendor.name} />
                      <Badge value={r.rewardStatus} label={`報酬 ${REWARD_LABEL[r.rewardStatus]}`} />
                      {isStagnant(r) && <span className="badge bg-amber-100 text-amber-800 border-amber-200">停滞</span>}
                    </div>
                    {r.meetingAt && <div className="text-xs text-gray-600 mt-1.5">面談 {fmtDateTime(r.meetingAt)}</div>}
                    {r.nextAction && (
                      <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                        次: {r.nextAction}
                        {r.nextActionDue && <span className={cn("ml-1", overdue && "text-rose-600 font-medium")}>（{fmtDate(r.nextActionDue)}）</span>}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">ステータス</span>
                      <StatusSelect action={setReferralStatusAction} id={r.id} value={r.status} options={REFERRAL_ORDER.map((s) => ({ value: s, label: REFERRAL_LABEL[s] }))} />
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
                    <th>紹介先</th>
                    <th>ベンダー</th>
                    <th>ステータス</th>
                    <th>面談日時</th>
                    <th>次アクション</th>
                    <th>期限</th>
                    <th className="text-right">報酬</th>
                    <th>報酬状態</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => {
                    const overdue = r.nextActionDue && r.nextActionDue < today && !["MEETING_DONE", "DECLINED"].includes(r.status);
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">
                          <Link href={`/referrals/${r.id}`} className="text-blue-700 hover:underline font-medium">
                            {r.contact.name}
                          </Link>
                          <div className="text-xs text-gray-500">{r.contact.company}</div>
                        </td>
                        <td>
                          <VendorTag id={r.vendor.id} name={r.vendor.name} />
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <StatusSelect
                              action={setReferralStatusAction}
                              id={r.id}
                              value={r.status}
                              options={REFERRAL_ORDER.map((s) => ({ value: s, label: REFERRAL_LABEL[s] }))}
                            />
                            {isStagnant(r) && (
                              <span className="badge bg-amber-100 text-amber-800 border-amber-200" title={`${stagnationDays}日以上停滞`}>
                                停滞
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap">{fmtDateTime(r.meetingAt)}</td>
                        <td className="text-gray-600 max-w-xs truncate">{r.nextAction ?? "-"}</td>
                        <td className={cn("whitespace-nowrap", overdue && "text-rose-600 font-medium")}>{fmtDate(r.nextActionDue)}</td>
                        <td className={cn("text-right whitespace-nowrap", r.rewardUndetermined && "text-amber-700 font-medium")}>{fmtReward(r.rewardAmount, r.rewardUndetermined)}</td>
                        <td>
                          <Badge value={r.rewardStatus} label={REWARD_LABEL[r.rewardStatus]} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {REFERRAL_ORDER.map((status) => {
            const items = referrals.filter((r) => r.status === status);
            return (
              <div key={status} className="card bg-gray-50">
                <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                  <Badge value={status} label={REFERRAL_LABEL[status]} />
                  <span className="text-xs text-gray-500">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-24">
                  {items.map((r) => (
                    <div key={r.id} className={cn("card p-2.5 text-sm shadow-sm", isStagnant(r) && "border-amber-300")}>
                      <Link href={`/referrals/${r.id}`} className="font-medium text-blue-700 hover:underline block">
                        {r.contact.name}
                      </Link>
                      <div className="text-xs text-gray-500">{r.contact.company}</div>
                      <div className="mt-1">
                        <VendorTag id={r.vendor.id} name={r.vendor.name} link={false} />
                      </div>
                      {r.meetingAt && <div className="text-xs text-gray-500 mt-1">面談 {fmtDateTime(r.meetingAt)}</div>}
                      <div className="flex items-center justify-between mt-2 gap-1">
                        <span className={cn("text-xs", r.rewardUndetermined ? "text-amber-700 font-medium" : "text-gray-600")}>{fmtReward(r.rewardAmount, r.rewardUndetermined)}</span>
                        <StatusSelect
                          action={setReferralStatusAction}
                          id={r.id}
                          value={r.status}
                          options={REFERRAL_ORDER.map((s) => ({ value: s, label: REFERRAL_LABEL[s] }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
