"use server";
import { runWithFlash } from "@/lib/flash";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/auth";

export async function markAllReadAction() {
  await runWithFlash(null, async () => {
    const user = await assertUser();
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/notifications");
    revalidatePath("/", "layout");
  });
}
