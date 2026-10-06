import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** 通知を既読にしてリンク先へ移動 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const base = new URL(req.url);
  if (!user) return NextResponse.redirect(new URL("/login", base));
  const n = await prisma.notification.findFirst({ where: { id: Number(id), userId: user.id } });
  if (!n) return NextResponse.redirect(new URL("/notifications", base));
  if (!n.readAt) await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  return NextResponse.redirect(new URL(n.linkUrl ?? "/notifications", base));
}
