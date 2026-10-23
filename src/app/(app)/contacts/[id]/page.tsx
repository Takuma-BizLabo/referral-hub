import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, Description, EmptyState, PageHeader } from "@/components/ui";
import { REFERRAL_LABEL, REWARD_LABEL, VENDOR_MEETING_STATUS_LABEL } from "@/lib/labels";
import { VendorTag } from "@/components/VendorTag";
import { cn, fmtDate, fmtDateTime, fmtReward, fmtYen } from "@/lib/utils";
import { toggleContactActiveAction, toggleNoReplyAction } from "../actions";
import { thankYouTotal } from "@/lib/thank-you";
import { SubmitButton } from "@/components/SubmitButton";
import { idOrNull, idParam } from "@/lib/params";
import { splitTitle } from "@/lib/title";
import { HIRING_FIELDS, hasHiring } from "@/lib/hiring";
import { FIT_BADGE, FIT_LABEL, parseVendorCriteria, vendorFit } from "@/lib/candidates";
import { parseFeeTable } from "@/lib/fee-table";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = idOrNull((await params).id);
  const c = id ? await prisma.contact.findUnique({ where: { id }, select: { name: true, company: true } }) : null;
  return { title: c ? `${c.company ?? ""} ${c.name}`.trim() : "繋がり" };
}

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id: idParam(id) },
    include: {
      tags: { include: { tag: true } },
      referrals: { include: { vendor: true }, orderBy: { id: "desc" } },
    },
  });
  if (!contact) notFound();
  const referredVendorIds = new Set(contact.referrals.map((r) => r.vendorId));
  const vendorRows = await prisma.vendor.findMany({ where: { isActive: true, id: { notIn: [...referredVendorIds] } }, orderBy: { name: "asc" } });
  // 提案前の判定：ベンダーごとに NG確定（除外・過去NG）／条件に合う／要確認／合わない
  const ngRows = await prisma.referral.findMany({
    where: { vendorApproval: "NG", vendorId: { in: vendorRows.map((v) => v.id) } },
    select: { vendorId: true, contact: { select: { company: true } } },
  });
  const FIT_RANK = { match: 0, maybe: 1, none: 2, no: 3, ng: 4 } as const;
  const otherVendors = vendorRows
    .map((v) => {
      const fit = vendorFit(
        parseVendorCriteria(v.criteria),
        parseFeeTable(v.feeTable),
        contact,
        ngRows.filter((r) => r.vendorId === v.id && r.contact.company).map((r) => r.contact.company!),
      );
      return { ...v, fit, fitKey: fit.level === "ng" || fit.hasRules ? fit.level : ("none" as const) };
    })
    .sort((a, b) => FIT_RANK[a.fitKey] - FIT_RANK[b.fitKey] || a.name.localeCompare(b.name, "ja"));

  return (
    <div className="space-y-4">
      <PageHeader
        title={contact.name}
        description={[contact.company, contact.title].filter(Boolean).join(" / ") + (contact.isActive ? "" : "（無効）") + (contact.noReply ? "（返信なし）" : "")}
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
              { label: "役職クラス", value: splitTitle(contact.title).cls },
              { label: "正確な役職", value: splitTitle(contact.title).detail },
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
          <form action={toggleNoReplyAction} className="mb-2">
            <input type="hidden" name="id" value={contact.id} />
            <SubmitButton className="btn-secondary btn-sm">{contact.noReply ? "返信ありに戻す" : "返信なしにする"}</SubmitButton>
            <p className="mt-1 text-xs text-gray-500">
              {contact.noReply
                ? `${contact.noReplyAt ? fmtDate(contact.noReplyAt) + " から" : ""}返信なし。一覧と候補でグレーアウトしています`
                : "返信が返ってこない人事は、一覧と候補でグレーアウトして一番下に並べます"}
            </p>
          </form>
          <form action={toggleContactActiveAction}>
            <input type="hidden" name="id" value={contact.id} />
            <SubmitButton className={contact.isActive ? "btn-danger btn-sm" : "btn-secondary btn-sm"}>
              {contact.isActive ? "この繋がりを無効にする" : "有効に戻す"}
            </SubmitButton>
          </form>
        </Card>
        <Card title="採用の情報" className="lg:col-span-2">
          {hasHiring(contact) ? (
            <Description items={HIRING_FIELDS.map((f) => ({ label: f.label, value: contact[f.key] }))} />
          ) : (
            <EmptyState message="まだ入っていません（編集画面の「採用の情報」で入力できます）" />
          )}
        </Card>
      </div>

      <Card title={`まだ紹介していないベンダー（${otherVendors.length}）`}>
        {otherVendors.length === 0 ? (
          <EmptyState message="すべてのベンダーに紹介済みです" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>ベンダー</th>
                  <th>この人事は</th>
                  <th>先方希望ターゲット</th>
                  <th className="text-right">単価</th>
                  <th>MTG状態</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {otherVendors.map((v) => (
                  <tr key={v.id} className={v.fit.level === "ng" ? "bg-rose-50/60" : ""}>
                    <td>
                      <VendorTag id={v.id} name={v.name} />
                    </td>
                    <td className="max-w-56">
                      {v.fitKey === "none" ? (
                        <span className="text-xs text-gray-400">条件未設定</span>
                      ) : (
                        <>
                          <span className={cn("badge", FIT_BADGE[v.fit.level])}>{FIT_LABEL[v.fit.level]}</span>
                          {v.fit.reasons.length > 0 && <div className={cn("mt-0.5 text-[11px]", v.fit.level === "ng" ? "font-medium text-rose-700" : "text-gray-500")}>{v.fit.reasons.join(" ／ ")}</div>}
                        </>
                      )}
                    </td>
                    <td className="max-w-xs text-xs text-gray-700">{v.wantedTarget ? <span className="line-clamp-2 whitespace-pre-wrap">{v.wantedTarget}</span> : <span className="text-gray-300">-</span>}</td>
                    <td className="text-right whitespace-nowrap font-medium">{fmtYen(v.referralFee)}</td>
                    <td>
                      <Badge value={v.meetingStatus} label={VENDOR_MEETING_STATUS_LABEL[v.meetingStatus]} />
                    </td>
                    <td className="text-right">
                      <Link href={`/referrals/new?vendorId=${v.id}&contactId=${contact.id}`} className={v.fit.level === "ng" ? "btn-secondary btn-sm" : "btn-primary btn-sm"}>
                        紹介する
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title={`紹介履歴（${contact.referrals.length}）`}
        actions={
          <span className="text-sm text-gray-600">
            謝礼金の合計 <b className="text-gray-900">{fmtYen(thankYouTotal(contact.referrals).total)}</b>（{thankYouTotal(contact.referrals).count}件・紹介見送りを除く）
          </span>
        }
      >
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
                  <th className="text-right">謝礼金</th>
                  <th>報酬状態</th>
                </tr>
              </thead>
              <tbody>
                {contact.referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      <Link href={`/referrals/${r.id}`}>
                        <VendorTag id={r.vendor.id} name={r.vendor.name} link={false} />
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{fmtDate(r.pickedUpAt)}</td>
                    <td>
                      <Badge value={r.status} label={REFERRAL_LABEL[r.status]} />
                    </td>
                    <td className="whitespace-nowrap">{fmtDateTime(r.meetingAt)}</td>
                    <td className="text-right whitespace-nowrap">{fmtReward(r.rewardAmount, r.rewardUndetermined)}</td>
                    <td className="text-right whitespace-nowrap">{r.thankYouFee === null ? "-" : fmtYen(r.thankYouFee)}</td>
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
