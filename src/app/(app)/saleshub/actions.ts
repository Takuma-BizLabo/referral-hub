"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/auth";

/** スレッドを開いたら、そのスレッドの自分宛て未読通知を既読にする */
export async function markThreadReadAction(threadId: number) {
  const user = await assertUser();
  if (!Number.isInteger(threadId)) return;
  const r = await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null, type: "SALESHUB_MESSAGE", linkUrl: `/saleshub/${threadId}` },
    data: { readAt: new Date() },
  });
  if (r.count > 0) revalidatePath("/", "layout");
}
