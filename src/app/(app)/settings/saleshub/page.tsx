import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";
import { getSettingRaw, getSetting } from "@/lib/settings";
import { fmtDateTime } from "@/lib/utils";
import { issueIngestTokenAction, rebuildCandidatesAction } from "./actions";
import { SaleshubSettingsForm } from "./SaleshubSettingsForm";

export const metadata = { title: "セールスハブ連携" };

export default async function SaleshubSettingsPage() {
  await requireAdmin();
  const lastRebuild = (await getSettingRaw("saleshub.lastRebuild"))?.split("|") ?? null;
  const [token, enabled, schedulerUserId, lastIngest, status, extVersion, stale, users, threadCount, msgCount] = await Promise.all([
    getSettingRaw("saleshub.ingestToken"),
    getSettingRaw("saleshub.enabled"),
    getSettingRaw("saleshub.schedulerUserId"),
    getSettingRaw("saleshub.lastIngestAt"),
    getSettingRaw("saleshub.status"),
    getSettingRaw("saleshub.extensionVersion"),
    getSetting("saleshubStaleMinutes"),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.saleshubThread.count(),
    prisma.saleshubMessage.count(),
  ]);
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const lastAt = lastIngest ? new Date(lastIngest) : null;
  const staleMin = Number(stale);
  const isStale = !lastAt || Date.now() - lastAt.getTime() > staleMin * 60_000;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="接続状態">
        <dl className="text-sm space-y-2">
          <div className="flex justify-between">
            <dt className="text-gray-500">状態</dt>
            <dd>
              {enabled !== "1" ? (
                <span className="badge bg-gray-100 text-gray-700 border-gray-200">停止中</span>
              ) : status === "loggedout" ? (
                <span className="badge bg-rose-100 text-rose-800 border-rose-200">セールスハブ未ログイン</span>
              ) : isStale ? (
                <span className="badge bg-amber-100 text-amber-800 border-amber-200">受信なし（拡張が動いていない可能性）</span>
              ) : (
                <span className="badge bg-emerald-100 text-emerald-800 border-emerald-200">正常</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">最終受信</dt>
            <dd>{lastAt ? fmtDateTime(lastAt) : "未受信"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">拡張バージョン</dt>
            <dd>{extVersion ?? "-"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">取り込み済み</dt>
            <dd>
              {threadCount} スレッド / {msgCount} メッセージ
            </dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="label">接続トークン（Chrome 拡張に貼る）</div>
          {token ? (
            <code className="block rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs break-all select-all">{token}</code>
          ) : (
            <p className="text-sm text-gray-500">未発行です。下のボタンで発行してください。</p>
          )}
          <form action={issueIngestTokenAction} className="mt-2">
            <button className="btn-secondary btn-sm">{token ? "トークンを再発行（拡張側も貼り直し）" : "トークンを発行"}</button>
          </form>
          <div className="label mt-4">ツールのURL（拡張に貼る）</div>
          <code className="block rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs break-all select-all">{appUrl || "APP_URL 未設定"}</code>
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <SaleshubSettingsForm enabled={enabled === "1"} schedulerUserId={schedulerUserId ?? ""} staleMinutes={staleMin} users={users.map((u) => ({ id: u.id, name: u.name }))} />
        </div>
      </Card>

      <Card title="Chrome 拡張の入れ方（松田さん・田中さん・棗さんの Chrome）">
        <ol className="list-decimal pl-5 text-sm space-y-2 text-gray-800">
          <li>
            <a href="/saleshub-extension.zip" className="text-blue-700 underline">
              拡張ファイル（zip）をダウンロード
            </a>
            して解凍する
          </li>
          <li>
            Chrome で <code className="bg-gray-100 px-1 rounded">chrome://extensions</code> を開き、右上の <b>デベロッパーモード</b> を ON
          </li>
          <li>
            <b>パッケージ化されていない拡張機能を読み込む</b> → 解凍したフォルダを選ぶ
          </li>
          <li>拡張のアイコン（パズルのマーク → ピン留め）をクリックし、上の「ツールのURL」と「接続トークン」を貼って保存</li>
          <li>
            Chrome で <a href="https://saleshub.jp/my/messages" target="_blank" rel="noreferrer" className="text-blue-700 underline">セールスハブ</a> にログインしておく（タブは閉じてOK）
          </li>
        </ol>
        <div className="mt-4 text-xs text-gray-600 space-y-1">
          <p>・拡張は Chrome が起動している間、5分おきにセールスハブの新着を確認してツールへ送ります。複数人が入れていても二重登録はされません。</p>
          <p>・ログイン情報はツールのサーバーには保存されません。ログインが切れた場合やしばらく受信がない場合は、管理者に通知が届きます。</p>
          <p>・初回は過去のやりとりも取り込み、打ち合わせが決まっているスレッドはベンダーMTGとして自動登録します（初回分は LINE 通知なし）。</p>
        </div>
      </Card>

      <Card title="紹介候補の再抽出" className="lg:col-span-2">
        <p className="text-sm text-gray-700 mb-3">
          繋がりリストを後から追加した場合などに、取り込み済みの全スレッドの会社名を繋がりリストと突き合わせ直し、紹介候補（ピックアップ受付）を登録します。登録済みの組み合わせは重複しません。
        </p>
        <form action={rebuildCandidatesAction} className="flex flex-wrap items-center gap-3">
          <button className="btn-secondary">過去メッセージから紹介候補を再抽出</button>
          {lastRebuild && (
            <span className="text-xs text-gray-500">
              前回 {fmtDateTime(new Date(lastRebuild[0]))}：{lastRebuild[1]} スレッド → 候補 {lastRebuild[2]} 件を登録
              {lastRebuild[3] ? `／ 繋がり未登録: ${lastRebuild[3]}` : ""}
            </span>
          )}
        </form>
      </Card>

      <Card title="自動化の内容" className="lg:col-span-2">
        <ul className="list-disc pl-5 text-sm space-y-1 text-gray-800">
          <li>ベンダーからの新着メッセージ → 全員にツール内通知（LINE は通知設定で ON/OFF）</li>
          <li>ベンダーが打ち合わせを求めている（日程調整URL や「お時間」「日程」などの文言）→ 商談担当者へ承認なしで「ベンダーMTG（日程調整中）」タスクを作成し通知。ベンダー未登録なら単価0で自動作成し管理者に通知</li>
          <li>チャット内に日時（例: 10月9日 11:40、13日16:00、木曜日 午前11:00）→ MTG を「確定」にして日時をセット。読み取り結果は MTG 詳細で修正可能</li>
          <li>商談担当者の初回メッセージの「株式会社○○ / 人事部(課長クラス)」や、ベンダーが途中で挙げた会社名 → 繋がりリストと突き合わせて紹介候補（ピックアップ受付）を登録。該当がなければ通知で知らせる</li>
        </ul>
      </Card>
    </div>
  );
}
