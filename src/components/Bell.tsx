"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { markAllReadAction } from "@/app/(app)/notifications/actions";
import { notificationGroupOf } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { SubmitButton } from "./SubmitButton";

export type BellItem = { id: number; title: string; type: string; createdAt: string; read: boolean };

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  const dt = new Date(iso);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

/** ベルのドロップダウン（直近10件・すべて既読） */
export function Bell({ unread, items, dark }: { unread: number; items: BellItem[]; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn("relative inline-flex items-center justify-center w-9 h-9 rounded-lg", dark ? "text-white hover:bg-white/10" : "text-gray-600 hover:bg-black/5")}
        aria-label={`通知${unread > 0 ? `（未読 ${unread} 件）` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 rounded-full bg-rose-500 text-white text-[10px] px-1 flex items-center justify-center font-bold">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,380px)] rounded-xl border border-gray-200 bg-white text-gray-900 shadow-xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold">通知{unread > 0 && <span className="ml-1 text-rose-600">未読 {unread}</span>}</span>
            {unread > 0 && (
              <form action={markAllReadAction}>
                <SubmitButton className="text-xs text-blue-700 hover:underline disabled:opacity-50" pendingText="更新中...">
                  すべて既読にする
                </SubmitButton>
              </form>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">通知はありません</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
              {items.map((n) => (
                <li key={n.id}>
                  {/* 既読化はルートハンドラで行うため、プリフェッチしない通常リンクにする */}
                  <a href={`/notifications/${n.id}/go`} className={cn("flex gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50", !n.read && "bg-blue-50/60")}>
                    <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", n.read ? "bg-transparent" : "bg-blue-500")} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block line-clamp-2", !n.read && "font-medium")}>{n.title}</span>
                      <span className="text-[11px] text-gray-400">
                        {notificationGroupOf(n.type)?.label ?? "お知らせ"} ・ {ago(n.createdAt)}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <Link href="/notifications" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-center text-sm text-blue-700 border-t border-gray-100 hover:bg-gray-50 rounded-b-xl">
            すべての通知を見る
          </Link>
        </div>
      )}
    </div>
  );
}
