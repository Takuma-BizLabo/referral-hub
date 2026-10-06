/**
 * セールスハブのチャット本文（コピペ）から、ベンダー名・担当者・紹介候補企業などを抽出する。
 * ルールベースのため完全ではなく、画面で修正してから登録する前提。
 */
export type ParsedSaleshub = {
  vendorName: string | null;
  vendorContactName: string | null;
  senderName: string | null; // 商談担当者（こちら側）
  candidates: { company: string; dept: string | null; raw: string }[];
  format: "ONLINE" | "VISIT" | null;
  wantsMeeting: boolean;
  agenda: string[];
  dateHints: string[];
};

const COMPANY_RE = /((?:株式会社|有限会社|合同会社|一般社団法人)[^\s\/／（(、。]+|[^\s\/／（(、。]+(?:株式会社|有限会社|合同会社|Inc\.?|Co\.,? ?Ltd\.?))/g;

export function parseSaleshubText(text: string): ParsedSaleshub {
  // 極端に長い行は正規表現が二次的に遅くなるため、1行2000文字・全体20万文字で打ち切る
  const lines = text
    .slice(0, 200_000)
    .split(/\r?\n/)
    .map((l) => l.trim().slice(0, 2000))
    .filter(Boolean);

  const result: ParsedSaleshub = {
    vendorName: null,
    vendorContactName: null,
    senderName: null,
    candidates: [],
    format: null,
    wantsMeeting: false,
    agenda: [],
    dateHints: [],
  };

  for (const line of lines) {
    // 「〇〇の△△です」「〇〇の△△と申します」→ ベンダー社名・担当者
    const m1 = line.match(/(?:お世話になっております。?)?\s*(.+?)の([^\s、。]{1,10}?)(?:です|と申します|でございます)[。．]?$/);
    if (m1 && !result.vendorName && !/と申します/.test(line.replace(m1[0], "")) && m1[1].length <= 30) {
      // 自分側の名乗り（「松田と申します」）はベンダーではない
      if (/の/.test(m1[0])) {
        result.vendorName = m1[1].replace(/^(お世話になっております。?|いつもお世話になっております。?)/, "").trim();
        result.vendorContactName = m1[2];
      }
    }
    const m2 = line.match(/^(?:お世話になっております。?)?\s*([^\s、。の]{1,10})と申します/);
    if (m2 && !result.senderName) result.senderName = m2[1];

    // 候補企業：会社名 / 部署(役職) 形式
    const compMatches = line.match(COMPANY_RE);
    if (compMatches) {
      for (const c of compMatches) {
        if (result.vendorName && c.includes(result.vendorName)) continue;
        const after = line.slice(line.indexOf(c) + c.length);
        const dept = after.match(/[\/／]\s*([^\s]+)/)?.[1] ?? null;
        if (!result.candidates.some((x) => x.company === c)) result.candidates.push({ company: c, dept, raw: line });
      }
    }

    if (/オンライン/.test(line)) result.format = "ONLINE";
    if (/訪問|来社|ご来訪/.test(line)) result.format = result.format ?? "VISIT";
    if (/打ち合わせ|打合せ|お打合せ|MTG|ミーティング|お時間をいただけ/.test(line)) result.wantsMeeting = true;
    if (/^[・･\-＊*●○■□]/.test(line)) result.agenda.push(line.replace(/^[・･\-＊*●○■□]\s*/, ""));
    const dh = line.match(/(今週|来週|再来週|\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2})[^。]*/);
    if (dh) result.dateHints.push(dh[0]);
  }
  return result;
}

/** 会社名の正規化（突き合わせ用） */
export function normalizeCompanyName(s: string) {
  return s
    .replace(/[\s　]+/g, "")
    .replace(/株式会社|有限会社|合同会社|\(株\)|（株）|\(有\)|（有）|㈱|㈲/g, "")
    .toLowerCase();
}
