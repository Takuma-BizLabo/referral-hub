import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";
import { getLineQuota, lineConfigured } from "@/lib/line";
import { jstMonth, lineLimitReachedThisMonth } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/lib/labels";
import { fmtDateTime } from "@/lib/utils";
import { issueLineCodeAction, sendLineTestAction, unlinkLineAction } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "LINE連携" };

export default async function LineSettingsPage() {
  const me = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  const configured = lineConfigured();
  const codeValid = user.lineLinkCode && user.lineLinkCodeExpiresAt && user.lineLinkCodeExpiresAt > new Date();
  const lastLine = await prisma.notification.findFirst({ where: { userId: me.id, lineSentAt: { not: null } }, orderBy: { lineSentAt: "desc" } });
  // 今月のLINE送信（管理者だけ表示）。月の区切りは日本時間
  const isAdmin = me.role === "ADMIN";
  const month = jstMonth();
  const monthStart = new Date(`${month}-01T00:00:00+09:00`);
  const [quota, limited, sentRows, unsentCount, users] = isAdmin
    ? await Promise.all([
        getLineQuota(),
        lineLimitReachedThisMonth(),
        prisma.notification.groupBy({ by: ["type", "userId"], where: { lineSentAt: { gte: monthStart } }, _count: { _all: true } }),
        prisma.notification.count({ where: { createdAt: { gte: monthStart }, lineError: { not: null } } }),
        prisma.user.findMany({ select: { id: true, name: true } }),
      ])
    : [null, false, [], 0, []];
  const sentTotal = sentRows.reduce((a, r) => a + r._count._all, 0);
  const byType = NOTIFICATION_TYPES.map((t) => ({ label: t.label, n: sentRows.filter((r) => r.type === t.key).reduce((a, r) => a + r._count._all, 0) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const byUser = users.map((u) => ({ name: u.name, n: sentRows.filter((r) => r.userId === u.id).reduce((a, r) => a + r._count._all, 0) })).filter((x) => x.n > 0);

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
                <SubmitButton className="btn-secondary">テスト送信</SubmitButton>
              </form>
              <form action={unlinkLineAction}>
                <SubmitButton className="btn-danger" confirm="LINE連携を解除しますか？">連携を解除</SubmitButton>
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
              <SubmitButton className="btn-primary">{codeValid ? "コードを再発行" : "連携コードを発行"}</SubmitButton>
            </form>
          </div>
        )}
      </Card>
      {isAdmin && (
        <Card title={`今月のLINE送信（${month}）`} className="lg:col-span-2">
          {limited && (
            <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              LINE公式アカウントの今月の送信上限に達したため、LINEへの送信を止めています（通知はツール内のベルには届いています）。翌月1日に自動で再開します。
              すぐ再開するには、LINE Official Account Manager でプランを上げてから、この画面の「テスト送信」を押してください。
            </div>
          )}
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <div className="text-xs text-gray-500">LINE側の使用数</div>
              <div className="text-lg font-semibold">{quota ? `${quota.used} / ${quota.limit ?? "上限なし"} 通` : "取得できません"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">このツールから送った数</div>
              <div className="text-lg font-semibold">{sentTotal} 通</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">送れなかった通知</div>
              <div className="text-lg font-semibold">{unsentCount} 件</div>
            </div>
          </div>
          {sentTotal > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <div className="mb-1 text-xs text-gray-500">種類別（多い順）</div>
                <ul className="space-y-0.5">
                  {byType.map((x) => (
                    <li key={x.label} className="flex justify-between gap-2">
                      <span>{x.label}</span>
                      <span className="font-medium">{x.n}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1 text-xs text-gray-500">送り先別</div>
                <ul className="space-y-0.5">
                  {byUser.map((x) => (
                    <li key={x.name} className="flex justify-between gap-2">
                      <span>{x.name}</span>
                      <span className="font-medium">{x.n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500">
            LINEは送り先1人につき1通と数えます（全員に送る通知は人数分）。減らすには「通知・閾値」で LINE に送る種類を絞ってください。
          </p>
        </Card>
      )}
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
