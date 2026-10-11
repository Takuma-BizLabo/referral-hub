import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { INLINE_SAFE_TYPES } from "@/lib/attachments";

/** タスク添付ファイルの取得（ログインユーザーのみ） */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("ログインが必要です", { status: 401 });
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) return new Response("見つかりません", { status: 404 });
  const a = await prisma.taskAttachment.findUnique({ where: { id: Number(id) } });
  if (!a) return new Response("見つかりません", { status: 404 });

  const wantsDownload = new URL(req.url).searchParams.has("download");
  const inlineOk = INLINE_SAFE_TYPES.includes(a.mimeType);
  // ブラウザで開ける安全な形式以外は、HTML として解釈されないよう必ずダウンロードにする
  const disposition = inlineOk && !wantsDownload ? "inline" : "attachment";
  const asciiName = a.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(a.data), {
    headers: {
      "Content-Type": inlineOk ? a.mimeType : "application/octet-stream",
      "Content-Length": String(a.size),
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
