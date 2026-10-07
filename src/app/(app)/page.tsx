import Link from "next/link";
import { endOfDay, startOfDay } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState, PageHeader, ProgressBar } from "@/components/ui";
import { CompleteTaskForm } from "@/components/TaskControls";
import { completeTaskAction } from "./tasks/actions";
import { EXECUTION_LABEL, REFERRAL_LABEL } from "@/lib/labels";
import { monthlyActuals, monthlyGoals } from "@/lib/stats";
import { getSettingNumber } from "@/lib/settings";
import { cn, fmtDate, fmtMonthDay, fmtYen, yearMonthOf } from "@/lib/utils";

export const metadata = { title: "ダッシュボード" };

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const ym = yearMonthOf(now);
  const stagnationDays = await getSettingNumber("stagnationDays");
  const stagnantSince = new Date(Date.now() - stagnationDays * 86400000);

  const [
    todayMeetings,
    todayReferralMeetings,
    overdueMeetings,
    overdueReferrals,
    pendingCounts,
    rejectedMine,
    minutesMissing,
    stagnant,
    lateP,
    goals,
    actuals,
    users,
    myTasks,
    saleshubUnread,
  ] = await Promise.all([
    prisma.vendorMeeting.findMany({
      where: { scheduledAt: { gte: dayStart, lte: dayEnd }, executionStatus: { in: ["SCHEDULING", "CONFIRMED", "RESCHEDULE"] } },
      include: { vendor: true, assignee: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.referral.findMany({
      where: { meetingAt: { gte: dayStart, lte: dayEnd }, status: { in: ["SCHEDULING", "MEETING_CONFIRMED"] } },
      include: { vendor: true, contact: true },
      orderBy: { meetingAt: "asc" },
    }),
    prisma.vendorMeeting.findMany({
      where: { nextActionDue: { lt: dayStart }, executionStatus: { notIn: ["CANCELLED", "NO_MEETING"] }, nextAction: { not: null } },
      include: { vendor: true, assignee: true },
      orderBy: { nextActionDue: "asc" },
      take: 20,
    }),
    prisma.referral.findMany({
      where: { nextActionDue: { lt: dayStart }, status: { notIn: ["MEETING_DONE", "DECLINED"] }, nextAction: { not: null } },
      include: { vendor: true, contact: true },
      orderBy: { nextActionDue: "asc" },
      take: 20,
    }),
    isAdmin
      ? Promise.all([prisma.vendorMeeting.count({ where: { approvalStatus: "PENDING" } }), prisma.referral.count({ where: { rewardStatus: "APPLIED" } })])
      : Promise.resolve([0, 0] as const),
    prisma.vendorMeeting.findMany({ where: { approvalStatus: "REJECTED", assigneeId: user.id }, include: { vendor: true } }),
    prisma.vendorMeeting.findMany({
      where: { executionStatus: "DONE", minutes: null, ...(isAdmin ? {} : { assigneeId: user.id }) },
      include: { vendor: true, assignee: true },
      orderBy: { doneAt: "asc" },
      take: 10,
    }),
    prisma.referral.findMany({
      where: { status: { notIn: ["MEETING_DONE", "DECLINED"] }, statusChangedAt: { lt: stagnantSince } },
      include: { vendor: true, contact: true },
      orderBy: { statusChangedAt: "asc" },
      take: 10,
    }),
    prisma.referral.count({ where: { rewardStatus: { in: ["APPROVED", "INVOICED"] }, paymentDueAt: { lt: dayStart } } }),
    monthlyGoals(ym),
    monthlyActuals(ym),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.task.findMany({
      where: { assigneeId: user.id, status: "OPEN" },
      include: { requester: true, assignee: true },
      orderBy: [{ important: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    // セールスハブの未読通知（スレッド単位にまとめる）
    prisma.notification.findMany({
      where: { userId: user.id, readAt: null, type: "SALESHUB_MESSAGE" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true, body: true, linkUrl: true, createdAt: true },
    }),
  ]);
  const pendingCount = pendingCounts[0] + pendingCounts[1];
  const myTaskCount = myTasks.length;

  // ---- 今日やること（優先順の1本のリスト） ----
  const items: TodoItem[] = [];
  for (const t of myTasks) {
    const overdue = !!t.dueDate && t.dueDate < dayStart;
    const dueToday = !!t.dueDate && t.dueDate >= dayStart && t.dueDate <= dayEnd;
    items.push({
      key: `t${t.id}`,
      priority: t.important || overdue ? 1 : dueToday ? 3 : 6,
      kind: t.important ? "重要タスク" : overdue ? "期限超過タスク" : "タスク",
      tone: t.important || overdue ? "rose" : "blue",
      title: t.title,
      sub: `${t.requester.name} から${t.dueDate ? ` ・ 期限 ${fmtDate(t.dueDate)}` : ""}${t.body ? ` ・ ${t.body.slice(0, 60)}` : ""}`,
      href: t.linkUrl ?? `/tasks?focus=${t.id}`,
      openLabel: t.linkUrl ? "関連ページ" : "開く",
      taskId: t.id,
    });
  }
  for (const m of rejectedMine) {
    items.push({ key: `rj${m.id}`, priority: 2, kind: "差し戻し", tone: "rose", title: `${m.vendor.name} のベンダーMTG`, sub: `理由: ${m.rejectReason ?? "-"}`, href: `/meetings/${m.id}/edit`, openLabel: "修正する" });
  }
  for (const m of overdueMeetings) {
    items.push({ key: `om${m.id}`, priority: 2, kind: "期限切れ", tone: "rose", title: `[MTG] ${m.vendor.name}：${m.nextAction}`, sub: `期限 ${fmtDate(m.nextActionDue)} ・ ${m.assignee.name}`, href: `/meetings/${m.id}` });
  }
  for (const r of overdueReferrals) {
    items.push({ key: `or${r.id}`, priority: 2, kind: "期限切れ", tone: "rose", title: `[紹介] ${r.contact.name} × ${r.vendor.name}：${r.nextAction}`, sub: `期限 ${fmtDate(r.nextActionDue)}`, href: `/referrals/${r.id}` });
  }
  for (const m of todayMeetings) {
    items.push({ key: `m${m.id}`, priority: 3, at: m.scheduledAt, kind: "今日のMTG", tone: "sky", title: `${fmtTime(m.scheduledAt)} ${m.vendor.name}`, sub: `${m.assignee.name} ・ ${EXECUTION_LABEL[m.executionStatus]}${m.place ? ` ・ ${m.place}` : ""}`, href: `/meetings/${m.id}` });
  }
  for (const r of todayReferralMeetings) {
    items.push({ key: `r${r.id}`, priority: 3, at: r.meetingAt, kind: "今日の面談", tone: "indigo", title: `${fmtTime(r.meetingAt)} ${r.contact.name} × ${r.vendor.name}`, sub: REFERRAL_LABEL[r.status], href: `/referrals/${r.id}` });
  }
  for (const m of minutesMissing) {
    items.push({ key: `mm${m.id}`, priority: 4, kind: "メモ未入力", tone: "amber", title: `${m.vendor.name} のMTG議事メモ`, sub: `実施 ${fmtDate(m.doneAt)} ・ ${m.assignee.name}`, href: `/meetings/${m.id}#minutes`, openLabel: "入力する" });
  }
  if (isAdmin && pendingCount > 0) {
    items.push({ key: "approvals", priority: 4, kind: "承認待ち", tone: "amber", title: `承認待ちが ${pendingCount} 件あります`, sub: `MTG ${pendingCounts[0]} 件 ・ 報酬計上 ${pendingCounts[1]} 件`, href: "/approvals", openLabel: "承認キューへ" });
  }
  const shGroups = new Map<string, { id: number; title: string; body: string | null; count: number }>();
  for (const n of saleshubUnread) {
    const k = n.linkUrl ?? `n${n.id}`;
    const g = shGroups.get(k);
    if (g) g.count++;
    else shGroups.set(k, { id: n.id, title: n.title, body: n.body, count: 1 });
  }
  for (const [k, g] of shGroups) {
    items.push({ key: `sh${k}`, priority: 5, kind: "セールスハブ新着", tone: "emerald", title: g.title + (g.count > 1 ? `（ほか${g.count - 1}件）` : ""), sub: g.body?.slice(0, 80) ?? "", href: `/notifications/${g.id}/go`, openLabel: "開く" });
  }
  items.sort((a, b) => a.priority - b.priority || (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
  const todoCount = items.length;

  return (
    <div className="space-y-4">
      <PageHeader title="ダッシュボード" description={`${fmtDate(now)} ／ ${user.name} さん`} />


      <TodoList items={items} />

      <div className="card flex flex-wrap overflow-x-auto">
        <Kpi label="今日やること" value={todoCount} sub="下のリストの件数" accent={todoCount > 0 ? "text-rose-600" : undefined} />
        <Kpi label="あなた宛タスク" value={myTaskCount} sub="未完了" href="/tasks" accent={myTaskCount > 0 ? "text-rose-600" : undefined} />
        <Kpi label="今日の予定" value={todayMeetings.length + todayReferralMeetings.length} sub="MTG・面談" href="/meetings/calendar" />
        <Kpi label="期限切れ" value={overdueMeetings.length + overdueReferrals.length} sub="次アクション超過" accent={overdueMeetings.length + overdueReferrals.length > 0 ? "text-rose-600" : undefined} />
        <Kpi label="メモ未入力" value={minutesMissing.length} sub="実施済MTG" accent={minutesMissing.length > 0 ? "text-amber-600" : undefined} />
        <Kpi label="停滞案件" value={stagnant.length} sub={`${stagnationDays}日以上`} accent={stagnant.length > 0 ? "text-amber-600" : undefined} />
        {isAdmin ? (
          <Kpi label="🔒 承認待ち" value={pendingCount} sub="MTG・報酬計上" href="/approvals" accent={pendingCount > 0 ? "text-rose-600" : undefined} />
        ) : (
          <Kpi label="差し戻し" value={rejectedMine.length} sub="修正して再申請" href="/meetings?approval=REJECTED" accent={rejectedMine.length > 0 ? "text-rose-600" : undefined} />
        )}
        <Kpi label="今月のMTG" value={actuals.meetingsTotal} sub={`目標 ${goals.overall?.meetingTarget ?? 0}`} />
        <Kpi label="今月の計上" value={fmtYen(actuals.rewardAccrual)} sub={`入金 ${fmtYen(actuals.rewardPaid)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`今月の目標達成率（${ym.replace("-", "年")}月）`} actions={isAdmin ? <Link href="/goals" className="text-xs text-blue-700 hover:underline">目標を設定</Link> : undefined}>
          <div className="space-y-4 text-sm">
            <div>
              <div className="flex justify-between mb-1">
                <span>ベンダーMTG件数</span>
                <span>
                  {actuals.meetingsTotal} / {goals.overall?.meetingTarget ?? 0}
                </span>
              </div>
              <ProgressBar value={actuals.meetingsTotal} target={goals.overall?.meetingTarget ?? 0} />
            </div>
            {users
              .filter((u) => isAdmin || u.id === user.id)
              .map((u) => (
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
                <span>報酬（計上）</span>
                <span>
                  {fmtYen(actuals.rewardAccrual)} / {fmtYen(goals.overall?.rewardAccrualTarget ?? 0)}
                </span>
              </div>
              <ProgressBar value={actuals.rewardAccrual} target={goals.overall?.rewardAccrualTarget ?? 0} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>報酬（入金）</span>
                <span>
                  {fmtYen(actuals.rewardPaid)} / {fmtYen(goals.overall?.rewardPaidTarget ?? 0)}
                </span>
              </div>
              <ProgressBar value={actuals.rewardPaid} target={goals.overall?.rewardPaidTarget ?? 0} />
            </div>
          </div>
        </Card>

        <Card title={`停滞中の紹介案件（${stagnationDays}日以上）`}>
          {stagnant.length === 0 ? (
            <EmptyState message="停滞している案件はありません" />
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {stagnant.map((r) => (
                <li key={r.id} className="py-2 flex items-center gap-2">
                  <Badge value={r.status} label={REFERRAL_LABEL[r.status]} />
                  <Link href={`/referrals/${r.id}`} className="text-blue-700 hover:underline flex-1 truncate">
                    {r.contact.name} × {r.vendor.name}
                  </Link>
                  <span className="text-xs text-gray-500">{fmtDate(r.statusChangedAt)}〜</span>
                </li>
              ))}
            </ul>
          )}
          {isAdmin && lateP > 0 && (
            <p className="mt-3 text-xs text-rose-600">
              入金予定日を過ぎた未入金が {lateP} 件あります。
              <Link href="/rewards?status=INVOICED" className="underline ml-1">
                報酬管理へ
              </Link>
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, href, accent }: { label: string; value: React.ReactNode; sub?: string; href?: string; accent?: string }) {
  const body = (
    <div className="kpi">
      <div className="text-xs text-gray-500 whitespace-nowrap">{label}</div>
      <div className={`text-2xl font-bold mt-0.5 ${accent ?? "text-gray-900"}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 whitespace-nowrap">{sub}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="hover:bg-gray-50">
      {body}
    </Link>
  ) : (
    body
  );
}

type TodoItem = {
  key: string;
  priority: number; // 小さいほど上
  at?: Date | null;
  kind: string;
  tone: "rose" | "amber" | "sky" | "indigo" | "blue" | "emerald";
  title: string;
  sub?: string;
  href: string;
  openLabel?: string;
  taskId?: number;
};

const TONE: Record<TodoItem["tone"], { badge: string; bar: string }> = {
  rose: { badge: "bg-rose-100 text-rose-800 border-rose-200", bar: "border-l-rose-500" },
  amber: { badge: "bg-amber-100 text-amber-800 border-amber-200", bar: "border-l-amber-400" },
  sky: { badge: "bg-sky-100 text-sky-800 border-sky-200", bar: "border-l-sky-400" },
  indigo: { badge: "bg-indigo-100 text-indigo-800 border-indigo-200", bar: "border-l-indigo-400" },
  blue: { badge: "bg-blue-50 text-blue-800 border-blue-200", bar: "border-l-primary" },
  emerald: { badge: "bg-emerald-100 text-emerald-800 border-emerald-200", bar: "border-l-emerald-400" },
};

function fmtTime(d: Date | null) {
  return d ? fmtMonthDay(d).split(" ")[1] : "";
}

function TodoList({ items }: { items: TodoItem[] }) {
  return (
    <Card title={`今日やること（${items.length}）`} actions={<Link href="/tasks" className="text-xs text-blue-700 hover:underline">タスク一覧へ</Link>}>
      {items.length === 0 ? (
        <EmptyState message="今日やることはありません。おつかれさまです。" />
      ) : (
        <ul className="space-y-2 -mx-1">
          {items.map((it) => {
            const tone = TONE[it.tone];
            return (
              <li key={it.key} className={cn("rounded-lg border border-gray-200 border-l-4 bg-white px-3 py-2.5", tone.bar)}>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-60">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("badge", tone.badge)}>{it.kind}</span>
                      <Link href={it.href} className="font-medium text-gray-900 hover:text-blue-700 hover:underline break-words">
                        {it.title}
                      </Link>
                    </div>
                    {it.sub && <div className="text-xs text-gray-500 mt-1 line-clamp-2 break-all">{it.sub}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {it.taskId && <CompleteTaskForm id={it.taskId} action={completeTaskAction} />}
                    <Link href={it.href} className="btn-secondary btn-sm">
                      {it.openLabel ?? "開く"}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
