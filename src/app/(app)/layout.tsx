import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
  return (
    <Shell user={user} unread={unread}>
      {children}
    </Shell>
  );
}
