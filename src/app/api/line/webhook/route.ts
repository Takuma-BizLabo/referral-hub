import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { replyLineText, verifyLineSignature } from "@/lib/line";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
};

/** LINE Messaging API Webhook：連携コードを受け取って userId を紐付ける */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyLineSignature(raw, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const body = JSON.parse(raw) as { events?: LineEvent[] };
  for (const ev of body.events ?? []) {
    const lineUserId = ev.source?.userId;
    if (!lineUserId) continue;

    if (ev.type === "follow" && ev.replyToken) {
      await replyLineText(ev.replyToken, "友だち追加ありがとうございます。\n紹介案件管理ツールの「設定 → LINE連携」で発行した6桁のコードを送ってください。");
      continue;
    }
    if (ev.type !== "message" || ev.message?.type !== "text") continue;
    const text = (ev.message.text ?? "").trim();
    const code = text.match(/\d{6}/)?.[0];
    if (!code) {
      if (ev.replyToken) await replyLineText(ev.replyToken, "連携するには、ツールの「設定 → LINE連携」で発行した6桁のコードを送ってください。");
      continue;
    }
    const user = await prisma.user.findUnique({ where: { lineLinkCode: code } });
    if (!user || !user.lineLinkCodeExpiresAt || user.lineLinkCodeExpiresAt < new Date()) {
      if (ev.replyToken) await replyLineText(ev.replyToken, "コードが無効か期限切れです。ツールでコードを再発行してください。");
      continue;
    }
    // 同じ LINE アカウントが別ユーザーに紐付いていたら解除
    await prisma.user.updateMany({ where: { lineUserId, id: { not: user.id } }, data: { lineUserId: null } });
    await prisma.user.update({
      where: { id: user.id },
      data: { lineUserId, lineLinkCode: null, lineLinkCodeExpiresAt: null },
    });
    if (ev.replyToken) await replyLineText(ev.replyToken, `${user.name} さんのアカウントと連携が完了しました。今後リマインドをこのトークにお送りします。`);
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
