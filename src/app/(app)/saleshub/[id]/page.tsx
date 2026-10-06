import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, PageHeader } from "@/components/ui";
import { EXECUTION_LABEL } from "@/lib/labels";
import { cn, fmtDateTime } from "@/lib/utils";

export default async function SaleshubThreadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const t = await prisma.saleshubThread.findUnique({ where: { id: Number(id) }, include: { messages: { orderBy: { sentAt: "asc" } } } });
  if (!t) notFound();
  const [meeting, vendor, referrals] = await Promise.all([
    t.importedMeetingId ? prisma.vendorMeeting.findUnique({ where: { id: t.importedMeetingId }, include: { assignee: true } }) : null,
    t.vendorId ? prisma.vendor.findUnique({ where: { id: t.vendorId } }) : null,
    t.vendorId ? prisma.referral.findMany({ where: { vendorId: t.vendorId }, include: { contact: true }, orderBy: { id: "desc" } }) : [],
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.vendorName}
        description={t.requestTitle ?? undefined}
        actions={
          <>
            <a href={`https://saleshub.jp/proposals/${t.proposalId}`} target="_blank" rel="noreferrer" className="btn-secondary">
              セールスハブで開く
            </a>
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
          <Card title="ベンダー">
            {vendor ? (
              <div className="text-sm">
                <Link href={`/vendors/${vendor.id}`} className="text-blue-700 hover:underline font-medium">
                  {vendor.name}
                </Link>
                <div className="text-xs text-gray-500 mt-1">単価 ¥{vendor.referralFee.toLocaleString()}{vendor.referralFee === 0 ? "（未入力）" : ""}</div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">未紐付け</p>
            )}
          </Card>
          <Card title={`このベンダーの紹介案件（${referrals.length}）`}>
            {referrals.length === 0 ? (
              <p className="text-sm text-gray-500">なし</p>
            ) : (
              <ul className="text-sm space-y-1">
                {referrals.map((r) => (
                  <li key={r.id}>
                    <Link href={`/referrals/${r.id}`} className="text-blue-700 hover:underline">
                      {r.contact.name}（{r.contact.company}）
                    </Link>
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
