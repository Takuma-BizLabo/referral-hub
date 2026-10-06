import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "rh_session";
const SESSION_DAYS = 30;

export type CurrentUser = {
  id: number;
  loginId: string;
  name: string;
  role: Role;
  lineUserId: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: number) {
  const id = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { id, userId, expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) {
    await prisma.session.deleteMany({ where: { id } });
  }
  store.delete(SESSION_COOKIE);
}

/** ログイン中ユーザー（未ログインなら null）。同一リクエスト内ではキャッシュされる。 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }
  const u = session.user;
  return { id: u.id, loginId: u.loginId, name: u.name, role: u.role, lineUserId: u.lineUserId };
});

/** ログイン必須。未ログインなら /login へ。 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 管理者必須。権限がなければ例外（Server Action 用）または /へ。 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/?error=forbidden");
  }
  return user;
}

export function isAdmin(user: CurrentUser | null | undefined) {
  return user?.role === "ADMIN";
}

/** Server Action 内での権限チェック用（redirect ではなく例外を投げる） */
export async function assertUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("ログインが必要です");
  return user;
}

export async function assertAdmin(): Promise<CurrentUser> {
  const user = await assertUser();
  if (user.role !== "ADMIN") throw new Error("この操作は管理者のみ実行できます");
  return user;
}
