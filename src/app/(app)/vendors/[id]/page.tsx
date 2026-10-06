import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, Description, EmptyState, PageHeader } from "@/components/ui";
import {
  APPROVAL_LABEL,
  EXECUTION_LABEL,
  FORMAT_LABEL,
  REFERRAL_LABEL,
  REWARD_LABEL,
  VENDOR_MEETING_STATUS_LABEL,
} from "@/lib/labels";
import { fmtDateTime, fmtReward, fmtYen } from "@/lib/utils";
import { setVendorMeetingStatusAction, toggleVendorActiveAction } from "../actions";
import { HistoryList } from "@/components/HistoryList";
import { SubmitButton } from "@/components/SubmitButton";
import { idOrNull, idParam } from "@/lib/params";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = idOrNull((await params).id);
  const v = id ? await prisma.vendor.findUnique({ where: { id }, select: { name: true } }) : null;
  return { title: v ? v.name : "ベンダー" };
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({
    where: { id: idParam(id) },
    include: {
      meetings: { include: { assignee: true }, orderBy: [{ scheduledAt: "desc" }, { id: "desc" }] },
      referrals: { include: { contact: true }, orderBy: { id: "desc" } },
    },
  });
  if (!vendor) notFound();
  const notReferredCount = await prisma.contact.count({ where: { isActive: true, referrals: { none: { vendorId: vendor.id } } } });
  const histories = await prisma.statusHistory.findMany({
    where: { entityType: "VENDOR", entityId: vendor.id },
    include: { changedBy: true },
    orderBy: { changedAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={vendor.name}
        description={vendor.isActive ? undefined : "（無効）"}
        actions={
          <>
            <Link href={`/meetings/new?vendorId=${vendor.id}`} className="btn-secondary">
              + MTG登録
            </Link>
            <Link href={`/referrals/new?vendorId=${vendor.id}`} className="btn-secondary">
              + 紹介案件
            </Link>
            <Link href={`/vendors/${vendor.id}/edit`} className="btn-primary">
              編集
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="基本情報" className="lg:col-span-2">
          <Description
            items={[
              { label: "担当者", value: vendor.contactName },
              { label: "紹介報酬単価", value: fmtYen(vendor.referralFee) },
              { label: "メール", value: vendor.contactEmail },
              { label: "電話", value: vendor.contactPhone },
              {
                label: "セールスハブ案件URL",
                value: vendor.saleshubUrl ? (
                  <a href={vendor.saleshubUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline break-all">
                    {vendor.saleshubUrl}
                  </a>
                ) : null,
              },
              { label: "サービス概要", value: vendor.serviceSummary },
              { label: "メモ", value: vendor.memo },
            ]}
          />
        </Card>
        <Card title="ベンダーMTGの状態">
          <div className="flex items-center gap-3 mb-3">
            <Badge value={vendor.meetingStatus} label={VENDOR_MEETING_STATUS_LABEL[vendor.meetingStatus]} className="text-sm px-2 py-1" />
          </div>
          <p className="text-xs text-gray-500 mb-3">
            「実施済」でないと、このベンダーの紹介案件を「紹介先に打診中」以降へ進められません。手動で切り替えます。
          </p>
          <form action={setVendorMeetingStatusAction} className="flex gap-2">
            <input type="hidden" name="id" value={vendor.id} />
            {vendor.meetingStatus === "NOT_DONE" ? (
              <SubmitButton name="status" value="DONE" className="btn-primary">
                実施済にする
              </SubmitButton>
            ) : (
              <SubmitButton name="status" value="NOT_DONE" className="btn-secondary">
                未実施に戻す
              </SubmitButton>
            )}
          </form>
          <form action={toggleVendorActiveAction} className="mt-4 pt-4 border-t border-gray-100">
            <input type="hidden" name="id" value={vendor.id} />
            <SubmitButton className={vendor.isActive ? "btn-danger btn-sm" : "btn-secondary btn-sm"}>
              {vendor.isActive ? "このベンダーを無効にする" : "有効に戻す"}
            </SubmitButton>
          </form>
        </Card>
      </div>

      <Card title={`ベンダーMTG（${vendor.meetings.length}）`}>
        {vendor.meetings.length === 0 ? (
          <EmptyState message="MTGはまだありません" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>担当</th>
                  <th>形式</th>
                  <th>承認</th>
                  <th>実施</th>
                  <th>次アクション</th>
                </tr>
              </thead>
              <tbody>
                {vendor.meetings.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">
                      <Link href={`/meetings/${m.id}`} className="text-blue-700 hover:underline">
                        {m.scheduledAt ? fmtDateTime(m.scheduledAt) : "日時未定"}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{m.assignee.name}</td>
                    <td className="whitespace-nowrap">{FORMAT_LABEL[m.format]}</td>
                    <td>
                      <Badge value={m.approvalStatus} label={APPROVAL_LABEL[m.approvalStatus]} />
                    </td>
                    <td>
                      <Badge value={m.executionStatus} label={EXECUTION_LABEL[m.executionStatus]} />
                    </td>
                    <td className="text-gray-600">{m.nextAction ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title={`紹介案件（${vendor.referrals.length}）`}
        actions={
          <Link href={`/contacts?notVendor=${vendor.id}`} className="text-xs text-blue-700 hover:underline">
            まだ紹介していない繋がり {notReferredCount} 人を見る →
          </Link>
        }
      >
        {vendor.referrals.length === 0 ? (
          <EmptyState message="紹介案件はまだありません" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>紹介先</th>
                  <th>会社</th>
                  <th>ステータス</th>
                  <th>面談日時</th>
                  <th className="text-right">報酬</th>
                  <th>報酬状態</th>
                </tr>
              </thead>
              <tbody>
                {vendor.referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      <Link href={`/referrals/${r.id}`} className="text-blue-700 hover:underline">
                        {r.contact.name}
                      </Link>
                    </td>
                    <td>{r.contact.company ?? "-"}</td>
                    <td>
                      <Badge value={r.status} label={REFERRAL_LABEL[r.status]} />
                    </td>
                    <td className="whitespace-nowrap">{fmtDateTime(r.meetingAt)}</td>
                    <td className="text-right whitespace-nowrap">{fmtReward(r.rewardAmount, r.rewardUndetermined)}</td>
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

      <Card title="変更履歴">
        <HistoryList histories={histories} />
      </Card>
    </div>
  );
}
