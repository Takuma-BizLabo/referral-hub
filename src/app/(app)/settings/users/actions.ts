"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertAdmin, hashPassword } from "@/lib/auth";
import { errorState, type ActionState } from "@/lib/action-state";
import { str } from "@/lib/utils";
import type { Role } from "@prisma/client";

function validatePassword(pw: string) {
  if (pw.length < 8) throw new Error("パスワードは8文字以上にしてください");
}

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const loginId = str(formData.get("loginId"));
    const name = str(formData.get("name"));
    const password = String(formData.get("password") ?? "");
    const role = (str(formData.get("role")) ?? "MEMBER") as Role;
    if (!loginId || !name) throw new Error("ログインIDと氏名は必須です");
    if (!/^[a-zA-Z0-9_.-]{3,}$/.test(loginId)) throw new Error("ログインIDは3文字以上の半角英数字で入力してください");
    validatePassword(password);
    const exists = await prisma.user.findUnique({ where: { loginId } });
    if (exists) throw new Error("このログインIDは既に使われています");
    await prisma.user.create({
      data: { loginId, name, role, passwordHash: await hashPassword(password) },
    });
    revalidatePath("/settings/users");
    return { success: `ユーザー「${name}」を作成しました` };
  } catch (e) {
    return errorState(e);
  }
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const id = Number(formData.get("id"));
    const password = String(formData.get("password") ?? "");
    validatePassword(password);
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
    // 既存セッションを無効化
    await prisma.session.deleteMany({ where: { userId: id } });
    revalidatePath("/settings/users");
    return { success: "パスワードを再設定しました" };
  } catch (e) {
    return errorState(e);
  }
}

export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const me = await assertAdmin();
    const id = Number(formData.get("id"));
    const name = str(formData.get("name"));
    const role = (str(formData.get("role")) ?? "MEMBER") as Role;
    const isActive = formData.get("isActive") === "on";
    if (!name) throw new Error("氏名は必須です");
    if (id === me.id && (role !== "ADMIN" || !isActive)) {
      throw new Error("自分自身の管理者権限・有効状態は変更できません");
    }
    await prisma.user.update({ where: { id }, data: { name, role, isActive } });
    if (!isActive) await prisma.session.deleteMany({ where: { userId: id } });
    revalidatePath("/settings/users");
    return { success: "ユーザー情報を更新しました" };
  } catch (e) {
    return errorState(e);
  }
}
