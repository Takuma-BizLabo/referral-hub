import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** 通知を既読にしてリンク先へ移動 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const base = new URL(req.url);
  if (!user) return NextResponse.redirect(new URL("/login", base));
  const nid = Number(id);
  if (!Number.isSafeInteger(nid) || nid <= 0 || nid > 2147483647) return NextResponse.redirect(new URL("/notifications", base));
  const n = await prisma.notification.findFirst({ where: { id: nid, userId: user.id } });
  if (!n) return NextResponse.redirect(new URL("/notifications", base));
  if (!n.readAt) await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  const target = n.linkUrl && n.linkUrl.startsWith("/") && !n.linkUrl.startsWith("//") ? n.linkUrl : "/notifications";
  return NextResponse.redirect(new URL(target, base));
}
