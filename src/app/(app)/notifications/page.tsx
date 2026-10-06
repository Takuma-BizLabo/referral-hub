import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { NOTIFICATION_GROUPS, notificationGroupOf } from "@/lib/labels";
import { cn, fmtDateTime } from "@/lib/utils";
import { markAllReadAction } from "./actions";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "通知" };

type SP = { group?: string; unread?: string };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const group = NOTIFICATION_GROUPS.find((g) => g.key === sp.group);
  const unreadOnly = sp.unread === "1";
  const where: Prisma.NotificationWhereInput = {
    userId: user.id,
    ...(group ? { type: { in: group.types } } : {}),
    ...(unreadOnly ? { readAt: null } : {}),
  };
  const [items, unreadByType] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.notification.groupBy({ by: ["type"], where: { userId: user.id, readAt: null }, _count: { _all: true } }),
  ]);
  const unreadOf = (types: string[]) => unreadByType.filter((u) => types.includes(u.type)).reduce((a, u) => a + u._count._all, 0);
  const totalUnread = unreadByType.reduce((a, u) => a + u._count._all, 0);
  const href = (patch: Partial<SP>) => {
    const o: Record<string, string> = {};
    const g = "group" in patch ? patch.group : sp.group;
    const u = "unread" in patch ? patch.unread : sp.unread;
    if (g) o.group = g;
    if (u) o.unread = u;
    const qs = new URLSearchParams(o).toString();
    return qs ? `/notifications?${qs}` : "/notifications";
  };

  return (
    <div>
      <PageHeader
        title="通知"
        description={totalUnread > 0 ? `未読 ${totalUnread} 件` : "未読はありません"}
        actions={
          totalUnread > 0 ? (
            <form action={markAllReadAction}>
              {group && <input type="hidden" name="group" value={group.key} />}
              <SubmitButton className="btn-secondary" pendingText="更新中...">
                {group ? `「${group.label}」を既読にする` : "すべて既読にする"}
              </SubmitButton>
            </form>
          ) : undefined
        }
      />
      <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible">
        <Link href={href({ group: undefined })} className={cn("chip", !group && "chip-active")}>
          すべて{totalUnread > 0 && <span className="text-xs">（未読 {totalUnread}）</span>}
        </Link>
        {NOTIFICATION_GROUPS.map((g) => {
          const n = unreadOf(g.types);
          return (
            <Link key={g.key} href={href({ group: g.key })} className={cn("chip", group?.key === g.key && "chip-active")}>
              {g.label}
              {n > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold inline-flex items-center justify-center">{n}</span>}
            </Link>
          );
        })}
        <Link href={href({ unread: unreadOnly ? undefined : "1" })} className={cn("chip", unreadOnly && "chip-active")}>
          {unreadOnly ? "✓ " : ""}未読のみ
        </Link>
      </div>
      <div className="card">
        {items.length === 0 ? (
          <EmptyState message={unreadOnly ? "未読の通知はありません" : "通知はありません"} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((n) => (
              <li key={n.id} className={cn("px-4 py-3 text-sm flex gap-3", !n.readAt && "bg-blue-50/50")}>
                <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", n.readAt ? "bg-transparent" : "bg-blue-500")} />
                <div className="flex-1 min-w-0">
                  {/* 既読化はルートハンドラで行うため、プリフェッチしない通常リンクにする */}
                  <a href={`/notifications/${n.id}/go`} className="font-medium text-gray-900 hover:underline break-words">
                    {n.title}
                  </a>
                  {n.body && <div className="text-gray-600 mt-0.5 whitespace-pre-wrap break-words line-clamp-4">{n.body}</div>}
                  <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-2">
                    <span>{fmtDateTime(n.createdAt)}</span>
                    <span>{notificationGroupOf(n.type)?.label ?? "お知らせ"}</span>
                    {n.lineSentAt && <span className="text-emerald-600">LINE送信済</span>}
                    {n.lineError && (
                      <span className="text-rose-500" title={n.lineError}>
                        LINE送信失敗
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
