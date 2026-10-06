import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, Description, PageHeader } from "@/components/ui";
import { HistoryList } from "@/components/HistoryList";
import { APPROVAL_LABEL, EXECUTION_LABEL, FORMAT_LABEL, VENDOR_MEETING_STATUS_LABEL } from "@/lib/labels";
import { fmtDate, fmtDateTime, fmtReward, fmtYen, toInputDate } from "@/lib/utils";
import { REFERRAL_LABEL } from "@/lib/labels";
import { meetingTargets } from "@/lib/meeting-targets";
import { approveMeetingAction } from "../actions";
import { ExecutionControls, MinutesForm, RejectForm } from "./MeetingControls";

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const m = await prisma.vendorMeeting.findUnique({
    where: { id: Number(id) },
    include: { vendor: { include: { referrals: { include: { contact: true }, orderBy: { id: "desc" } } } }, assignee: true },
  });
  if (!m) notFound();
  const histories = await prisma.statusHistory.findMany({
    where: { entityType: "VENDOR_MEETING", entityId: m.id },
    include: { changedBy: true },
    orderBy: { changedAt: "desc" },
  });
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="space-y-4">
      <PageHeader
        title={`ベンダーMTG：${m.vendor.name}`}
        description={`担当：${m.assignee.name}`}
        actions={
          <Link href={`/meetings/${m.id}/edit`} className="btn-primary">
            編集
          </Link>
        }
      />

      {m.approvalStatus === "REJECTED" && (
        <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="font-medium">差し戻されています</div>
          <div className="mt-1">理由：{m.rejectReason}</div>
          <div className="mt-1 text-xs">内容を修正して「編集 → 保存」すると再申請になります。</div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="MTG情報" className="lg:col-span-2">
          <Description
            items={[
              {
                label: "ベンダー",
                value: (
                  <Link href={`/vendors/${m.vendor.id}`} className="text-blue-700 hover:underline">
                    {m.vendor.name}
                  </Link>
                ),
              },
              { label: "ベンダーMTG状態", value: <Badge value={m.vendor.meetingStatus} label={VENDOR_MEETING_STATUS_LABEL[m.vendor.meetingStatus]} /> },
              { label: "日時", value: m.scheduledAt ? fmtDateTime(m.scheduledAt) : "日時未定" },
              { label: "形式", value: FORMAT_LABEL[m.format] },
              {
                label: "会議URL・場所",
                value: m.place?.startsWith("http") ? (
                  <a href={m.place} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline break-all">
                    {m.place}
                  </a>
                ) : (
                  m.place
                ),
              },
              { label: "承認", value: <Badge value={m.approvalStatus} label={APPROVAL_LABEL[m.approvalStatus]} /> },
              { label: "実施", value: <Badge value={m.executionStatus} label={EXECUTION_LABEL[m.executionStatus]} /> },
              { label: "実施日時", value: m.doneAt ? fmtDateTime(m.doneAt) : null },
              { label: "この依頼の紹介単価（協力金）", value: m.fee !== null ? fmtYen(m.fee) : `${fmtYen(m.vendor.referralFee)}（ベンダー共通）` },
              { label: "ベンダーからの依頼内容", value: m.requestNote },
              { label: "次アクション", value: m.nextAction },
              { label: "期限", value: fmtDate(m.nextActionDue) },
            ]}
          />
        </Card>

        <div className="space-y-4">
          <Card title="お繋ぎ先（この依頼で繋げる人物）">
            {m.vendor.referrals.filter((r) => r.status !== "DECLINED").length > 0 ? (
              <ul className="text-sm space-y-1.5">
                {m.vendor.referrals
                  .filter((r) => r.status !== "DECLINED")
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <Link href={`/referrals/${r.id}`} className="text-blue-700 hover:underline truncate">
                        {r.contact.company ?? "-"}
                        <span className="text-gray-500 text-xs ml-1">{r.contact.name}</span>
                      </Link>
                      <span className="text-xs whitespace-nowrap">
                        {fmtReward(r.rewardAmount, r.rewardUndetermined)} ・ {REFERRAL_LABEL[r.status]}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : meetingTargets(m.requestNote, []).length > 0 ? (
              <div className="text-sm">
                {meetingTargets(m.requestNote, []).map((t) => (
                  <span key={t} className="badge bg-indigo-50 text-indigo-800 border-indigo-200 mr-1">
                    {t}
                  </span>
                ))}
                <p className="text-xs text-gray-500 mt-2">繋がりリストに該当がないため紹介案件は未作成です。</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">まだ候補がありません。</p>
            )}
            <Link href={`/referrals/new?vendorId=${m.vendor.id}`} className="btn-secondary btn-sm mt-3">
              + 紹介案件を追加
            </Link>
          </Card>
          <Card title="実施ステータス">
            <ExecutionControls id={m.id} current={m.executionStatus} vendorDone={m.vendor.meetingStatus === "DONE"} />
          </Card>
          {isAdmin && m.approvalStatus !== "APPROVED" && (
            <Card title="承認（管理者）">
              <form action={approveMeetingAction} className="mb-3">
                <input type="hidden" name="id" value={m.id} />
                <button className="btn-primary w-full">承認する</button>
              </form>
              <RejectForm id={m.id} />
            </Card>
          )}
        </div>
      </div>

      <Card title="議事メモ・次アクション">
        <MinutesForm
          id={m.id}
          minutes={m.minutes ?? ""}
          nextAction={m.nextAction ?? ""}
          nextActionDue={toInputDate(m.nextActionDue)}
        />
      </Card>

      <Card title="変更履歴">
        <HistoryList histories={histories} />
      </Card>
    </div>
  );
}
