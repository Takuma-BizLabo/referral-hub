import * as cheerio from "cheerio";
import { createHash } from "node:crypto";

export type ParsedThread = {
  proposalId: string;
  vendorName: string;
  requestTitle: string | null;
  lastSnippet: string | null;
  stage: string | null;
};

export type ParsedMessage = {
  senderName: string;
  isMine: boolean; // こちら側（サポーター）の発言
  sentAt: Date;
  body: string;
};

function clean(s: string | undefined | null) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** /my/messages のスレッド一覧 HTML を解析 */
export function parseThreadList(html: string): ParsedThread[] {
  const $ = cheerio.load(html);
  const out: ParsedThread[] = [];
  const seen = new Set<string>();
  $('a[href^="/proposals/"]').each((_, el) => {
    const a = $(el);
    const m = (a.attr("href") ?? "").match(/\/proposals\/(\d+)/);
    if (!m || seen.has(m[1])) return;
    const vendorName = clean(a.find(".thread-block-opponent .u-fw-b").first().text());
    if (!vendorName) return;
    seen.add(m[1]);
    out.push({
      proposalId: m[1],
      vendorName,
      requestTitle: clean(a.find(".thread-block-business-name").first().text()) || null,
      lastSnippet: clean(a.find(".thread-block-latest-message").first().text()) || null,
      stage: clean(a.find(".c-label").first().text()) || null,
    });
  });
  return out;
}

/** "2026/10/05 04:11"（JST）を Date に */
export function parseJstDateTime(s: string): Date | null {
  const m = s.trim().match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi));
}

/** /proposals/{id} のメッセージを解析（古い順） */
export function parseThreadMessages(html: string): ParsedMessage[] {
  const $ = cheerio.load(html);
  const out: ParsedMessage[] = [];
  $(".message-item").each((_, el) => {
    const item = $(el);
    const content = item.find(".message-item-content").first();
    const isMine = /-supporter/.test(content.attr("class") ?? "");
    const senderName = clean(item.find(".message-item-name").first().text());
    const sentAt = parseJstDateTime(clean(item.find(".message-item-time").first().text()));
    const balloon = item.find(".message-item-balloon").first();
    const paras: string[] = [];
    balloon.find("p").each((__, p) => {
      const $p = $(p);
      $p.find("br").replaceWith("\n");
      const t = $p
        .text()
        .split("\n")
        .map((l) => l.replace(/[ \t　]+/g, " ").trim())
        .filter(Boolean)
        .join("\n");
      if (t) paras.push(t);
    });
    let body = paras.join("\n");
    if (!body) body = clean(balloon.text());
    const files = balloon
      .find("a[href]")
      .map((__, a) => clean($(a).text()))
      .get()
      .filter(Boolean);
    if (files.length) body += `\n[添付: ${files.join(", ")}]`;
    if (!sentAt || !body) return;
    out.push({ senderName: senderName || (isMine ? "自分" : "ベンダー"), isMine, sentAt, body });
  });
  return out;
}

export function messageKey(proposalId: string, m: ParsedMessage) {
  const h = createHash("sha1").update(m.body).digest("hex").slice(0, 10);
  return `${proposalId}:${m.sentAt.toISOString()}:${h}`;
}

/** 取込画面に貼る用のテキスト */
export function formatThreadAsText(
  vendorName: string,
  requestTitle: string | null,
  messages: { senderName: string; isMine: boolean; sentAt: Date; body: string }[],
) {
  const lines: string[] = [`【ベンダー】${vendorName}`];
  if (requestTitle) lines.push(`【依頼】${requestTitle}`);
  lines.push("");
  for (const m of messages) {
    const t = m.sentAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    lines.push(`---- ${m.senderName}${m.isMine ? "（自分）" : `（${vendorName}）`} ${t}`);
    lines.push(m.body, "");
  }
  return lines.join("\n").trim();
}

// ---------- 自動化ルール用の抽出 ----------

export const URL_RE = /https?:\/\/[^\s<>"'）)」』]+/g;

/** 打ち合わせ・日程調整の依頼っぽいか（ベンダー発言向け） */
export function looksLikeMeetingRequest(body: string) {
  if (URL_RE.test(body)) {
    URL_RE.lastIndex = 0;
    return true;
  }
  URL_RE.lastIndex = 0;
  return /打ち?合わ?せ|お時間|日程|ミーティング|MTG|面談|ご説明の時間|お話|ご都合|候補日|予約/i.test(body);
}

export const COMPANY_RE = /((?:株式会社|有限会社|合同会社|一般社団法人|公益財団法人)[^\s\/／（(、。,．「」『』]+|[^\s\/／（(、。,．「」『』]{1,30}?(?:株式会社|有限会社|合同会社|ホールディングス|Inc\.?|Co\.,? ?Ltd\.?))/g;

/** 本文中の会社名候補（「株式会社○○ / 部署(役職)」の部署情報付き） */
export function extractCompanies(body: string, exclude: string[] = []): { company: string; dept: string | null }[] {
  const out: { company: string; dept: string | null }[] = [];
  const ex = exclude.map(normalizeCompanyName);
  for (const line of body.split("\n")) {
    const matches = line.match(COMPANY_RE);
    if (!matches) continue;
    for (const c of matches) {
      const name = trimCompanyTail(c.trim());
      const n = normalizeCompanyName(name);
      if (!n || n.length < 2) continue;
      if (ex.some((e) => e && (n === e || n.includes(e) || e.includes(n)))) continue;
      if (out.some((o) => normalizeCompanyName(o.company) === n)) continue;
      const after = line.slice(line.indexOf(name) + name.length);
      const dept = after.match(/[\/／]\s*([^\s、。]+)/)?.[1] ?? null;
      out.push({ company: name, dept });
    }
  }
  return out;
}

/** 「株式会社○○さまもご興味…」のように後続の助詞・敬称まで拾った場合に切り落とす */
export function trimCompanyTail(name: string) {
  const m = name.match(/^(株式会社|有限会社|合同会社|一般社団法人|公益財団法人)?(.*)$/);
  if (!m) return name;
  const prefix = m[1] ?? "";
  let rest = m[2];
  // 先頭2文字は固有名として残し、それ以降で助詞・敬称・活用語尾が出たら切る
  const cut = rest.slice(2).search(/(さま|様|さん|殿|御中|も|の|が|は|を|に|と|で|へ|から|まで|です|にて|より)/);
  if (cut >= 0) rest = rest.slice(0, 2 + cut);
  return prefix + rest;
}

export function normalizeCompanyName(s: string) {
  return s
    .replace(/[\s　]+/g, "")
    .replace(/株式会社|有限会社|合同会社|一般社団法人|公益財団法人|\(株\)|（株）|\(有\)|（有）|㈱|㈲|さん$|様$/g, "")
    .toLowerCase();
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * 本文から打ち合わせ日時を読み取る（JST）。例:
 *  "10月9日（金）11:40-12:10" / "10/13 16:00-" / "13日16:00-" / "木曜日 · 午前11:00～11:30" / "明日15時"
 * base は発言日時。見つからなければ null。
 */
export function extractMeetingDateTime(body: string, base: Date): Date | null {
  const jst = new Date(base.getTime() + 9 * 3600 * 1000); // JST 基準の年月日計算用
  const baseY = jst.getUTCFullYear();
  const baseM = jst.getUTCMonth(); // 0-based
  const baseD = jst.getUTCDate();
  const baseDow = jst.getUTCDay();

  const time = (h: number, mi: number, ampm?: string) => {
    if (ampm && /午後|PM/i.test(ampm) && h < 12) h += 12;
    return { h, mi };
  };
  const timeRe = /(午前|午後|AM|PM)?\s*(\d{1,2})(?::|時)(\d{2})?分?/i;
  const make = (y: number, mo: number, d: number, h: number, mi: number) => new Date(Date.UTC(y, mo, d, h - 9, mi));

  // 1) 月日あり: 10月9日 / 10/9
  let m = body.match(/(\d{1,2})\s*[月\/]\s*(\d{1,2})\s*日?\s*(?:[（(][月火水木金土日][)）])?\s*(?:の)?\s*(午前|午後|AM|PM)?\s*(\d{1,2})(?::|時)(\d{2})?/i);
  if (m) {
    const mo = Number(m[1]) - 1;
    const d = Number(m[2]);
    const { h, mi } = time(Number(m[4]), Number(m[5] ?? 0), m[3]);
    let y = baseY;
    if (mo < baseM - 1) y += 1; // 年またぎ
    return make(y, mo, d, h, mi);
  }
  // 2) 日のみ: 13日16:00
  m = body.match(/(?<![\d月\/])(\d{1,2})\s*日\s*(?:[（(][月火水木金土日][)）])?\s*(午前|午後|AM|PM)?\s*(\d{1,2})(?::|時)(\d{2})?/i);
  if (m) {
    const d = Number(m[1]);
    const { h, mi } = time(Number(m[3]), Number(m[4] ?? 0), m[2]);
    let mo = baseM;
    let y = baseY;
    if (d < baseD) {
      mo += 1;
      if (mo > 11) {
        mo = 0;
        y += 1;
      }
    }
    return make(y, mo, d, h, mi);
  }
  // 3) 曜日: 木曜日 · 午前11:00
  m = body.match(/([月火水木金土日])曜日?[^\d]{0,6}(午前|午後|AM|PM)?\s*(\d{1,2})(?::|時)(\d{2})?/i);
  if (m) {
    const dow = WEEKDAYS.indexOf(m[1]);
    const { h, mi } = time(Number(m[3]), Number(m[4] ?? 0), m[2]);
    let diff = (dow - baseDow + 7) % 7;
    if (diff === 0) diff = 7; // 同じ曜日なら翌週扱い
    const d = new Date(Date.UTC(baseY, baseM, baseD + diff));
    return make(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, mi);
  }
  // 4) 明日 / 明後日
  m = body.match(/(明日|明後日)[^\d]{0,6}(午前|午後|AM|PM)?\s*(\d{1,2})(?::|時)(\d{2})?/i);
  if (m) {
    const add = m[1] === "明日" ? 1 : 2;
    const { h, mi } = time(Number(m[3]), Number(m[4] ?? 0), m[2]);
    const d = new Date(Date.UTC(baseY, baseM, baseD + add));
    return make(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, mi);
  }
  void timeRe;
  return null;
}
