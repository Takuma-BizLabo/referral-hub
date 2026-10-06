"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";

const I = {
  dash: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  vendor: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
  meeting: "M20 6L9 17l-5-5",
  referral: "M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7",
  contacts: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  reward: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  approvals: "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  goals: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  import: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
};

function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-90">
      <path d={d} />
    </svg>
  );
}

const NAV: { href: string; label: string; icon: string; admin?: boolean; match?: (p: string) => boolean }[] = [
  { href: "/", label: "ダッシュボード", icon: I.dash, match: (p) => p === "/" },
  { href: "/meetings", label: "ベンダーMTG", icon: I.meeting },
  { href: "/referrals", label: "紹介案件", icon: I.referral },
  { href: "/vendors", label: "ベンダー", icon: I.vendor },
  { href: "/contacts", label: "繋がりリスト", icon: I.contacts },
  { href: "/rewards", label: "報酬管理", icon: I.reward },
  { href: "/import/saleshub", label: "セールスハブ取込", icon: I.import },
];
const ADMIN_NAV = [
  { href: "/approvals", label: "承認キュー", icon: I.approvals },
  { href: "/goals", label: "目標設定", icon: I.goals },
];

export function Shell({ user, unread, children }: { user: CurrentUser; unread: number; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = user.role === "ADMIN";
  const isActive = (n: { href: string; match?: (p: string) => boolean }) => (n.match ? n.match(pathname) : pathname.startsWith(n.href));

  const sidebar = (
    <div className="flex flex-col h-full text-gray-100">
      <div className="px-4 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center font-black text-white text-lg">R</div>
        <div>
          <div className="font-bold leading-tight">紹介案件管理</div>
          <div className="text-[11px] text-gray-400 leading-tight">ベンダーMTG・紹介・報酬</div>
        </div>
      </div>
      <div className="px-3 pb-3 grid grid-cols-2 gap-2">
        <Link href="/meetings/new" onClick={() => setOpen(false)} className="btn-primary py-2.5 text-xs">
          + MTG登録
        </Link>
        <Link href="/referrals/new" onClick={() => setOpen(false)} className="btn-primary py-2.5 text-xs">
          + 紹介案件
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={cn("nav-link", isActive(n) && "nav-link-active")}>
            <Icon d={n.icon} />
            {n.label}
          </Link>
        ))}
        {isAdmin && (
          <>
            <div className="px-3 pt-4 pb-1 text-[11px] text-gray-400 flex items-center gap-1">
              <span>🔒</span> 管理者だけ
            </div>
            {ADMIN_NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={cn("nav-link", isActive(n) && "nav-link-active")}>
                <Icon d={n.icon} />
                {n.label}
              </Link>
            ))}
          </>
        )}
        <Link href="/settings" onClick={() => setOpen(false)} className={cn("nav-link mt-2", isActive({ href: "/settings" }) && "nav-link-active")}>
          <Icon d={I.settings} />
          設定
        </Link>
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <span className="font-bold">{user.name}</span>
          <span className={cn("badge border-0 text-[10px]", isAdmin ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-gray-200")}>{ROLE_LABEL[user.role]}</span>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span className="font-mono">{user.loginId}</span>
          <form action={logoutAction}>
            <button className="hover:text-white">ログアウト</button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:block w-60 shrink-0 bg-sidebar sticky top-0 h-screen">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar shadow-xl">
            <button className="absolute right-3 top-3 text-gray-300 text-2xl leading-none" onClick={() => setOpen(false)} aria-label="閉じる">
              ×
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-sidebar text-white px-4 h-12">
          <button onClick={() => setOpen(true)} aria-label="メニュー">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold">紹介案件管理</span>
          <div className="flex-1" />
          <Bell unread={unread} />
        </header>
        <div className="hidden md:flex justify-end px-6 pt-4">
          <Bell unread={unread} />
        </div>
        <main className="flex-1 px-4 md:px-6 pb-8 pt-3 md:-mt-8 max-w-[1400px] w-full">{children}</main>
      </div>
    </div>
  );
}

function Bell({ unread }: { unread: number }) {
  return (
    <Link href="/notifications" className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-black/5 md:text-gray-600 text-white" aria-label="通知">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 rounded-full bg-rose-500 text-white text-[10px] px-1 flex items-center justify-center font-bold">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
