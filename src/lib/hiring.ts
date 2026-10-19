/**
 * 繋がり（人事）の採用の情報。人事のチカラの登録フォームの回答から入れる。
 * 一覧・詳細・編集画面と、候補ピックアップ（新卒・中途の採用人数）で使う。
 */
export const HIRING_FIELDS = [
  { key: "hiresNewGrad", label: "年間の採用人数（新卒）", long: false },
  { key: "hiresMidCareer", label: "年間の採用人数（中途）", long: false },
  { key: "hardestRole", label: "最も採用に苦戦している職種", long: false },
  { key: "hiringRoles", label: "採用している職種", long: true },
  { key: "hiringMethods", label: "取り組んでいる採用手法", long: true },
  { key: "hiringIssues", label: "抱えている悩み", long: true },
  { key: "interestedSolutions", label: "興味がある・検討したい解決策", long: true },
  { key: "considerTiming", label: "検討時期", long: false },
] as const;

export type HiringKey = (typeof HIRING_FIELDS)[number]["key"];
export type HiringData = Partial<Record<HiringKey, string | null>>;

export function hasHiring(c: HiringData) {
  return HIRING_FIELDS.some((f) => !!c[f.key]);
}

/** 一覧用の短い表示（例：新卒 1-10名 ／ 中途 11-30名） */
export function hiresSummary(c: HiringData): string | null {
  const parts = [c.hiresNewGrad ? `新卒 ${c.hiresNewGrad}` : null, c.hiresMidCareer ? `中途 ${c.hiresMidCareer}` : null].filter(Boolean);
  return parts.length ? parts.join(" ／ ") : null;
}
