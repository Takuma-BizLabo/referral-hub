import type { Contact, Referral, SaleshubMessage } from "@prisma/client";
import { extractCompanies, normalizeCompanyName } from "./parse";
import { isProposed } from "./proposed";

export type ThreadCandidate = {
  company: string;
  dept: string | null;
  /** 誰が挙げたか */
  source: "mine" | "vendor";
  /** 想定単価。null = 未定（ベンダーが途中で挙げた会社） */
  fee: number | null;
  contacts: Pick<Contact, "id" | "name" | "company" | "title">[];
  referrals: (Pick<Referral, "id" | "status" | "rewardAmount" | "rewardUndetermined"> & { contactId: number })[];
};

function sameCompany(a: string, b: string) {
  const x = normalizeCompanyName(a);
  const y = normalizeCompanyName(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

/**
 * スレッド詳細の「お繋ぎ先候補」表示用（読み取りのみ）。
 * 自動化ルールと同じ考え方で、松田が提示した会社＝依頼の単価、ベンダーが途中で挙げた新しい会社＝単価未定。
 */
export function threadCandidates(
  thread: { vendorName: string },
  messages: Pick<SaleshubMessage, "body" | "isMine">[],
  proposedForVendor: { company: string }[],
  fee: number | null,
  contacts: Pick<Contact, "id" | "name" | "company" | "title">[],
  referrals: (Pick<Referral, "id" | "status" | "rewardAmount" | "rewardUndetermined" | "contactId"> & { contact: { company: string | null } })[],
): ThreadCandidate[] {
  const out: ThreadCandidate[] = [];
  const push = (c: { company: string; dept: string | null }, source: "mine" | "vendor") => {
    if (out.some((o) => sameCompany(o.company, c.company))) return;
    const known = source === "mine" || isProposed(c.company, proposedForVendor);
    const hits = contacts.filter((x) => x.company && sameCompany(x.company, c.company));
    out.push({
      ...c,
      source,
      fee: known ? fee : null,
      contacts: hits,
      referrals: referrals.filter((r) => hits.some((h) => h.id === r.contactId) || (r.contact.company && sameCompany(r.contact.company, c.company))),
    });
  };
  for (const m of messages.filter((m) => m.isMine)) for (const c of extractCompanies(m.body, [thread.vendorName])) push(c, "mine");
  for (const m of messages.filter((m) => !m.isMine)) for (const c of extractCompanies(m.body, [thread.vendorName])) push(c, "vendor");
  return out;
}
