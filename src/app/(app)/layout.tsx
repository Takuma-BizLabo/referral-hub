import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unread, openTasks] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.task.count({ where: { assigneeId: user.id, status: "OPEN" } }),
  ]);
  return (
    <Shell user={user} unread={unread} openTasks={openTasks}>
      {children}
    </Shell>
  );
}
