"use server";
import { runWithFlash } from "@/lib/flash";
import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/auth";

/** 6桁の連携コードを発行（30分有効） */
export async function issueLineCodeAction() {
  await runWithFlash(null, async () => {
    const user = await assertUser();
    let code = "";
    for (let i = 0; i < 10; i++) {
      code = String(randomInt(100000, 999999));
      const exists = await prisma.user.findUnique({ where: { lineLinkCode: code } });
      if (!exists) break;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { lineLinkCode: code, lineLinkCodeExpiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    revalidatePath("/settings/line");
  });
}

export async function unlinkLineAction() {
  await runWithFlash(null, async () => {
    const user = await assertUser();
    await prisma.user.update({ where: { id: user.id }, data: { lineUserId: null, lineLinkCode: null, lineLinkCodeExpiresAt: null } });
    revalidatePath("/settings/line");
  });
}

export async function sendLineTestAction() {
  await runWithFlash(null, async () => {
    const user = await assertUser();
    const { notify } = await import("@/lib/notifications");
    await notify({ userId: user.id, type: "TASK_ASSIGNED", title: "【テスト】LINE連携の確認メッセージです", body: "このメッセージが届いていれば連携は正常です。" });
    revalidatePath("/settings/line");
  });
}
