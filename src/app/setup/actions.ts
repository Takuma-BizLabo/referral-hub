"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";
import { str } from "@/lib/utils";

/** 初回セットアップ：ユーザーが1人もいないときだけ、最初の管理者を作成できる */
export async function setupAdminAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const count = await prisma.user.count();
  if (count > 0) return { error: "すでにユーザーが存在します。ログイン画面からログインしてください。" };
  const loginId = str(formData.get("loginId"));
  const name = str(formData.get("name"));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!loginId || !name) return { error: "ログインIDと氏名は必須です" };
  if (!/^[a-zA-Z0-9_.-]{3,}$/.test(loginId)) return { error: "ログインIDは3文字以上の半角英数字で入力してください" };
  if (password.length < 8) return { error: "パスワードは8文字以上にしてください" };
  if (password !== confirm) return { error: "確認用パスワードが一致しません" };
  const user = await prisma.user.create({
    data: { loginId, name, role: "ADMIN", passwordHash: await hashPassword(password) },
  });
  await createSession(user.id);
  redirect("/settings/users");
}
