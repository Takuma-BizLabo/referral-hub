import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { COMPANY_PARSER_VERSION, extractCompanies, normalizeCompanyName } from "./parse";

export type Proposed = { company: string; dept: string | null };
type Cache = { v: number; items: Proposed[] };

function readCache(raw: Prisma.JsonValue | null | undefined): Proposed[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const c = raw as unknown as Cache;
  if (c.v !== COMPANY_PARSER_VERSION || !Array.isArray(c.items)) return null;
  return c.items;
}

/** 1スレッドの「こちら側（松田）が提示した会社名」を本文から計算する */
function computeThreadProposed(vendorName: string, mineBodies: string[]): Proposed[] {
  const out: Proposed[] = [];
  for (const body of mineBodies) {
    for (const c of extractCompanies(body, [vendorName])) {
      if (!out.some((o) => normalizeCompanyName(o.company) === normalizeCompanyName(c.company))) out.push(c);
    }
  }
  return out;
}

/**
 * スレッドの提示会社キャッシュ（SaleshubThread.proposedCache）を計算し直して保存する。
 * 受信処理でこちら側のメッセージが増えたときに呼ぶ。
 */
export async function refreshThreadProposed(threadId: number): Promise<Proposed[]> {
  const t = await prisma.saleshubThread.findUnique({
    where: { id: threadId },
    select: { vendorName: true, messages: { where: { isMine: true }, orderBy: { sentAt: "asc" }, select: { body: true } } },
  });
  if (!t) return [];
  const items = computeThreadProposed(
    t.vendorName,
    t.messages.map((m) => m.body),
  );
  const cache: Cache = { v: COMPANY_PARSER_VERSION, items };
  await prisma.saleshubThread.update({ where: { id: threadId }, data: { proposedCache: cache as unknown as Prisma.InputJsonValue } });
  return items;
}

/** スレッド一覧（vendorName・キャッシュ付き）から、キャッシュが古いものだけ再計算して提示会社を返す */
async function proposedOfThreads(threads: { id: number; vendorName: string; proposedCache: Prisma.JsonValue | null }[]) {
  const result = new Map<number, Proposed[]>();
  for (const t of threads) {
    const cached = readCache(t.proposedCache);
    result.set(t.id, cached ?? (await refreshThreadProposed(t.id)));
  }
  return result;
}

/**
 * そのベンダーの全スレッドで、こちら側（松田）が提示した会社名（＝依頼で指名された繋ぎ先）を集める。
 * 同じベンダーと複数スレッドがある場合もまとめて見る。
 */
export async function proposedCompaniesForVendor(vendorId: number): Promise<Proposed[]> {
  const threads = await prisma.saleshubThread.findMany({
    where: { vendorId },
    select: { id: true, vendorName: true, proposedCache: true },
    orderBy: { id: "asc" },
  });
  const byThread = await proposedOfThreads(threads);
  const out: Proposed[] = [];
  for (const t of threads) {
    for (const c of byThread.get(t.id) ?? []) {
      if (!out.some((o) => normalizeCompanyName(o.company) === normalizeCompanyName(c.company))) out.push(c);
    }
  }
  return out;
}

/** ベンダーID → 提示済み会社名 の一覧（MTG一覧の「お繋ぎ先」表示用） */
export async function proposedCompaniesByVendor(): Promise<Record<number, string[]>> {
  const threads = await prisma.saleshubThread.findMany({
    where: { vendorId: { not: null } },
    select: { id: true, vendorId: true, vendorName: true, proposedCache: true },
    orderBy: { id: "asc" },
  });
  const byThread = await proposedOfThreads(threads);
  const map: Record<number, string[]> = {};
  for (const t of threads) {
    const list = (map[t.vendorId!] ??= []);
    for (const c of byThread.get(t.id) ?? []) {
      if (!list.some((x) => normalizeCompanyName(x) === normalizeCompanyName(c.company))) list.push(c.company);
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
