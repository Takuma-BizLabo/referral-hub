import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EmptyState, PageHeader, Tabs } from "@/components/ui";
import { VendorTag } from "@/components/VendorTag";
import { REFERRAL_LABEL, STATUS_COLOR, VENDOR_MEETING_STATUS_LABEL } from "@/lib/labels";
import { cn, fmtYen } from "@/lib/utils";

export const metadata = { title: "紹介マトリクス" };

export default async function ContactMatrixPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q } = await searchParams;
  const [vendors, contacts] = await Promise.all([
    prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({
      where: {
        isActive: true,
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }] } : {}),
      },
      include: { referrals: { select: { id: true, vendorId: true, status: true, rewardAmount: true } } },
      orderBy: [{ company: "asc" }, { name: "asc" }],
      take: 300,
    }),
  ]);

  return (
    <div>
      <PageHeader title="繋がりリスト" description="誰をどのベンダーに紹介済みか、まだ紹介できる組み合わせはどれか" />
      <Tabs
        items={[
          { href: "/contacts", label: "一覧", active: false },
          { href: "/contacts/matrix", label: "紹介マトリクス（誰をどこに紹介済みか）", active: true },
        ]}
      />
      <form className="card p-3 mb-3 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-48">
          <label className="label">検索</label>
          <input name="q" defaultValue={q} className="input" placeholder="氏名・会社名" />
        </div>
        <button className="btn-secondary">絞り込む</button>
      </form>
      <p className="text-xs text-gray-500 mb-2">
        セルのバッジ＝紹介済み（現在のステータス）。「＋」を押すとその組み合わせで紹介案件を作成します。ベンダーMTG未実施の列は打診前に MTG を済ませてください。
      </p>
      <div className="card overflow-x-auto">
        {contacts.length === 0 ? (
          <EmptyState message="該当する繋がりがありません" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="sticky left-0 bg-gray-50 z-10">繋がり</th>
                {vendors.map((v) => (
                  <th key={v.id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <VendorTag id={v.id} name={v.name} />
                      <span className="text-[11px] font-normal text-gray-500">
                        {fmtYen(v.referralFee)} ／ MTG {VENDOR_MEETING_STATUS_LABEL[v.meetingStatus]}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="text-right">合計</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const total = c.referrals.reduce((a, r) => (r.status === "MEETING_DONE" ? a + r.rewardAmount : a), 0);
                return (
                  <tr key={c.id}>
                    <td className="sticky left-0 bg-white z-10 whitespace-nowrap">
                      <Link href={`/contacts/${c.id}`} className="text-blue-700 hover:underline font-medium">
                        {c.name}
                      </Link>
                      <div className="text-xs text-gray-500">
                        {c.company}
                        {c.title ? ` / ${c.title}` : ""}
                      </div>
                    </td>
                    {vendors.map((v) => {
                      const rs = c.referrals.filter((r) => r.vendorId === v.id);
                      return (
                        <td key={v.id} className="text-center">
                          {rs.length === 0 ? (
                            <Link
                              href={`/referrals/new?vendorId=${v.id}&contactId=${c.id}`}
                              className="inline-flex w-7 h-7 items-center justify-center rounded-md border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
                              title={`${c.name} を ${v.name} に紹介する`}
                            >
                              ＋
                            </Link>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              {rs.map((r) => (
                                <Link key={r.id} href={`/referrals/${r.id}`} className={cn("badge", STATUS_COLOR[r.status])}>
                                  {REFERRAL_LABEL[r.status]}
                                </Link>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-right whitespace-nowrap text-xs text-gray-600">
                      {c.referrals.length}件
                      {total > 0 && <div className="font-medium text-gray-900">{fmtYen(total)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
