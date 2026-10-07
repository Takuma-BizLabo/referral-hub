/**
 * セールスハブ本文の解析（日時・会社名）のテスト。依存追加なしで tsx で実行する。
 *   npx tsx scripts/test-parse.ts
 * 失敗があれば終了コード 1。
 */
import assert from "node:assert/strict";
import { extractCompanies, extractMeetingDateTime, looksLikeMeetingRequest } from "../src/lib/saleshub/parse";

/** JST の "YYYY-MM-DD HH:mm" を Date に */
function jst(s: string): Date {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) throw new Error(`bad date ${s}`);
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi));
}
function fmt(d: Date | null) {
  if (!d) return "null";
  const j = new Date(d.getTime() + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())} ${p(j.getUTCHours())}:${p(j.getUTCMinutes())}`;
}

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    failures.push(`✗ ${name}\n    ${e instanceof Error ? e.message.split("\n").join("\n    ") : String(e)}`);
  }
}

// ---------- 日時 ----------
// base は発言日時（JST）。2026-10-07 は水曜、2026-10-05 は月曜。
const dateCases: { body: string; base: string; want: string | null; note?: string }[] = [
  { body: "10月9日（金）11:40-12:00でお願いします", base: "2026-10-07 10:00", want: "2026-10-09 11:40" },
  { body: "13日16:00-はいかがでしょうか", base: "2026-10-07 10:00", want: "2026-10-13 16:00" },
  { body: "木曜日 · 午前11:00～11:30", base: "2026-10-07 10:00", want: "2026-10-08 11:00" },
  { body: "火曜日 · 午後2:00～2:30", base: "2026-10-07 10:00", want: "2026-10-13 14:00", note: "曜日のあとの午後を落とさない" },
  { body: "明日15時からでお願いします", base: "2026-10-07 10:00", want: "2026-10-08 15:00" },
  { body: "10/14 10:30 で確定です", base: "2026-10-07 10:00", want: "2026-10-14 10:30" },
  { body: "来週火曜 14:00 はいかがでしょう", base: "2026-10-05 10:00", want: "2026-10-13 14:00", note: "月曜の発言でも翌週の火曜" },
  { body: "来週火曜 14:00 はいかがでしょう", base: "2026-10-07 10:00", want: "2026-10-13 14:00" },
  { body: "今週金曜 10時でお願いします", base: "2026-10-07 10:00", want: "2026-10-09 10:00" },
  { body: "12/30 10:00 でお願いします", base: "2026-12-20 10:00", want: "2026-12-30 10:00", note: "年またぎで翌年にならない" },
  { body: "12/30 10:00 の件、ありがとうございました", base: "2027-01-02 10:00", want: "2026-12-30 10:00", note: "年明け直後に前年末の日付" },
  { body: "1月5日 10:00 でお願いします", base: "2026-12-20 10:00", want: "2027-01-05 10:00", note: "12月の発言なら翌年" },
  { body: "１０月９日（金）１１：４０〜", base: "2026-10-07 10:00", want: "2026-10-09 11:40", note: "全角数字・全角コロン" },
  { body: "10月9日 13時半から", base: "2026-10-07 10:00", want: "2026-10-09 13:30", note: "○時半" },
  { body: "2027年1月8日 9:30 で確定", base: "2026-12-20 10:00", want: "2027-01-08 09:30", note: "年の明記" },
  { body: "10月9日（金曜日）の11:40", base: "2026-10-07 10:00", want: "2026-10-09 11:40" },
  { body: "よろしくお願いいたします。", base: "2026-10-07 10:00", want: null },
  { body: "従業員数100名以上1000名未満の企業", base: "2026-10-07 10:00", want: null },
  { body: "2月30日 10:00", base: "2026-10-07 10:00", want: null, note: "存在しない日付" },
  { body: "10月32日 10:00", base: "2026-10-07 10:00", want: null, note: "存在しない日" },
  { body: "10月9日 24:00", base: "2026-10-07 10:00", want: null, note: "存在しない時刻" },
  { body: "ご都合のよろしい日程は 10月9日 11:40 または 10月13日 16:00 です", base: "2026-10-07 10:00", want: "2026-10-09 11:40", note: "複数候補なら先頭" },
  { body: "2026/10/20 14:00 でお願いします", base: "2026-10-07 10:00", want: "2026-10-20 14:00", note: "年つきの日付" },
];
for (const c of dateCases) {
  test(`日時: ${c.body}（${c.base}発言）${c.note ? ` - ${c.note}` : ""}`, () => {
    const got = extractMeetingDateTime(c.body, jst(c.base));
    assert.equal(fmt(got), c.want ?? "null");
  });
}

// ---------- 会社名 ----------
const companyCases: { body: string; want: string[]; exclude?: string[]; note?: string }[] = [
  { body: "株式会社イメージ・マジックさまもご興味がありそうです", want: ["株式会社イメージ・マジック"] },
  { body: "カネ美食品さまの件、承知しました", want: ["カネ美食品"] },
  { body: "株式会社がくまるくんの代表とお繋ぎできます", want: ["株式会社がくまるくん"] },
  { body: "アデコ株式会社LHH Japan の部長です", want: ["アデコ株式会社"] },
  { body: "弊社はアデコ株式会社の方と面識があります", want: ["アデコ株式会社"], note: "先頭の「弊社は」を含めない" },
  { body: "ほけんの窓口グループ株式会社さま", want: ["ほけんの窓口グループ株式会社"], note: "後ろが法人格なら途中の「の」で切らない" },
  { body: "株式会社エスプール / 人事部(課長クラス)", want: ["株式会社エスプール"] },
  { body: "弊社は株式会社ファーストの佐藤です", want: ["株式会社ファースト"], note: "助詞のあとの「株式会社」は前置の法人格として読む" },
  { body: "ご紹介は株式会社日本(JP)です", want: ["株式会社日本"] },
  { body: "社名は株式会社 テストです", want: [], note: "法人格のあとが区切りなら社名として拾わない" },
  { body: "有限会社山田商店、株式会社田中製作所にもお繋ぎできます", want: ["有限会社山田商店", "株式会社田中製作所"] },
  { body: "トヨタ自動車株式会社さまもご興味があるとのことです", want: ["トヨタ自動車株式会社"] },
  { body: "株式会社テストベンダーの山田です", want: [], exclude: ["株式会社テストベンダー"], note: "ベンダー自身は除外" },
  { body: "松田さまの件、承知しました", want: [], note: "人名は会社として拾わない" },
  { body: "よろしくお願いいたします。", want: [] },
];
for (const c of companyCases) {
  test(`会社名: ${c.body}${c.note ? ` - ${c.note}` : ""}`, () => {
    const got = extractCompanies(c.body, c.exclude ?? []).map((x) => x.company);
    assert.deepEqual(got, c.want);
  });
}
test("会社名: 部署の読み取り", () => {
  const got = extractCompanies("株式会社エスプール / 人事部(課長クラス)");
  assert.equal(got[0]?.dept, "人事部(課長クラス)");
});


// ---- 打ち合わせ依頼の判定（実際のセールスハブの文面） ----
const meetingYes: [string, string][] = [
  ["TimeRex URL", "まずはお気軽に事前打ち合わせにご予約下さいませ。\n◆事前打ち合わせのご予約用URL：https://timerex.net/s/flierinc/c8654bc0"],
  ["jicoo URL", "下記URLが私の空き予定となっておりますので、ご都合のよろしいお時間をお選びくださいますと幸いです。\nご調整用URL：https://www.jicoo.com/t/betterplace/e/yESmS8w0evgG"],
  ["Spir URL", "下記URLより、ご都合のよい日時をお選びいただけますと幸いです。 https://app.spirinc.com/t/abc/as/def/confirm"],
  ["説明の時間", "まずは一度、サービス概要や事例などのご説明の時間をいただけますと幸いです。お打ち合わせはオンラインを想定しています。"],
  ["打ち合わせのお時間", "まずは上記から事前お打ち合わせのお時間を頂戴できますでしょうか。"],
  ["ご都合", "来週でご都合のよい日時をいくつかご教示いただけますでしょうか。"],
];
const meetingNo: [string, string][] = [
  ["社内確認中（ペイメントフォー）", "このたびはお声がけいただき、誠にありがとうございます。\n株式会社アッカ・インターナショナル様につきまして、\n社内で確認の上、改めてご連絡させていただきます。\n回答まで1週間ほどお時間をいただく可能性がございますが、\nご了承いただけますと幸いです。"],
  ["対象外の連絡", "商談対象外との件、承知いたしました。ご確認いただきありがとうございました。"],
  ["資料URLだけ", "サービス資料はこちらです。https://example.com/docs/service.pdf ご確認ください。"],
  ["確認しました", "確認いたしました。当日はよろしくお願いいたします。"],
];
for (const [name, body] of meetingYes) test(`打ち合わせ依頼あり: ${name}`, () => assert.equal(looksLikeMeetingRequest(body), true));
for (const [name, body] of meetingNo) test(`打ち合わせ依頼なし: ${name}`, () => assert.equal(looksLikeMeetingRequest(body), false));

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`\n${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`all ${passed} tests passed`);
