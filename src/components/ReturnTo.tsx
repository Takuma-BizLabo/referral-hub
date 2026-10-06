"use client";
import { usePathname, useSearchParams } from "next/navigation";

/** 操作後・エラー時に戻るための現在のURL（?error= / ?notice= は除く）を hidden で送る */
export function useReturnTo() {
  const pathname = usePathname();
  const params = useSearchParams();
  const next = new URLSearchParams(params.toString());
  next.delete("error");
  next.delete("notice");
  next.delete("blocked");
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function ReturnToInput() {
  const v = useReturnTo();
  return <input type="hidden" name="returnTo" value={v} />;
}
