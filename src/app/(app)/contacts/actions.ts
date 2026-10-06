"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/auth";
import { errorState, type ActionState } from "@/lib/action-state";
import { str } from "@/lib/utils";
import { findDuplicate, parseBool, parseTags, writeContact, type ContactInput } from "@/lib/contacts";

function contactInput(formData: FormData): ContactInput {
  const name = str(formData.get("name"));
  if (!name) throw new Error("氏名は必須です");
  return {
    name,
    company: str(formData.get("company")),
    title: str(formData.get("title")),
    industry: str(formData.get("industry")),
    employeeSize: str(formData.get("employeeSize")),
    region: str(formData.get("region")),
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
    otherContact: str(formData.get("otherContact")),
    isOnSaleshub: formData.get("isOnSaleshub") === "on",
    relationMemo: str(formData.get("relationMemo")),
    tags: parseTags(str(formData.get("tags"))),
  };
}

export async function createContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: number;
  try {
    await assertUser();
    const input = contactInput(formData);
    if (formData.get("ignoreDuplicate") !== "1") {
      const dup = await findDuplicate(input);
      if (dup) {
        return {
          error: `重複の可能性：「${dup.contact.name}（${dup.contact.company ?? "会社不明"}）」が既に登録されています（${dup.reason}）。そのまま登録する場合は「重複を無視して登録」にチェックしてください。`,
        };
      }
    }
    const c = await prisma.$transaction((tx) => writeContact(tx, input));
    id = c.id;
  } catch (e) {
    return errorState(e);
  }
  revalidatePath("/contacts");
  redirect(`/contacts/${id}`);
}

export async function updateContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = Number(formData.get("id"));
  try {
    await assertUser();
    const input = contactInput(formData);
    await prisma.$transaction((tx) => writeContact(tx, input, id));
  } catch (e) {
    return errorState(e);
  }
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

export async function toggleContactActiveAction(formData: FormData) {
  await assertUser();
  const id = Number(formData.get("id"));
  const c = await prisma.contact.findUniqueOrThrow({ where: { id } });
  await prisma.contact.update({ where: { id }, data: { isActive: !c.isActive } });
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
}

// ---------- CSV 取込 ----------

export type ImportRow = Record<string, string>; // key = ContactFieldKey
export type DuplicateInfo = { index: number; existingId: number; existingLabel: string; reason: string };

export async function checkDuplicatesAction(rows: ImportRow[]): Promise<DuplicateInfo[]> {
  await assertUser();
  const result: DuplicateInfo[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.name?.trim()) continue;
    const dup = await findDuplicate({ name: r.name.trim(), company: r.company?.trim() || null, email: r.email?.trim() || null });
    if (dup) {
      result.push({
        index: i,
        existingId: dup.contact.id,
        existingLabel: `${dup.contact.name}（${dup.contact.company ?? "会社不明"}）`,
        reason: dup.reason,
      });
    }
  }
  return result;
}

export type ImportDecision = "create" | "skip" | "overwrite";

export async function importContactsAction(
  rows: ImportRow[],
  decisions: { index: number; decision: ImportDecision; existingId?: number }[],
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  await assertUser();
  const decisionMap = new Map(decisions.map((d) => [d.index, d]));
  let created = 0,
    updated = 0,
    skipped = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = r.name?.trim();
    if (!name) {
      errors.push(`${i + 1}行目: 氏名が空のためスキップ`);
      skipped++;
      continue;
    }
    const d = decisionMap.get(i);
    if (d?.decision === "skip") {
      skipped++;
      continue;
    }
    const input: ContactInput = {
      name,
      company: r.company?.trim() || null,
      title: r.title?.trim() || null,
      industry: r.industry?.trim() || null,
      employeeSize: r.employeeSize?.trim() || null,
      region: r.region?.trim() || null,
      email: r.email?.trim() || null,
      phone: r.phone?.trim() || null,
      otherContact: r.otherContact?.trim() || null,
      isOnSaleshub: parseBool(r.isOnSaleshub),
      relationMemo: r.relationMemo?.trim() || null,
      tags: parseTags(r.tags),
    };
    try {
      if (d?.decision === "overwrite" && d.existingId) {
        await prisma.$transaction((tx) => writeContact(tx, input, d.existingId));
        updated++;
      } else {
        await prisma.$transaction((tx) => writeContact(tx, input));
        created++;
      }
    } catch (e) {
      errors.push(`${i + 1}行目: ${e instanceof Error ? e.message : "エラー"}`);
    }
  }
  revalidatePath("/contacts");
  return { created, updated, skipped, errors };
}

/** 同梱の会社リスト（data/*.csv）を取り込む（管理者） */
export async function importBundledCompaniesAction(): Promise<void> {
  const { assertAdmin } = await import("@/lib/auth");
  await assertAdmin();
  const { importCompanyLists } = await import("@/lib/import-companies");
  const r = await importCompanyLists();
  // 取り込んだ会社名で、セールスハブの過去メッセージから紹介候補を再抽出
  const { rebuildCandidates } = await import("@/lib/saleshub/rules");
  const c = await rebuildCandidates().catch(() => ({ created: 0 }));
  revalidatePath("/contacts");
  revalidatePath("/referrals");
  redirect(`/contacts?imported=${r.created}&updated=${r.updated}&candidates=${c.created}`);
}
