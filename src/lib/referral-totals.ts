/**
 * 紹介案件の金額の集計（紹介案件一覧の上の「確定／見込み」）。
 * - 確定：面談実施済、または報酬状態が未確定より先（計上申請〜入金済）
 * - 見込み：それ以外で紹介見送りでないもの（金額未定は金額に含めず件数だけ数える）
 * 紹介見送りはどちらにも入れない。謝礼金も同じ区分で合計する。
 */
export type TotalsRow = {
  status: string;
  rewardStatus: string;
  rewardAmount: number;
  rewardUndetermined: boolean;
  thankYouFee: number | null;
};

export type TotalsBucket = { amount: number; count: number; undetermined: number; thankYou: number };

export function isFixedReferral(r: Pick<TotalsRow, "status" | "rewardStatus">) {
  return r.status === "MEETING_DONE" || r.rewardStatus !== "UNFIXED";
}

export function referralTotals(rows: TotalsRow[]) {
  const empty = (): TotalsBucket => ({ amount: 0, count: 0, undetermined: 0, thankYou: 0 });
  const fixed = empty();
  const expected = empty();
  for (const r of rows) {
    if (r.status === "DECLINED") continue;
    const b = isFixedReferral(r) ? fixed : expected;
    b.count += 1;
    if (r.rewardUndetermined) b.undetermined += 1;
    else b.amount += r.rewardAmount;
    b.thankYou += r.thankYouFee ?? 0;
  }
  return { fixed, expected, total: fixed.amount + expected.amount };
}

/** 日本時間の年月（YYYY-MM）。日時がなければ "none" */
export function monthKeyJst(d: Date | null | undefined): string {
  return d ? new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 7) : "none";
}

/** 面談日（商談日）の月ごとの確定・見込み。月の昇順、面談日未定は最後。紹介見送りだけの月は出さない */
export function totalsByMonth(rows: (TotalsRow & { meetingAt: Date | null })[]) {
  const groups = new Map<string, (TotalsRow & { meetingAt: Date | null })[]>();
  for (const r of rows) {
    if (r.status === "DECLINED") continue;
    const k = monthKeyJst(r.meetingAt);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "none" ? 1 : b === "none" ? -1 : a.localeCompare(b)))
    .map(([key, rs]) => ({ key, totals: referralTotals(rs) }));
}

export function monthLabel(key: string) {
  if (key === "none") return "面談日未定";
  const [y, m] = key.split("-");
  return `${y}年${Number(m)}月`;
}
