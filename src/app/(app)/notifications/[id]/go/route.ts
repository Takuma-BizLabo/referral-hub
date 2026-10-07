import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * 相対パスでリダイレクトする。
 * Railway などのプロキシ配下では req.url のホストが内部アドレス（localhost:8080 など）になるため、
 * それを基準に絶対URLを作るとブラウザが内部アドレスへ飛ばされて開けなくなる。
 */
function go(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

/** 通知を既読にしてリンク先へ移動 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) return go("/login");
  const nid = Number(id);
  if (!Number.isSafeInteger(nid) || nid <= 0 || nid > 2147483647) return go("/notifications");
  const n = await prisma.notification.findFirst({ where: { id: nid, userId: user.id } });
  if (!n) return go("/notifications");
  if (!n.readAt) await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  const target = n.linkUrl && n.linkUrl.startsWith("/") && !n.linkUrl.startsWith("//") ? n.linkUrl : "/notifications";
  return go(target);
}
