/** ベンダーMTGに表示する「お繋ぎ先」と単価。 */
// amount null = 単価未定。declined = 先方・人事のNGなどで紹介見送り（¥0・グレーで表示し、合計に含めない）
export type MeetingTarget = { name: string; amount: number | null; declined?: boolean };

/**
 * 紹介案件があればその会社と報酬額、なければセールスハブで提示した会社（依頼の単価）、
 * それもなければ依頼内容の「ピックアップ:」行から拾う。
 */
export function meetingTargets(
  requestNote: string | null | undefined,
  referrals: { status: string; rewardAmount: number; rewardUndetermined: boolean; vendorApproval?: string; contactApproval?: string; contact: { company: string | null; name: string } }[],
  proposed: string[] = [],
  requestFee: number | null = null,
): MeetingTarget[] {
  const out: MeetingTarget[] = [];
  // 紹介見送り、または先方・人事のどちらかが NG の紹介案件は「見送り」扱い
  const isDeclined = (r: (typeof referrals)[number]) => r.status === "DECLINED" || r.vendorApproval === "NG" || r.contactApproval === "NG";
  const seen = new Set<string>();
  // 見送りになった会社は、提示済みの会社から拾う場合にも出さない
  const declined = new Set(referrals.filter(isDeclined).map((r) => (r.contact.company ?? r.contact.name).replace(/株式会社|\s/g, "")));
  for (const r of referrals.filter((r) => !isDeclined(r))) {
    const name = r.contact.company ?? r.contact.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, amount: r.rewardUndetermined ? null : r.rewardAmount });
  }
  // 見送りになった会社も「¥0・見送り」として最後に残す（提案した経緯が分かるように）
  for (const r of referrals.filter(isDeclined)) {
    const name = r.contact.company ?? r.contact.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, amount: 0, declined: true });
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
    if (seen.has(name) || declined.has(name.replace(/株式会社|\s/g, ""))) continue;
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

/** お繋ぎ先バッジの色：見送りはグレーアウト、未定は黄色 */
export function targetBadgeClass(t: MeetingTarget): string {
  if (t.declined) return "bg-gray-100 text-gray-400 border-gray-200 line-through decoration-gray-400";
  return t.amount === null ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-indigo-50 text-indigo-800 border-indigo-200";
}

/** 一覧用：見送りは最初の数社だけ表示し、残りは件数にまとめる */
export function compactTargets(targets: MeetingTarget[], maxDeclined = 3): { shown: MeetingTarget[]; hiddenDeclined: number } {
  const active = targets.filter((t) => !t.declined);
  const declined = targets.filter((t) => t.declined);
  return { shown: [...active, ...declined.slice(0, maxDeclined)], hiddenDeclined: Math.max(0, declined.length - maxDeclined) };
}
