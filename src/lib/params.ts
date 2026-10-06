import { notFound } from "next/navigation";

/** URL の [id] を数値に。数値でなければ 404（Prisma の検証エラーで 500 にしない） */
export function idParam(id: string): number {
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0 || n > 2147483647) notFound();
  return n;
}

/** generateMetadata 用（404 にはせず null を返す） */
export function idOrNull(id: string): number | null {
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

type ParamSpec = "int" | readonly string[];

/**
 * URL クエリ（searchParams）を安全な値に整える。
 * - 同じキーが複数ある場合（?q=a&q=b）は先頭だけ使う
 * - NUL 文字（PostgreSQL が拒否する）を取り除き、長すぎる値は切り詰める
 * - spec が "int" のキーは正の32bit整数のみ、文字列の配列を渡したキーはその中の値のみ有効（不正値は undefined）
 * 不正な値で Prisma が例外を投げて画面が壊れるのを防ぐ。
 */
export function cleanParams<T extends Record<string, string | string[] | undefined>>(raw: T, spec: Partial<Record<keyof T, ParamSpec>> = {}): { [K in keyof T]: string | undefined } {
  const out: Record<string, string | undefined> = {};
  for (const [key, v0] of Object.entries(raw)) {
    const v1 = Array.isArray(v0) ? v0[0] : v0;
    if (typeof v1 !== "string") {
      out[key] = undefined;
      continue;
    }
    const v = v1.replace(/\0/g, "").slice(0, 200);
    const s = spec[key as keyof T];
    if (s === "int") out[key] = idOrNull(v) === null ? undefined : String(Number(v));
    else if (s) out[key] = s.includes(v) ? v : undefined;
    else out[key] = v;
  }
  return out as { [K in keyof T]: string | undefined };
}
