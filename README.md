# 紹介案件管理ツール（ベンダーMTG・紹介案件・報酬）

営業代行の紹介ビジネス向け管理ツールです。

- **ベンダーMTG（フェーズ1）**：商談担当者がベンダーと行う事前MTGの登録 → 管理者承認 → 実施・議事メモ
- **紹介案件（フェーズ2）**：ピックアップされた繋がりの紹介 → 面談 → 報酬の計上・請求・入金
- **繋がりリスト**：CSV一括取込（列マッピング・重複チェック）
- **セールスハブ取込**：チャット本文を貼り付けて、ベンダー・MTGタスク・紹介候補を自動抽出
- **リマインド**：ツール内通知（ベル）＋ LINE push（前日・1時間前・メモ未入力・期限・停滞・入金遅延・承認待ち・差し戻し）
- **目標管理**：月次目標と達成率

## 技術スタック

| 領域 | 採用 |
|---|---|
| フレームワーク | Next.js 15（App Router）/ TypeScript / Tailwind CSS v4 |
| DB | PostgreSQL + Prisma 6 |
| 認証 | ID / パスワード（bcrypt）＋ DBセッション Cookie。権限はサーバー側で毎回チェック |
| cron | アプリ内スケジューラ（5分間隔）＋ 外部から叩ける `/api/cron/run` |
| LINE | Messaging API（push / webhook） |
| ホスティング | Railway 推奨（Web サービス + PostgreSQL） |

---

## 1. ローカルでのセットアップ

前提：Node.js 20 以上（開発時は 24 で確認）。PostgreSQL のインストールは不要です（組み込み版を使用）。

```bash
npm install
cp .env.example .env        # 必要に応じて値を編集
```

ターミナル1：開発用 PostgreSQL を起動（初回は自動で初期化。Ctrl+C で停止）

```bash
npm run db:dev
```

ターミナル2：マイグレーション → シード → 起動

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

http://localhost:3000 を開き、以下でログインできます。

| ログインID | パスワード | 権限 |
|---|---|---|
| `admin` | `admin1234` | 管理者 |
| `matsuda` | `matsuda1234` | 商談担当者 |
| `member2` | `member1234` | 商談担当者 |

> 本番ではシードのパスワードは使わず、「設定 → ユーザー管理」でユーザーを作成・パスワード再設定してください。

シードには、ベンダー3社・繋がり20件・ベンダーMTG5件・紹介案件7件・今月の目標が含まれます（議事メモ未入力、期限超過、停滞、入金遅延、差し戻しの各サンプルを含みます）。

### よく使うコマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run db:dev` | 組み込み PostgreSQL 起動（ローカルのみ） |
| `npm run db:migrate` | マイグレーション作成・適用（開発） |
| `npm run db:deploy` | マイグレーション適用のみ（本番） |
| `npm run db:seed` | シードデータ投入 |
| `npm run db:studio` | Prisma Studio（DB をブラウザで閲覧） |
| `npm run cron` | リマインド判定を手動で1回実行 |
| `npm run typecheck` / `npm run lint` | 型チェック / Lint |

---

## 2. 環境変数

`.env.example` をコピーして設定します。

| 変数 | 必須 | 説明 |
|---|---|---|
| `DATABASE_URL` | ○ | PostgreSQL 接続文字列。Railway では Postgres サービスの `DATABASE_URL` を参照 |
| `SESSION_SECRET` | ○ | セッション用の長いランダム文字列（`openssl rand -base64 32` などで生成） |
| `APP_URL` | ○ | 公開URL（LINE 通知内のリンクに使用）例：`https://xxx.up.railway.app` |
| `CRON_SECRET` | ○ | `/api/cron/run` を外部から叩くときの合言葉 |
| `CRON_ENABLED` | | `false` にするとアプリ内スケジューラを止める（既定 `true`） |
| `TZ` | | `Asia/Tokyo`（既定） |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE利用時 | Messaging API のチャネルアクセストークン（長期） |
| `LINE_CHANNEL_SECRET` | LINE利用時 | Messaging API のチャネルシークレット（Webhook 署名検証） |

LINE の2つが未設定でも動作します（通知はツール内のみ）。

---

## 3. Railway へのデプロイ

### 3-1. アカウントとプロジェクト作成

1. https://railway.app で GitHub アカウントでサインアップ（Hobby プラン：月 $5〜）
2. このフォルダを GitHub リポジトリに push しておく
3. Railway ダッシュボード → **New Project → Deploy from GitHub repo** → このリポジトリを選択
4. 同じプロジェクトで **+ New → Database → Add PostgreSQL** を追加

### 3-2. 環境変数の設定

Web サービスの **Variables** に以下を追加します。

```
DATABASE_URL=${{Postgres.DATABASE_URL}}   ← Postgres サービスを参照（Variable Reference）
SESSION_SECRET=（ランダム文字列）
APP_URL=https://（Settings → Networking で生成した公開ドメイン）
CRON_SECRET=（ランダム文字列）
TZ=Asia/Tokyo
LINE_CHANNEL_ACCESS_TOKEN=（後述）
LINE_CHANNEL_SECRET=（後述）
```

### 3-3. ビルド・起動

`package.json` の設定で自動的に動きます。

- Build：`prisma generate && next build`
- Start：`prisma migrate deploy && next start`（起動時にマイグレーションを自動適用）

Settings → Networking → **Generate Domain** で公開 URL を発行し、`APP_URL` に設定してください。

### 3-4. 初期ユーザーの作成

本番 DB にはユーザーがいないため、公開 URL を開くと自動的に **初期セットアップ画面（`/setup`）** にリダイレクトされます。そこで最初の管理者（ログインID・氏名・パスワード）を作成してください。ユーザーが1人でも存在するとこの画面は表示されなくなります。

ログイン後、「設定 → ユーザー管理」で残りのメンバーを作成します。

> サンプルデータ（ベンダー3社・繋がり20件など）を本番にも入れたい場合は `railway ssh --service web -- npm run db:seed` で投入できます（ユーザーが未作成の場合はシードのユーザーも作られます）。

### 3-5. cron について

Railway の Web サービスは常駐するため、**アプリ内のスケジューラが5分ごとにリマインド判定を実行**します。追加設定は不要です。

スリープする環境や、別途確実に動かしたい場合は、外部 cron（Railway Cron / GitHub Actions / cron-job.org など）から次を5分ごとに叩いてください。

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://xxx.up.railway.app/api/cron/run
```

---

## 4. LINE 連携の手順

### 4-1. LINE 公式アカウント・Messaging API の準備

1. https://developers.line.biz/console/ にログイン（LINE アカウントで可）
2. **プロバイダー**を作成 → **チャネルを作成 → Messaging API**
   - 新しい手順では LINE Official Account Manager で公式アカウントを作成し、「設定 → Messaging API」で有効化します
3. チャネルの **Messaging API 設定** タブで：
   - **チャネルアクセストークン（長期）** を発行 → `LINE_CHANNEL_ACCESS_TOKEN`
   - **Webhook URL** に `https://（APP_URL）/api/line/webhook` を設定し、**Webhook の利用：ON**、「検証」で成功を確認
   - **応答メッセージ：OFF**（LINE 側の自動応答を止める）、あいさつメッセージは任意
4. **チャネル基本設定** タブの **チャネルシークレット** → `LINE_CHANNEL_SECRET`
5. 環境変数を保存して再デプロイ

### 4-2. 各ユーザーの紐付け

1. 公式アカウントの QR コード（Messaging API 設定タブ）を各メンバーに共有し、友だち追加してもらう
2. ツールにログイン → **設定 → LINE連携 → 連携コードを発行**（6桁・30分有効）
3. 公式アカウントのトークにそのコードを送信
4. 「連携が完了しました」と返信が来れば完了。「テスト送信」で確認できます

### 4-3. 送信量の目安

LINE のフリープランは月 200 通です。**設定 → 通知・閾値** で「LINE にも送る通知の種類」を選べます（既定では、停滞と期限超過はツール内のみ）。

---

## 5. 画面と役割

| 画面 | 管理者 | 商談担当者 |
|---|---|---|
| ダッシュボード／ベンダー／ベンダーMTG／紹介案件／繋がり／報酬／セールスハブ取込／通知 | ○ | ○ |
| 承認キュー（MTG承認・差し戻し、報酬計上承認） | ○ | × |
| 目標設定 | ○ | × |
| 設定 → ユーザー管理／通知・閾値 | ○ | × |
| 設定 → LINE連携（自分の分） | ○ | ○ |
| 紹介案件の「MTG未実施ブロック」強制解除 | ○ | × |

### 業務ルール

- ベンダーの「MTG状態」が **実施済** でないと、紹介案件を「紹介先に打診中」以降へ進められません（管理者のみ強制解除可。理由は任意）。MTG を実施済にする際に「ベンダーのMTG状態も実施済にする」チェックで一緒に更新できます。
- 同じ繋がりを同じベンダーに重複紹介しようとすると警告します（確認後は登録可）。
- 紹介案件を **面談実施済** にすると、報酬は自動で **計上申請** になり、管理者が承認キューで承認すると **承認済**（計上月＝承認した月）。
- ステータス変更はすべて履歴（誰が・いつ・何から何へ）に残ります。

### リマインド

| 判定 | 送信先 | 既定の LINE |
|---|---|---|
| MTG・面談の前日（日次時刻）／1時間前 | 担当者／管理者 | ON |
| 実施後 24h 議事メモ（面談結果）未入力 | 担当者／管理者 | ON |
| 次アクション期限当日／超過（日次時刻） | 担当者／管理者 | 当日 ON／超過 OFF |
| 承認待ち発生（MTG登録・報酬計上） | 管理者 | ON |
| 差し戻し／承認完了／タスク割当 | 担当者 | 差し戻し・割当 ON |
| 紹介案件の停滞（既定7日） | 管理者 | OFF |
| 入金予定日超過で未入金 | 管理者 | ON |

日次時刻（既定 8:00）・停滞日数・メモ猶予時間は **設定 → 通知・閾値** で変更できます。

---

## 6. セールスハブ連携（Chrome 拡張による自動取込）

セールスハブには公開 API がないため、**Chrome 拡張**がログイン済みのブラウザからメッセージ一覧を取得し、ツールの API へ送る方式です。ログイン情報はツールのサーバーに保存されません。

### 6-1. 設定（管理者）

1. ツールの **設定 → セールスハブ連携** で「トークンを発行」
2. 同画面の「拡張ファイル（zip）をダウンロード」→ 解凍
3. Chrome `chrome://extensions` → デベロッパーモード ON → 「パッケージ化されていない拡張機能を読み込む」→ 解凍フォルダ
4. 拡張アイコン → ツールのURL と 接続トークンを貼って保存 → 「今すぐ同期」
5. Chrome でセールスハブにログインしておく（複数人が入れてもOK。二重登録はされません）

### 6-2. 自動化の内容

| 起きたこと | ツールの動作 |
|---|---|
| ベンダーから新着メッセージ | 全員にツール内通知（LINE は通知設定で ON/OFF） |
| ベンダーが打ち合わせを求めている（日程調整URL／「お時間」「日程」等） | 商談担当者（既定：松田）へ **承認なし**で「ベンダーMTG（日程調整中）」を作成し通知。ベンダー未登録なら単価0で自動作成し管理者へ通知 |
| チャットに日時（10月9日 11:40、13日16:00、木曜日 午前11:00 など） | MTG を「確定」にして日時をセット（MTG 詳細で修正可） |
| 商談担当者の初回メッセージの「株式会社○○ / 人事部(課長クラス)」、ベンダーが途中で挙げた会社名 | 繋がりリストと突き合わせて紹介候補（ピックアップ受付）を登録。該当なしは通知で知らせる |
| 拡張からの受信が一定時間ない／セールスハブ未ログイン | 管理者へ通知（設定 → セールスハブ連携 で時間を変更可） |

初回同期では過去のやりとりも取り込み、打ち合わせが成立しているスレッドはベンダーMTGとして登録します（初回分は LINE 通知なし）。

### 6-3. 手動取込

「セールスハブ取込（手動）」画面にチャット本文を貼り付けて解析・登録することもできます。受信箱の各スレッドからは本文がプリセットされます。

### 6-4. 会社リストの取込

`data/saleshub_registered.csv`（セールスハブ掲載済み企業）と `data/connections.csv`（繋がりリスト）を用意して次を実行すると、繋がりリストへ取り込みます。

```bash
npx tsx scripts/import-companies.ts
```

本番では `railway ssh --service web -- npx tsx scripts/import-companies.ts` で実行できます。

## 7. ディレクトリ構成（抜粋）

```
prisma/schema.prisma        DB スキーマ（ER はこのファイル）
prisma/seed.ts              シードデータ
src/app/(app)/...           各画面（Server Components + Server Actions）
src/app/api/cron/run        外部 cron 用エンドポイント
src/app/api/line/webhook    LINE Webhook（連携コード受付）
src/lib/auth.ts             セッション・権限チェック
src/lib/notifications.ts    ツール内通知 + LINE push
src/lib/cron/reminders.ts   リマインド判定ロジック
src/lib/saleshub/            セールスハブ連携（HTML解析・自動化ルール・受信処理）
extension/                  Chrome 拡張（public/saleshub-extension.zip として配布）
scripts/dev-db.mjs          組み込み PostgreSQL（ローカル開発用）
```
