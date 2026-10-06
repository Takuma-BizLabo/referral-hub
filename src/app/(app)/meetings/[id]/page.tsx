import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, Description, PageHeader } from "@/components/ui";
import { HistoryList } from "@/components/HistoryList";
import { APPROVAL_LABEL, EXECUTION_LABEL, FORMAT_LABEL, VENDOR_MEETING_STATUS_LABEL } from "@/lib/labels";
import { cn, fmtDate, fmtDateTime, fmtReward, fmtYen, toInputDate } from "@/lib/utils";
import { REFERRAL_LABEL } from "@/lib/labels";
import { formatTargetAmount, formatTargetsTotal, meetingTargets } from "@/lib/meeting-targets";
import { proposedCompaniesForVendor } from "@/lib/saleshub/proposed";
import { approveMeetingAction } from "../actions";
import { advanceToContactingAction } from "../../referrals/actions";
import { setVendorMeetingStatusAction } from "../../vendors/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ExecutionControls, MinutesForm, RejectForm } from "./MeetingControls";
import { idOrNull, idParam } from "@/lib/params";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = idOrNull((await params).id);
  const m = id ? await prisma.vendorMeeting.findUnique({ where: { id }, select: { vendor: { select: { name: true } } } }) : null;
  return { title: m ? `MTG：${m.vendor.name}` : "ベンダーMTG" };
}

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const m = await prisma.vendorMeeting.findUnique({
    where: { id: idParam(id) },
    include: { vendor: { include: { referrals: { include: { contact: true }, orderBy: { id: "desc" } } } }, assignee: true },
  });
  if (!m) notFound();
  const proposed = (await proposedCompaniesForVendor(m.vendor.id)).map((c) => c.company);
  const targets = meetingTargets(m.requestNote, m.vendor.referrals, proposed, m.fee ?? m.vendor.referralFee);
  const histories = await prisma.statusHistory.findMany({
    where: { entityType: "VENDOR_MEETING", entityId: m.id },
    include: { changedBy: true },
    orderBy: { changedAt: "desc" },
  });
  const isAdmin = user.role === "ADMIN";
  const receivedReferrals = m.vendor.referrals.filter((r) => r.status === "RECEIVED");

  return (
    <div className="space-y-4">
      <PageHeader
        title={`ベンダーMTG：${m.vendor.name}`}
        description={`担当：${m.assignee.name}`}
        actions={
          <>
            <Link href={`/tasks?link=${encodeURIComponent(`/meetings/${m.id}`)}`} className="btn-secondary">
              タスクを依頼
            </Link>
            <Link href={`/meetings/${m.id}/edit`} className="btn-primary">
              編集
            </Link>
          </>
        }
      />

      {m.approvalStatus === "REJECTED" && (
        <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="font-medium">差し戻されています</div>
          <div className="mt-1">理由：{m.rejectReason}</div>
          <div className="mt-1 text-xs">内容を修正して「編集 → 保存」すると再申請になります。</div>
        </div>
      )}

      {m.executionStatus === "DONE" && receivedReferrals.length > 0 && (
        <section className="rounded-xl border-2 border-blue-200 bg-blue-50/60 p-4">
          <h2 className="font-semibold text-blue-950">次のステップ：ピックアップ受付の紹介案件を「紹介先に打診中」へ</h2>
          <p className="text-xs text-blue-900/80 mt-1">MTGが実施済になりました。このベンダーの「ピックアップ受付」の案件 {receivedReferrals.length} 件を、紹介先への打診に進められます。</p>
          {m.vendor.meetingStatus !== "DONE" && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex flex-wrap items-center gap-2">
              <span className="flex-1 min-w-48">ベンダーの「MTG状態」が未実施のため、このままでは打診中へ進められません。</span>
              <form action={setVendorMeetingStatusAction}>
                <input type="hidden" name="id" value={m.vendor.id} />
                <input type="hidden" name="status" value="DONE" />
                <SubmitButton className="btn-secondary btn-sm">ベンダーのMTG状態を実施済にする</SubmitButton>
              </form>
            </div>
          )}
          <form action={advanceToContactingAction} className="mt-3 space-y-2">
            <ul className="divide-y divide-blue-100 rounded-lg border border-blue-100 bg-white">
              {receivedReferrals.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <label className="flex items-center gap-2 min-w-0 flex-1">
                    <input type="checkbox" name="ids" value={r.id} defaultChecked />
                    <span className="truncate">
                      {r.contact.company ?? "-"}
                      <span className="text-xs text-gray-500 ml-1">{r.contact.name}</span>
                    </span>
                  </label>
                  <span className={cn("text-xs whitespace-nowrap", r.rewardUndetermined && "text-amber-700 font-medium")}>{fmtReward(r.rewardAmount, r.rewardUndetermined)}</span>
                  <Link href={`/referrals/${r.id}`} className="text-xs text-blue-700 hover:underline whitespace-nowrap">
                    詳細
                  </Link>
                </li>
              ))}
            </ul>
            <SubmitButton className="btn-primary" pendingText="更新中..." disabled={m.vendor.meetingStatus !== "DONE"}>
              選んだ案件を「紹介先に打診中」へ進める
            </SubmitButton>
          </form>
        </section>
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
              { label: "お繋ぎ先の合計単価", value: formatTargetsTotal(targets, m.fee ?? m.vendor.referralFee) },
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
            ) : targets.length > 0 ? (
              <div className="text-sm">
                {targets.map((t) => (
                  <span key={t.name} className="badge bg-indigo-50 text-indigo-800 border-indigo-200 mr-1">
                    {t.name} ({formatTargetAmount(t.amount)})
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
                <SubmitButton className="btn-primary w-full">承認する</SubmitButton>
              </form>
              <RejectForm id={m.id} />
            </Card>
          )}
        </div>
      </div>

      <div id="minutes" className="scroll-mt-16">
        <Card title="議事メモ・次アクション">
          <MinutesForm
            id={m.id}
            minutes={m.minutes ?? ""}
            nextAction={m.nextAction ?? ""}
            nextActionDue={toInputDate(m.nextActionDue)}
          />
        </Card>
      </div>

      <Card title="変更履歴">
        <HistoryList histories={histories} />
      </Card>
    </div>
  );
}
