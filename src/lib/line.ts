import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const LINE_API = "https://api.line.me/v2/bot";

export function lineConfigured() {
  return !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

/** LINE Messaging API の push でテキストを送る */
export async function pushLineText(lineUserId: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN が設定されていません");
  const res = await fetch(`${LINE_API}/message/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LINE push 失敗 (${res.status}): ${body.slice(0, 300)}`);
  }
}

/** Webhook の署名検証 */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Webhook への返信（連携コード受付の結果通知） */
export async function replyLineText(replyToken: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  await fetch(`${LINE_API}/message/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  }).catch(() => {});
}
