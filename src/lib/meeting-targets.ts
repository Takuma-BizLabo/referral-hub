/** ベンダーMTGに表示する「お繋ぎ先会社名」を求める。紹介案件があればその会社、なければ依頼内容の「ピックアップ:」行から拾う。 */
export function meetingTargets(
  requestNote: string | null | undefined,
  referrals: { status: string; contact: { company: string | null; name: string } }[],
  proposed: string[] = [],
): string[] {
  const fromReferrals = Array.from(
    new Set(referrals.filter((r) => r.status !== "DECLINED").map((r) => r.contact.company ?? r.contact.name).filter(Boolean)),
  );
  if (fromReferrals.length) return fromReferrals;
  if (proposed.length) return proposed;
  const line = (requestNote ?? "").split("\n").find((l) => l.startsWith("ピックアップ"));
  if (!line) return [];
  return line
    .replace(/^ピックアップ[^:：]*[:：]\s*/, "")
    .split(/[、,]/)
    .map((s) => s.replace(/\s*\/.*$/, "").trim())
    .filter(Boolean);
}
