/**
 * 候補ピックアップ：ベンダーの条件（と単価表）に、繋がり（人事）が合うかを判定する。DB や Next に依存しない。
 */
import { contactDept, judgeFee, parseEmployeeSize, type FeeRule } from "./fee-table";
import { splitTitle } from "./title";

export type Criteria = {
  /** 従業員数の下限（以上） */
  minEmployees?: number | null;
  /** 従業員数の上限（未満） */
  maxEmployees?: number | null;
  /** 役職クラス（TITLE_CLASSES のどれか。空＝問わない） */
  classes?: string[];
  /** 部署のキーワード（例：人事）。空＝問わない */
  dept?: string | null;
  /** 業種のキーワード（どれかを含めば可） */
  industries?: string[];
  /** 地域のキーワード（どれかを含めば可） */
  regions?: string[];
  /** 除外する企業（NG リスト） */
  excludeCompanies?: string[];
};

export type CandidateContact = {
  company: string | null;
  name: string;
  title: string | null;
  industry: string | null;
  employeeSize: string | null;
  region: string | null;
  relationMemo?: string | null;
};

/** match＝条件に合う、maybe＝データが足りず要確認、no＝合わない */
export type MatchLevel = "match" | "maybe" | "no";
export type MatchResult = { level: MatchLevel; ok: string[]; check: string[]; ng: string[] };

const listOf = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
const numOf = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

/** DB の JSON を Criteria に整える（不正な値は捨てる） */
export function parseCriteria(json: unknown): Criteria {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  return {
    minEmployees: numOf(o.minEmployees),
    maxEmployees: numOf(o.maxEmployees),
    classes: listOf(o.classes),
    dept: typeof o.dept === "string" && o.dept.trim() ? o.dept.trim() : null,
    industries: listOf(o.industries),
    regions: listOf(o.regions),
    excludeCompanies: listOf(o.excludeCompanies),
  };
}

export function hasCriteria(c: Criteria): boolean {
  return (
    c.minEmployees != null ||
    c.maxEmployees != null ||
    !!c.classes?.length ||
    !!c.dept ||
    !!c.industries?.length ||
    !!c.regions?.length ||
    !!c.excludeCompanies?.length
  );
}

const norm = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/株式会社|有限会社|合同会社|\(株\)|（株）|\s/g, "")
    .toLowerCase();

const fmtRange = (min: number | null | undefined, max: number | null | undefined) =>
  min != null && max != null ? `${min}〜${max - 1}名` : min != null ? `${min}名以上` : `${max}名未満`;

/** 条件の要約（画面に出す） */
export function describeCriteria(c: Criteria): string[] {
  const out: string[] = [];
  if (c.minEmployees != null || c.maxEmployees != null) out.push(`従業員数 ${fmtRange(c.minEmployees, c.maxEmployees)}`);
  if (c.classes?.length) out.push(`役職 ${c.classes.join("・")}`);
  if (c.dept) out.push(`部署「${c.dept}」`);
  if (c.industries?.length) out.push(`業種 ${c.industries.join("・")}`);
  if (c.regions?.length) out.push(`地域 ${c.regions.join("・")}`);
  if (c.excludeCompanies?.length) out.push(`除外 ${c.excludeCompanies.length}社`);
  return out;
}

/** 1人の繋がりが条件と単価表に合うか */
export function matchCandidate(c: Criteria, feeRules: FeeRule[], contact: CandidateContact): MatchResult {
  const ok: string[] = [];
  const check: string[] = [];
  const ng: string[] = [];

  if (c.excludeCompanies?.length && contact.company) {
    const n = norm(contact.company);
    if (c.excludeCompanies.some((x) => norm(x) && (n === norm(x) || n.includes(norm(x))))) ng.push("除外する企業");
  }

  if (c.minEmployees != null || c.maxEmployees != null) {
    const size = parseEmployeeSize(contact.employeeSize);
    if (!size) check.push("従業員数が不明");
    else {
      const [lo, hi] = size;
      const min = c.minEmployees ?? 0;
      const max = c.maxEmployees ?? Infinity;
      if (lo >= min && hi < max) ok.push(`従業員数 ${contact.employeeSize}`);
      else if (hi >= min && lo < max) check.push(`従業員数 ${contact.employeeSize} は範囲にまたがる`);
      else ng.push(`従業員数 ${contact.employeeSize}`);
    }
  }

  if (c.classes?.length) {
    const cls = splitTitle(contact.title).cls;
    if (!cls) check.push("役職が不明");
    else if (c.classes.includes(cls)) ok.push(cls);
    else ng.push(`役職 ${cls}`);
  }

  if (c.dept) {
    const dept = contactDept(contact);
    const text = [dept, contact.title].filter(Boolean).join(" ");
    if (!text) check.push("部署が不明");
    else if (text.includes(c.dept)) ok.push(dept ?? c.dept);
    else if (dept) ng.push(`部署 ${dept}`);
    else check.push("部署が不明");
  }

  if (c.industries?.length) {
    if (!contact.industry) check.push("業種が不明");
    else if (c.industries.some((k) => contact.industry!.includes(k))) ok.push(`業種 ${contact.industry}`);
    else ng.push(`業種 ${contact.industry}`);
  }

  if (c.regions?.length) {
    if (!contact.region) check.push("地域が不明");
    else if (c.regions.some((k) => contact.region!.includes(k))) ok.push(contact.region);
    else ng.push(`地域 ${contact.region}`);
  }

  if (feeRules.length) {
    const j = judgeFee(feeRules, contact);
    if (j.kind === "matched") ok.push(`単価表 ¥${j.fee.toLocaleString("ja-JP")}`);
    else if (j.kind === "outside") ng.push(`単価表の対象外（${j.reason}）`);
    else check.push(j.reason);
  }

  const level: MatchLevel = ng.length ? "no" : check.length ? "maybe" : "match";
  return { level, ok, check, ng };
}
