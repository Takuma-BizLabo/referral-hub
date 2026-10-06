import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";
import { lineConfigured } from "@/lib/line";
import { fmtDateTime } from "@/lib/utils";
import { issueLineCodeAction, sendLineTestAction, unlinkLineAction } from "./actions";

export const metadata = { title: "LINE連携" };

export default async function LineSettingsPage() {
  const me = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  const configured = lineConfigured();
  const codeValid = user.lineLinkCode && user.lineLinkCodeExpiresAt && user.lineLinkCodeExpiresAt > new Date();
  const lastLine = await prisma.notification.findFirst({ where: { userId: me.id, lineSentAt: { not: null } }, orderBy: { lineSentAt: "desc" } });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="あなたのLINE連携">
        {!configured && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 mb-3">
            サーバーに LINE のチャネル設定（LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET）がありません。README の手順で設定してください。それまで通知はツール内のみです。
          </div>
        )}
        {user.lineUserId ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="badge bg-emerald-100 text-emerald-800 border-emerald-200">連携済</span>
              <span className="text-xs text-gray-500 font-mono">{user.lineUserId.slice(0, 8)}…</span>
            </div>
            {lastLine && <p className="text-xs text-gray-500">最終送信：{fmtDateTime(lastLine.lineSentAt)}</p>}
            <div className="flex gap-2">
              <form action={sendLineTestAction}>
                <button className="btn-secondary">テスト送信</button>
              </form>
              <form action={unlinkLineAction}>
                <button className="btn-danger">連携を解除</button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <span className="badge bg-gray-100 text-gray-700 border-gray-200">未連携</span>
            <ol className="list-decimal pl-5 space-y-1 text-gray-700">
              <li>LINE で公式アカウントを友だち追加する（QRコードは管理者から受け取ってください）</li>
              <li>下の「連携コードを発行」を押す</li>
              <li>表示された6桁のコードを、公式アカウントのトークにそのまま送る</li>
              <li>「連携が完了しました」と返信が来たら完了。この画面を再読み込みすると「連携済」になります</li>
            </ol>
            {codeValid ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
                <div className="text-xs text-blue-700 mb-1">連携コード（{fmtDateTime(user.lineLinkCodeExpiresAt)} まで有効）</div>
                <div className="text-3xl font-bold tracking-[0.3em] text-blue-900">{user.lineLinkCode}</div>
              </div>
            ) : null}
            <form action={issueLineCodeAction}>
              <button className="btn-primary">{codeValid ? "コードを再発行" : "連携コードを発行"}</button>
            </form>
          </div>
        )}
      </Card>
      <Card title="LINE通知について">
        <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
          <li>通知はまずツール内（ベル）に届き、LINE 送信が ON の種類だけ LINE にも push されます。</li>
          <li>どの種類を LINE に送るかは管理者が「通知・閾値」で設定します（無料枠 月200通の目安）。</li>
          <li>LINE 公式アカウントは全員で1つを共有し、ユーザーごとに連携コードで紐付けます。</li>
          <li>送信に失敗した場合は通知一覧に「LINE送信失敗」と表示されます。</li>
        </ul>
      </Card>
    </div>
  );
}
