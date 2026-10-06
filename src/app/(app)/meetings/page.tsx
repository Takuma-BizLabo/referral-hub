import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { StatusSelect } from "@/components/StatusSelect";
import { VendorChips, VendorTag } from "@/components/VendorTag";
import { CountChips } from "@/components/CountChips";
import { FilterPanel } from "@/components/FilterPanel";
import { APPROVAL_LABEL, EXECUTION_LABEL, EXECUTION_ORDER, FORMAT_LABEL } from "@/lib/labels";
import { cn, fmtDate, fmtDateTime } from "@/lib/utils";
import { formatTargetAmount, formatTargetsTotal, meetingTargets } from "@/lib/meeting-targets";
import { proposedCompaniesByVendor } from "@/lib/saleshub/proposed";
import { setExecutionStatusAction } from "./actions";
import type { ApprovalStatus, ExecutionStatus, Prisma } from "@prisma/client";

export const metadata = { title: "ベンダーMTG" };

type SP = { view?: string; assignee?: string; approval?: string; execution?: string; vendor?: string; q?: string };

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const view = sp.view === "kanban" ? "kanban" : "list";
  const where: Prisma.VendorMeetingWhereInput = {
    ...(sp.assignee ? { assigneeId: Number(sp.assignee) } : {}),
    ...(sp.approval ? { approvalStatus: sp.approval as ApprovalStatus } : {}),
    ...(sp.execution ? { executionStatus: sp.execution as ExecutionStatus } : {}),
    ...(sp.vendor ? { vendorId: Number(sp.vendor) } : {}),
    ...(sp.q ? { vendor: { name: { contains: sp.q, mode: "insensitive" } } } : {}),
  };
  const proposedByVendor = await proposedCompaniesByVendor();
  const [meetings, users, vendors, allForCounts] = await Promise.all([
    prisma.vendorMeeting.findMany({
      where,
      include: { vendor: { include: { referrals: { include: { contact: true } } } }, assignee: true },
      orderBy: [{ scheduledAt: "asc" }, { id: "desc" }],
      take: 500,
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.vendorMeeting.findMany({
      where: { ...where, vendorId: undefined, executionStatus: undefined },
      select: { vendorId: true, executionStatus: true, approvalStatus: true },
    }),
  ]);
  const vendorCounts: Record<number, number> = {};
  for (const m of allForCounts) vendorCounts[m.vendorId] = (vendorCounts[m.vendorId] ?? 0) + 1;
  const execCounts: Record<string, number> = {};
  for (const m of allForCounts.filter((x) => !sp.vendor || x.vendorId === Number(sp.vendor))) execCounts[m.executionStatus] = (execCounts[m.executionStatus] ?? 0) + 1;
  const linkWith = (patch: Record<string, string | undefined>) => {
    const o: Record<string, string> = { ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v) as [string, string][]), view };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete o[k];
      else o[k] = v;
    }
    return `/meetings?${new URLSearchParams(o)}`;
  };
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "view") as [string, string][]);
  const withView = (v: string) => `/meetings?${new URLSearchParams({ ...Object.fromEntries(qs), view: v })}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetsOf = (m: (typeof meetings)[number]) => meetingTargets(m.requestNote, m.vendor.referrals, proposedByVendor[m.vendor.id] ?? [], m.fee ?? m.vendor.referralFee);

  return (
    <div>
      <PageHeader
        title="ベンダーMTG"
        description="商談担当者がベンダーと行う事前MTG"
        actions={
          <>
            <Link href="/meetings/calendar" className="btn-secondary">
              カレンダー
            </Link>
            <Link href="/meetings/new" className="btn-primary">
              + MTG登録
            </Link>
          </>
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
        items={EXECUTION_ORDER.map((s) => ({ value: s, label: EXECUTION_LABEL[s], count: execCounts[s] ?? 0, href: linkWith({ execution: s, view: "list" }) }))}
        active={sp.execution}
        totalLabel="全件"
        total={Object.values(execCounts).reduce((a, b) => a + b, 0)}
        allHref={linkWith({ execution: undefined })}
      />
      <FilterPanel activeCount={[sp.q, sp.assignee, sp.approval, sp.execution, sp.vendor].filter(Boolean).length}>
      <form className="card p-3 mb-3 flex flex-wrap gap-2 items-end">
        <input type="hidden" name="view" value={view} />
        <div className="min-w-40">
          <label className="label">ベンダー名</label>
          <input name="q" defaultValue={sp.q} className="input" />
        </div>
        <div>
          <label className="label">担当</label>
          <select name="assignee" defaultValue={sp.assignee ?? ""} className="input">
            <option value="">すべて</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">承認</label>
          <select name="approval" defaultValue={sp.approval ?? ""} className="input">
            <option value="">すべて</option>
            {(Object.keys(APPROVAL_LABEL) as ApprovalStatus[]).map((s) => (
              <option key={s} value={s}>
                {APPROVAL_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        {view === "list" && (
          <div>
            <label className="label">実施</label>
            <select name="execution" defaultValue={sp.execution ?? ""} className="input">
              <option value="">すべて</option>
              {EXECUTION_ORDER.map((s) => (
                <option key={s} value={s}>
                  {EXECUTION_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        )}
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
        <button className="btn-secondary">絞り込む</button>
        <Link href={`/meetings?view=${view}`} className="btn-secondary">
          クリア
        </Link>
      </form>
      </FilterPanel>

      {view === "list" ? (
        meetings.length === 0 ? (
          <div className="card">
            <EmptyState message="該当するMTGがありません" />
          </div>
        ) : (
          <>
            {/* スマホ: カード表示 */}
            <ul className="md:hidden space-y-2">
              {meetings.map((m) => {
                const overdue = m.nextActionDue && m.nextActionDue < today && m.executionStatus !== "CANCELLED";
                const targets = targetsOf(m);
                return (
                  <li key={m.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/meetings/${m.id}`} className="min-w-0">
                        <VendorTag id={m.vendor.id} name={m.vendor.name} link={false} />
                        <div className="text-sm font-medium text-blue-700 mt-1">{m.scheduledAt ? fmtDateTime(m.scheduledAt) : "日時未定"}</div>
                      </Link>
                      <Badge value={m.approvalStatus} label={APPROVAL_LABEL[m.approvalStatus]} />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {m.assignee.name} ／ {FORMAT_LABEL[m.format]} ／ 単価{" "}
                      <span className={cn("font-medium text-gray-800", targets.some((t) => t.amount === null) && "text-amber-700")}>{formatTargetsTotal(targets, m.fee ?? m.vendor.referralFee)}</span>
                    </div>
                    {targets.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {targets.map((t) => (
                          <span key={t.name} className={cn("badge", t.amount === null ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-indigo-50 text-indigo-800 border-indigo-200")}>
                            {t.name} ({formatTargetAmount(t.amount)})
                          </span>
                        ))}
                      </div>
                    )}
                    {m.nextAction && (
                      <div className="text-xs text-gray-600 mt-1.5 line-clamp-2">
                        次: {m.nextAction}
                        {m.nextActionDue && <span className={cn("ml-1", overdue && "text-rose-600 font-medium")}>（{fmtDate(m.nextActionDue)}）</span>}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">実施</span>
                      <StatusSelect action={setExecutionStatusAction} id={m.id} value={m.executionStatus} options={EXECUTION_ORDER.map((s) => ({ value: s, label: EXECUTION_LABEL[s] }))} />
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
                    <th>日時</th>
                    <th>ベンダー</th>
                    <th className="text-right">単価</th>
                    <th>お繋ぎ先</th>
                    <th>担当</th>
                    <th>形式</th>
                    <th>承認</th>
                    <th>実施</th>
                    <th>次アクション</th>
                    <th>期限</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((m) => {
                    const overdue = m.nextActionDue && m.nextActionDue < today && m.executionStatus !== "CANCELLED";
                    const targets = targetsOf(m);
                    return (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap">
                          <Link href={`/meetings/${m.id}`} className="text-blue-700 hover:underline">
                            {m.scheduledAt ? fmtDateTime(m.scheduledAt) : "日時未定"}
                          </Link>
                        </td>
                        <td>
                          <VendorTag id={m.vendor.id} name={m.vendor.name} />
                        </td>
                        <td className={cn("text-right whitespace-nowrap font-medium", targets.some((t) => t.amount === null) && "text-amber-700")}>
                          {formatTargetsTotal(targets, m.fee ?? m.vendor.referralFee)}
                        </td>
                        <td className="max-w-sm">
                          {targets.length ? (
                            <div className="flex flex-wrap gap-1">
                              {targets.map((t) => (
                                <span key={t.name} className={cn("badge", t.amount === null ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-indigo-50 text-indigo-800 border-indigo-200")}>
                                  {t.name}
                                  <span className="ml-1 font-normal opacity-80">({formatTargetAmount(t.amount)})</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">未定</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">{m.assignee.name}</td>
                        <td className="whitespace-nowrap">{FORMAT_LABEL[m.format]}</td>
                        <td>
                          <Badge value={m.approvalStatus} label={APPROVAL_LABEL[m.approvalStatus]} />
                        </td>
                        <td>
                          <StatusSelect
                            action={setExecutionStatusAction}
                            id={m.id}
                            value={m.executionStatus}
                            options={EXECUTION_ORDER.map((s) => ({ value: s, label: EXECUTION_LABEL[s] }))}
                          />
                        </td>
                        <td className="text-gray-600 max-w-xs truncate">{m.nextAction ?? "-"}</td>
                        <td className={cn("whitespace-nowrap", overdue && "text-rose-600 font-medium")}>{fmtDate(m.nextActionDue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-5 overflow-x-auto">
          {EXECUTION_ORDER.map((status) => {
            const items = meetings.filter((m) => m.executionStatus === status);
            return (
              <div key={status} className="card bg-gray-50 min-w-56">
                <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                  <Badge value={status} label={EXECUTION_LABEL[status]} />
                  <span className="text-xs text-gray-500">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-24">
                  {items.map((m) => (
                    <div key={m.id} className="card p-2.5 text-sm shadow-sm">
                      <Link href={`/meetings/${m.id}`} className="block">
                        <VendorTag id={m.vendor.id} name={m.vendor.name} link={false} />
                      </Link>
                      <div className="text-xs text-gray-500 mt-1">{m.scheduledAt ? fmtDateTime(m.scheduledAt) : "日時未定"}</div>
                      {(() => {
                        const targets = targetsOf(m);
                        return (
                          <>
                            <div className="text-xs text-gray-500">
                              {m.assignee.name} ／ {FORMAT_LABEL[m.format]} ／ 合計 {formatTargetsTotal(targets, m.fee ?? m.vendor.referralFee)}
                            </div>
                            {targets.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {targets.map((t) => (
                                  <span key={t.name} className={cn("badge", t.amount === null ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-indigo-50 text-indigo-800 border-indigo-200")}>
                                    {t.name} ({formatTargetAmount(t.amount)})
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <div className="flex items-center justify-between mt-2 gap-1">
                        <Badge value={m.approvalStatus} label={APPROVAL_LABEL[m.approvalStatus]} />
                        <StatusSelect
                          action={setExecutionStatusAction}
                          id={m.id}
                          value={m.executionStatus}
                          options={EXECUTION_ORDER.map((s) => ({ value: s, label: EXECUTION_LABEL[s] }))}
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
