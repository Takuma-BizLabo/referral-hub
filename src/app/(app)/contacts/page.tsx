import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EmptyState, PageHeader, Tabs } from "@/components/ui";
import { VendorTag } from "@/components/VendorTag";
import { cn, fmtYen } from "@/lib/utils";
import { FilterPanel } from "@/components/FilterPanel";
import { cleanParams } from "@/lib/params";
import type { Prisma } from "@prisma/client";
import { judgeFee, parseFeeTable, type FeeJudgement } from "@/lib/fee-table";
import { splitTitle } from "@/lib/title";

export const metadata = { title: "繋がりリスト" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; industry?: string; region?: string; saleshub?: string; tag?: string; inactive?: string; notVendor?: string; target?: string; imported?: string; updated?: string; candidates?: string; removed?: string }>;
}) {
  await requireUser();
  const sp = cleanParams(await searchParams, { notVendor: "int", saleshub: ["0", "1"], inactive: ["1"], target: ["1"] });
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
    ...(sp.notVendor ? { referrals: { none: { vendorId: Number(sp.notVendor) } } } : {}),
  };
  const vendors = await prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const notVendor = sp.notVendor ? vendors.find((v) => v.id === Number(sp.notVendor)) : undefined;
  const [allContacts, industries, regions, tags, allTotal] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: [{ company: "asc" }, { name: "asc" }],
      include: { tags: { include: { tag: true } }, referrals: { select: { vendorId: true } } },
      // 単価表で絞るときは DB で絞れないので全件から判定する
      take: sp.target === "1" ? undefined : 500,
    }),
    prisma.contact.findMany({ where: { industry: { not: null } }, distinct: ["industry"], select: { industry: true }, orderBy: { industry: "asc" } }),
    prisma.contact.findMany({ where: { region: { not: null } }, distinct: ["region"], select: { region: true }, orderBy: { region: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.contact.count({ where }),
  ]);
  // 未紹介ベンダーに単価表があれば、繋がりごとの協力金の見込みを出す
  const feeRules = notVendor ? parseFeeTable(notVendor.feeTable) : [];
  const judgements = new Map<number, FeeJudgement>(feeRules.length ? allContacts.map((c) => [c.id, judgeFee(feeRules, c)]) : []);
  const targetOnly = sp.target === "1" && feeRules.length > 0;
  // 対象：単価が決まる人を金額の高い順、次に要確認（規模がまたがる）
  const rank = (j: FeeJudgement | undefined) => (j?.kind === "matched" ? 0 : 1);
  const top = (j: FeeJudgement | undefined) => (j?.kind === "matched" ? j.fee : j?.kind === "ambiguous" ? Math.max(...j.candidates) : 0);
  const contacts = targetOnly
    ? allContacts
        .filter((c) => ["matched", "ambiguous"].includes(judgements.get(c.id)?.kind ?? ""))
        .sort((a, b) => rank(judgements.get(a.id)) - rank(judgements.get(b.id)) || top(judgements.get(b.id)) - top(judgements.get(a.id)))
    : allContacts;
  const total = targetOnly ? contacts.length : allTotal;

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
      <Tabs
        items={[
          { href: "/contacts", label: "一覧", active: true },
          { href: "/contacts/matrix", label: "紹介マトリクス（誰をどこに紹介済みか）", active: false },
        ]}
      />
      {sp.imported !== undefined && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 mb-3">
          会社リストを取り込みました：新規 {sp.imported} 件 / 更新 {sp.updated ?? 0} 件{sp.removed && sp.removed !== "0" ? ` / セールスハブ未掲載 ${sp.removed} 件を削除` : ""}{sp.candidates ? `／ セールスハブの過去メッセージから紹介候補 ${sp.candidates} 件を登録` : ""}
        </div>
      )}
      {notVendor && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900 mb-3 flex flex-wrap items-center gap-2">
          <VendorTag id={notVendor.id} name={notVendor.name} />
          にまだ紹介していない繋がりを表示中
          {feeRules.length ? "（単価表あり：「見込み単価」は規模・役職からの判定）" : `（単価 ${fmtYen(notVendor.referralFee)}）`}。右端の「紹介する」で紹介案件を作成できます。
          {feeRules.length > 0 &&
            (targetOnly ? (
              <Link href={`/contacts?notVendor=${notVendor.id}`} className="btn-secondary btn-sm">
                全員を表示
              </Link>
            ) : (
              <Link href={`/contacts?notVendor=${notVendor.id}&target=1`} className="btn-primary btn-sm">
                単価表に当てはまる人だけ表示
              </Link>
            ))}
        </div>
      )}
      <FilterPanel activeCount={[sp.q, sp.notVendor, sp.industry, sp.region, sp.saleshub, sp.tag, sp.inactive].filter(Boolean).length}>
      <form className="card p-3 mb-3 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-48">
          <label className="label">検索</label>
          <input name="q" defaultValue={sp.q} className="input" placeholder="氏名・会社・役職・メモ" />
        </div>
        <div>
          <label className="label">未紹介のベンダー</label>
          <select name="notVendor" defaultValue={sp.notVendor ?? ""} className="input">
            <option value="">指定なし</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} に未紹介
              </option>
            ))}
          </select>
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
        {sp.target === "1" && <input type="hidden" name="target" value="1" />}
        <label className="flex items-center gap-1 text-sm pb-2">
          <input type="checkbox" name="inactive" value="1" defaultChecked={sp.inactive === "1"} /> 無効も表示
        </label>
        <button className="btn-secondary">絞り込む</button>
        <Link href="/contacts" className="btn-secondary">
          クリア
        </Link>
      </form>
      </FilterPanel>

      {contacts.length === 0 ? (
        <div className="card">
          <EmptyState message="該当する繋がりがありません" />
        </div>
      ) : (
        <>
          {/* スマホ: カード表示 */}
          <ul className="md:hidden space-y-2">
            {contacts.map((c) => {
              const vids = Array.from(new Set(c.referrals.map((r) => r.vendorId)));
              return (
                <li key={c.id} className={cn("card p-3", !c.isActive && "opacity-50")}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/contacts/${c.id}`} className="min-w-0">
                      <div className="font-medium text-blue-700">{c.company ?? c.name}</div>
                      <div className="text-xs text-gray-600">{[c.company ? c.name : null, c.title].filter(Boolean).join(" / ") || "-"}</div>
                    </Link>
                    {notVendor && (
                      <Link href={`/referrals/new?vendorId=${notVendor.id}&contactId=${c.id}`} className="btn-primary btn-sm shrink-0">
                        紹介する
                      </Link>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{[c.industry, c.employeeSize, c.region, c.isOnSaleshub ? "SH済" : null].filter(Boolean).join(" ／ ")}</div>
                  {judgements.has(c.id) && <div className="mt-1 text-xs">見込み単価：<FeeCell j={judgements.get(c.id)!} /></div>}
                  {(c.tags.length > 0 || vids.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.tags.map((t) => (
                        <span key={t.tagId} className="badge bg-gray-100 text-gray-600 border-gray-200">
                          {t.tag.name}
                        </span>
                      ))}
                      {vids.map((vid) => {
                        const v = vendors.find((x) => x.id === vid);
                        return v ? <VendorTag key={vid} id={v.id} name={v.name} /> : null;
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {/* PC: テーブル表示 */}
          <div className="card overflow-x-auto hidden md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>会社名</th>
                  <th>役職クラス</th>
                  <th>正確な役職</th>
                  <th>業種</th>
                  <th>規模</th>
                  <th>地域</th>
                  <th>SH</th>
                  <th>タグ</th>
                  <th>紹介済みベンダー</th>
                  {feeRules.length > 0 && <th>見込み単価</th>}
                  {notVendor && <th></th>}
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
                    <td className="whitespace-nowrap">{splitTitle(c.title).cls ?? "-"}</td>
                    <td className="min-w-40">{splitTitle(c.title).detail ?? "-"}</td>
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
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(c.referrals.map((r) => r.vendorId))).map((vid) => {
                          const v = vendors.find((x) => x.id === vid);
                          return v ? <VendorTag key={vid} id={v.id} name={v.name} /> : null;
                        })}
                        {c.referrals.length === 0 && <span className="text-xs text-gray-400">未紹介</span>}
                      </div>
                    </td>
                    {feeRules.length > 0 && (
                      <td className="text-xs">
                        <FeeCell j={judgements.get(c.id)!} />
                      </td>
                    )}
                    {notVendor && (
                      <td className="text-right">
                        <Link href={`/referrals/new?vendorId=${notVendor.id}&contactId=${c.id}`} className="btn-primary btn-sm">
                          紹介する
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** 単価表での判定結果の表示（理由はマウスを乗せると出る） */
function FeeCell({ j }: { j: FeeJudgement }) {
  if (j.kind === "matched") return <span className="font-medium text-emerald-700 whitespace-nowrap" title={j.reason}>{fmtYen(j.fee)}</span>;
  if (j.kind === "ambiguous")
    return (
      <span className="text-amber-700 whitespace-nowrap" title={j.reason}>
        要確認（{j.candidates.map((f) => fmtYen(f)).join(" / ")}）
      </span>
    );
  return (
    <span className="text-gray-400" title={j.reason}>
      {j.kind === "unknown" ? "判断できない" : "対象外"}
    </span>
  );
}
