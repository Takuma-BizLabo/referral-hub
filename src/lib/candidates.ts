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
  /** 年間の採用人数（新卒）の下限（以上） */
  minNewGrad?: number | null;
  /** 年間の採用人数（中途）の下限（以上） */
  minMidCareer?: number | null;
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
  hiresNewGrad?: string | null;
  hiresMidCareer?: string | null;
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
    minNewGrad: numOf(o.minNewGrad),
    minMidCareer: numOf(o.minMidCareer),
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
    c.minNewGrad != null ||
    c.minMidCareer != null ||
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
  if (c.minNewGrad != null) out.push(`新卒採用 ${c.minNewGrad}名以上`);
  if (c.minMidCareer != null) out.push(`中途採用 ${c.minMidCareer}名以上`);
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

  const hires = (min: number | null | undefined, raw: string | null | undefined, label: string) => {
    if (min == null) return;
    const r = parseEmployeeSize(raw);
    if (!r) check.push(`${label}が不明`);
    else if (r[0] >= min) ok.push(`${label} ${raw}`);
    else if (r[1] >= min) check.push(`${label} ${raw} は${min}名にまたがる`);
    else ng.push(`${label} ${raw}`);
  };
  hires(c.minNewGrad, contact.hiresNewGrad, "新卒採用");
  hires(c.minMidCareer, contact.hiresMidCareer, "中途採用");

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

/**
 * ベンダーの紹介条件（複数）。どれか1つに合えば候補になる（OR）。除外する企業はベンダー共通。
 * DB の vendors.criteria は { sets: CriteriaSet[], excludeCompanies: string[] }。
 * 以前の1つだけの形（Criteria そのもの）も読める。
 */
export type CriteriaSet = Omit<Criteria, "excludeCompanies"> & {
  /** 条件の名前（例：大企業の人事部長）。空なら「条件1」など */
  label?: string | null;
  /** 自由記述の条件・メモ（判定には使わず表示だけ。例：上場企業はNG、IT企業優先） */
  note?: string | null;
};
export type VendorCriteria = {
  sets: CriteriaSet[];
  excludeCompanies: string[];
  /** 除外する業種のキーワード（業種か会社名に含めば合わない。例：派遣） */
  excludeIndustries?: string[];
};
export type VendorMatchResult = MatchResult & { setName: string | null };

const textOf = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function parseSet(o: unknown): CriteriaSet {
  const c = parseCriteria(o);
  const r = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
  return {
    label: textOf(r.label),
    minEmployees: c.minEmployees,
    maxEmployees: c.maxEmployees,
    minNewGrad: c.minNewGrad,
    minMidCareer: c.minMidCareer,
    classes: c.classes,
    dept: c.dept,
    industries: c.industries,
    regions: c.regions,
    note: textOf(r.note),
  };
}

/** 判定に使う項目が1つでも入っているか（名前・メモだけの条件は判定しない） */
export function setHasRules(s: CriteriaSet) {
  return hasCriteria({ ...s, excludeCompanies: [] });
}
const setIsEmpty = (s: CriteriaSet) => !setHasRules(s) && !s.label && !s.note;

export function parseVendorCriteria(json: unknown): VendorCriteria {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  if (Array.isArray(o.sets)) {
    return { sets: o.sets.map(parseSet).filter((s) => !setIsEmpty(s)), excludeCompanies: listOf(o.excludeCompanies), excludeIndustries: listOf(o.excludeIndustries) };
  }
  const one = parseSet(o);
  return { sets: setIsEmpty(one) ? [] : [one], excludeCompanies: listOf(o.excludeCompanies), excludeIndustries: listOf(o.excludeIndustries) };
}

export function hasVendorCriteria(vc: VendorCriteria) {
  return vc.sets.some(setHasRules) || vc.excludeCompanies.length > 0 || !!vc.excludeIndustries?.length;
}

export const setNameOf = (s: CriteriaSet, i: number) => s.label || `条件${i + 1}`;

/** 1つの条件の要約 */
export function describeSet(s: CriteriaSet): string[] {
  return describeCriteria({ ...s, excludeCompanies: [] });
}

/** 画面上部に出す要約（条件ごとに1つ） */
export function describeVendorCriteria(vc: VendorCriteria): string[] {
  const out = vc.sets.filter(setHasRules).map((s, _i, arr) => {
    const d = describeSet(s).join("・");
    return arr.length > 1 || s.label ? `${setNameOf(s, vc.sets.indexOf(s))}（${d}）` : d;
  });
  if (vc.excludeCompanies.length) out.push(`除外 ${vc.excludeCompanies.length}社`);
  if (vc.excludeIndustries?.length) out.push(`除外業種 ${vc.excludeIndustries.join("・")}`);
  return out;
}

const LEVEL_ORDER: Record<MatchLevel, number> = { match: 0, maybe: 1, no: 2 };

/** 繋がりがベンダーの紹介条件のどれかに合うか（一番合う条件の結果を返す） */
export function matchVendorCriteria(vc: VendorCriteria, feeRules: FeeRule[], contact: CandidateContact): VendorMatchResult {
  const hitIndustry = vc.excludeIndustries?.find((k) => contact.industry?.includes(k) || contact.company?.includes(k));
  if (hitIndustry) return { level: "no", ok: [], check: [], ng: [`除外する業種（${hitIndustry}）`], setName: null };
  const ruled = vc.sets.map((s, i) => ({ s, i })).filter(({ s }) => setHasRules(s));
  if (!ruled.length) return { ...matchCandidate({ excludeCompanies: vc.excludeCompanies }, feeRules, contact), setName: null };
  let best: VendorMatchResult | null = null;
  for (const { s, i } of ruled) {
    const r = matchCandidate({ ...s, excludeCompanies: vc.excludeCompanies }, feeRules, contact);
    const better =
      !best ||
      LEVEL_ORDER[r.level] < LEVEL_ORDER[best.level] ||
      (r.level === best.level && (r.ng.length < best.ng.length || (r.ng.length === best.ng.length && r.check.length < best.check.length)));
    if (better) best = { ...r, setName: ruled.length > 1 || s.label ? setNameOf(s, i) : null };
  }
  return best!;
}
