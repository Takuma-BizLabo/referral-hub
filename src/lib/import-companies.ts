import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { prisma } from "./db";

/**
 * data/saleshub_registered.csv（セールスハブ掲載済み企業）と data/connections.csv（繋がりリスト）を
 * 繋がりリストへ取り込む。会社名が一致する行は1件にまとめ、既存の繋がりは更新する。
 */
function norm(s: string) {
  return (s ?? "")
    .replace(/[\s　]+/g, "")
    .replace(/株式会社|有限会社|合同会社|\(株\)|（株）|㈱/g, "")
    .toLowerCase();
}
function clean(v: unknown) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}
function prefecture(addr: string | null) {
  const m = (addr ?? "").match(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/);
  return m ? m[1] : addr;
}
type Row = Record<string, string>;
function readCsv(file: string): Row[] {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  return parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true }) as Row[];
}
function col(row: Row, ...names: string[]) {
  for (const key of Object.keys(row)) {
    const k = key.replace(/\s+/g, "");
    if (names.some((n) => k.includes(n))) {
      const v = clean(row[key]);
      if (v) return v;
    }
  }
  return null;
}

export async function importCompanyLists(): Promise<{ registered: number; connections: number; created: number; updated: number }> {
  const registered = readCsv("data/saleshub_registered.csv");
  const connections = readCsv("data/connections.csv");

  type Merged = {
    company: string;
    name: string | null;
    title: string | null;
    dept: string | null;
    region: string | null;
    employeeSize: string | null;
    industry: string | null;
    hp: string | null;
    owner: string | null;
    rank: string | null;
    channel: string | null;
    onSaleshub: boolean;
  };
  const map = new Map<string, Merged>();
  const blank = (company: string): Merged => ({
    company,
    name: null,
    title: null,
    dept: null,
    region: null,
    employeeSize: null,
    industry: null,
    hp: null,
    owner: null,
    rank: null,
    channel: null,
    onSaleshub: false,
  });

  for (const r of registered) {
    const company = col(r, "セールスハブ登録名") ?? col(r, "会社名");
    if (!company || !/\D/.test(company)) continue;
    const m = blank(company);
    m.title = col(r, "役職");
    m.dept = col(r, "部署");
    m.region = prefecture(col(r, "所在地"));
    m.onSaleshub = true;
    map.set(norm(company), m);
  }
  for (const r of connections) {
    const company = col(r, "会社名");
    if (!company) continue;
    const key = norm(company);
    const base = map.get(key) ?? blank(company);
    base.name = col(r, "担当氏名") ?? base.name;
    base.title = col(r, "担当者役職") ?? base.title;
    base.employeeSize = col(r, "従業員数");
    base.industry = col(r, "事業内容");
    base.hp = col(r, "HP");
    base.owner = col(r, "保有者");
    base.rank = col(r, "ランク");
    base.channel = col(r, "連絡手段", "列1");
    map.set(key, base);
  }

  const existing = await prisma.contact.findMany();
  let created = 0;
  let updated = 0;
  for (const m of map.values()) {
    const name = m.name ?? `担当者（${[m.dept, m.title].filter(Boolean).join("・") || "氏名未登録"}）`;
    const memo = [
      m.owner ? `繋がり保有者: ${m.owner}` : null,
      m.rank ? `ランク: ${m.rank}` : null,
      m.channel ? `連絡手段: ${m.channel}` : null,
      m.dept ? `部署: ${m.dept}` : null,
      m.hp ? `HP: ${m.hp}` : null,
      m.onSaleshub ? "セールスハブ掲載済み" : null,
    ]
      .filter(Boolean)
      .join(" / ");
    const tags = [m.onSaleshub ? "セールスハブ掲載" : null, m.owner ? `保有者:${m.owner}` : null, m.rank ? `ランク${m.rank}` : null].filter((x): x is string => !!x);
    const data = {
      name,
      company: m.company,
      title: m.title,
      industry: m.industry,
      employeeSize: m.employeeSize ? `${m.employeeSize}名` : null,
      region: m.region,
      otherContact: m.channel,
      isOnSaleshub: m.onSaleshub,
      relationMemo: memo || null,
    };
    const hit = existing.find((c) => norm(c.company ?? "") === norm(m.company));
    const contact = hit
      ? await prisma.contact.update({ where: { id: hit.id }, data: { ...data, name: hit.name.startsWith("担当者（") ? name : hit.name } })
      : await prisma.contact.create({ data });
    if (hit) updated++;
    else created++;
    for (const t of tags) {
      const tag = await prisma.tag.upsert({ where: { name: t }, update: {}, create: { name: t } });
      await prisma.contactTag.upsert({ where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } }, update: {}, create: { contactId: contact.id, tagId: tag.id } });
    }
  }
  return { registered: registered.length, connections: connections.length, created, updated };
}
