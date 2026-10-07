import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "./TaskForm";

export const metadata = { title: "タスク" };

type SP = { tab?: string; focus?: string; link?: string; title?: string; body?: string; assignee?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === "requested" ? "requested" : sp.tab === "done" ? "done" : sp.tab === "all" ? "all" : "mine";
  const isAdmin = me.role === "ADMIN";
  const include = { requester: true, assignee: true } as const;
  const [mine, requested, done, all, users, counts] = await Promise.all([
    prisma.task.findMany({ where: { assigneeId: me.id, status: "OPEN" }, include, orderBy: [{ important: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }] }),
    prisma.task.findMany({ where: { requesterId: me.id, status: "OPEN" }, include, orderBy: [{ important: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }] }),
    prisma.task.findMany({ where: { status: "DONE", OR: [{ assigneeId: me.id }, { requesterId: me.id }] }, include, orderBy: { doneAt: "desc" }, take: 100 }),
    prisma.task.findMany({ where: { status: "OPEN" }, include, orderBy: [{ important: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }] }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true, name: true } }),
    Promise.all([
      prisma.task.count({ where: { assigneeId: me.id, status: "OPEN" } }),
      prisma.task.count({ where: { requesterId: me.id, status: "OPEN" } }),
      prisma.task.count({ where: { status: "OPEN" } }),
    ]),
  ]);
  const list = tab === "mine" ? mine : tab === "requested" ? requested : tab === "done" ? done : all;
  const focus = sp.focus && /^\d+$/.test(sp.focus) ? Number(sp.focus) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title="タスク" description="メンバー間の依頼を文字で受け渡し。完了を押すと依頼者側のステータスも「完了」になります。" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs
            items={[
              { href: "/tasks", label: `自分宛（${counts[0]}）`, active: tab === "mine" },
              { href: "/tasks?tab=requested", label: `自分が依頼（${counts[1]}）`, active: tab === "requested" },
              { href: "/tasks?tab=all", label: `全員の未完了（${counts[2]}）`, active: tab === "all" },
              { href: "/tasks?tab=done", label: "完了済み", active: tab === "done" },
            ]}
          />
          {list.length === 0 ? (
            <div className="card">
              <EmptyState message={tab === "mine" ? "あなた宛の未完了タスクはありません" : tab === "requested" ? "依頼中のタスクはありません" : tab === "done" ? "完了したタスクはありません" : "未完了のタスクはありません"} />
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((t) => (
                <TaskCard key={t.id} task={t} meId={me.id} isAdmin={isAdmin} focus={focus === t.id} />
              ))}
            </div>
          )}
        </div>
        <div>
          <Card title="タスクを依頼する">
            <TaskForm
              key={`${sp.link ?? ""}${sp.title ?? ""}`}
              users={users}
              meId={me.id}
              defaultLink={sp.link}
              defaultTitle={sp.title?.slice(0, 200)}
              defaultBody={sp.body?.slice(0, 5000)}
              defaultAssigneeId={sp.assignee && /^\d{1,9}$/.test(sp.assignee) ? Number(sp.assignee) : undefined}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
