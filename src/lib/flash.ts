import "server-only";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { friendlyErrorMessage } from "./errors";

/** 戻り先として安全なアプリ内パスか（オープンリダイレクト防止） */
function safePath(v: string | null | undefined): string | null {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  return v;
}

/** フォームの returnTo、なければ Referer（同一オリジンのみ）から戻り先を決める */
async function backPath(formData: FormData | null): Promise<string> {
  const fromForm = safePath(typeof formData?.get("returnTo") === "string" ? (formData!.get("returnTo") as string) : null);
  if (fromForm) return fromForm;
  const h = await headers();
  const ref = h.get("referer");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (ref) {
    try {
      const u = new URL(ref);
      if (!host || u.host === host) return safePath(u.pathname + u.search) ?? "/";
    } catch {
      // 不正な Referer は無視
    }
  }
  return "/";
}

/** パスにフラッシュメッセージ（?error= / ?notice=）を付ける */
export function withFlashParam(path: string, key: "error" | "notice", message: string) {
  const u = new URL(path, "http://local");
  u.searchParams.delete("error");
  u.searchParams.delete("notice");
  u.searchParams.set(key, message.slice(0, 300));
  return u.pathname + u.search;
}

/**
 * フォームから直接呼ばれる Server Action（StatusSelect・承認ボタンなど）を包む。
 * 例外が起きたら元のページに ?error=... で戻し、画面上部にフラッシュ表示する。
 * redirect() / notFound() は素通しする。
 */
export async function runWithFlash(formData: FormData | null, fn: () => Promise<void | { notice?: string }>) {
  let notice: string | undefined;
  try {
    const r = await fn();
    notice = r && typeof r === "object" ? r.notice : undefined;
  } catch (e) {
    unstable_rethrow(e);
    console.error("[action error]", e);
    redirect(withFlashParam(await backPath(formData), "error", friendlyErrorMessage(e)));
  }
  if (notice) redirect(withFlashParam(await backPath(formData), "notice", notice));
}
