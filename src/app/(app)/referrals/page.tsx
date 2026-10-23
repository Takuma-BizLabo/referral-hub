import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { MonthCalendar } from "@/components/MonthCalendar";
import { TodaySchedule } from "@/components/TodaySchedule";
import { StatusSelect } from "@/components/StatusSelect";
import { VendorChips, VendorTag } from "@/components/VendorTag";
import { CountChips } from "@/components/CountChips";
import { FilterPanel } from "@/components/FilterPanel";
import { cleanParams } from "@/lib/params";
import { REFERRAL_LABEL, REFERRAL_ORDER, REWARD_LABEL, REWARD_ORDER } from "@/lib/labels";
import { cn, fmtDate, fmtDateTime, fmtReward, fmtYen, toInputDateTime } from "@/lib/utils";
import { monthKeyJst, monthLabel, referralTotals, totalsByMonth, type TotalsBucket } from "@/lib/referral-totals";
import { setListedEarlyAction, setReferralStatusAction } from "./actions";
import { MeetingAtCell, RewardCell, ThankYouFeeCell } from "./InlineCells";
import { SubmitButton } from "@/components/SubmitButton";
import type { Prisma, ReferralStatus, RewardStatus } from "@prisma/client";

export const metadata = { title: "紹介案件" };

type SP = { view?: string; month?: string; tm?: string; vendor?: string; status?: string; reward?: string; q?: string; stagnant?: string; sort?: string };

const SORTS: Record<string, { label: string; orderBy: Prisma.ReferralOrderByWithRelationInput[] }> = {
  updated: { label: "ステータス更新が新しい順", orderBy: [{ statusChangedAt: "desc" }] },
  meeting: { label: "面談日時が早い順", orderBy: [{ meetingAt: { sort: "asc", nulls: "last" } }, { statusChangedAt: "desc" }] },
  due: { label: "期限が近い順", orderBy: [{ nextActionDue: { sort: "asc", nulls: "last" } }, { statusChangedAt: "desc" }] },
  picked: { label: "ピックアップが新しい順", orderBy: [{ pickedUpAt: "desc" }, { id: "desc" }] },
  stale: { label: "停滞が長い順", orderBy: [{ statusChangedAt: "asc" }] },
};

/**
 * 一覧に出す紹介案件：先方（ベンダー）が OK のもの（人事が確認待ちでも出す）、手動で一覧に追加したもの、
 * 面談日時が入っている・日程調整中以降に進んだもの。
 * それ以外は「先方OK待ちの候補」として畳んで表示する（回答はベンダー詳細のチェックリストで入力）。
 */
const LISTED: Prisma.ReferralWhereInput = {
  // 面談日時が入っている・日程調整より先に進んだ案件は、回答の入力がなくても一覧に出す
  OR: [{ vendorApproval: "OK" }, { listedEarly: true }, { meetingAt: { not: null } }, { status: { in: ["SCHEDULING", "MEETING_CONFIRMED", "MEETING_DONE"] } }],
};

const ANSWER_LABEL = { PENDING: "確認待ち", OK: "OK", NG: "NG" } as const;
function AnswerBadge({ who, value }: { who: string; value: keyof typeof ANSWER_LABEL }) {
  return (
    <span className={cn("badge", value === "OK" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : value === "NG" ? "bg-rose-100 text-rose-800 border-rose-200" : "bg-gray-100 text-gray-600 border-gray-200")}>
      {who} {ANSWER_LABEL[value]}
    </span>
  );
}

function TotalBox({ label, b, tone, note }: { label: string; b: TotalsBucket; tone: string; note: string }) {
  return (
    <div className={cn("rounded-lg border px-4 py-2.5", tone)}>
      <div className="text-xs text-gray-500">
        {label}
        <span className="ml-1 text-[11px] text-gray-400">{note}</span>
      </div>
      <div className="text-xl font-semibold">{fmtYen(b.amount)}</div>
      <div className="text-xs text-gray-500">
        {b.count}件{b.undetermined > 0 && <span className="text-amber-700">（うち金額未定 {b.undetermined}件）</span>}
        {b.thankYou > 0 && <span className="ml-2">謝礼金 {fmtYen(b.thankYou)}</span>}
      </div>
    </div>
  );
}

/** 行の色：紹介見送りはグレーアウト、日程調整中は黄色 */
function rowTone(status: ReferralStatus) {
  if (status === "DECLINED") return "bg-gray-100 opacity-60";
  if (status === "SCHEDULING") return "bg-yellow-50";
  return "";
}

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = cleanParams(await searchParams, {
    vendor: "int",
    status: Object.keys(REFERRAL_LABEL),
    reward: Object.keys(REWARD_LABEL),
    view: ["list", "kanban", "calendar"],
    sort: Object.keys(SORTS),
    stagnant: ["1"],
  });
  const view = sp.view === "kanban" ? "kanban" : sp.view === "calendar" ? "calendar" : "list";
  const where: Prisma.ReferralWhereInput = {
    ...(sp.vendor ? { vendorId: Number(sp.vendor) } : {}),
    ...(sp.status ? { status: sp.status as ReferralStatus } : {}),
    ...(sp.reward ? { rewardStatus: sp.reward as RewardStatus } : {}),
    ...(sp.q
      ? { contact: { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { company: { contains: sp.q, mode: "insensitive" } }] } }
      : {}),
  };
  const [fetched, vendors, stagnationDays, allForCounts, candidateRows] = await Promise.all([
    prisma.referral.findMany({
      where: { AND: [where, LISTED] },
      include: { vendor: true, contact: true },
      orderBy: (SORTS[sp.sort ?? ""] ?? SORTS.updated).orderBy,
      take: 500,
    }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.setting.findUnique({ where: { key: "stagnationDays" } }).then((s) => Number(s?.value ?? 7)),
    prisma.referral.findMany({ where: { AND: [{ ...where, vendorId: undefined, status: undefined }, LISTED] },
      select: { vendorId: true, status: true, rewardStatus: true, rewardAmount: true, rewardUndetermined: true, thankYouFee: true, meetingAt: true },
    }),
    prisma.referral.findMany({
      // 紹介見送りは候補に出さない
      where: { AND: [{ ...where, status: undefined, rewardStatus: undefined }, { NOT: LISTED }, { status: { not: "DECLINED" } }] },
      include: { vendor: { include: { meetings: { where: { executionStatus: { in: ["CONFIRMED", "SCHEDULING", "RESCHEDULE"] } }, orderBy: { scheduledAt: "asc" }, take: 1 } } }, contact: true },
      orderBy: [{ vendorId: "asc" }, { id: "asc" }],
      take: 300,
    }),
  ]);
  // 候補の並び順：ベンダーMTGの日時が決まったもの（新しい順）→ MTG日程調整中 → MTG未設定
  const mtgOf = (r: (typeof candidateRows)[number]) => r.vendor.meetings[0];
  const mtgAt = (r: (typeof candidateRows)[number]) => {
    const m = mtgOf(r);
    return m?.scheduledAt && m.executionStatus === "CONFIRMED" ? m.scheduledAt.getTime() : null;
  };
  const mtgRank = (r: (typeof candidateRows)[number]) => (mtgAt(r) !== null ? 0 : mtgOf(r) ? 1 : 2);
  // ベンダーMTGがキャンセルになった（最新のMTGがキャンセル）ベンダーの候補は出さない
  const latestMeetings = await prisma.vendorMeeting.findMany({
    where: { vendorId: { in: Array.from(new Set(candidateRows.map((r) => r.vendorId))) } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    distinct: ["vendorId"],
    select: { vendorId: true, executionStatus: true },
  });
  const cancelledVendors = new Set(latestMeetings.filter((m) => m.executionStatus === "CANCELLED").map((m) => m.vendorId));
  const candidates = candidateRows.filter((r) => !cancelledVendors.has(r.vendorId)).sort((a, b) => mtgRank(a) - mtgRank(b) || (mtgAt(b) ?? 0) - (mtgAt(a) ?? 0));
  // 並び順：面談日時が決まったものを一番上（日時の新しい順）→ その他（選んだ並び順のまま）→ 紹介見送りを一番下
  const group = (r: (typeof fetched)[number]) => (r.status === "DECLINED" ? 2 : r.meetingAt ? 0 : 1);
  const referrals = fetched
    .map((r, i) => ({ r, i }))
    .sort((a, b) => group(a.r) - group(b.r) || (group(a.r) === 0 ? b.r.meetingAt!.getTime() - a.r.meetingAt!.getTime() : 0) || a.i - b.i)
    .map((x) => x.r);
  const vendorCounts: Record<number, number> = {};
  for (const r of allForCounts) vendorCounts[r.vendorId] = (vendorCounts[r.vendorId] ?? 0) + 1;
  const statusCounts: Record<string, number> = {};
  for (const r of allForCounts.filter((x) => !sp.vendor || x.vendorId === Number(sp.vendor))) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  // 確定・見込みの金額（ベンダーの絞り込みだけ効かせる。ステータスの絞り込みは無視）
  // 確定・見込みは面談日（商談日）の月ごと。tm=YYYY-MM（既定は今月）／none（面談日未定）／all（すべて）
  const totalRows = allForCounts.filter((x) => !sp.vendor || x.vendorId === Number(sp.vendor));
  const byMonth = totalsByMonth(totalRows);
  const thisMonth = monthKeyJst(new Date());
  const tm = sp.tm === "all" || sp.tm === "none" || /^\d{4}-\d{2}$/.test(sp.tm ?? "") ? sp.tm! : thisMonth;
  const totals = tm === "all" ? referralTotals(totalRows) : (byMonth.find((m) => m.key === tm)?.totals ?? referralTotals([]));
  const monthKeys = [...new Set([...byMonth.map((m) => m.key).filter((k) => k !== "none"), thisMonth])].sort();
  const tmHref = (k: string) => linkWith({ tm: k === thisMonth ? undefined : k });
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
      <TodaySchedule />
      <Tabs
        items={[
          { href: withView("list"), label: "リスト", active: view === "list" },
          { href: withView("kanban"), label: "カンバン", active: view === "kanban" },
          { href: `/referrals?view=calendar`, label: "カレンダー", active: view === "calendar" },
        ]}
      />
      {view !== "calendar" && (
        <>
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
  
        {candidates.length > 0 && (
          <details className="card mb-3 border-gray-200 bg-gray-50">
            <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm text-gray-500 select-none">
              <span className="font-medium text-gray-600">先方OK待ちの候補（{candidates.length}件）</span>
              <span className="text-xs">先方がOKになると自動で一覧に表示されます（回答はベンダー詳細で入力）。先に一覧へ出す場合は「一覧に追加」</span>
            </summary>
            <ul className="divide-y divide-gray-200 border-t border-gray-200">
              {candidates.map((r) => {
                const m = r.vendor.meetings[0];
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 text-sm text-gray-500 opacity-70 transition-opacity hover:opacity-100">
                    <Link href={`/referrals/${r.id}`} className="min-w-44 hover:underline">
                      <div className="font-medium text-gray-700">{r.contact.company ?? r.contact.name}</div>
                      {r.contact.company && <div className="text-xs">{r.contact.name}</div>}
                    </Link>
                    <VendorTag id={r.vendor.id} name={r.vendor.name} />
                    <span className="flex gap-1">
                      <AnswerBadge who="先方" value={r.vendorApproval} />
                      <AnswerBadge who="人事" value={r.contactApproval} />
                    </span>
                    <span className="text-xs whitespace-nowrap">
                      {m ? (m.scheduledAt && m.executionStatus === "CONFIRMED" ? `MTG ${fmtDateTime(m.scheduledAt)}` : "MTG日程調整中") : "MTG未設定"}
                    </span>
                    <span className={cn("text-xs", r.rewardUndetermined && "text-amber-700")}>
                      <RewardCell id={r.id} amount={r.rewardAmount} undetermined={r.rewardUndetermined} />
                    </span>
                    <form action={setListedEarlyAction} className="ml-auto">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="listed" value="1" />
                      <SubmitButton className="btn-secondary btn-sm" pendingText="追加中...">
                        ＋ 一覧に追加
                      </SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
        </>
      )}

      {view !== "calendar" && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 text-gray-500">面談日の月：</span>
          {[...monthKeys, ...(byMonth.some((m) => m.key === "none") ? ["none"] : []), "all"].map((k) => (
            <Link key={k} href={tmHref(k)} className={cn("chip", tm === k && "chip-active")}>
              {k === "all" ? "すべて" : monthLabel(k)}
              {k === thisMonth ? "（今月）" : ""}
            </Link>
          ))}
        </div>
      )}
      {view !== "calendar" && (
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <TotalBox label="確定" note="面談実施済・計上申請以降" b={totals.fixed} tone="border-emerald-200 bg-emerald-50/60" />
          <TotalBox label="見込み" note="面談前（紹介見送りを除く）" b={totals.expected} tone="border-amber-200 bg-amber-50/60" />
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
            <div className="text-xs text-gray-500">確定＋見込み</div>
            <div className="text-xl font-semibold">{fmtYen(totals.total)}</div>
            <div className="text-xs text-gray-500">
              {totals.fixed.count + totals.expected.count}件
              {totals.fixed.thankYou + totals.expected.thankYou > 0 && <span className="ml-2">謝礼金 {fmtYen(totals.fixed.thankYou + totals.expected.thankYou)}</span>}
            </div>
          </div>
        </div>
      )}
      {view !== "calendar" && byMonth.length > 0 && (
        <details className="card mb-3">
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-gray-700">月別の内訳（面談日ベース）</summary>
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="table">
              <thead>
                <tr>
                  <th>面談日の月</th>
                  <th className="text-right">確定</th>
                  <th className="text-right">見込み</th>
                  <th className="text-right">確定＋見込み</th>
                  <th className="text-right">件数</th>
                  <th className="text-right">謝礼金</th>
                </tr>
              </thead>
              <tbody>
                {byMonth.map(({ key, totals: t }) => (
                  <tr key={key} className={cn(tm === key && "bg-blue-50/60")}>
                    <td className="whitespace-nowrap">
                      <Link href={tmHref(key)} className="text-blue-700 hover:underline">
                        {monthLabel(key)}
                      </Link>
                    </td>
                    <td className="text-right whitespace-nowrap">{fmtYen(t.fixed.amount)}</td>
                    <td className="text-right whitespace-nowrap">
                      {fmtYen(t.expected.amount)}
                      {t.expected.undetermined > 0 && <span className="ml-1 text-xs text-amber-700">＋未定{t.expected.undetermined}件</span>}
                    </td>
                    <td className="text-right whitespace-nowrap font-semibold">{fmtYen(t.total)}</td>
                    <td className="text-right">{t.fixed.count + t.expected.count}</td>
                    <td className="text-right whitespace-nowrap">{fmtYen(t.fixed.thankYou + t.expected.thankYou)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {view === "calendar" ? (
        <MonthCalendar month={sp.month} monthHref={(m) => `/referrals?view=calendar${m ? `&month=${m}` : ""}`} />
      ) : view === "list" ? (
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
                  <li key={r.id} className={cn("card p-3", isStagnant(r) && "border-amber-300", rowTone(r.status))}>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/referrals/${r.id}`} className="min-w-0">
                        <div className="font-medium text-blue-700 truncate">{r.contact.company ?? r.contact.name}</div>
                        {r.contact.company && <div className="text-xs text-gray-500 truncate">{r.contact.name}</div>}
                      </Link>
                      <span className={cn("text-sm whitespace-nowrap font-medium", r.rewardUndetermined && "text-amber-700")}>
                        <RewardCell id={r.id} amount={r.rewardAmount} undetermined={r.rewardUndetermined} />
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <VendorTag id={r.vendor.id} name={r.vendor.name} />
                      <Badge value={r.rewardStatus} label={`報酬 ${REWARD_LABEL[r.rewardStatus]}`} />
                      {r.contactApproval === "PENDING" && r.status !== "DECLINED" && <AnswerBadge who="人事" value="PENDING" />}
                      {isStagnant(r) && <span className="badge bg-amber-100 text-amber-800 border-amber-200">停滞</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        面談 <MeetingAtCell id={r.id} value={toInputDateTime(r.meetingAt)} display={r.meetingAt ? fmtDateTime(r.meetingAt) : null} />
                      </span>
                      <span className="flex items-center gap-1">
                        謝礼金 <ThankYouFeeCell id={r.id} value={r.thankYouFee} />
                      </span>
                    </div>
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
                    <th className="text-right">謝礼金</th>
                    <th>報酬状態</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => {
                    const overdue = r.nextActionDue && r.nextActionDue < today && !["MEETING_DONE", "DECLINED"].includes(r.status);
                    return (
                      <tr key={r.id} className={rowTone(r.status)}>
                        <td className="whitespace-nowrap">
                          <Link href={`/referrals/${r.id}`} className="text-blue-700 hover:underline font-medium">
                            {r.contact.company ?? r.contact.name}
                          </Link>
                          {r.contact.company && <div className="text-xs text-gray-500">{r.contact.name}</div>}
                          {r.contactApproval === "PENDING" && r.status !== "DECLINED" && (
                            <div className="mt-0.5">
                              <AnswerBadge who="人事" value="PENDING" />
                            </div>
                          )}
                          {r.listedEarly && r.vendorApproval !== "OK" && (
                            <form action={setListedEarlyAction} className="mt-0.5">
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="listed" value="0" />
                              <SubmitButton className="text-[11px] text-gray-400 underline hover:text-gray-700" pendingText="...">
                                先方OK待ちの候補に戻す
                              </SubmitButton>
                            </form>
                          )}
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
                        <td className="whitespace-nowrap">
                          <MeetingAtCell id={r.id} value={toInputDateTime(r.meetingAt)} display={r.meetingAt ? fmtDateTime(r.meetingAt) : null} />
                        </td>
                        <td className="text-gray-600 max-w-xs truncate">{r.nextAction ?? "-"}</td>
                        <td className={cn("whitespace-nowrap", overdue && "text-rose-600 font-medium")}>{fmtDate(r.nextActionDue)}</td>
                        <td className={cn("text-right whitespace-nowrap", r.rewardUndetermined && "text-amber-700 font-medium")}>
                          <RewardCell id={r.id} amount={r.rewardAmount} undetermined={r.rewardUndetermined} />
                        </td>
                        <td className="text-right">
                          <ThankYouFeeCell id={r.id} value={r.thankYouFee} />
                        </td>
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
                    <div key={r.id} className={cn("card p-2.5 text-sm shadow-sm", isStagnant(r) && "border-amber-300", rowTone(r.status))}>
                      <Link href={`/referrals/${r.id}`} className="font-medium text-blue-700 hover:underline block">
                        {r.contact.company ?? r.contact.name}
                      </Link>
                      {r.contact.company && <div className="text-xs text-gray-500">{r.contact.name}</div>}
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
