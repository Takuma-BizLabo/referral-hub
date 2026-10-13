/**
 * ベンダーの単価表（従業員数 × 役職 → 協力金）と、繋がりの情報からの単価判定。
 * クライアント（紹介案件フォーム）でもサーバーでも使うので、DB には触れない純粋な関数だけを置く。
 */

export const FEE_ROLES = {
  CEO: "代表取締役",
  HR_EXEC: "人事管掌役員",
  HR_HEAD: "人事部長",
  SALES_TECH_HEAD: "営業部長・技術部長",
} as const;
export type FeeRole = keyof typeof FEE_ROLES;

/** 単価表の1行。従業員数は min 以上・max 未満（max が null は上限なし） */
export type FeeRule = { role: FeeRole; min: number; max: number | null; fee: number };

export type FeeJudgement =
  | { kind: "matched"; fee: number; reason: string }
  | { kind: "ambiguous"; candidates: number[]; reason: string }
  | { kind: "unknown"; reason: string } // 従業員数・役職が空欄や判断できない
  | { kind: "outside"; reason: string }; // 単価表の対象外

/** DB の JSON を検証して単価表にする（不正な行は捨てる） */
export function parseFeeTable(json: unknown): FeeRule[] {
  if (!Array.isArray(json)) return [];
  const rules: FeeRule[] = [];
  for (const r of json) {
    if (!r || typeof r !== "object") continue;
    const { role, min, max, fee } = r as Record<string, unknown>;
    if (typeof role !== "string" || !(role in FEE_ROLES)) continue;
    if (typeof min !== "number" || !Number.isInteger(min) || min < 0) continue;
    if (max !== null && (typeof max !== "number" || !Number.isInteger(max) || max <= min)) continue;
    if (typeof fee !== "number" || !Number.isInteger(fee) || fee < 0) continue;
    rules.push({ role: role as FeeRole, min, max: max as number | null, fee });
  }
  return rules;
}

/** 「50名以上100名未満」のような表示 */
export function fmtSizeRange(min: number, max: number | null) {
  if (max === null) return `${min.toLocaleString("ja-JP")}名以上`;
  if (min === 0) return `${max.toLocaleString("ja-JP")}名未満`;
  return `${min.toLocaleString("ja-JP")}名以上${max.toLocaleString("ja-JP")}名未満`;
}

/**
 * 繋がりの「規模」欄を人数の範囲にする（両端を含む）。読めなければ null。
 * 例: "50〜100名" → [50,100] / "300名以上" → [300,∞] / "4000.0名" → [4000,4000] / "31（業務委託含む）名" → [31,31]
 */
export function parseEmployeeSize(raw: string | null | undefined): [number, number] | null {
  if (!raw) return null;
  const s = raw.normalize("NFKC").replace(/,/g, "").replace(/\s/g, "");
  const n = (x: string) => Math.round(Number(x));
  let m = s.match(/(\d+(?:\.\d+)?)名?[〜~\-ー－から]+(\d+(?:\.\d+)?)/);
  if (m) {
    const a = n(m[1]);
    const b = n(m[2]);
    return a <= b ? [a, b] : [b, a];
  }
  m = s.match(/(\d+(?:\.\d+)?)名?以上/);
  if (m) return [n(m[1]), Infinity];
  m = s.match(/(\d+(?:\.\d+)?)名?未満/);
  if (m) return [0, Math.max(0, n(m[1]) - 1)];
  m = s.match(/(\d+(?:\.\d+)?)名?以下/);
  if (m) return [0, n(m[1])];
  m = s.match(/(\d+(?:\.\d+)?)/);
  if (m) return [n(m[1]), n(m[1])];
  return null;
}

/**
 * 役職欄を単価表の役職に分類する。
 * - role: 当てはまる役職（null は単価表の役職ではない）
 * - vague: 「役員・取締役クラス」「部長クラス」など、部署が分からず判断できない
 */
export function classifyTitle(raw: string | null | undefined): { role: FeeRole | null; vague: boolean } {
  if (!raw) return { role: null, vague: true };
  const s = raw.normalize("NFKC").replace(/\s/g, "");
  if (/副社長|代表代行/.test(s)) return { role: null, vague: true };
  if (/代表|社長|CEO|最高経営責任者/i.test(s)) return { role: "CEO", vague: false };
  const hr = /人事|CHRO|人材開発|人財/i.test(s);
  const exec = /取締役|役員|CHRO|CxO/i.test(s);
  const head = /部長|本部長|責任者|室長|局長/.test(s) && !/副部長|部長代理/.test(s);
  if (hr && exec) return { role: "HR_EXEC", vague: false };
  if (hr && head) return { role: "HR_HEAD", vague: false };
  if (/営業|セールス|技術|開発|エンジニア|CTO/i.test(s) && head) return { role: "SALES_TECH_HEAD", vague: false };
  // 部署の書かれていない役員・部長は、人事や営業の担当かもしれないので判断できない
  if (!hr && (exec || /部長|執行役員/.test(s))) return { role: null, vague: true };
  return { role: null, vague: false };
}

type FeeContact = { employeeSize: string | null; title: string | null; name?: string | null; relationMemo?: string | null };

/**
 * 部署（「人事部」など）。セールスハブ取込の繋がりは役職欄が「部長クラス」だけで、
 * 部署は関係性メモ「部署: 人事部」や氏名「担当者（人事部・部長クラス）」に入っている。
 */
export function contactDept(c: { name?: string | null; relationMemo?: string | null }): string | null {
  const memo = c.relationMemo?.match(/部署[:：]\s*([^/／\n]+)/);
  if (memo) return memo[1].trim();
  const name = c.name?.match(/[（(]([^・（()）]+)・/);
  return name ? name[1].trim() : null;
}

/** 単価表と繋がりの規模・役職（部署を含む）から協力金を判定する */
export function judgeFee(rules: FeeRule[], contact: FeeContact): FeeJudgement {
  const dept = contactDept(contact);
  const title = dept && contact.title && !contact.title.includes(dept) ? `${dept} ${contact.title}` : contact.title;
  const { role, vague } = classifyTitle(title);
  const size = parseEmployeeSize(contact.employeeSize);
  const sizeLabel = contact.employeeSize ?? "空欄";
  if (!role) {
    return vague
      ? { kind: "unknown", reason: title ? `役職「${title}」から対象の役職か判断できません` : "役職が空欄です" }
      : { kind: "outside", reason: `役職「${title}」は単価表の対象外です` };
  }
  const roleRules = rules.filter((r) => r.role === role);
  if (roleRules.length === 0) return { kind: "outside", reason: `${FEE_ROLES[role]}は単価表の対象外です` };
  if (!size) return { kind: "unknown", reason: `${FEE_ROLES[role]}ですが、従業員数が${contact.employeeSize ? `「${sizeLabel}」で読み取れません` : "空欄です"}` };

  const [lo, hi] = size;
  // 規模の範囲と重なる行（max は未満）
  const hits = roleRules.filter((r) => hi >= r.min && (r.max === null || lo < r.max)).sort((a, b) => a.min - b.min);
  if (hits.length === 0) return { kind: "outside", reason: `${FEE_ROLES[role]}ですが、従業員数「${sizeLabel}」は単価表の対象外です` };
  // 規模の範囲がすき間なく単価表に収まっているか
  let cursor = lo;
  for (const r of hits) {
    if (r.min > cursor) break;
    cursor = Math.max(cursor, r.max ?? Infinity);
  }
  const covered = cursor > hi || cursor === Infinity;
  const fees = Array.from(new Set(hits.map((r) => r.fee))).sort((a, b) => a - b);
  if (covered && fees.length === 1) {
    const range = hits.length === 1 ? `（${fmtSizeRange(hits[0].min, hits[0].max)}）` : "";
    return { kind: "matched", fee: fees[0], reason: `${FEE_ROLES[role]}・${sizeLabel}${range}` };
  }
  return {
    kind: "ambiguous",
    candidates: fees,
    reason: `${FEE_ROLES[role]}ですが、従業員数「${sizeLabel}」が単価表の区切りにまたがります${covered ? "" : "（対象外の可能性もあり）"}`,
  };
}

/** 単価表を表示用に規模ごとにまとめる */
export function groupFeeTable(rules: FeeRule[]) {
  const groups: { min: number; max: number | null; rows: FeeRule[] }[] = [];
  for (const r of [...rules].sort((a, b) => a.min - b.min || (a.max ?? Infinity) - (b.max ?? Infinity))) {
    const g = groups.find((x) => x.min === r.min && x.max === r.max);
    if (g) g.rows.push(r);
    else groups.push({ min: r.min, max: r.max, rows: [r] });
  }
  return groups;
}

/**
 * 紹介案件を自動で作るときの報酬額。単価表がなければベンダー共通の単価、
 * 単価表で決まらなければ「単価未定」にして理由を返す。
 */
export function rewardFor(
  vendor: { referralFee: number; feeTable: unknown },
  contact: FeeContact,
): { rewardAmount: number; rewardUndetermined: boolean; reason: string | null } {
  const rules = parseFeeTable(vendor.feeTable);
  if (rules.length === 0) return { rewardAmount: vendor.referralFee, rewardUndetermined: false, reason: null };
  const j = judgeFee(rules, contact);
  if (j.kind === "matched") return { rewardAmount: j.fee, rewardUndetermined: false, reason: null };
  const cands = j.kind === "ambiguous" ? `（候補：${j.candidates.map((f) => "¥" + f.toLocaleString("ja-JP")).join(" / ")}）` : "";
  return { rewardAmount: 0, rewardUndetermined: true, reason: `単価表で決まらず：${j.reason}${cands}` };
}
