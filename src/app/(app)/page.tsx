import Link from "next/link";
import { endOfDay, startOfDay } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState, PageHeader, ProgressBar } from "@/components/ui";
import { VendorTag } from "@/components/VendorTag";
import { TaskCard } from "@/components/TaskCard";
import { REFERRAL_LABEL } from "@/lib/labels";
import { monthlyActuals, monthlyGoals } from "@/lib/stats";
import { getSettingNumber } from "@/lib/settings";
import { fmtDate, fmtMonthDay, fmtYen, yearMonthOf } from "@/lib/utils";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { error } = await searchParams;
  const isAdmin = user.role === "ADMIN";
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const ym = yearMonthOf(now);
  const stagnationDays = await getSettingNumber("stagnationDays");
  const stagnantSince = new Date(Date.now() - stagnationDays * 86400000);

  const [todayMeetings, todayReferralMeetings, overdueMeetings, overdueReferrals, pendingCount, rejectedMine, minutesMissing, stagnant, lateP, goals, actuals, users] =
    await Promise.all([
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
        where: { nextActionDue: { lt: dayStart }, executionStatus: { notIn: ["CANCELLED"] }, nextAction: { not: null } },
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
        ? Promise.all([
            prisma.vendorMeeting.count({ where: { approvalStatus: "PENDING" } }),
            prisma.referral.count({ where: { rewardStatus: "APPLIED" } }),
          ]).then(([a, b]) => a + b)
        : Promise.resolve(0),
      prisma.vendorMeeting.findMany({ where: { approvalStatus: "REJECTED", assigneeId: user.id }, include: { vendor: true } }),
      prisma.vendorMeeting.findMany({
        where: { executionStatus: "DONE", minutes: null, ...(isAdmin ? {} : { assigneeId: user.id }) },
        include: { vendor: true, assignee: true },
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
    ]);

  const myTasks = await prisma.task.findMany({
    where: { assigneeId: user.id, status: "OPEN" },
    include: { requester: true, assignee: true },
    orderBy: [{ important: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: 5,
  });
  const myTaskCount = await prisma.task.count({ where: { assigneeId: user.id, status: "OPEN" } });
  const todoCount = myTaskCount + todayMeetings.length + todayReferralMeetings.length + overdueMeetings.length + overdueReferrals.length + rejectedMine.length + minutesMissing.length;

  return (
    <div className="space-y-4">
      <PageHeader title="ダッシュボード" description={`${fmtDate(now)} ／ ${user.name} さん`} />
      {error === "forbidden" && <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">その画面は管理者のみ利用できます。</div>}

      {myTaskCount > 0 && (
        <section className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-rose-900">あなた宛の未完了タスク {myTaskCount} 件</h2>
            <Link href="/tasks" className="btn-dark btn-sm">
              タスク一覧へ
            </Link>
          </div>
          <div className="space-y-2">
            {myTasks.map((t) => (
              <TaskCard key={t.id} task={t} meId={user.id} isAdmin={isAdmin} />
            ))}
          </div>
        </section>
      )}

      <div className="card flex flex-wrap overflow-x-auto">
        <Kpi label="今日やること" value={todoCount} sub="タスク・予定・期限切れ・差し戻し" accent={todoCount > 0 ? "text-rose-600" : undefined} />
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
        <Card title="今日の予定">
          {todayMeetings.length + todayReferralMeetings.length === 0 ? (
            <EmptyState message="今日の予定はありません" />
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {todayMeetings.map((m) => (
                <li key={`m${m.id}`} className="py-2 flex items-center gap-3">
                  <span className="text-gray-500 w-14 shrink-0">{fmtMonthDay(m.scheduledAt).split(" ")[1]}</span>
                  <Badge value="CONFIRMED" label="MTG" />
                  <Link href={`/meetings/${m.id}`} className="flex-1 truncate">
                    <VendorTag id={m.vendor.id} name={m.vendor.name} link={false} />
                  </Link>
                  <span className="text-xs text-gray-500">{m.assignee.name}</span>
                </li>
              ))}
              {todayReferralMeetings.map((r) => (
                <li key={`r${r.id}`} className="py-2 flex items-center gap-3">
                  <span className="text-gray-500 w-14 shrink-0">{fmtMonthDay(r.meetingAt).split(" ")[1]}</span>
                  <Badge value="MEETING_CONFIRMED" label="面談" />
                  <Link href={`/referrals/${r.id}`} className="flex-1 truncate text-blue-700 hover:underline">
                    <VendorTag id={r.vendor.id} name={r.vendor.name} link={false} className="mr-1" />
                    {r.contact.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="期限切れ・要対応">
          {overdueMeetings.length + overdueReferrals.length + rejectedMine.length + minutesMissing.length === 0 ? (
            <EmptyState message="対応が必要な項目はありません" />
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {rejectedMine.map((m) => (
                <li key={`rj${m.id}`} className="py-2 flex items-center gap-2">
                  <Badge value="REJECTED" label="差し戻し" />
                  <Link href={`/meetings/${m.id}`} className="text-blue-700 hover:underline flex-1 truncate">
                    {m.vendor.name}：{m.rejectReason}
                  </Link>
                </li>
              ))}
              {minutesMissing.map((m) => (
                <li key={`mm${m.id}`} className="py-2 flex items-center gap-2">
                  <Badge value="PENDING" label="メモ未入力" />
                  <Link href={`/meetings/${m.id}`} className="text-blue-700 hover:underline flex-1 truncate">
                    {m.vendor.name} のMTG議事メモ
                  </Link>
                  <span className="text-xs text-gray-500">{m.assignee.name}</span>
                </li>
              ))}
              {overdueMeetings.map((m) => (
                <li key={`om${m.id}`} className="py-2 flex items-center gap-2">
                  <Badge value="REJECTED" label={fmtDate(m.nextActionDue)} />
                  <Link href={`/meetings/${m.id}`} className="text-blue-700 hover:underline flex-1 truncate">
                    [MTG] {m.vendor.name}：{m.nextAction}
                  </Link>
                </li>
              ))}
              {overdueReferrals.map((r) => (
                <li key={`or${r.id}`} className="py-2 flex items-center gap-2">
                  <Badge value="REJECTED" label={fmtDate(r.nextActionDue)} />
                  <Link href={`/referrals/${r.id}`} className="text-blue-700 hover:underline flex-1 truncate">
                    [紹介] {r.contact.name} × {r.vendor.name}：{r.nextAction}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

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
