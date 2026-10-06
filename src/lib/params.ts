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
