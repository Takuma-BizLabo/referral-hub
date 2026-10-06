import { prisma } from "../db";
import { extractCompanies, normalizeCompanyName } from "./parse";

/**
 * そのベンダーの全スレッドで、こちら側（松田）が提示した会社名（＝依頼で指名された繋ぎ先）を集める。
 * 同じベンダーと複数スレッドがある場合もまとめて見る。
 */
export async function proposedCompaniesForVendor(vendorId: number): Promise<{ company: string; dept: string | null }[]> {
  const threads = await prisma.saleshubThread.findMany({
    where: { vendorId },
    include: { messages: { where: { isMine: true }, orderBy: { sentAt: "asc" } } },
  });
  const out: { company: string; dept: string | null }[] = [];
  for (const t of threads) {
    for (const m of t.messages) {
      for (const c of extractCompanies(m.body, [t.vendorName])) {
        if (!out.some((o) => normalizeCompanyName(o.company) === normalizeCompanyName(c.company))) out.push(c);
      }
    }
  }
  return out;
}

/** ベンダーID → 提示済み会社名 の一覧（MTG一覧の「お繋ぎ先」表示用） */
export async function proposedCompaniesByVendor(): Promise<Record<number, string[]>> {
  const threads = await prisma.saleshubThread.findMany({
    where: { vendorId: { not: null } },
    include: { messages: { where: { isMine: true }, orderBy: { sentAt: "asc" } } },
  });
  const map: Record<number, string[]> = {};
  for (const t of threads) {
    const list = (map[t.vendorId!] ??= []);
    for (const m of t.messages) {
      for (const c of extractCompanies(m.body, [t.vendorName])) {
        if (!list.some((x) => normalizeCompanyName(x) === normalizeCompanyName(c.company))) list.push(c.company);
      }
    }
  }
  return map;
}

export function isProposed(company: string, proposed: { company: string }[]) {
  const n = normalizeCompanyName(company);
  return proposed.some((p) => {
    const pn = normalizeCompanyName(p.company);
    return pn && (pn === n || pn.includes(n) || n.includes(pn));
  });
}
