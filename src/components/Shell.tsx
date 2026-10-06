"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";

const NAV: { href: string; label: string; admin?: boolean; match?: (p: string) => boolean }[] = [
  { href: "/", label: "ダッシュボード", match: (p) => p === "/" },
  { href: "/vendors", label: "ベンダー" },
  { href: "/meetings", label: "ベンダーMTG" },
  { href: "/referrals", label: "紹介案件" },
  { href: "/contacts", label: "繋がりリスト" },
  { href: "/rewards", label: "報酬管理" },
  { href: "/approvals", label: "承認キュー", admin: true },
  { href: "/goals", label: "目標設定", admin: true },
  { href: "/settings", label: "設定" },
];

export function Shell({ user, unread, children }: { user: CurrentUser; unread: number; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !n.admin || user.role === "ADMIN");
  const isActive = (n: (typeof NAV)[number]) => (n.match ? n.match(pathname) : pathname.startsWith(n.href));

  const nav = (
    <nav className="flex flex-col gap-0.5 p-2">
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => setOpen(false)}
          className={cn("nav-link", isActive(n) && "nav-link-active")}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex">
      {/* サイドバー（PC） */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="px-4 py-3 border-b border-gray-200">
          <Link href="/" className="font-semibold text-gray-900">
            紹介案件管理
          </Link>
        </div>
        {nav}
      </aside>

      {/* ドロワー（スマホ） */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-lg">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <span className="font-semibold">紹介案件管理</span>
              <button className="text-gray-500 text-xl leading-none" onClick={() => setOpen(false)} aria-label="閉じる">
                ×
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 h-12">
          <button className="md:hidden text-gray-700" onClick={() => setOpen(true)} aria-label="メニュー">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1" />
          <Link href="/notifications" className="relative text-gray-600 hover:text-gray-900" aria-label="通知">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] px-1 flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <div className="text-sm text-gray-700 hidden sm:block">
            {user.name}
            <span className="text-xs text-gray-400 ml-1">({ROLE_LABEL[user.role]})</span>
          </div>
          <form action={logoutAction}>
            <button className="btn-secondary btn-sm">ログアウト</button>
          </form>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
