"use client";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 絞り込みフォーム。スマホでは折りたたみ、PC では常に表示する。 */
export function FilterPanel({ children, activeCount = 0 }: { children: ReactNode; activeCount?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={cn("md:hidden btn-secondary w-full mb-3 justify-between", activeCount > 0 && "border-blue-300 text-blue-800")}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>絞り込み{activeCount > 0 ? `（${activeCount}件指定中）` : ""}</span>
        <span aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      <div className={cn(open ? "block" : "hidden", "md:block")}>{children}</div>
    </>
  );
}
