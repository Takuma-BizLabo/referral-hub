import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { EXECUTION_LABEL, FORMAT_LABEL } from "@/lib/labels";
import { fmtDate, fmtDateTime, fmtYen } from "@/lib/utils";
import { approveMeetingAction } from "../meetings/actions";
import { approveRewardAction } from "../referrals/actions";
import { RejectForm } from "../meetings/[id]/MeetingControls";

export const metadata = { title: "承認キュー" };

export default async function ApprovalsPage() {
  await requireAdmin();
  const [meetings, rewards] = await Promise.all([
    prisma.vendorMeeting.findMany({
      where: { approvalStatus: "PENDING" },
      include: { vendor: true, assignee: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.referral.findMany({
      where: { rewardStatus: "APPLIED" },
      include: { vendor: true, contact: true },
      orderBy: { meetingDoneAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="承認キュー" description="管理者の承認が必要な項目" />

      <Card title={`ベンダーMTG 承認待ち（${meetings.length}）`}>
        {meetings.length === 0 ? (
          <EmptyState message="承認待ちのMTGはありません" />
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => (
              <div key={m.id} className="border border-gray-200 rounded p-3 grid gap-3 lg:grid-cols-3">
                <div className="lg:col-span-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/meetings/${m.id}`} className="font-medium text-blue-700 hover:underline">
                      {m.vendor.name}
                    </Link>
                    <Badge value={m.executionStatus} label={EXECUTION_LABEL[m.executionStatus]} />
                  </div>
                  <div className="text-gray-600 mt-1">
                    担当：{m.assignee.name} ／ {m.scheduledAt ? fmtDateTime(m.scheduledAt) : "日時未定"} ／ {FORMAT_LABEL[m.format]}
                  </div>
                  {m.place && <div className="text-gray-500 text-xs mt-1 break-all">{m.place}</div>}
                  {m.requestNote && <div className="text-gray-500 text-xs mt-1 whitespace-pre-wrap">{m.requestNote}</div>}
                  <div className="text-gray-400 text-xs mt-1">登録 {fmtDateTime(m.createdAt)}</div>
                </div>
                <div className="space-y-2">
                  <form action={approveMeetingAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="btn-primary w-full">承認する</button>
                  </form>
                  <RejectForm id={m.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`報酬 計上申請（${rewards.length}）`}>
        {rewards.length === 0 ? (
          <EmptyState message="計上申請中の報酬はありません" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>ベンダー</th>
                  <th>紹介先</th>
                  <th>面談実施日</th>
                  <th className="text-right">報酬額</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/referrals/${r.id}`} className="text-blue-700 hover:underline">
                        {r.vendor.name}
                      </Link>
                    </td>
                    <td>
                      {r.contact.name}
                      <span className="text-gray-500 text-xs ml-1">{r.contact.company}</span>
                    </td>
                    <td className="whitespace-nowrap">{fmtDate(r.meetingDoneAt ?? r.meetingAt)}</td>
                    <td className="text-right whitespace-nowrap font-medium">{fmtYen(r.rewardAmount)}</td>
                    <td className="text-right">
                      <form action={approveRewardAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn-primary btn-sm">承認（計上確定）</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
