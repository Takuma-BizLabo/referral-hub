import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unread, openTasks, recent] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.task.count({ where: { assigneeId: user.id, status: "OPEN" } }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, type: true, createdAt: true, readAt: true },
    }),
  ]);
  const notifications = recent.map((n) => ({ id: n.id, title: n.title, type: n.type, createdAt: n.createdAt.toISOString(), read: !!n.readAt }));
  return (
    <Shell user={user} unread={unread} openTasks={openTasks} notifications={notifications}>
      {children}
    </Shell>
  );
}
