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
  VENDOR_PROPOSAL_LABEL,
  VENDOR_PROPOSAL_ORDER,
} from "@/lib/labels";
import { StatusSelect } from "@/components/StatusSelect";
import { cn, fmtDateTime, fmtReward, fmtYen } from "@/lib/utils";
import type { VendorApproval } from "@prisma/client";
import { setVendorApprovalAction, setVendorMeetingStatusAction, setVendorProposalStatusAction, toggleVendorActiveAction } from "../actions";
import { ProposePicker } from "./ProposePicker";
import { RewardCell } from "@/app/(app)/referrals/InlineCells";
import { HistoryList } from "@/components/HistoryList";
import { SubmitButton } from "@/components/SubmitButton";
import { idOrNull, idParam } from "@/lib/params";
import { FEE_ROLES, fmtSizeRange, groupFeeTable, parseFeeTable, rewardFor } from "@/lib/fee-table";
import { describeVendorCriteria, hasVendorCriteria, matchVendorCriteria, parseVendorCriteria } from "@/lib/candidates";
import { VendorCriteriaCard } from "./VendorCriteriaCard";
import { CopyBriefPanel } from "@/components/CopyBrief";

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
  const feeGroups = groupFeeTable(parseFeeTable(vendor.feeTable));
  const notReferred = await prisma.contact.findMany({
    where: { isActive: true, referrals: { none: { vendorId: vendor.id } } },
    orderBy: [{ company: "asc" }, { name: "asc" }],
    take: 1000,
  });
  const notReferredCount = notReferred.length;
  // 候補ピックアップ：条件と単価表に合う順（返信なしは各段の最後）
  const criteria = parseVendorCriteria(vendor.criteria);
  const feeRules = parseFeeTable(vendor.feeTable);
  const usesFilter = hasVendorCriteria(criteria) || feeRules.length > 0;
  const LEVEL_RANK = { match: 0, maybe: 1, no: 2 } as const;
  const proposeCandidates = notReferred
    .map((c) => {
      const f = rewardFor(vendor, c);
      const m = matchVendorCriteria(criteria, feeRules, c);
      return {
        id: c.id,
        company: c.company,
        name: c.name,
        title: c.title,
        employeeSize: c.employeeSize,
        fee: fmtReward(f.rewardAmount, f.rewardUndetermined),
        level: m.level,
        notes: [...(m.setName && m.level !== "no" ? [`${m.setName}に合う`] : []), ...(m.level === "no" ? m.ng : m.level === "maybe" ? m.check : m.ok)],
        noReply: c.noReply,
      };
    })
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || Number(a.noReply) - Number(b.noReply));
  // 提案した人事のチェックリスト：確認待ち（どちらか）→ 両方OK → NG の順
  const rank = (r: (typeof vendor.referrals)[number]) =>
    r.vendorApproval === "NG" || r.contactApproval === "NG" ? 2 : r.vendorApproval === "OK" && r.contactApproval === "OK" ? 1 : 0;
  const proposals = [...vendor.referrals].sort((a, b) => rank(a) - rank(b));
  const approvalCount = (side: "vendor" | "contact", a: VendorApproval) =>
    vendor.referrals.filter((r) => (side === "vendor" ? r.vendorApproval : r.contactApproval) === a).length;
  const bothOk = vendor.referrals.filter((r) => r.vendorApproval === "OK" && r.contactApproval === "OK").length;
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

      {vendor.meetingStatus === "DONE" && (
        <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <span className="text-sm font-semibold text-gray-800">提案状況</span>
          <StatusSelect
            action={setVendorProposalStatusAction}
            id={vendor.id}
            value={vendor.proposalStatus}
            options={VENDOR_PROPOSAL_ORDER.map((p) => ({ value: p, label: VENDOR_PROPOSAL_LABEL[p] }))}
            className="input text-sm py-1 w-auto"
          />
          <span className="text-xs text-gray-500">MTG後、人事の提案を始める前は「提案前」、会社情報を送って回答待ちは「提案中」、提案し終えたら「提案済み」</span>
        </div>
      )}

      <VendorCriteriaCard vendorId={vendor.id} criteria={criteria} />

      <Card
        title={`ベンダーに提案した人事（${vendor.referrals.length}）`}
        actions={
          <Link href={`/contacts?notVendor=${vendor.id}`} className="text-xs text-blue-700 hover:underline">
            まだ紹介していない繋がり {notReferredCount} 人を見る →
          </Link>
        }
      >
        <p className="text-xs text-gray-500 mb-3">
          セールスハブのチャットで会社情報を送り、先方が繋いでほしい相手を選んだら「先方の回答」を OK に、人事に打診して了承をもらったら「人事の回答」を OK にします。先方が OK になると紹介案件の一覧に表示されます（人事が確認待ちの間も表示。どちらかが NG なら紹介見送り）。
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="text-gray-500">先方</span>
            <span className="badge bg-gray-100 text-gray-700 border-gray-200">確認待ち {approvalCount("vendor", "PENDING")}</span>
            <span className="badge bg-emerald-100 text-emerald-800 border-emerald-200">✓ OK {approvalCount("vendor", "OK")}</span>
            <span className="badge bg-rose-100 text-rose-800 border-rose-200">✗ NG {approvalCount("vendor", "NG")}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-gray-500">人事</span>
            <span className="badge bg-gray-100 text-gray-700 border-gray-200">確認待ち {approvalCount("contact", "PENDING")}</span>
            <span className="badge bg-emerald-100 text-emerald-800 border-emerald-200">✓ OK {approvalCount("contact", "OK")}</span>
            <span className="badge bg-rose-100 text-rose-800 border-rose-200">✗ NG {approvalCount("contact", "NG")}</span>
          </span>
          <span className="badge bg-emerald-600 text-white border-emerald-600">両方OK {bothOk}</span>
        </div>
        <div className="mb-4">
          <ProposePicker vendorId={vendor.id} candidates={proposeCandidates} usesFilter={usesFilter} criteriaSummary={[...describeVendorCriteria(criteria), ...(feeRules.length ? ["単価表"] : [])]} />
        </div>
        {proposals.length === 0 ? (
          <EmptyState message="まだ提案した人事はいません" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>先方の回答</th>
                  <th>人事の回答</th>
                  <th>会社</th>
                  <th>ステータス</th>
                  <th>面談日時</th>
                  <th className="text-right">報酬</th>
                  <th>報酬状態</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((r) => (
                  <tr key={r.id} className={cn(rank(r) === 2 && "bg-gray-100 opacity-60", rank(r) === 1 && "bg-emerald-50/60")}>
                    <td className="whitespace-nowrap">
                      <AnswerButtons id={r.id} vendorId={vendor.id} side="vendor" value={r.vendorApproval} />
                    </td>
                    <td className="whitespace-nowrap">
                      <AnswerButtons id={r.id} vendorId={vendor.id} side="contact" value={r.contactApproval} />
                    </td>
                    <td className="whitespace-nowrap">
                      <Link href={`/referrals/${r.id}`} className="text-blue-700 hover:underline font-medium">
                        {r.contact.company ?? r.contact.name}
                      </Link>
                      {r.contact.noReply && <span className="badge ml-1.5 bg-gray-200 text-gray-600 border-gray-300">返信なし</span>}
                    </td>
                    <td>
                      <Badge value={r.status} label={REFERRAL_LABEL[r.status]} />
                    </td>
                    <td className="whitespace-nowrap">{fmtDateTime(r.meetingAt)}</td>
                    <td className={cn("text-right whitespace-nowrap", r.rewardUndetermined && "text-amber-700 font-medium")}>
                      <RewardCell id={r.id} amount={r.rewardAmount} undetermined={r.rewardUndetermined} />
                    </td>
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

      {(vendor.introSteps || vendor.introMessage) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {vendor.introSteps && (
            <Card title="お繋ぎの手順">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{vendor.introSteps}</p>
            </Card>
          )}
          {vendor.introMessage && (
            <Card title="お繋ぎ文章">
              <CopyBriefPanel text={vendor.introMessage} />
            </Card>
          )}
        </div>
      )}

      {feeGroups.length > 0 && (
        <Card
          title="単価表（協力金）"
          actions={
            <Link href={`/contacts?notVendor=${vendor.id}&target=1`} className="text-xs text-blue-700 hover:underline">
              単価表に当てはまる繋がりを見る →
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>従業員数</th>
                  <th>役職</th>
                  <th className="text-right">協力金</th>
                </tr>
              </thead>
              <tbody>
                {feeGroups.flatMap((g) =>
                  g.rows.map((r, i) => (
                    <tr key={`${g.min}-${g.max}-${i}`}>
                      <td className="whitespace-nowrap">{i === 0 ? fmtSizeRange(g.min, g.max) : ""}</td>
                      <td>{FEE_ROLES[r.role]}</td>
                      <td className="text-right whitespace-nowrap font-medium">{fmtYen(r.fee)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="基本情報" className="lg:col-span-2">
          <Description
            items={[
              { label: "担当者", value: vendor.contactName },
              { label: "紹介報酬単価", value: feeGroups.length ? `${fmtYen(vendor.referralFee)}（単価表あり・下記）` : fmtYen(vendor.referralFee) },
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
            「未実施」のままだと、このベンダーの紹介案件を「紹介先に打診中」以降へ進められません。事前MTGをした場合は「実施済」、MTGなしで紹介する場合は「MTG不要」にしてください。
          </p>
          {/* ボタン自身の name/value は送信されないことがあるため、値は hidden で送る */}
          <div className="flex flex-wrap gap-2">
            {vendor.meetingStatus !== "DONE" && (
              <form action={setVendorMeetingStatusAction}>
                <input type="hidden" name="id" value={vendor.id} />
                <input type="hidden" name="status" value="DONE" />
                <SubmitButton className="btn-primary">実施済にする</SubmitButton>
              </form>
            )}
            {vendor.meetingStatus !== "NOT_REQUIRED" && (
              <form action={setVendorMeetingStatusAction}>
                <input type="hidden" name="id" value={vendor.id} />
                <input type="hidden" name="status" value="NOT_REQUIRED" />
                <SubmitButton className="btn-secondary">MTG不要にする</SubmitButton>
              </form>
            )}
            {vendor.meetingStatus !== "NOT_DONE" && (
              <form action={setVendorMeetingStatusAction}>
                <input type="hidden" name="id" value={vendor.id} />
                <input type="hidden" name="status" value="NOT_DONE" />
                <SubmitButton className="btn-secondary">未実施に戻す</SubmitButton>
              </form>
            )}
          </div>
          <form action={toggleVendorActiveAction} className="mt-4 pt-4 border-t border-gray-100">
            <input type="hidden" name="id" value={vendor.id} />
            <SubmitButton className={vendor.isActive ? "btn-danger btn-sm" : "btn-secondary btn-sm"}>
              {vendor.isActive ? "このベンダーを無効にする" : "有効に戻す"}
            </SubmitButton>
          </form>
        </Card>
      </div>

      <Card title="変更履歴">
        <HistoryList histories={histories} />
      </Card>
    </div>
  );
}

/** 回答（OK／NG／確認待ち）を切り替えるボタン群 */
function AnswerButtons({ id, vendorId, side, value }: { id: number; vendorId: number; side: "vendor" | "contact"; value: VendorApproval }) {
  const opts = [
    ["OK", "✓ OK", "bg-emerald-600 text-white"],
    ["NG", "✗ NG", "bg-rose-600 text-white"],
    ["PENDING", "確認待ち", "bg-gray-600 text-white"],
  ] as const;
  return (
    <div className="inline-flex divide-x divide-gray-200 overflow-hidden rounded-md border border-gray-200">
      {opts.map(([v, label, activeCls]) => (
        <form key={v} action={setVendorApprovalAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="side" value={side} />
          <input type="hidden" name="approval" value={v} />
          <input type="hidden" name="returnTo" value={`/vendors/${vendorId}`} />
          <SubmitButton className={cn("px-2.5 py-1 text-xs", value === v ? activeCls : "bg-white text-gray-500 hover:bg-gray-50")} pendingText="...">
            {label}
          </SubmitButton>
        </form>
      ))}
    </div>
  );
}
