"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!loginId || !password) return { error: "IDとパスワードを入力してください" };

  const user = await prisma.user.findUnique({ where: { loginId } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "IDまたはパスワードが正しくありません" };
  }
  await createSession(user.id);
  // オープンリダイレクト防止：アプリ内パスのみ（「//host」や「/\host」はブラウザが外部URLとして解釈する）
  redirect(next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") && !/[\r\n]/.test(next) ? next : "/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
