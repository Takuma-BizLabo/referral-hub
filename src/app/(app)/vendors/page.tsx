import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { VENDOR_MEETING_STATUS_LABEL } from "@/lib/labels";
import { fmtYen } from "@/lib/utils";
import { cleanParams } from "@/lib/params";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "ベンダー" };

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; inactive?: string }>;
}) {
  await requireUser();
  const { q, status, inactive } = cleanParams(await searchParams);
  const where: Prisma.VendorWhereInput = {
    isActive: inactive === "1" ? undefined : true,
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }, { serviceSummary: { contains: q, mode: "insensitive" } }] } : {}),
    ...(status === "DONE" || status === "NOT_DONE" ? { meetingStatus: status } : {}),
  };
  const vendors = await prisma.vendor.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: { _count: { select: { meetings: true, referrals: true } } },
  });

  return (
    <div>
      <PageHeader
        title="ベンダー"
        description="サービス提供企業の一覧"
        actions={
          <>
            <Link href="/import/saleshub" className="btn-secondary">
              セールスハブ取込
            </Link>
            <Link href="/vendors/new" className="btn-primary">
              + ベンダー登録
            </Link>
          </>
        }
      />
      <form className="card p-3 mb-3 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-48">
          <label className="label">検索</label>
          <input name="q" defaultValue={q} className="input" placeholder="社名・担当者・サービス" />
        </div>
        <div>
          <label className="label">MTG状態</label>
          <select name="status" defaultValue={status ?? ""} className="input">
            <option value="">すべて</option>
            <option value="NOT_DONE">未実施</option>
            <option value="DONE">実施済</option>
          </select>
        </div>
        <label className="flex items-center gap-1 text-sm pb-2">
          <input type="checkbox" name="inactive" value="1" defaultChecked={inactive === "1"} /> 無効も表示
        </label>
        <button className="btn-secondary">絞り込む</button>
      </form>

      <div className="card overflow-x-auto">
        {vendors.length === 0 ? (
          <EmptyState message="ベンダーがありません" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>社名</th>
                <th>担当者</th>
                <th>サービス概要</th>
                <th className="text-right">単価</th>
                <th>MTG状態</th>
                <th className="text-right">MTG</th>
                <th className="text-right">紹介</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className={v.isActive ? "" : "opacity-50"}>
                  <td>
                    <Link href={`/vendors/${v.id}`} className="text-blue-700 hover:underline font-medium">
                      {v.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{v.contactName ?? "-"}</td>
                  <td className="max-w-xs truncate text-gray-600">{v.serviceSummary ?? "-"}</td>
                  <td className="text-right whitespace-nowrap">{fmtYen(v.referralFee)}</td>
                  <td>
                    <Badge value={v.meetingStatus} label={VENDOR_MEETING_STATUS_LABEL[v.meetingStatus]} />
                  </td>
                  <td className="text-right">{v._count.meetings}</td>
                  <td className="text-right">{v._count.referrals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
