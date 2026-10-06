"use server";
import { runWithFlash } from "@/lib/flash";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/auth";
import { NOTIFICATION_GROUPS } from "@/lib/labels";

/** 未読をまとめて既読にする（group 指定時はその種別のみ） */
export async function markAllReadAction(formData?: FormData) {
  await runWithFlash(formData ?? null, async () => {
    const user = await assertUser();
    const group = NOTIFICATION_GROUPS.find((g) => g.key === formData?.get("group"));
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(group ? { type: { in: group.types } } : {}) },
      data: { readAt: new Date() },
    });
    revalidatePath("/notifications");
    revalidatePath("/", "layout");
  });
}
