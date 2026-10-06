import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, PageHeader } from "@/components/ui";
import { EXECUTION_LABEL, REFERRAL_LABEL } from "@/lib/labels";
import { cn, fmtDateTime, fmtReward, fmtYen } from "@/lib/utils";
import { proposedCompaniesForVendor } from "@/lib/saleshub/proposed";
import { threadCandidates } from "@/lib/saleshub/candidates";
import { MarkThreadRead } from "./MarkRead";

export default async function SaleshubThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const threadId = Number(id);
  if (!Number.isInteger(threadId)) notFound();
  const t = await prisma.saleshubThread.findUnique({ where: { id: threadId }, include: { messages: { orderBy: { sentAt: "asc" } } } });
  if (!t) notFound();
  const [meeting, vendor, referrals, proposed, unread] = await Promise.all([
    t.importedMeetingId ? prisma.vendorMeeting.findUnique({ where: { id: t.importedMeetingId }, include: { assignee: true } }) : null,
    t.vendorId ? prisma.vendor.findUnique({ where: { id: t.vendorId } }) : null,
    t.vendorId ? prisma.referral.findMany({ where: { vendorId: t.vendorId }, include: { contact: true }, orderBy: { id: "desc" } }) : [],
    t.vendorId ? proposedCompaniesForVendor(t.vendorId) : [],
    prisma.notification.count({ where: { userId: user.id, readAt: null, type: "SALESHUB_MESSAGE", linkUrl: `/saleshub/${t.id}` } }),
  ]);
  const fee = t.fee ?? (vendor && vendor.referralFee > 0 ? vendor.referralFee : null);
  // 会社名の照合用（有効な繋がりのみ。件数は数百件程度の想定）
  const contacts = await prisma.contact.findMany({ where: { isActive: true, company: { not: null } }, select: { id: true, name: true, company: true, title: true } });
  const candidates = threadCandidates(t, t.messages, proposed, fee, contacts, referrals);
  const lastVendorMsg = [...t.messages].reverse().find((m) => !m.isMine);
  const awaitingReply = !!t.messages.length && !t.messages[t.messages.length - 1].isMine;
  const taskTitle = `${t.vendorName} のセールスハブに返信`;

  return (
    <div className="space-y-4">
      {unread > 0 && <MarkThreadRead threadId={t.id} />}
      <PageHeader
        title={t.vendorName}
        description={t.requestTitle ?? undefined}
        actions={
          <>
            <a href={`https://saleshub.jp/proposals/${t.proposalId}`} target="_blank" rel="noreferrer" className="btn-secondary">
              セールスハブで開く
            </a>
            <Link href={`/tasks?link=${encodeURIComponent(`/saleshub/${t.id}`)}&title=${encodeURIComponent(taskTitle)}`} className="btn-secondary">
              タスクを依頼
            </Link>
            {t.vendorId ? (
              <Link href={`/referrals/new?vendorId=${t.vendorId}${fee ? `&reward=${fee}` : ""}`} className="btn-secondary">
                + 紹介案件を作る
              </Link>
            ) : null}
            <Link href={`/import/saleshub?thread=${t.id}`} className="btn-secondary">
              取込画面へ
            </Link>
            {meeting ? (
              <Link href={`/meetings/${meeting.id}`} className="btn-primary">
                ベンダーMTGを見る
              </Link>
            ) : (
              <Link href={`/meetings/new?vendorId=${t.vendorId ?? ""}`} className="btn-primary">
                + MTG登録
              </Link>
            )}
          </>
        }
      />
      {awaitingReply && lastVendorMsg && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          ベンダーからの最新メッセージ（{fmtDateTime(lastVendorMsg.sentAt)}）にまだ返信していません。
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="チャット" className="lg:col-span-2">
          <div className="space-y-3">
            {t.messages.map((m) => (
              <div key={m.id} className={cn("flex", m.isMine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm", m.isMine ? "bg-blue-50 border border-blue-100" : "bg-gray-50 border border-gray-200")}>
                  <div className="text-[11px] text-gray-500 mb-1">
                    {m.senderName}
                    {m.isMine ? "（自分）" : ""} ・ {fmtDateTime(m.sentAt)}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                </div>
              </div>
            ))}
            {t.messages.length === 0 && <p className="text-sm text-gray-400">メッセージ本文はまだ取り込まれていません</p>}
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="お繋ぎ先候補と単価">
            {candidates.length === 0 ? (
              <p className="text-sm text-gray-500">チャットから会社名は見つかっていません。</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {candidates.map((c) => (
                  <li key={c.company} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium break-words">{c.company}</div>
                        <div className="text-xs text-gray-500">
                          {c.source === "mine" ? "こちらが提示" : "ベンダーが言及"}
                          {c.dept ? ` ・ ${c.dept}` : ""}
                        </div>
                      </div>
                      <span className={cn("whitespace-nowrap font-semibold", c.fee === null && "text-amber-700")}>{c.fee === null ? "未定" : fmtYen(c.fee)}</span>
                    </div>
                    {c.referrals.length > 0 ? (
                      <div className="mt-1.5 space-y-1">
                        {c.referrals.map((r) => (
                          <Link key={r.id} href={`/referrals/${r.id}`} className="flex items-center gap-1.5 text-xs text-blue-700 hover:underline">
                            <Badge value={r.status} label={REFERRAL_LABEL[r.status]} />
                            紹介案件 #{r.id}（{fmtReward(r.rewardAmount, r.rewardUndetermined)}）
                          </Link>
                        ))}
                      </div>
                    ) : c.contacts.length > 0 && t.vendorId ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.contacts.map((ct) => (
                          <Link
                            key={ct.id}
                            href={`/referrals/new?vendorId=${t.vendorId}&contactId=${ct.id}${c.fee === null ? "&undetermined=1" : `&reward=${c.fee}`}&note=${encodeURIComponent(`${c.company}${c.dept ? " / " + c.dept : ""}（セールスハブ）`)}`}
                            className="btn-primary btn-sm"
                          >
                            紹介案件を作る：{ct.name}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        繋がりリストに未登録
                        <Link href={`/contacts/new?company=${encodeURIComponent(c.company)}`} className="btn-secondary btn-sm">
                          繋がりを追加
                        </Link>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-gray-500 mt-3">こちらが提示した会社は依頼の単価、ベンダーが途中で挙げた新しい会社は「単価未定」です。</p>
          </Card>
          <Card title="ベンダーMTG">
            {meeting ? (
              <div className="text-sm space-y-1">
                <div>
                  <Badge value={meeting.executionStatus} label={EXECUTION_LABEL[meeting.executionStatus]} />
                </div>
                <div>日時：{meeting.scheduledAt ? fmtDateTime(meeting.scheduledAt) : "未定"}</div>
                <div>担当：{meeting.assignee.name}</div>
                {meeting.place && <div className="break-all text-xs text-gray-600">{meeting.place}</div>}
              </div>
            ) : (
              <p className="text-sm text-gray-500">まだMTGは作成されていません。ベンダーから打ち合わせの依頼が来ると自動で作成されます。</p>
            )}
          </Card>
          <Card title="この依頼の紹介単価（協力金）">
            <div className="text-lg font-semibold">{t.fee ? `¥${t.fee.toLocaleString()}` : <span className="text-sm text-gray-400">次回の同期で取得します</span>}</div>
            <p className="text-xs text-gray-500 mt-1">初回メッセージで提示した人物の紹介案件にこの単価が入ります。ベンダーが途中で挙げた会社は「単価未定」で登録されます。</p>
          </Card>
          <Card title="ベンダー">
            {vendor ? (
              <div className="text-sm">
                <Link href={`/vendors/${vendor.id}`} className="text-blue-700 hover:underline font-medium">
                  {vendor.name}
                </Link>
                <div className="text-xs text-gray-500 mt-1">
                  単価 ¥{vendor.referralFee.toLocaleString()}
                  {vendor.referralFee === 0 ? "（未入力）" : ""}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">未紐付け</p>
            )}
          </Card>
          <Card title={`このベンダーの紹介案件（${referrals.length}）`}>
            {referrals.length === 0 ? (
              <p className="text-sm text-gray-500">なし</p>
            ) : (
              <ul className="text-sm space-y-1.5">
                {referrals.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <Link href={`/referrals/${r.id}`} className="text-blue-700 hover:underline truncate">
                      {r.contact.name}（{r.contact.company}）
                    </Link>
                    <span className="text-xs whitespace-nowrap text-gray-600">
                      {fmtReward(r.rewardAmount, r.rewardUndetermined)} ・ {REFERRAL_LABEL[r.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
