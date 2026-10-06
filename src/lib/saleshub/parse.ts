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

/** 依頼ページの「ご協力金 ¥40,000」を読み取る（円） */
export function parseProposalFee(html: string): number | null {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const m = text.match(/協力金[^0-9¥￥]{0,40}[¥￥]?\s*([\d,]{4,})/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
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

/** 会社名抽出ロジックのバージョン。変更したら上げる（SaleshubThread.proposedCache が再計算される） */
export const COMPANY_PARSER_VERSION = 2;

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

const LEGAL_PREFIX_RE = /^(株式会社|有限会社|合同会社|一般社団法人|公益財団法人)/;
const LEGAL_SUFFIX_RE = /(株式会社|有限会社|合同会社|ホールディングス|Inc\.?|Co\.,? ?Ltd\.?)$/;

/**
 * 法人格のない会社名（「カネ美食品さまの件」など）。業種を表す語で終わり、直後に敬称が付くものだけを拾う。
 * 人名（「松田さま」）を拾わないよう、業種語で終わることを必須にしている。
 */
const INDUSTRY_NAME_RE =
  /([一-龯々ァ-ヶーA-Za-z0-9・&]{1,20}?(?:食品|工業|商事|物産|製作所|製薬|化学|電機|電気|電工|建設|工務店|不動産|産業|興業|技研|銀行|証券|保険|生命|運輸|物流|倉庫|自動車|鉄道|航空|商会|商店|印刷|出版|新聞|放送|百貨店|製菓|酒造|製紙|鉄鋼|重工|精機|薬品|ホールディングス|グループ|ジャパン))(?=さま|様|さん|社|御中|殿)/g;

/** 自社・相手を指す語（会社名として扱わない） */
const SELF_WORD_RE = /^(弊社|御社|貴社|当社|同社|他社|各社|自社)/;

/** 本文中の会社名候補（「株式会社○○ / 部署(役職)」の部署情報付き） */
export function extractCompanies(body: string, exclude: string[] = []): { company: string; dept: string | null }[] {
  const out: { company: string; dept: string | null }[] = [];
  const ex = exclude.map(normalizeCompanyName);
  const add = (line: string, raw: string) => {
    const name = trimCompanyTail(trimCompanyHead(raw.trim()));
    if (SELF_WORD_RE.test(name) && !LEGAL_SUFFIX_RE.test(name)) return;
    const n = normalizeCompanyName(name);
    if (!n || n.length < 2) return;
    if (ex.some((e) => e && (n === e || n.includes(e) || e.includes(n)))) return;
    if (out.some((o) => {
      const on = normalizeCompanyName(o.company);
      return on === n || on.includes(n) || n.includes(on);
    })) return;
    const after = line.slice(line.indexOf(name) + name.length);
    const dept = after.match(/[\/／]\s*([^\s、。]+)/)?.[1] ?? null;
    out.push({ company: name, dept });
  };
  for (const line of body.split("\n")) {
    for (const c of line.match(COMPANY_RE) ?? []) add(line, c);
    for (const c of line.match(INDUSTRY_NAME_RE) ?? []) add(line, c);
  }
  return out;
}

/**
 * 「弊社はアデコ株式会社」のように、法人格が後ろに付く会社名の前に文が付いてしまった場合に切り落とす。
 * 直前が漢字・カタカナなどの「は・が・を・へ・から・より・では・には・とは・、」で区切る
 * （「がくまるくん株式会社」のように先頭がひらがなの社名は切らない）。
 */
export function trimCompanyHead(name: string) {
  if (LEGAL_PREFIX_RE.test(name)) return name;
  const re = /(?<=[一-龯々ァ-ヶーA-Za-z0-9])(?:は|が|を|へ|から|より|では|には|とは)|[、。:：」』）)]/g;
  let cut = -1;
  for (const m of name.matchAll(re)) cut = m.index! + m[0].length;
  if (cut <= 0) return name;
  const rest = name.slice(cut);
  return normalizeCompanyName(rest).length >= 2 ? rest : name;
}

/** 「株式会社○○さまもご興味…」のように後続の助詞・敬称まで拾った場合に切り落とす */
export function trimCompanyTail(name: string) {
  // 法人格で終わる社名（「ほけんの窓口グループ株式会社」）は途中の助詞で切らない
  if (LEGAL_SUFFIX_RE.test(name) && !LEGAL_PREFIX_RE.test(name)) return name;
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
const DOW = "[月火水木金土日]";
/** 時刻: 11:40 / 午前11:00 / 15時 / 13時半 / 9時30分 */
const TIME = String.raw`(午前|午後|AM|PM)?\s*(\d{1,2})(?::(\d{2})|時(?:\s*(\d{1,2})\s*分|(半))?)`;

type TimeMatch = { h: number; mi: number } | null;
function readTime(ampm: string | undefined, h: string, m1: string | undefined, m2: string | undefined, han: string | undefined): TimeMatch {
  let hh = Number(h);
  const mi = m1 !== undefined ? Number(m1) : m2 !== undefined ? Number(m2) : han ? 30 : 0;
  if (ampm && /午後|PM/i.test(ampm) && hh < 12) hh += 12;
  if (ampm && /午前|AM/i.test(ampm) && hh === 12) hh = 0;
  if (hh > 23 || mi > 59) return null;
  return { h: hh, mi };
}

/**
 * 本文から打ち合わせ日時を読み取る（JST）。例:
 *  "10月9日（金）11:40-12:10" / "10/13 16:00-" / "13日16:00-" / "木曜日 · 午前11:00～11:30" / "明日15時"
 *  "来週火曜 14:00" / "今週金曜 10時" / "2027年1月8日 9:30" / 全角数字
 * base は発言日時。見つからなければ null。
 * 年の省略時は、発言日の45日前以降で最も近い年を採る（12月の発言で「1月5日」→翌年、1月の発言で「12/30」→前年）。
 */
export function extractMeetingDateTime(body: string, base: Date): Date | null {
  const text = body.normalize("NFKC"); // 全角数字・全角コロン・全角括弧を半角に
  const jst = new Date(base.getTime() + 9 * 3600 * 1000); // JST 基準の年月日計算用
  const baseY = jst.getUTCFullYear();
  const baseM = jst.getUTCMonth(); // 0-based
  const baseD = jst.getUTCDate();
  const baseDow = jst.getUTCDay();

  const make = (y: number, mo: number, d: number, h: number, mi: number) => new Date(Date.UTC(y, mo, d, h - 9, mi));
  /** 存在する日付か（2/30 などを弾く） */
  const valid = (y: number, mo: number, d: number) => {
    const t = new Date(Date.UTC(y, mo, d));
    return mo >= 0 && mo <= 11 && t.getUTCFullYear() === y && t.getUTCMonth() === mo && t.getUTCDate() === d;
  };
  const dowParen = String.raw`(?:\s*\(${DOW}(?:曜日?)?\))?`;

  // 1) 月日あり: 10月9日 / 10/9 / 2027年1月8日 / 2027/1/8
  let m = text.match(new RegExp(String.raw`(?<!\d)(?:(\d{4})\s*[年/]\s*)?(\d{1,2})\s*[月/]\s*(\d{1,2})(?!\d)\s*日?${dowParen}[\s,、]*(?:の)?\s*${TIME}`, "i"));
  if (m) {
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const t = readTime(m[4], m[5], m[6], m[7], m[8]);
    if (!t) return null;
    if (m[1]) {
      const y = Number(m[1]);
      return valid(y, mo, d) ? make(y, mo, d, t.h, t.mi) : null;
    }
    const floor = base.getTime() - 45 * 86400_000;
    for (const y of [baseY - 1, baseY, baseY + 1]) {
      if (!valid(y, mo, d)) continue;
      const at = make(y, mo, d, t.h, t.mi);
      if (at.getTime() >= floor) return at;
    }
    return null;
  }
  // 2) 日のみ: 13日16:00（過ぎた日なら翌月）
  m = text.match(new RegExp(String.raw`(?<![\d月/])(\d{1,2})\s*日${dowParen}[\s,、]*(?:の)?\s*${TIME}`, "i"));
  if (m) {
    const d = Number(m[1]);
    const t = readTime(m[2], m[3], m[4], m[5], m[6]);
    if (!t) return null;
    let mo = baseM;
    let y = baseY;
    if (d < baseD) {
      mo += 1;
      if (mo > 11) {
        mo = 0;
        y += 1;
      }
    }
    return valid(y, mo, d) ? make(y, mo, d, t.h, t.mi) : null;
  }
  // 3) 曜日: 木曜日 · 午前11:00 / 来週火曜 14:00 / 今週金曜 10時
  m = text.match(new RegExp(String.raw`(再来週|来週|今週)?\s*(?:の)?\s*(${DOW})曜(?:日)?[^\d]{0,8}?${TIME}`, "i"));
  if (m) {
    const dow = WEEKDAYS.indexOf(m[2]);
    const t = readTime(m[3], m[4], m[5], m[6], m[7]);
    if (!t) return null;
    let add: number;
    if (m[1]) {
      // 週は月曜はじまり。今週=今週の該当曜日、来週=翌週、再来週=翌々週
      const toMonday = (baseDow + 6) % 7;
      const weeks = m[1] === "再来週" ? 2 : m[1] === "来週" ? 1 : 0;
      add = -toMonday + weeks * 7 + ((dow + 6) % 7);
    } else {
      add = (dow - baseDow + 7) % 7;
      if (add === 0) add = 7; // 同じ曜日なら翌週扱い
    }
    const d = new Date(Date.UTC(baseY, baseM, baseD + add));
    return make(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), t.h, t.mi);
  }
  // 4) 今日 / 明日 / 明後日
  m = text.match(new RegExp(String.raw`(本日|今日|明日|あす|明後日|あさって)[^\d]{0,6}?${TIME}`, "i"));
  if (m) {
    const add = m[1] === "明後日" || m[1] === "あさって" ? 2 : m[1] === "明日" || m[1] === "あす" ? 1 : 0;
    const t = readTime(m[2], m[3], m[4], m[5], m[6]);
    if (!t) return null;
    const d = new Date(Date.UTC(baseY, baseM, baseD + add));
    return make(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), t.h, t.mi);
  }
  return null;
}
