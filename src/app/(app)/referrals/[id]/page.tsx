import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, Description, PageHeader } from "@/components/ui";
import { HistoryList } from "@/components/HistoryList";
import { StatusSelect } from "@/components/StatusSelect";
import { FORMAT_LABEL, REFERRAL_LABEL, REFERRAL_ORDER, REWARD_LABEL, REWARD_ORDER, VENDOR_MEETING_STATUS_LABEL } from "@/lib/labels";
import { fmtDate, fmtDateTime, fmtYen, toInputDate } from "@/lib/utils";
import { forceUnlockAction, setReferralStatusAction, setRewardStatusAction } from "../actions";
import { RewardForm } from "./RewardForm";

export default async function ReferralDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blocked?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { blocked } = await searchParams;
  const r = await prisma.referral.findUnique({
    where: { id: Number(id) },
    include: { vendor: { include: { meetings: { where: { executionStatus: "DONE" }, take: 1 } } }, contact: true },
  });
  if (!r) notFound();
  const histories = await prisma.statusHistory.findMany({
    where: { entityType: "REFERRAL", entityId: r.id },
    include: { changedBy: true },
    orderBy: { changedAt: "desc" },
  });
  const isAdmin = user.role === "ADMIN";
  const vendorNotDone = r.vendor.meetingStatus !== "DONE";

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${r.contact.name} × ${r.vendor.name}`}
        description={[r.contact.company, r.contact.title].filter(Boolean).join(" / ")}
        actions={
          <Link href={`/referrals/${r.id}/edit`} className="btn-primary">
            編集
          </Link>
        }
      />

      {blocked && blocked in REFERRAL_LABEL && (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-medium">「{REFERRAL_LABEL[blocked as keyof typeof REFERRAL_LABEL]}」へ進められません</div>
          <div className="mt-1">
            ベンダー「{r.vendor.name}」のMTGが「実施済」になっていません。先に
            <Link href={`/vendors/${r.vendor.id}`} className="underline mx-1">
              ベンダー詳細
            </Link>
            でMTG状態を実施済にしてください。
          </div>
          {isAdmin && (
            <form action={forceUnlockAction} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={r.id} />
              <div className="flex-1 min-w-48">
                <label className="label">強制解除の理由（任意）</label>
                <input name="reason" className="input" />
              </div>
              <button className="btn-danger">管理者権限で強制解除</button>
            </form>
          )}
        </div>
      )}

      {r.forceUnlocked && (
        <div className="rounded border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
          この案件はベンダーMTG未実施のブロックが強制解除されています{r.forceUnlockReason ? `（理由：${r.forceUnlockReason}）` : ""}。
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="案件情報" className="lg:col-span-2">
          <Description
            items={[
              {
                label: "紹介先",
                value: (
                  <Link href={`/contacts/${r.contact.id}`} className="text-blue-700 hover:underline">
                    {r.contact.name}（{r.contact.company ?? "-"}）
                  </Link>
                ),
              },
              {
                label: "ベンダー",
                value: (
                  <span className="flex items-center gap-2">
                    <Link href={`/vendors/${r.vendor.id}`} className="text-blue-700 hover:underline">
                      {r.vendor.name}
                    </Link>
                    <Badge value={r.vendor.meetingStatus} label={`MTG ${VENDOR_MEETING_STATUS_LABEL[r.vendor.meetingStatus]}`} />
                  </span>
                ),
              },
              { label: "ピックアップ日", value: fmtDate(r.pickedUpAt) },
              { label: "ステータス", value: <Badge value={r.status} label={REFERRAL_LABEL[r.status]} /> },
              { label: "ピックアップ内容", value: r.pickupNote },
              { label: "面談日時", value: fmtDateTime(r.meetingAt) },
              { label: "面談形式", value: r.meetingFormat ? FORMAT_LABEL[r.meetingFormat] : null },
              {
                label: "会議URL・場所",
                value: r.meetingPlace?.startsWith("http") ? (
                  <a href={r.meetingPlace} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline break-all">
                    {r.meetingPlace}
                  </a>
                ) : (
                  r.meetingPlace
                ),
              },
              { label: "面談実施日", value: fmtDateTime(r.meetingDoneAt) },
              { label: "面談結果メモ", value: r.meetingResult },
              { label: "次アクション", value: r.nextAction },
              { label: "期限", value: fmtDate(r.nextActionDue) },
              { label: "メモ", value: r.memo },
            ]}
          />
        </Card>

        <div className="space-y-4">
          <Card title="紹介ステータス">
            <StatusSelect
              action={setReferralStatusAction}
              id={r.id}
              value={r.status}
              options={REFERRAL_ORDER.map((s) => ({ value: s, label: REFERRAL_LABEL[s] }))}
              className="input"
            />
            {vendorNotDone && !r.forceUnlocked && (
              <p className="text-xs text-amber-700 mt-2">ベンダーMTGが未実施のため「紹介先に打診中」以降へは進められません。</p>
            )}
            <p className="text-xs text-gray-500 mt-2">「面談実施済」にすると報酬が自動で「計上申請」になります。</p>
          </Card>

          <Card title="報酬">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-semibold">{fmtYen(r.rewardAmount)}</span>
              <Badge value={r.rewardStatus} label={REWARD_LABEL[r.rewardStatus]} />
            </div>
            <StatusSelect
              action={setRewardStatusAction}
              id={r.id}
              value={r.rewardStatus}
              options={REWARD_ORDER.map((s) => ({ value: s, label: REWARD_LABEL[s] }))}
              className="input"
            />
            <p className="text-xs text-gray-500 mt-2">承認は管理者のみ。請求・入金は誰でも更新できます。</p>
          </Card>
        </div>
      </div>

      <Card title="請求・入金">
        <RewardForm
          id={r.id}
          rewardAmount={r.rewardAmount}
          invoicedAt={toInputDate(r.invoicedAt)}
          paymentDueAt={toInputDate(r.paymentDueAt)}
          paidAt={toInputDate(r.paidAt)}
          approvedAt={r.rewardApprovedAt ? fmtDateTime(r.rewardApprovedAt) : null}
        />
      </Card>

      <Card title="変更履歴">
        <HistoryList histories={histories} />
      </Card>
    </div>
  );
}
