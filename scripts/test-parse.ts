/**
 * セールスハブ本文の解析（日時・会社名）のテスト。依存追加なしで tsx で実行する。
 *   npx tsx scripts/test-parse.ts
 * 失敗があれば終了コード 1。
 */
import assert from "node:assert/strict";
import { classPartOf, judgeFee } from "../src/lib/fee-table";
import { joinTitle, splitTitle } from "../src/lib/title";
import { matchCandidate, matchVendorCriteria, parseCriteria, parseVendorCriteria } from "../src/lib/candidates";
import { referralTotals } from "../src/lib/referral-totals";
import { classifyScheduleMessage, evaluateThreadSchedule, extractCompanies, findDeclinedCompanies, extractMeetingDateTime, looksLikeMeetingRequest } from "../src/lib/saleshub/parse";

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


// ---- 日程の「提示」と「確定」 ----
const base12 = jst("2026-10-12 02:39");
test("候補日の提示（複数日）は確定にしない", () => {
  const body = "稲嶺様\nお世話になっております。\n以下、私の空き日程になりますので株式会社Works Human Intelligence様にお伝えいただけますでしょうか。\n---\n10/16 15:00-18:00\n10/19 11:00-12:00,13:00-18:00\n10/20 11:00-12:00,13:00-18:00\n---";
  assert.equal(classifyScheduleMessage(body, base12).kind, "proposal");
  assert.equal(evaluateThreadSchedule([{ isMine: true, sentAt: base12, body }]).confirmedAt, null);
});
test("1日内の複数時間帯も候補扱い", () => {
  assert.equal(classifyScheduleMessage("10/19 11:00-12:00,13:00-18:00 でいかがでしょうか", base12).kind, "proposal");
});
test("ベンダーの『この日時でお願いします』＋入室URLは確定", () => {
  const b = jst("2026-10-05 13:27");
  const body = "松田さま\nでは、10月9日（金）11:40-12:00でお願いいたします。\nお時間になりましたら、下記へご入室をお願いします。\n= 10月 9日 (金曜日) · 午前11:40～午後12:00\nビデオ通話のリンク: https://meet.google.com/kae-hdie-wmd";
  const r = evaluateThreadSchedule([{ isMine: false, sentAt: b, body }]);
  assert.equal(fmt(r.confirmedAt), "2026-10-09 11:40");
});
test("予約した旨の連絡は確定", () => {
  const b = jst("2026-10-06 23:47");
  const r = evaluateThreadSchedule([{ isMine: true, sentAt: b, body: "13日16:00-\nに再度ご日程調整させていただきました。\n何卒よろしくお願いいたします。" }]);
  assert.equal(fmt(r.confirmedAt), "2026-10-13 16:00");
});
test("日時1つ→相手が『確認いたしました』で確定", () => {
  const r = evaluateThreadSchedule([
    { isMine: true, sentAt: jst("2026-10-07 00:19"), body: "saleshub事前打ち合わせ\n木曜日 · 午前11:00～11:30\nよろしくお願いいたします。" },
    { isMine: false, sentAt: jst("2026-10-07 00:37"), body: "確認いたしました。\n当日はよろしくお願いいたします。" },
  ]);
  assert.equal(fmt(r.confirmedAt), "2026-10-08 11:00");
});
test("日時1つだけで相手の返事がなければ未確定", () => {
  const r = evaluateThreadSchedule([{ isMine: true, sentAt: jst("2026-10-07 00:19"), body: "木曜日 11:00～11:30 はいかがでしょうか" }]);
  assert.equal(r.confirmedAt, null);
});
test("確定後に新しい候補が出たら未確定に戻る", () => {
  const r = evaluateThreadSchedule([
    { isMine: true, sentAt: jst("2026-10-05 16:01"), body: "【10月6日（火）15:00-15:30】で予約させていただきました。" },
    { isMine: false, sentAt: jst("2026-10-06 16:55"), body: "再度、下記の日程からお選びください。\n10/13 16:00-\n10/14 10:00-" },
  ]);
  assert.equal(r.confirmedAt, null);
});
test("相手が日時を1つ提示→『そちらの日程でぜひ』で確定", () => {
  const r = evaluateThreadSchedule([
    { isMine: false, sentAt: jst("2026-10-12 23:03"), body: "松田様\n\n夜分遅くに失礼いたします。\n\n【10/15（木）16:30-17:00】\nこちらでお願いできますでしょうか。" },
    { isMine: true, sentAt: jst("2026-10-13 14:49"), body: "難波様\n\nお世話になっております。\nそちらの日程でぜひ、よろしくお願いいたします。\n商談URL等ございましたらご共有いただけますと幸いです。\nよろしくお願いいたします。" },
  ]);
  assert.equal(fmt(r.confirmedAt), "2026-10-15 16:30");
});
test("日時1つの提示に『よろしくお願いいたします』だけでは確定しない", () => {
  const r = evaluateThreadSchedule([
    { isMine: false, sentAt: jst("2026-10-12 23:03"), body: "【10/15（木）16:30-17:00】\nこちらでお願いできますでしょうか。" },
    { isMine: true, sentAt: jst("2026-10-13 14:49"), body: "ご連絡ありがとうございます。社内で確認します。よろしくお願いいたします。" },
  ]);
  assert.equal(r.confirmedAt, null);
});
test("ベンダーが紹介見送りと連絡した会社だけを拾う", () => {
  const body = "松田様\n\nご連絡ありがとうございます。\nDriveXの辻です。\n\nオーダースーツSADA様の代表取締役の方をご紹介いただけるとのこと、ありがとうございます。\n\n同社は、生産計画AIスケジューラ「スマート生産計画」のご提案対象ですが、すでに別のサポーター様を通じてお話を進めております。\n重複でのご連絡を避けるため、今回はSADA様へのご紹介を見送らせていただければと存じます。せっかくお声がけいただいたところ、申し訳ございません。\n一方で、松田様のおつながりにあるカネ美食品様にも関心を持っております。";
  assert.deepEqual(findDeclinedCompanies(body, ["株式会社オーダースーツSADA", "カネ美食品株式会社", "株式会社イメージ・マジック"]), ["株式会社オーダースーツSADA"]);
});
test("見送りの言葉がなければ何も拾わない", () => {
  assert.deepEqual(findDeclinedCompanies("オーダースーツSADA様をぜひご紹介ください。", ["株式会社オーダースーツSADA"]), []);
});

test("役職の詳細を括弧で併記しても、単価表はクラス部分で判定する", () => {
  assert.equal(classPartOf("課長クラス（採用統括／採用推進部 課長）"), "課長クラス");
  assert.equal(classPartOf("一般社員（人事責任者）"), "一般社員");
  assert.equal(classPartOf("取締役 CHRO"), "取締役 CHRO");
  const rules = [{ role: "HR_HEAD" as const, min: 100, max: 1000, fee: 50000 }];
  const memo = "部署: 人事部";
  const a = judgeFee(rules, { employeeSize: "300名", title: "部長クラス", relationMemo: memo });
  const b = judgeFee(rules, { employeeSize: "300名", title: "部長クラス（経営企画Div. 人事チーム責任者）", relationMemo: memo });
  const c = judgeFee(rules, { employeeSize: "300名", title: "一般社員（人事責任者）", relationMemo: memo });
  assert.deepEqual(b, a);
  assert.notEqual(c.kind, "matched");
});

test("役職をクラスと正確な役職に分ける・まとめる", () => {
  assert.deepEqual(splitTitle("部長クラス（経営企画Div. 人事チーム責任者）"), { cls: "部長クラス", detail: "経営企画Div. 人事チーム責任者" });
  assert.deepEqual(splitTitle("代表取締役"), { cls: "代表取締役", detail: null });
  assert.deepEqual(splitTitle("代表"), { cls: "代表取締役", detail: "代表" });
  assert.deepEqual(splitTitle("執行役員"), { cls: "役員・取締役クラス", detail: "執行役員" });
  assert.deepEqual(splitTitle("部長クラス（営業部長（人事実務兼任））"), { cls: "部長クラス", detail: "営業部長（人事実務兼任）" });
  assert.equal(joinTitle("部長クラス", "人事責任者"), "部長クラス（人事責任者）");
  assert.equal(joinTitle("代表取締役", "代表取締役"), "代表取締役");
  assert.equal(joinTitle(null, "執行役員"), "執行役員");
  assert.equal(joinTitle("一般社員", null), "一般社員");
});

test("候補ピックアップ：条件に合う・要確認・合わない", () => {
  const c = parseCriteria({ minEmployees: 100, maxEmployees: 1000, classes: ["部長クラス", "課長クラス"], dept: "人事", excludeCompanies: ["株式会社NG商事"] });
  const base = { company: "株式会社A", name: "山田", industry: null, region: null, relationMemo: "部署: 人事部" };
  assert.equal(matchCandidate(c, [], { ...base, title: "部長クラス（人事部長）", employeeSize: "300名" }).level, "match");
  assert.equal(matchCandidate(c, [], { ...base, title: "部長クラス", employeeSize: null }).level, "maybe");
  assert.equal(matchCandidate(c, [], { ...base, title: "一般社員", employeeSize: "300名" }).level, "no");
  assert.equal(matchCandidate(c, [], { ...base, title: "部長クラス", employeeSize: "50名" }).level, "no");
  assert.equal(matchCandidate(c, [], { ...base, company: "NG商事株式会社", title: "部長クラス", employeeSize: "300名" }).level, "no");
  assert.equal(matchCandidate(parseCriteria(null), [], { ...base, title: null, employeeSize: null }).level, "match");
});

test("紹介の条件（複数）：どれか1つに合えば合う・以前の1つだけの形も読める", () => {
  const vc = parseVendorCriteria({
    sets: [
      { label: "大企業の人事", minEmployees: 300, classes: ["部長クラス"], dept: "人事" },
      { minEmployees: 50, maxEmployees: 300, classes: ["代表取締役"] },
      { note: "上場企業はNG" },
      {},
    ],
    excludeCompanies: ["NG商事"],
  });
  assert.equal(vc.sets.length, 3);
  const base = { company: "株式会社A", name: "山田", industry: null, region: null, relationMemo: "部署: 人事部" };
  const a = matchVendorCriteria(vc, [], { ...base, title: "部長クラス（人事部長）", employeeSize: "500名" });
  assert.equal(a.level, "match");
  assert.equal(a.setName, "大企業の人事");
  const b = matchVendorCriteria(vc, [], { ...base, title: "代表取締役", employeeSize: "100名" });
  assert.equal(b.level, "match");
  assert.equal(b.setName, "条件2");
  assert.equal(matchVendorCriteria(vc, [], { ...base, title: "一般社員", employeeSize: "100名" }).level, "no");
  assert.equal(matchVendorCriteria(vc, [], { ...base, company: "NG商事株式会社", title: "代表取締役", employeeSize: "100名" }).level, "no");
  const old = parseVendorCriteria({ minEmployees: 100, classes: ["部長クラス"], excludeCompanies: ["X社"] });
  assert.equal(old.sets.length, 1);
  assert.deepEqual(old.excludeCompanies, ["X社"]);
  assert.deepEqual(parseVendorCriteria(null), { sets: [], excludeCompanies: [] });
});

test("紹介案件の確定・見込みの金額", () => {
  const r = (status: string, rewardStatus: string, rewardAmount: number, rewardUndetermined = false, thankYouFee: number | null = null) => ({ status, rewardStatus, rewardAmount, rewardUndetermined, thankYouFee });
  const t = referralTotals([
    r("MEETING_DONE", "UNFIXED", 40000, false, 5000),
    r("MEETING_CONFIRMED", "APPLIED", 30000),
    r("MEETING_CONFIRMED", "UNFIXED", 70000, false, 10000),
    r("SCHEDULING", "UNFIXED", 0, true),
    r("DECLINED", "UNFIXED", 90000, false, 3000),
  ]);
  assert.deepEqual(t.fixed, { amount: 70000, count: 2, undetermined: 0, thankYou: 5000 });
  assert.deepEqual(t.expected, { amount: 70000, count: 2, undetermined: 1, thankYou: 10000 });
  assert.equal(t.total, 140000);
});

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`\n${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`all ${passed} tests passed`);
