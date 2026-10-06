import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EmptyState, PageHeader } from "@/components/ui";
import { cn, fmtDateTime } from "@/lib/utils";
import { markAllReadAction } from "./actions";

export const metadata = { title: "通知" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div>
      <PageHeader
        title="通知"
        actions={
          <form action={markAllReadAction}>
            <button className="btn-secondary">すべて既読にする</button>
          </form>
        }
      />
      <div className="card">
        {items.length === 0 ? (
          <EmptyState message="通知はありません" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((n) => (
              <li key={n.id} className={cn("px-4 py-3 text-sm flex gap-3", !n.readAt && "bg-blue-50/50")}>
                <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", n.readAt ? "bg-transparent" : "bg-blue-500")} />
                <div className="flex-1 min-w-0">
                  <Link href={`/notifications/${n.id}/go`} className="font-medium text-gray-900 hover:underline">
                    {n.title}
                  </Link>
                  {n.body && <div className="text-gray-600 mt-0.5 whitespace-pre-wrap">{n.body}</div>}
                  <div className="text-xs text-gray-400 mt-1 flex gap-2">
                    <span>{fmtDateTime(n.createdAt)}</span>
                    {n.lineSentAt && <span className="text-emerald-600">LINE送信済</span>}
                    {n.lineError && <span className="text-rose-500" title={n.lineError}>LINE送信失敗</span>}
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
