import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { lineConfigured, pushLineText } from "./line";
import { getLineEnabledMap } from "./settings";
import type { NotificationType } from "./labels";

export type NotifyInput = {
  userId: number;
  type: NotificationType;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  /** 同じキーの通知は 1 回しか作られない（cron の重複送信防止） */
  dedupeKey?: string | null;
  /** false にするとこの通知は LINE に送らない（ツール内のみ） */
  line?: boolean;
};

function appUrl(path: string | null | undefined) {
  if (!path) return "";
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

/** ツール内通知を作成し、設定が ON なら LINE にも push する。 */
export async function notify(input: NotifyInput): Promise<boolean> {
  if (input.dedupeKey) {
    const exists = await prisma.notification.findUnique({ where: { dedupeKey: input.dedupeKey } });
    if (exists) return false;
  }
  let n;
  try {
    n = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        linkUrl: input.linkUrl ?? null,
        dedupeKey: input.dedupeKey ?? null,
      },
    });
  } catch (e) {
    // 確認と作成の間に同じ dedupeKey の通知が作られた（cron の同時実行・同じ payload の同時受信など）場合は作らない
    if (input.dedupeKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }

  // LINE 送信
  try {
    if (!lineConfigured() || input.line === false) return true;
    const enabled = await getLineEnabledMap();
    if (!enabled[input.type]) return true;
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user?.lineUserId || !user.isActive) return true;
    const text = [input.title, input.body, appUrl(input.linkUrl)].filter(Boolean).join("\n");
    await pushLineText(user.lineUserId, text);
    await prisma.notification.update({ where: { id: n.id }, data: { lineSentAt: new Date() } });
  } catch (e) {
    await prisma.notification.update({
      where: { id: n.id },
      data: { lineError: e instanceof Error ? e.message.slice(0, 500) : "LINE送信エラー" },
    });
  }
  return true;
}

/** 全管理者に通知 */
export async function notifyAdmins(input: Omit<NotifyInput, "userId">) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true } });
  for (const a of admins) {
    await notify({ ...input, userId: a.id, dedupeKey: input.dedupeKey ? `${input.dedupeKey}:u${a.id}` : null });
  }
}
