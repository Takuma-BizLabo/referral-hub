/** 謝礼金（紹介先＝人事へのお礼）の集計。紹介見送りは数えない */
export function thankYouTotal(refs: { thankYouFee: number | null; status: string }[]): { total: number; count: number } {
  const xs = refs.filter((r) => r.status !== "DECLINED" && r.thankYouFee !== null && r.thankYouFee > 0);
  return { total: xs.reduce((a, r) => a + (r.thankYouFee ?? 0), 0), count: xs.length };
}
