# 05. 通知・LINE連携・リマインド

> 一言で：ツール内通知（ベル・通知一覧）を1か所の `notify()` で作り、種類ごとに ON なら LINE 公式アカウントから本人へ push する。5分おきのリマインド判定で、商談の前日・1時間前・メモ未入力・期限・停滞・入金遅延・未完了タスクを自動通知する。

## できること（使う人の目線）
- 画面右上のベルで未読数を見る。開くと直近10件。クリックで既読になり、関連ページへ飛ぶ。「すべて既読にする」もある。
- 通知一覧（/notifications）で種類グループ（タスク／承認・差し戻し／リマインド）と「未読のみ」で絞り込む。グループ単位で一括既読。
- 各通知に「LINE送信済」「LINE送信失敗」（ホバーで理由）が出る。
- 設定 → LINE連携で、自分の LINE を6桁コードで紐付ける。テスト送信・連携解除ができる。
- 管理者は 設定 → 通知・閾値 で、停滞日数・日次通知の時刻・議事メモ猶予・タスクのリマインド間隔と、「LINE にも送る通知の種類」を切り替える。
- 何もしなくても、MTG・面談の前日／1時間前、議事メモ未入力、次アクション期限の当日／超過、紹介案件の停滞、入金遅延、未完了タスクの一覧が届く。同じ内容は二重に届かない。

## 画面と操作

### ベル（ヘッダー）— `src/components/Bell.tsx`
- 置き場所：スマホは上部の濃色ヘッダー（`md:hidden`、`dark` で白アイコン）、PC は右上（`hidden md:flex`）。
- アイコン右上に未読バッジ `bg-rose-500 text-white text-[10px]`、100件以上は `99+`。
- クリックでドロップダウン（`w-[min(92vw,380px)] rounded-xl shadow-xl`）。外側クリック・Esc で閉じる。
- ヘッダー行：「通知 未読 N」（`text-rose-600`）＋未読がある時だけ「すべて既読にする」（`markAllReadAction` を form で送る）。
- 一覧は直近10件（`max-h-[60vh] overflow-y-auto`）。未読は `bg-blue-50/60`＋左に青丸 `bg-blue-500`＋太字、タイトルは2行で省略（`line-clamp-2`）。下にグループ名・相対時刻（たった今／N分前／N時間前／N日前／7日以上は M/D）。
- 各行は `<a href="/notifications/{id}/go">`（プリフェッチで既読になるのを避けるため `Link` を使わない）。
- 空：「通知はありません」。最下部に「すべての通知を見る」→ /notifications。
- データはレイアウト（`src/app/(app)/layout.tsx`）で取る：未読件数 `count(readAt=null)` と直近10件（createdAt desc）。

### 通知一覧 — URL `/notifications?group=task|approval|remind|saleshub&unread=1`
- ヘッダー説明：「未読 N 件」／「未読はありません」。未読がある時だけ右上ボタン「すべて既読にする」（グループ選択中は「『タスク』を既読にする」で、そのグループだけ既読）。
- チップ列（`chip` / 選択中 `chip-active`、スマホは横スクロール `overflow-x-auto no-scrollbar`）：「すべて（未読 N）」、各グループ（未読数を `bg-rose-500` の丸バッジ）、「未読のみ」（ON で「✓ 未読のみ」）。
- 一覧は最大200件、createdAt 降順。未読行は `bg-blue-50/50`＋青丸。本文は `whitespace-pre-wrap line-clamp-4`。下段に日時・グループ名（無ければ「お知らせ」）・`text-emerald-600`「LINE送信済」・`text-rose-500`「LINE送信失敗」（title に lineError）。
- 空：「通知はありません」／未読のみなら「未読の通知はありません」。

### 通知を開く — `GET /notifications/{id}/go`（ルートハンドラ）
- 未ログイン → `/login`。id が不正・他人の通知 → `/notifications`。
- 未読なら readAt を今にしてから、`linkUrl` へ 307。`linkUrl` が `/` で始まり `//` で始まらない時だけ使い、それ以外は `/notifications`（オープンリダイレクト防止）。
- **Location は相対パスで返す**（`new NextResponse(null,{status:307,headers:{Location:path}})`）。プロキシ配下で `req.url` のホストが内部アドレスになり、絶対URLにすると開けなくなるため。

### LINE連携 — URL `/settings/line`（全員）
- サーバーに `LINE_CHANNEL_ACCESS_TOKEN` が無い時：黄色の注意（`border-amber-200 bg-amber-50`）「それまで通知はツール内のみ」。
- 連携済：バッジ「連携済」（`bg-emerald-100`）＋ lineUserId 先頭8文字、「最終送信：日時」（自分の通知の lineSentAt 最新）、「テスト送信」「連携を解除」（確認ダイアログ）。
- 未連携：バッジ「未連携」、手順4行（友だち追加 → コード発行 → 6桁をトークに送る → 返信が来たら完了）。有効なコードがあれば青枠（`border-blue-200 bg-blue-50`）に「連携コード（〜まで有効）」と大きな数字（`text-3xl font-bold tracking-[0.3em]`）。ボタン「連携コードを発行」／有効コードがあれば「コードを再発行」。
- 右カードに説明（ベル→ON の種類だけ LINE、管理者が通知・閾値で設定、無料枠 月200通の目安、公式アカウントは全員で1つ共有、失敗は一覧に表示）。

### 通知・閾値 — URL `/settings/thresholds`（管理者のみ）
- 数値3つ（`sm:grid-cols-3`）：紹介案件の停滞日数（1〜90）／日次通知の時刻（0〜23時）／議事メモ未入力の猶予（時間。actions は 1〜720 を許可、input の max は 168）。
- 青枠（`border-blue-200 bg-blue-50/50`）：未完了タスクのリマインド間隔（日。0〜30、0=送らない）。
- 「LINE にも送る通知の種類」：`NOTIFICATION_TYPES` 全種のチェックボックス（`sm:grid-cols-2`）。
- 保存でエラー／「保存しました」を表示。

## データ

### Notification
| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| id | int PK | 自動 | |
| userId | int FK→User（削除で cascade） | | 受け取る人 |
| type | string | | `NOTIFICATION_TYPES` の key |
| title | string | | 1行目。LINE でも先頭 |
| body | string? | null | 本文（改行可） |
| linkUrl | string? | null | アプリ内の相対パス（`/meetings/12` など） |
| dedupeKey | string? **UNIQUE** | null | 二重作成防止キー |
| readAt | datetime? | null | 既読日時 |
| lineSentAt | datetime? | null | LINE push 成功日時 |
| lineError | string? | null | LINE 送信失敗の理由（500文字まで） |
| createdAt | datetime | now | |

インデックス：(userId, readAt)、(userId, createdAt)、(userId, type, readAt)。

### Setting（キー・値の汎用表）
| 列 | 型 | 意味 |
|---|---|---|
| key | string PK | 設定名 |
| value | string | 値（数値も文字列で持つ） |

使うキー（未保存なら既定値 `SETTING_DEFAULTS`）：
| key | 既定 | 意味 |
|---|---|---|
| stagnationDays | 7 | 停滞と見なす日数 |
| dailyDigestHour | 8 | 日次判定を始める時（0〜23） |
| minutesMissingHours | 24 | 実施後この時間でメモ未入力通知 |
| taskReminderDays | 1 | 未完了タスクのリマインド間隔（日）。0=送らない |
| line.<TYPE> | 種類ごとの defaultLine | "1"=LINE に送る / "0"=送らない |
| saleshubStaleMinutes | 120 | セールスハブ由来なので移植不要 |

### User に足す列
| 列 | 型 | 意味 |
|---|---|---|
| lineUserId | string? UNIQUE | LINE の userId（U で始まる） |
| lineLinkCode | string? UNIQUE | 発行中の6桁コード |
| lineLinkCodeExpiresAt | datetime? | コードの期限（発行から30分） |

### 通知の種類（`src/lib/labels.ts` の NOTIFICATION_TYPES）
| key | ラベル | defaultLine | グループ |
|---|---|---|---|
| MEETING_1DAY | MTG・面談の前日 | ON | リマインド |
| MEETING_1HOUR | MTG・面談の1時間前 | ON | リマインド |
| MINUTES_MISSING | 議事メモ未入力（実施後24時間） | ON | リマインド |
| DUE_TODAY | 次アクション期限当日 | ON | リマインド |
| OVERDUE | 次アクション期限超過 | OFF | リマインド |
| APPROVAL_PENDING | 承認待ち発生（管理者へ） | ON | 承認・差し戻し |
| REJECTED | 差し戻し（担当者へ） | ON | 承認・差し戻し |
| APPROVED | 承認完了（担当者へ） | OFF | 承認・差し戻し |
| TASK_ASSIGNED | 新しいタスクの割当（担当者へ） | ON | タスク |
| STAGNANT | 紹介案件の停滞 | OFF | リマインド |
| PAYMENT_LATE | 入金予定日超過（管理者へ） | ON | リマインド |
| SALESHUB_MESSAGE | セールスハブの新着・連携状態 | ON | セールスハブ（移植不要） |
| TASK_DONE | 依頼したタスクの完了（依頼者へ） | ON | タスク |
| TASK_REMINDER | 未完了タスクの定期リマインド（担当者へ） | ON | タスク |
| TASK_COMMENT | タスクのチャット（依頼者・担当者へ） | ON | タスク |

NOTIFICATION_GROUPS：task=タスク、approval=承認・差し戻し、remind=リマインド、saleshub=セールスハブ。`notificationGroupOf(type)` で表示名を引く（無ければ「お知らせ」）。

### SQLite 例（日時は TEXT＝ISO 8601 UTC `toISOString()` に統一）
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  dedupe_key TEXT UNIQUE,          -- NULL は何件でも可
  read_at TEXT,
  line_sent_at TEXT,
  line_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notif_user_created ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_user_type_read ON notifications(user_id, type, read_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```
users への列追加は MIGRATIONS に：
```sql
ALTER TABLE users ADD COLUMN line_user_id TEXT;
ALTER TABLE users ADD COLUMN line_link_code TEXT;
ALTER TABLE users ADD COLUMN line_link_code_expires_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_line_link_code ON users(line_link_code);
```
（SQLite の ALTER では UNIQUE を付けられないので一意インデックスで代える。）

## 決まり（ロジック）

### notify(input) — `src/lib/notifications.ts`
入力：userId, type, title, body?, linkUrl?, dedupeKey?, line?（false で LINE に送らない）。戻り値：作ったら true、重複で作らなかったら false。
1. dedupeKey があれば同じキーの行を探し、あれば何もせず false。
2. 行を作る。作成時に UNIQUE 違反（Prisma `P2002`）が出たら＝確認と作成の間に別処理が同じキーで作った（cron の同時実行など）→ false で終わる。dedupeKey 無しの例外はそのまま投げる。
3. LINE 送信（ここでの失敗は呼び出し元に投げない）：
   - `LINE_CHANNEL_ACCESS_TOKEN` 未設定、または `line === false` → 送らない。
   - `getLineEnabledMap()[type]` が false → 送らない。
   - 受信者に lineUserId が無い／isActive=false → 送らない。
   - 本文＝`[title, body, APP_URL + linkUrl]` の空でないものを改行でつなぐ（APP_URL 末尾の / は除く。未設定なら相対パスのまま）。
   - 成功 → lineSentAt=now。例外 → lineError に message 先頭500文字（Error 以外は「LINE送信エラー」）。
- `notifyAdmins(input)`：role=ADMIN かつ isActive の全員に notify。dedupeKey は `${key}:u${adminId}` に変えて人ごとに一意にする。
- `line:false` を使うのはセールスハブ由来の処理だけ（移植不要）。仕組みとしては残す。

### getLineEnabledMap() — `src/lib/settings.ts`
`key LIKE 'line.%'` の Setting を読み、各種類について行があれば `value === "1"`、無ければ defaultLine。保存は thresholds の保存時に全種類 "1"/"0" を upsert（未チェックは "0"）。

### LINE Messaging API — `src/lib/line.ts`
- `lineConfigured()`：`LINE_CHANNEL_ACCESS_TOKEN` があるか。
- `pushLineText(to, text)`：`POST https://api.line.me/v2/bot/message/push`、`Authorization: Bearer <token>`、`{to, messages:[{type:"text", text: text.slice(0,4900)}]}`。非200は `LINE push 失敗 (status): 本文先頭300字` を投げる。
- `verifyLineSignature(raw, sig)`：`HMAC-SHA256(LINE_CHANNEL_SECRET, 生ボディ)` の base64 と `x-line-signature` を `timingSafeEqual`（長さ違いは false）。secret か署名が無ければ false。
- `replyLineText(replyToken, text)`：`/message/reply`。失敗は握りつぶす。

### Webhook と6桁コード連携
- 発行 `issueLineCodeAction`（ログイン中の本人）：`randomInt(100000, 999999)` で6桁。既存コードと重なれば最大10回引き直す。lineLinkCode と期限（now+30分）を保存。
- `POST /api/line/webhook`（認証不要パス。署名で守る）：生ボディを `req.text()` で読み、署名 NG なら 401。events を順に処理：
  - source.userId が無いイベントは無視。
  - `follow`：「友だち追加ありがとうございます…6桁のコードを送ってください」と返信。
  - text メッセージ以外は無視。本文から最初の `\d{6}` を拾う。無ければ「6桁のコードを送ってください」と返信。
  - コードのユーザーが無い／期限切れ → 「コードが無効か期限切れです。再発行してください」。
  - 有効 → 同じ lineUserId を持つ**別ユーザーの紐付けを外し**、本人に lineUserId を入れてコードと期限を消す。「◯◯ さんのアカウントと連携が完了しました…」と返信。
  - 最後に 200 `{ok:true}`。`GET` も `{ok:true}`（LINE コンソールの検証用）。
- 解除 `unlinkLineAction`：lineUserId・コード・期限を null。
- テスト送信 `sendLineTestAction`：自分宛てに type=TASK_ASSIGNED「【テスト】LINE連携の確認メッセージです」を notify（TASK_ASSIGNED の LINE 設定が OFF だと LINE には行かない）。

### 既読
- `markAllReadAction(formData?)`：自分の未読（readAt=null）を一括で readAt=now。form に group があればその種類だけ。`/notifications` とレイアウトを revalidate。
- 個別既読は `/notifications/{id}/go` を開いた時だけ。

### スケジューラ — `src/lib/cron/scheduler.ts` / `src/instrumentation.ts`
- `instrumentation.ts` の `register()`（nodejs ランタイム）で `process.env.TZ ||= "Asia/Tokyo"` にし、`CRON_ENABLED !== "false"` なら `startScheduler()`。
- `startScheduler()`：`globalThis.__rhSchedulerStarted` で1回だけ起動。起動15秒後に1回、その後5分ごとに `runReminders()`。例外はログのみ。**常駐1プロセス前提**（複数台でも dedupeKey で二重送信はしない）。
- 外部 cron 用 `GET/POST /api/cron/run`：`Authorization: Bearer <CRON_SECRET>` または `?secret=`。CRON_SECRET 未設定か不一致は 401。成功で `{ok, created, at}`。

### runReminders(now) — `src/lib/cron/reminders.ts`
日付の境目はサーバーのローカル時刻（TZ=Asia/Tokyo）。`today`=今日0時、`todayKey`=yyyyMMdd。「担当者へ」は VendorMeeting.assigneeId、「管理者へ」は ADMIN 全員（キー末尾 `:u{id}`）。戻り値 created は新規作成数。

毎回（5分ごと）判定するもの：
| 種類 | 対象 | 宛先 | タイトル例 | dedupeKey |
|---|---|---|---|---|
| MEETING_1HOUR | ベンダーMTG：scheduledAt が now+55〜65分、executionStatus ∈ SCHEDULING/CONFIRMED/RESCHEDULE | 担当者 | 【1時間前】{ベンダー} のベンダーMTG {日時}（body=place） | `meeting:{id}:1h` |
| MEETING_1HOUR | 紹介：meetingAt が同じ窓、status ∈ SCHEDULING/MEETING_CONFIRMED | 管理者 | 【1時間前】{人} × {ベンダー} の面談 {日時}（body=meetingPlace） | `referral:{id}:1h` |
| MINUTES_MISSING | MTG：DONE かつ minutes=null かつ doneAt ≤ now−猶予時間 | 担当者 | 【議事メモ未入力】{ベンダー} のベンダーMTG | `meeting:{id}:minutes` |
| MINUTES_MISSING | 紹介：MEETING_DONE かつ meetingResult=null かつ meetingDoneAt ≤ now−猶予 | 管理者 | 【面談結果未入力】{人} × {ベンダー} | `referral:{id}:minutes` |

（この間にセールスハブ連携の途絶チェックがあるが、セールスハブ由来なので移植不要。）

`now.getHours() < dailyDigestHour` ならここで終わり。以降は**その日の指定時刻以降、毎回判定し dedupeKey で1日1回**にする：
| 種類 | 対象 | 宛先 | dedupeKey |
|---|---|---|---|
| TASK_REMINDER | status=OPEN、createdAt < 今日0時（今日依頼分は除く）、担当者が有効。担当者ごとに1通。`dayIndex % taskReminderDays === 0` の日だけ（taskReminderDays=0 なら送らない） | 担当者 | `task-remind:u{userId}:{todayKey}` |
| MEETING_1DAY | MTG：scheduledAt が明日0時〜明後日0時、SCHEDULING/CONFIRMED/RESCHEDULE | 担当者 | `meeting:{id}:1d:{予定日yyyyMMdd}` |
| MEETING_1DAY | 紹介：meetingAt が明日、SCHEDULING/MEETING_CONFIRMED | 管理者 | `referral:{id}:1d:{予定日}` |
| DUE_TODAY / OVERDUE | MTG：nextAction あり、nextActionDue < 明日0時、executionStatus が CANCELLED/NO_MEETING 以外。nextActionDue ≥ 今日0時なら当日、未満なら超過 | 担当者 | `meeting:{id}:due:{todayKey}` |
| DUE_TODAY / OVERDUE | 紹介：同条件、status が MEETING_DONE/DECLINED 以外 | 管理者 | `referral:{id}:due:{todayKey}` |
| STAGNANT | 紹介：status が MEETING_DONE/DECLINED 以外、statusChangedAt < now−停滞日数 | 管理者 | `referral:{id}:stagnant:{statusChangedAtのms}:{bucket}` |
| PAYMENT_LATE | 紹介：rewardStatus ∈ APPROVED/INVOICED、paymentDueAt < 今日0時 | 管理者 | `referral:{id}:late:{todayKey}` |

細かい規則：
- TASK_REMINDER：`dayIndex = floor((today − tzOffset) / 1日)`（ローカル暦日の通し番号）。並び＝重要 desc → 期限 asc → 作成 asc。タイトル「【タスクのリマインド】未完了 N 件（うち期限超過 M 件）」、本文は先頭10件を「・{title}（{依頼者}から／重要・期限 yyyy/MM/dd(E) か 期限超過 …）」、11件以上は「ほか N 件」。linkUrl=/tasks。
- 前日のキーに予定日が入るので、日程が変われば新しい日でもう一度届く。1時間前・メモ未入力のキーには日付が無いので、各案件1回きり。
- 期限：当日／超過どちらも同じキーなので1日1通。超過は毎日届く（OVERDUE は既定で LINE OFF）。タイトル「【期限当日】{ベンダー}：{nextAction}」「【期限超過】…（yyyy/MM/dd(E)）」。
- 停滞：`days = floor((now − statusChangedAt)/1日)`、`bucket = floor((days − 停滞日数)/7)`。停滞日数に達した日と、その後7日ごとに1回。ステータスが変われば statusChangedAt が変わりリセット。タイトル「【停滞{days}日】{人} × {ベンダー}」。
- 入金遅延：毎日1通。タイトル「【入金遅延】{ベンダー}：{人} の紹介報酬 ¥{金額}」。

### 他の機能から呼ぶ notify（参考：どの種類をどこで出すか）
- APPROVAL_PENDING：ベンダーMTG登録時・差し戻し後の再申請時（管理者へ）、紹介が面談実施済になり報酬を自動で計上申請した時（管理者へ）。
- APPROVED / REJECTED：MTG の承認・差し戻し（担当者へ。差し戻しは body に理由）。
- TASK_ASSIGNED：MTG 担当を他人に割り当てた時、タスク依頼・再送・再開。TASK_DONE・TASK_COMMENT はタスク機能から。

### 権限
- ベル・通知一覧・LINE連携：ログインユーザー本人の分だけ（userId で絞る）。
- 通知・閾値：管理者のみ（ページ `requireAdmin`、保存 `assertAdmin`）。
- `/api/line/webhook` と `/api/cron` はログイン不要（middleware の PUBLIC_PATHS）。前者は署名、後者は CRON_SECRET で守る。

## 参照コード
- `src/lib/notifications.ts`：`notify`, `notifyAdmins`, `appUrl`
- `src/lib/labels.ts`：`NOTIFICATION_TYPES`, `NotificationType`, `NOTIFICATION_GROUPS`, `notificationGroupOf`
- `src/lib/settings.ts`：`SETTING_DEFAULTS`, `getSetting`, `getSettingNumber`, `setSetting`, `getLineEnabledMap`
- `src/lib/line.ts`：`lineConfigured`, `pushLineText`, `verifyLineSignature`, `replyLineText`
- `src/app/api/line/webhook/route.ts`：`POST`, `GET`
- `src/app/(app)/settings/line/page.tsx`, `actions.ts`：`issueLineCodeAction`, `unlinkLineAction`, `sendLineTestAction`
- `src/app/(app)/notifications/page.tsx`, `actions.ts`（`markAllReadAction`）, `[id]/go/route.ts`（`go`, `GET`）
- `src/components/Bell.tsx`：`Bell`, `ago`／`src/app/(app)/layout.tsx`（未読数と直近10件）／`src/components/Shell.tsx`（設置場所）
- `src/lib/cron/scheduler.ts`：`startScheduler`／`src/instrumentation.ts`：`register`
- `src/lib/cron/reminders.ts`：`runReminders`
- `src/app/api/cron/run/route.ts`：`handle`
- `src/app/(app)/settings/thresholds/page.tsx`, `ThresholdsForm.tsx`, `actions.ts`（`saveThresholdsAction`）
- `src/middleware.ts`：`PUBLIC_PATHS`
- `prisma/schema.prisma`：`Notification`, `Setting`, `User`

## 移植のポイント
- **dedupeKey の二重防止**：better-sqlite3 は同期なので `INSERT ... ON CONFLICT(dedupe_key) DO NOTHING` を使い、`info.changes === 0` なら「重複」として false を返せば、事前の SELECT と P2002 の catch を1つにできる（dedupe_key が NULL の行は衝突しない）。LINE 送信は INSERT が成功した時だけ行う。
- **LINE 送信は await してよいが失敗を投げない**：Route Handler の中で呼んでも、LINE の失敗で本処理（登録・承認など）を失敗させない。結果は line_sent_at / line_error に書く。
- **notifyAdmins の宛先**：referral-hub の ADMIN → 行き先では管理者(admin)。営業事務(clerk) も受け取るべきかは行き先の運用で決める（コードは `role IN (...) AND is_active=1` を1か所に）。担当者宛て（MTG の assignee）はそのまま。
- **タイムゾーン**：判定は「サーバーのローカル時刻＝JST」前提（`process.env.TZ="Asia/Tokyo"` を instrumentation で設定）。TEXT(ISO UTC) で保存するなら、範囲は JS で `Date` を作ってから `toISOString()` で比べる（文字列の大小比較で正しく動く）。`yyyyMMdd` のキーや `getHours()` は JST の Date から作る。
- **スケジューラ**：Next 16 でも `instrumentation.ts` の `register()` で `setInterval` を張れる（nodejs ランタイムのみ）。サーバーレスなら外部 cron で `/api/cron/run` を叩く方に寄せる。HMR で二重起動しないよう globalThis フラグを残す。
- **Webhook**：署名検証は**生ボディ**で行う（`await req.text()` → 検証 → `JSON.parse`）。`requireUser` を通さないパスにする。返信は replyToken で行い、push 枠を消費しない。
- **/notifications/{id}/go**：Location は相対パスのまま返す（`NextResponse.redirect(new URL(...))` にしない）。一覧・ベルのリンクは `<a>`（`next/link` はプリフェッチで GET が走り既読になる恐れ）。
- **Server Actions → Route Handlers にする場合**：`POST /api/notifications/read-all`（body: group?）、`POST /api/line/code`、`DELETE /api/line/link`、`POST /api/line/test`、`PUT /api/settings/thresholds`（admin）。いずれも requireUser(STAFF) 相当で本人に限る。
- **Setting の型**：値は文字列。`getSettingNumber` の「数値でなければ既定値」に合わせる。thresholds の保存は全項目を1トランザクションで upsert（`INSERT ... ON CONFLICT(key) DO UPDATE SET value=excluded.value`）。
- **groupBy**：一覧の種類別未読数は `SELECT type, COUNT(*) FROM notifications WHERE user_id=? AND read_at IS NULL GROUP BY type`。
- **そのまま流用できる純粋なもの**：`src/lib/labels.ts` の `NOTIFICATION_TYPES` / `NOTIFICATION_GROUPS` / `notificationGroupOf`（SALESHUB_MESSAGE と saleshub グループは外す）、`src/lib/line.ts` 全体（fetch と node:crypto だけに依存）、`Bell.tsx` の `ago()`。`reminders.ts` は Prisma 呼び出しを SQL に置き換えれば構造ごと流用できる。
- セールスハブの途絶チェック（`saleshub.enabled` 以下）と `confirmPendingFromChats` はセールスハブ由来なので移植不要。

## 依存
- 00 ベンダーMTG（VendorMeeting：scheduledAt, executionStatus, doneAt, minutes, nextAction, nextActionDue, assigneeId, place）
- 01 紹介案件（Referral：meetingAt, meetingPlace, status, statusChangedAt, meetingResult, meetingDoneAt, nextAction, nextActionDue, rewardStatus, paymentDueAt, rewardAmount）
- 04 タスク（チャット・添付）（Task：status, createdAt, assigneeId, requester, important, dueDate, title）— TASK_* 通知と TASK_REMINDER 用。未移植なら TASK_REMINDER 部分を外す。
- 行き先のユーザー・ロール・ログイン（requireUser / requireAdmin 相当）

## 動作確認チェックリスト
- [ ] 同じ dedupeKey で notify を2回（同時にも）呼んで、1件しかできず2回目が false になる
- [ ] dedupeKey 無しの notify は何回でも作られる
- [ ] LINE トークン未設定でもツール内通知は作られ、エラーにならない
- [ ] 通知・閾値で OFF にした種類は LINE に送られず、line_sent_at も line_error も空
- [ ] LINE 送信失敗時に line_error が入り、一覧に「LINE送信失敗」（ホバーで理由）が出る
- [ ] 連携コード発行 → LINE で6桁を送る → 「連携が完了しました」返信 → 画面が「連携済」
- [ ] 30分過ぎたコードは「無効か期限切れ」と返る。数字の無いメッセージには案内が返る
- [ ] 同じ LINE で別ユーザーに連携すると、前のユーザーの紐付けが外れる
- [ ] 署名が違う Webhook は 401
- [ ] テスト送信が届く／連携解除で未連携に戻る
- [ ] ベルの未読数・直近10件・「すべて既読にする」が動く。Esc と外側クリックで閉じる
- [ ] 通知をクリックすると既読になり linkUrl に飛ぶ。プロキシ配下でも内部アドレスに飛ばない（Location が相対）
- [ ] linkUrl が `//evil` や `https://…` の時は /notifications に飛ぶ。他人の通知 id は開けない
- [ ] 一覧のグループ絞り込み・未読のみ・グループ単位の一括既読
- [ ] MTG を now+60分に置いて cron を回すと 1時間前が担当者に1回だけ届く（5分後に回しても増えない）
- [ ] 日次時刻より前は前日・期限・停滞・入金遅延・タスクが出ず、時刻以降に1日1回だけ出る
- [ ] MTG の日程を別の日に変えると前日通知がもう一度届く
- [ ] 期限超過は毎日1通、停滞は到達日とその7日ごと、入金遅延は毎日1通
- [ ] taskReminderDays=2 で隔日、0 で送られない。今日依頼したタスクは含まれない
- [ ] `/api/cron/run` は CRON_SECRET 無し・不一致で 401、正しければ `{ok, created}`
- [ ] 通知・閾値の範囲外入力（停滞0、時刻24 など）でエラーメッセージが出る。メンバーは開けない
