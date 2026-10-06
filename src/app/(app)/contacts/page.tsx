import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "繋がりリスト" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; industry?: string; region?: string; saleshub?: string; tag?: string; inactive?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const where: Prisma.ContactWhereInput = {
    isActive: sp.inactive === "1" ? undefined : true,
    ...(sp.q
      ? {
          OR: [
            { name: { contains: sp.q, mode: "insensitive" } },
            { company: { contains: sp.q, mode: "insensitive" } },
            { title: { contains: sp.q, mode: "insensitive" } },
            { relationMemo: { contains: sp.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(sp.industry ? { industry: sp.industry } : {}),
    ...(sp.region ? { region: sp.region } : {}),
    ...(sp.saleshub === "1" ? { isOnSaleshub: true } : sp.saleshub === "0" ? { isOnSaleshub: false } : {}),
    ...(sp.tag ? { tags: { some: { tag: { name: sp.tag } } } } : {}),
  };
  const [contacts, industries, regions, tags, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: [{ company: "asc" }, { name: "asc" }],
      include: { tags: { include: { tag: true } }, _count: { select: { referrals: true } } },
      take: 500,
    }),
    prisma.contact.findMany({ where: { industry: { not: null } }, distinct: ["industry"], select: { industry: true }, orderBy: { industry: "asc" } }),
    prisma.contact.findMany({ where: { region: { not: null } }, distinct: ["region"], select: { region: true }, orderBy: { region: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.contact.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="繋がりリスト"
        description={`${total} 件`}
        actions={
          <>
            <Link href="/contacts/import" className="btn-secondary">
              CSV取込
            </Link>
            <Link href="/contacts/new" className="btn-primary">
              + 手入力で追加
            </Link>
          </>
        }
      />
      <form className="card p-3 mb-3 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-48">
          <label className="label">検索</label>
          <input name="q" defaultValue={sp.q} className="input" placeholder="氏名・会社・役職・メモ" />
        </div>
        <div>
          <label className="label">業種</label>
          <select name="industry" defaultValue={sp.industry ?? ""} className="input">
            <option value="">すべて</option>
            {industries.map((i) => (
              <option key={i.industry!} value={i.industry!}>
                {i.industry}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">地域</label>
          <select name="region" defaultValue={sp.region ?? ""} className="input">
            <option value="">すべて</option>
            {regions.map((r) => (
              <option key={r.region!} value={r.region!}>
                {r.region}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">セールスハブ</label>
          <select name="saleshub" defaultValue={sp.saleshub ?? ""} className="input">
            <option value="">すべて</option>
            <option value="1">登録済</option>
            <option value="0">未登録</option>
          </select>
        </div>
        <div>
          <label className="label">タグ</label>
          <select name="tag" defaultValue={sp.tag ?? ""} className="input">
            <option value="">すべて</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1 text-sm pb-2">
          <input type="checkbox" name="inactive" value="1" defaultChecked={sp.inactive === "1"} /> 無効も表示
        </label>
        <button className="btn-secondary">絞り込む</button>
        <Link href="/contacts" className="btn-secondary">
          クリア
        </Link>
      </form>

      <div className="card overflow-x-auto">
        {contacts.length === 0 ? (
          <EmptyState message="該当する繋がりがありません" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>氏名</th>
                <th>会社名</th>
                <th>役職</th>
                <th>業種</th>
                <th>規模</th>
                <th>地域</th>
                <th>SH</th>
                <th>タグ</th>
                <th className="text-right">紹介</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className={c.isActive ? "" : "opacity-50"}>
                  <td className="whitespace-nowrap">
                    <Link href={`/contacts/${c.id}`} className="text-blue-700 hover:underline font-medium">
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.company ?? "-"}</td>
                  <td className="whitespace-nowrap">{c.title ?? "-"}</td>
                  <td className="whitespace-nowrap">{c.industry ?? "-"}</td>
                  <td className="whitespace-nowrap">{c.employeeSize ?? "-"}</td>
                  <td className="whitespace-nowrap">{c.region ?? "-"}</td>
                  <td className="text-xs">{c.isOnSaleshub ? "済" : "-"}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <span key={t.tagId} className="badge bg-gray-100 text-gray-600 border-gray-200">
                          {t.tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="text-right">{c._count.referrals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
