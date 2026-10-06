import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export const CONTACT_FIELDS = [
  { key: "name", label: "氏名", required: true },
  { key: "company", label: "会社名" },
  { key: "title", label: "役職" },
  { key: "industry", label: "業種" },
  { key: "employeeSize", label: "従業員規模" },
  { key: "region", label: "地域" },
  { key: "email", label: "メール" },
  { key: "phone", label: "電話" },
  { key: "otherContact", label: "その他連絡先" },
  { key: "isOnSaleshub", label: "セールスハブ登録（はい/いいえ）" },
  { key: "relationMemo", label: "関係性メモ" },
  { key: "tags", label: "タグ（カンマ区切り）" },
] as const;
export type ContactFieldKey = (typeof CONTACT_FIELDS)[number]["key"];

export type ContactInput = {
  name: string;
  company: string | null;
  title: string | null;
  industry: string | null;
  employeeSize: string | null;
  region: string | null;
  email: string | null;
  phone: string | null;
  otherContact: string | null;
  isOnSaleshub: boolean;
  relationMemo: string | null;
  tags: string[];
};

export function normalizeName(s: string | null | undefined) {
  return (s ?? "").replace(/[\s　]+/g, "").toLowerCase();
}
export function normalizeCompany(s: string | null | undefined) {
  return (s ?? "")
    .replace(/[\s　]+/g, "")
    .replace(/株式会社|有限会社|合同会社|\(株\)|（株）|\(有\)|（有）|㈱|㈲/g, "")
    .toLowerCase();
}
export function parseBool(v: string | null | undefined) {
  if (!v) return false;
  return /^(1|true|yes|y|はい|有|あり|○|◯|済|登録済)$/i.test(v.trim());
}
export function parseTags(v: string | null | undefined): string[] {
  if (!v) return [];
  return Array.from(new Set(v.split(/[,、，;；/／]/).map((t) => t.trim()).filter(Boolean)));
}

/** 既存の繋がりとの重複を探す（氏名+会社名 または メール一致） */
export async function findDuplicate(input: { name: string; company: string | null; email: string | null }) {
  const candidates = await prisma.contact.findMany({
    where: {
      OR: [
        { name: { equals: input.name, mode: "insensitive" } },
        ...(input.email ? [{ email: { equals: input.email, mode: "insensitive" as const } }] : []),
      ],
    },
    take: 20,
  });
  const n = normalizeName(input.name);
  const c = normalizeCompany(input.company);
  const e = (input.email ?? "").trim().toLowerCase();
  for (const cand of candidates) {
    if (e && (cand.email ?? "").trim().toLowerCase() === e) return { contact: cand, reason: "メール一致" };
    if (normalizeName(cand.name) === n && normalizeCompany(cand.company) === c) return { contact: cand, reason: "氏名＋会社名一致" };
  }
  return null;
}

export async function upsertTags(tx: Prisma.TransactionClient, names: string[]) {
  const ids: number[] = [];
  for (const name of names) {
    const tag = await tx.tag.upsert({ where: { name }, update: {}, create: { name } });
    ids.push(tag.id);
  }
  return ids;
}

export async function writeContact(tx: Prisma.TransactionClient, input: ContactInput, id?: number) {
  const { tags, ...data } = input;
  const contact = id
    ? await tx.contact.update({ where: { id }, data })
    : await tx.contact.create({ data });
  const tagIds = await upsertTags(tx, tags);
  await tx.contactTag.deleteMany({ where: { contactId: contact.id } });
  if (tagIds.length) {
    await tx.contactTag.createMany({ data: tagIds.map((tagId) => ({ contactId: contact.id, tagId })) });
  }
  return contact;
}
