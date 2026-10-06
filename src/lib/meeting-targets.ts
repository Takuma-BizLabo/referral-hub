/** ベンダーMTGに表示する「お繋ぎ先」と単価。 */
export type MeetingTarget = { name: string; amount: number | null }; // amount null = 単価未定

/**
 * 紹介案件があればその会社と報酬額、なければセールスハブで提示した会社（依頼の単価）、
 * それもなければ依頼内容の「ピックアップ:」行から拾う。
 */
export function meetingTargets(
  requestNote: string | null | undefined,
  referrals: { status: string; rewardAmount: number; rewardUndetermined: boolean; contact: { company: string | null; name: string } }[],
  proposed: string[] = [],
  requestFee: number | null = null,
): MeetingTarget[] {
  const out: MeetingTarget[] = [];
  const seen = new Set<string>();
  for (const r of referrals.filter((r) => r.status !== "DECLINED")) {
    const name = r.contact.company ?? r.contact.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, amount: r.rewardUndetermined ? null : r.rewardAmount });
  }
  if (out.length) return out;
  const fromProposed = proposed.length
    ? proposed
    : (() => {
        const line = (requestNote ?? "").split("\n").find((l) => l.startsWith("ピックアップ"));
        if (!line) return [];
        return line
          .replace(/^ピックアップ[^:：]*[:：]\s*/, "")
          .split(/[、,]/)
          .map((s) => s.replace(/\s*\/.*$/, "").trim())
          .filter(Boolean);
      })();
  for (const name of fromProposed) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, amount: requestFee });
  }
  return out;
}

/** 合計単価の表示。未定が含まれる場合は「確定金額＋未定分」 */
export function formatTargetsTotal(targets: MeetingTarget[], fallbackFee: number | null): string {
  if (targets.length === 0) return fallbackFee !== null ? `¥${fallbackFee.toLocaleString()}` : "-";
  const fixed = targets.filter((t) => t.amount !== null).reduce((a, t) => a + (t.amount ?? 0), 0);
  const undetermined = targets.some((t) => t.amount === null);
  if (fixed === 0 && undetermined) return "未定";
  return `¥${fixed.toLocaleString()}${undetermined ? "＋未定分" : ""}`;
}

export function formatTargetAmount(amount: number | null): string {
  return amount === null ? "未定" : `¥${amount.toLocaleString()}`;
}
