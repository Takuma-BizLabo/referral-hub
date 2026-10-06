import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, Description, EmptyState, PageHeader } from "@/components/ui";
import { REFERRAL_LABEL, REWARD_LABEL } from "@/lib/labels";
import { fmtDate, fmtDateTime, fmtYen } from "@/lib/utils";
import { toggleContactActiveAction } from "../actions";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id: Number(id) },
    include: {
      tags: { include: { tag: true } },
      referrals: { include: { vendor: true }, orderBy: { id: "desc" } },
    },
  });
  if (!contact) notFound();

  return (
    <div className="space-y-4">
      <PageHeader
        title={contact.name}
        description={[contact.company, contact.title].filter(Boolean).join(" / ") + (contact.isActive ? "" : "（無効）")}
        actions={
          <>
            <Link href={`/referrals/new?contactId=${contact.id}`} className="btn-secondary">
              + この人を紹介
            </Link>
            <Link href={`/contacts/${contact.id}/edit`} className="btn-primary">
              編集
            </Link>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="基本情報" className="lg:col-span-2">
          <Description
            items={[
              { label: "会社名", value: contact.company },
              { label: "役職", value: contact.title },
              { label: "業種", value: contact.industry },
              { label: "従業員規模", value: contact.employeeSize },
              { label: "地域", value: contact.region },
              { label: "セールスハブ登録", value: contact.isOnSaleshub ? "登録済" : "未登録" },
              { label: "メール", value: contact.email },
              { label: "電話", value: contact.phone },
              { label: "その他連絡先", value: contact.otherContact },
              {
                label: "タグ",
                value: contact.tags.length ? (
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((t) => (
                      <span key={t.tagId} className="badge bg-gray-100 text-gray-600 border-gray-200">
                        {t.tag.name}
                      </span>
                    ))}
                  </div>
                ) : null,
              },
              { label: "関係性メモ", value: contact.relationMemo },
              { label: "登録日", value: fmtDate(contact.createdAt) },
            ]}
          />
        </Card>
        <Card title="操作">
          <form action={toggleContactActiveAction}>
            <input type="hidden" name="id" value={contact.id} />
            <button className={contact.isActive ? "btn-danger btn-sm" : "btn-secondary btn-sm"}>
              {contact.isActive ? "この繋がりを無効にする" : "有効に戻す"}
            </button>
          </form>
        </Card>
      </div>

      <Card title={`紹介履歴（${contact.referrals.length}）`}>
        {contact.referrals.length === 0 ? (
          <EmptyState message="紹介履歴はありません" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>ベンダー</th>
                  <th>ピックアップ日</th>
                  <th>ステータス</th>
                  <th>面談日時</th>
                  <th className="text-right">報酬</th>
                  <th>報酬状態</th>
                </tr>
              </thead>
              <tbody>
                {contact.referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      <Link href={`/referrals/${r.id}`} className="text-blue-700 hover:underline">
                        {r.vendor.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{fmtDate(r.pickedUpAt)}</td>
                    <td>
                      <Badge value={r.status} label={REFERRAL_LABEL[r.status]} />
                    </td>
                    <td className="whitespace-nowrap">{fmtDateTime(r.meetingAt)}</td>
                    <td className="text-right whitespace-nowrap">{fmtYen(r.rewardAmount)}</td>
                    <td>
                      <Badge value={r.rewardStatus} label={REWARD_LABEL[r.rewardStatus]} />
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
