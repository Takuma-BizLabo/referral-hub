"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ERROR_CODE_MESSAGE } from "@/lib/errors";

/** URL の ?error= / ?notice= を画面上部に表示する。× で閉じると URL からも消す。 */
export function FlashBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const error = params.get("error");
  const notice = params.get("notice");
  if (!error && !notice) return null;
  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("error");
    next.delete("notice");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const isError = !!error;
  const message = isError ? (Object.hasOwn(ERROR_CODE_MESSAGE, error!) ? ERROR_CODE_MESSAGE[error!] : error) : notice;
  return (
    <div
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "mb-3 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800"
          : "mb-3 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
      }
    >
      <span className="font-semibold shrink-0">{isError ? "エラー" : "完了"}</span>
      <span className="flex-1 break-words">{message}</span>
      <button type="button" onClick={close} className="shrink-0 text-lg leading-none opacity-60 hover:opacity-100" aria-label="閉じる">
        ×
      </button>
    </div>
  );
}
