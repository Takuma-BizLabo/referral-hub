# 04. タスク（チャット・添付）

> 一言で：メンバー間の依頼を文字で受け渡す機能。宛先・期限・重要フラグ・関連ページURL・添付ファイル付きで依頼し、タスクごとのチャット（画像貼り付け可）でやりとりし、完了すると依頼者に通知が届く。未完了タスクは担当者ごとに定期リマインドされる。

## できること（使う人の目線）
- 宛先（自分も可）・タイトル・内容・期限・関連ページURL・添付（5件まで）・「重要」を付けてタスクを依頼する。依頼すると担当者に通知（LINE にも）が飛ぶ。
- 画像はフォーム上で Cmd+V（Ctrl+V）で貼り付け、またはドラッグ&ドロップで添付できる。
- タブで「自分宛」「自分が依頼」「全員の未完了」「完了済み」を切り替えて見る。
- 「✓ 完了にする」でひとことを添えて完了にする。依頼者に完了通知が届く。「未完了に戻す」もできる。
- 依頼者・管理者は「LINEで再通知」「削除」ができる。
- タスクごとのチャットで報告・追加の指示を送る（Cmd+Enter で送信、スクショ貼り付け・ドロップで添付）。自分のメッセージは取り消せる。
- 関連ページ（MTG・紹介案件など）は目立つボタンで新しいタブに開く。本文中の URL もリンクになる。
- 添付画像はサムネイル表示、その他のファイルはダウンロード。
- MTG詳細・紹介案件詳細などの「タスクを依頼」ボタンから、リンク・タイトル・本文・宛先が入った状態でフォームを開ける。
- ダッシュボードの「今日やること」に自分宛の未完了タスクが並び、その場で完了にできる。サイドバーの「タスク」に未完了件数バッジが出る。

## 画面と操作

### タスク `/tasks`
- 説明文「メンバー間の依頼を文字で受け渡し。完了を押すと依頼者側のステータスも「完了」になります。」
- レイアウト：`grid lg:grid-cols-3`。左 2 列に一覧、右 1 列に「タスクを依頼する」カード（スマホでは一覧の下）。
- タブ（`?tab=`）：
  | tab | ラベル | 中身 | 並び |
  |---|---|---|---|
  | （なし）mine | 自分宛（未完了数） | assignee=自分・OPEN | 重要→期限昇順（期限なしは後）→作成降順 |
  | requested | 自分が依頼（数） | requester=自分・OPEN | 同上 |
  | all | 全員の未完了（数） | OPEN 全部 | 同上 |
  | done | 完了済み | DONE で自分が担当 or 依頼 | doneAt 降順、100 件まで |
- 空のとき：「あなた宛の未完了タスクはありません」／「依頼中のタスクはありません」／「未完了のタスクはありません」／「完了したタスクはありません」。
- `?focus=ID`：そのカードに `ring-2 ring-blue-400`（通知のリンク先）。カードの DOM id は `task-{id}`。
- 依頼フォームの初期値パラメータ：`link`（関連ページURL）、`title`（200 文字で切る）、`body`（5000 文字で切る。あれば textarea を 10 行に）、`assignee`（数字 1〜9 桁、有効ユーザーにいれば選択）。フォームは `key=link+title` で作り直す。
  - 例：MTG詳細 `/tasks?link=/meetings/12&title=○○：次の対応をお願いします&body=…&assignee=3`、紹介案件詳細 `/tasks?link=/referrals/5`。

### タスクカード（`TaskCard`）
- 枠：`rounded-xl border p-4 bg-white`。
  - 完了：`border-gray-200 opacity-75`
  - 重要 or 期限超過：`border-rose-300 border-l-4 border-l-rose-500 shadow-sm`
  - 通常：`border-gray-200 border-l-4 border-l-primary`
- バッジ：完了＝`bg-emerald-100 text-emerald-800 border-emerald-200`「完了」、重要＝`bg-rose-100 text-rose-800 border-rose-200`「重要」、それ以外＝`bg-blue-50 text-blue-800 border-blue-200`「未完了」。期限超過は追加で `bg-rose-600 text-white`「期限超過」。
- タイトル `font-semibold text-base`（完了は `line-through text-gray-500`）。
- 2 行目 `text-xs text-gray-500`：「依頼者 → 担当者（あなた）」（自分宛の未完了は担当者名が `text-rose-700`）・「依頼 日時」・「期限 日付」（超過は `text-rose-600 font-medium`）。
- 本文：`whitespace-pre-wrap break-words`、`linkify` で http(s) URL を `<a target="_blank" rel="noopener noreferrer" class="text-blue-700 underline break-all">` にする（URL の終わりは空白・`<>"'）)」』` まで）。
- 依頼時の添付（commentId が null のもの）：`AttachmentList`。
  - 画像（png/jpeg/gif/webp）：`h-20 w-28 object-cover` のサムネイル＋ファイル名、クリックで新しいタブに原寸（inline 表示）。`loading="lazy"`。
  - その他：`📎 ファイル名 サイズ` のチップ（`rounded-lg border bg-gray-50`）、`?download=1` 付きで新しいタブ。
- 関連ページ：`border-2 border-blue-300 bg-blue-50` の横長ボタン。左に `bg-blue-600 text-white`「関連ページ」、中央に URL（アプリ内パスは `APP_URL` を前に付けた公開URLで表示）、右に「新しいタブで開く ↗」。`target="_blank" rel="noopener noreferrer"`。
- 完了済み：`bg-emerald-50 border-emerald-100` で「{doneAt} に {担当者} が完了：{ひとこと}」。
- 操作ボタン（担当者・依頼者・管理者のみ表示）：
  - OPEN：「✓ 完了にする」（`btn-primary btn-sm`）→ 押すと同じ場所に「ひとこと（任意）」入力＋「完了」「キャンセル」が開く（`CompleteTaskForm`）。
  - DONE：「未完了に戻す」（`btn-secondary btn-sm`）。
  - OPEN かつ（依頼者 or 管理者）かつ担当者が自分でない：「LINEで再通知」。
  - 依頼者 or 管理者：「削除」（`btn-danger btn-sm`、確認ダイアログ「このタスクを削除しますか？」）。

### チャット（カード下部）
- 見出し「💬 やりとり（N）」。
- 吹き出し領域：`flex max-h-[28rem] flex-col-reverse overflow-y-auto rounded-lg bg-gray-50 p-2` の中に、古い→新しい順の `space-y-2` を 1 つ入れる。`flex-col-reverse` のおかげで、JS なしで開いた時点のスクロール位置が一番下（最新）になる。
- 自分の発言は右（`justify-end`、`rounded-2xl rounded-tr-sm bg-blue-100`）、他人は左（`justify-start`、`rounded-tl-sm border border-gray-200 bg-white`）。幅 `max-w-[85%]`。
- 吹き出しの上に「あなた／名前 ・ 日時」。自分 or 管理者なら「取消」リンク（確認「このメッセージを取り消しますか？」）。
- 本文は `linkify`、添付は `AttachmentList`。

### チャット入力（`TaskChatInput`）
- `rounded-lg border bg-white p-2`、ドラッグ中は `border-blue-400 bg-blue-50`。
- textarea 2 行、placeholder「報告・指示・質問を入力（Cmd+Enter で送信。スクショは貼り付けで添付）」。
- Cmd+Enter / Ctrl+Enter で送信（IME 変換中 `isComposing` は無視。空・ファイルエラー時は送らない）。
- フォーム上の貼り付け（ファイルを含むときだけ既定動作を止める）・ドロップで添付追加。「📎 ファイル」ボタンで選択。
- 添付は小さなチップ（画像は `h-8 w-10` のプレビュー）＋「×」で外す。
- 送信ボタンは空・送信中・ファイルエラー時に無効。表示は「送信」／「送信中...」／添付ありなら「アップロード中...」。成功で入力と添付をクリア。

### 依頼フォーム（`TaskForm`）
- 宛先（必須。全有効ユーザー、自分は「（自分）」付き。既定は自分以外の先頭）／期限（date）／タイトル（必須）／内容（textarea）／関連ページURL（hint「MTGや紹介案件のページURLを貼ると「関連ページ」ボタンになります」）／添付（`AttachmentPicker`）／「重要として目立たせる」チェック。
- フォームのどこで貼り付けても、ファイルなら添付に追加する。
- 送信ボタン「タスクを依頼する」。ファイルエラーがあれば無効。添付ありなら「アップロード中...」表示。成功でフォームをリセットし「○○ さんにタスクを依頼しました（添付 N 件）」。

### 添付ピッカー（`AttachmentPicker`）
- `border-2 border-dashed` のドロップ領域（ドラッグ中 `border-blue-400 bg-blue-50`、通常 `border-gray-300 bg-gray-50`）に「ファイルを選択」ボタンと説明。
- 選んだファイルは `h-20 w-28` のカード（画像はプレビュー、他は 📎）＋右上「×」。
- 実際に送るのは `name="files"` の隠し `input[type=file]`。state が変わるたびに `DataTransfer` で files を差し替えて同期する（表示用の選択 input とは別）。プレビュー URL は `URL.createObjectURL` → 不要時に revoke。
- `renamePasted`：名前が空か `image.png/jpg/jpeg/gif/webp` のものを「貼り付け画像_YYYYMMDD_HHmmss(_i).拡張子」に付け替える。

### 添付ファイル取得 `/tasks/attachments/[id]`（GET Route Handler）
- 未ログインは 401（Cookie 自体が無い場合は先に middleware が `/login` へリダイレクトする）。id が 1〜9 桁の数字でなければ／無ければ 404。
- `INLINE_SAFE_TYPES`（png/jpeg/gif/webp/pdf/text/plain）で `?download` なしなら `inline`、それ以外は必ず `attachment`。安全でない形式は Content-Type も `application/octet-stream` にする（HTML/SVG をブラウザで実行させない）。
- ヘッダー：`Content-Disposition: {inline|attachment}; filename="ASCII化した名前"; filename*=UTF-8''{エンコード}`、`X-Content-Type-Options: nosniff`、`Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox`、`Cache-Control: private, max-age=3600`。
- タスクの当事者かどうかは見ない（ログインユーザーなら誰でも取得できる）。

### ダッシュボード「今日やること」・サイドバー
- `/`（`src/app/(app)/page.tsx`）：自分宛の OPEN タスクを「今日やること」リストに入れる。
  - 優先度：重要 or 期限超過＝1、期限が今日＝3、それ以外＝6（他の項目：差し戻し・期限切れ＝2、今日のMTG＝3、メモ未入力＝4 などと混ぜて並べる）。
  - 種別バッジ：「重要タスク」「期限超過タスク」「タスク」。色は重要/超過＝rose（`bg-rose-100 text-rose-800`、左線 `border-l-rose-500`）、他＝blue（`bg-blue-50 text-blue-800`、`border-l-primary`）。
  - サブ行：「依頼者 から ・ 期限 ・ 📎添付 N 件 ・ 💬 N 件 ・ 本文先頭60字」。
  - リンク先：添付かチャットがあれば `/tasks?focus=ID`（「開く」）、無ければ関連ページURL（「関連ページ」、新しいタブ）か `/tasks?focus=ID`。
  - 各行に「✓ 完了にする」（同じ `CompleteTaskForm`）。
  - KPI「あなた宛タスク」（未完了数。1 以上は `text-rose-600`）。
- サイドバー（`Shell`）：「タスク」は一番上。未完了（自分宛 OPEN）があると `bg-rose-500/15 text-white font-semibold` で強調し、右に `bg-rose-500` の件数バッジ。

## データ

### Task
| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| id | int PK | | |
| title | text | 必須 | 200 文字まで |
| body | text? | | 内容 |
| requesterId | int FK → User | | 依頼者 |
| assigneeId | int FK → User | | 担当者（自分も可） |
| status | enum TaskStatus | OPEN | `OPEN`＝未完了、`DONE`＝完了 |
| important | bool | false | 重要 |
| dueDate | datetime? | | 期限（日付。00:00） |
| linkUrl | text? | | 関連ページ。`/` 始まりのパスか http(s) URL のみ |
| doneComment | text? | | 完了時のひとこと |
| doneAt | datetime? | | 完了日時 |
| createdAt / updatedAt | datetime | now | |
インデックス：(assigneeId, status)、(requesterId, status)。

### TaskAttachment
| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| id | int PK | | |
| taskId | int FK → Task（CASCADE） | | |
| commentId | int? FK → TaskComment（CASCADE） | null | null＝依頼時の添付、値あり＝チャットで送った添付 |
| filename | text | | 整形済みファイル名（150 文字まで） |
| mimeType | text | | 100 文字まで。不明は `application/octet-stream` |
| size | int | | バイト数 |
| data | bytea（Bytes） | | ファイル本体を DB に保存 |
| uploadedById | int? | | 送った人（FK なし） |
| createdAt | datetime | now | |
インデックス：taskId、commentId。一覧では `data` を読まない（`ATTACHMENT_META_SELECT` = id, filename, mimeType, size）。

### TaskComment
| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| id | int PK | | |
| taskId | int FK → Task（CASCADE） | | |
| authorId | int FK → User | | 発言者 |
| body | text? | | 本文（5000 文字まで。添付だけなら null） |
| createdAt | datetime | now | |
インデックス：(taskId, createdAt)。

### 設定
- `Setting` の `taskReminderDays`（既定 "1"）：未完了タスクのリマインド間隔（日）。0＝送らない。設定画面 `/settings/thresholds`（管理者）で 0〜30 の整数を入力。
- 通知種別ごとの LINE 送信 ON/OFF（`line.TASK_ASSIGNED` など）も同画面。

### SQLite の CREATE TABLE 例（日時は TEXT(ISO8601) に統一。期限は `YYYY-MM-DD` 相当の 00:00）
```sql
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  assignee_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','DONE')),
  important INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  link_url TEXT,
  done_comment TEXT,
  done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_requester ON tasks(requester_id, status);

CREATE TABLE IF NOT EXISTS task_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id, created_at);

CREATE TABLE IF NOT EXISTS task_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id INTEGER REFERENCES task_comments(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,          -- Postgres の bytea の代わり。better-sqlite3 は Buffer をそのまま入出力できる
  uploaded_by_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_comment ON task_attachments(comment_id);
```
※ `PRAGMA foreign_keys = ON` が無いと CASCADE が効かない（タスク削除で添付・コメントが残る）。

## 決まり（ロジック）

### 添付の制限（`src/lib/attachments.ts`。クライアントとサーバーの両方で検査）
- 1 ファイル 10MB（`MAX_FILE_BYTES`）、1 回の送信 5 件まで（`MAX_FILES`）、1 回の合計 25MB（`MAX_TOTAL_BYTES`）。
- サイズ 0 のファイルは無視。ファイル名はパス部分と制御文字を除き、空なら「file」、150 文字で切る。
- Server Action の本文上限を `next.config.ts` の `experimental.serverActions.bodySizeLimit: "30mb"` に上げている（既定 1MB では添付が送れない）。
- 上限を超えた送信が届かなかった場合も、`useStickyAction` がフォーム上に「送信できませんでした。…添付ファイルが大きすぎるか…」と出す。

### createTaskAction
- 必須：タイトル（200 文字以内）、宛先（有効ユーザー）。関連ページURLは `safeLinkUrl`（`/` 始まりで `//`・`/\` 始まりでないパス、または http/https の URL）を通らなければエラー。
- 期限は `YYYY-MM-DD` を日付として保存。添付はタスクと同時に作成（commentId=null）。
- 担当者が自分以外なら `TASK_ASSIGNED` を担当者へ：タイトル「【タスク依頼】{依頼者} → {タイトル}」、本文＝内容先頭200字／「期限: 日付」／「添付: ファイル名、…」、リンク `/tasks?focus=ID`。自分宛には通知しない。

### completeTaskAction
- できる人：担当者・依頼者・管理者。すでに DONE なら何もしない。
- `UPDATE ... WHERE id=? AND status='OPEN'` で DONE・doneAt・doneComment を入れ、更新 0 件なら通知しない（同時押しで二重通知しない）。
- 完了した人が依頼者以外なら `TASK_DONE` を依頼者へ：「【完了】{名前} がタスクを完了: {タイトル}」、本文＝ひとこと、リンク `/tasks?tab=requested&focus=ID`。

### reopenTaskAction
- できる人：担当者・依頼者・管理者。`WHERE status='DONE'` で OPEN に戻し doneAt・doneComment を消す。
- 戻した人が担当者以外なら担当者へ `TASK_ASSIGNED`「【再開】{名前} がタスクを未完了に戻しました: {タイトル}」。

### deleteTaskAction
- 依頼者か管理者のみ。物理削除（添付・コメントは CASCADE で消える）。通知なし。

### resendTaskAction
- 依頼者か管理者のみ、OPEN のみ。担当者へ `TASK_ASSIGNED`「【タスク依頼・再送】…」（本文は内容 300 字・期限・添付名）。dedupe なし（押すたびに送る）。
- 結果メッセージ：担当者が LINE 連携済みなら「（LINE にも送信）」、未連携なら「（LINE 未連携のためツール内のみ）」。

### addTaskCommentAction
- 本文 5000 文字以内。本文も添付も無ければエラー。タスクが無ければ「タスクが見つかりません（削除された可能性があります）」。
- コメントと添付（taskId と commentId 両方入る）を一緒に作成。
- 通知先：{依頼者, 担当者} から自分を除いた人（同一人物なら 1 回）。`TASK_COMMENT`「【タスクのチャット】{名前}：{タイトル}」、本文＝本文 300 字／添付名、リンク `/tasks?focus=ID`。
- タスクの状態（OPEN/DONE）に関係なく書き込める。チャットに書く権限チェック（当事者か）はしていない。

### deleteTaskCommentAction
- 自分のメッセージか管理者のみ。コメントを物理削除し、その添付も CASCADE で消える。

### 定期リマインド（`src/lib/cron/reminders.ts` の `runReminders`）
- cron が 5 分おきに呼ぶ。日次処理は「現在時刻の時 ≥ `dailyDigestHour`（日次通知の時刻）」のときだけ走る。
- `taskReminderDays > 0` かつ「暦日の通し番号 `dayIndex` が taskReminderDays で割り切れる日」に送る。`dayIndex = floor((今日0時のms − タイムゾーンオフセット) / 86400000)`（サーバーのローカル日付基準。JST 運用前提）。
- 対象：OPEN、`createdAt < 今日0時`（今日依頼されたものは依頼時に通知済みなので除く）、担当者が有効。並びは 重要→期限昇順→作成昇順。
- 担当者ごとに 1 通にまとめる：`TASK_REMINDER`、タイトル「【タスクのリマインド】未完了 N 件（うち期限超過 M 件）」、本文は先頭 10 件を「・タイトル（依頼者から／重要・期限超過 日付 or 期限 日付）」、11 件目以降は「ほか N 件」。リンク `/tasks`。
- 二重送信防止：`dedupeKey = task-remind:u{userId}:{yyyyMMdd}`（Notification.dedupeKey は UNIQUE。既にあれば作らない、作成時の一意制約違反も握りつぶす）。

### 通知全般
- `notify()` はツール内通知を作り、LINE 設定が ON・ユーザーが LINE 連携済み・有効なら LINE にも push（本文末尾に `APP_URL` 付きのリンク）。
- 種別ラベル：TASK_ASSIGNED＝新しいタスクの割当（担当者へ）、TASK_DONE＝依頼したタスクの完了（依頼者へ）、TASK_REMINDER＝未完了タスクの定期リマインド（担当者へ）、TASK_COMMENT＝タスクのチャット（依頼者・担当者へ）。いずれも LINE 既定 ON。

### 権限まとめ
| 操作 | できる人 |
|---|---|
| 一覧閲覧（全員の未完了タブ含む）・依頼・チャット書き込み・添付取得 | ログインユーザー全員 |
| 完了・未完了に戻す | 担当者・依頼者・管理者 |
| 再通知・削除 | 依頼者・管理者 |
| メッセージ取消 | 発言者・管理者 |

### 画面更新
- 各アクション後に `/tasks` と `/`（layout ごと。サイドバーの件数バッジ用）を revalidate。form 系は `runWithFlash` でエラー・notice をリダイレクトのクエリで表示。

## 参照コード
- `prisma/schema.prisma`：`Task`、`TaskStatus`、`TaskAttachment`、`TaskComment`
- `src/app/(app)/tasks/page.tsx`：`TasksPage`（タブ・並び・初期値パラメータ）
- `src/app/(app)/tasks/TaskForm.tsx`：`TaskForm`（`onPaste`）
- `src/app/(app)/tasks/actions.ts`：`pickFiles`、`cleanFilename`、`createTaskAction`、`completeTaskAction`、`reopenTaskAction`、`deleteTaskAction`、`resendTaskAction`、`addTaskCommentAction`、`deleteTaskCommentAction`
- `src/app/(app)/tasks/attachments/[id]/route.ts`：`GET`
- `src/components/TaskCard.tsx`：`TaskCard`、`TaskChat`、`AttachmentList`、`displayLink`
- `src/components/TaskChatInput.tsx`：`TaskChatInput`
- `src/components/AttachmentPicker.tsx`：`AttachmentPicker`、`renamePasted`、`validateFiles`
- `src/components/TaskControls.tsx`：`CompleteTaskForm`
- `src/components/Linkify.tsx`：`linkify`
- `src/lib/attachments.ts`：`MAX_FILE_BYTES`、`MAX_FILES`、`MAX_TOTAL_BYTES`、`INLINE_SAFE_TYPES`、`isImageType`、`fmtBytes`、`ATTACHMENT_META_SELECT`
- `src/lib/utils.ts`：`safeLinkUrl`、`parseDateInput`、`str`
- `src/lib/cron/reminders.ts`：`runReminders` の「未完了タスクの定期リマインド」部分
- `src/lib/notifications.ts`：`notify`（dedupeKey）
- `src/lib/settings.ts`：`taskReminderDays` の既定値
- `src/app/(app)/page.tsx`：「今日やること」のタスク部分、`TodoList`
- `src/components/Shell.tsx`：タスクの件数バッジ
- `next.config.ts`：`serverActions.bodySizeLimit`

## 移植のポイント
- そのまま流用できる純粋関数・部品：`src/lib/attachments.ts`、`src/components/Linkify.tsx`、`AttachmentPicker.tsx` の `renamePasted`・`validateFiles`、`safeLinkUrl`。`AttachmentPicker` / `TaskChatInput` は送信先（action）を差し替えれば UI ごと流用できる。
- 添付本体は SQLite の BLOB に保存。better-sqlite3 では `Buffer.from(await file.arrayBuffer())` をそのまま bind でき、読むと Buffer が返る。一覧の SELECT では `data` 列を絶対に含めない（重い）。DB ファイルが添付で膨らむので、バックアップ容量に注意。
- Route Handler に移す場合、依頼とチャット送信は `multipart/form-data` の POST（`await req.formData()` → `getAll("files")`）。Route Handler には Server Actions の bodySizeLimit は効かないが、前段のプロキシ（nginx の `client_max_body_size` など）で 30MB 程度を許可する。Server Actions のまま使うなら移植先の `next.config` に `experimental.serverActions.bodySizeLimit: "30mb"` を入れる。
- クライアントで `DataTransfer` を使って隠し input に files を入れる方式は Server Action 前提。Route Handler にするなら `FormData` を組んで `fetch` で送る方が素直（state の File[] を `fd.append("files", f)`）。
- 完了・再開の二重通知防止は `UPDATE tasks SET ... WHERE id=? AND status='OPEN'` の `changes` が 0 なら通知しない、で同じことができる。
- 添付取得 Route Handler はヘッダーをそのまま流用する（inline 可能な形式の限定、`nosniff`、CSP `sandbox`、RFC 5987 の `filename*`）。移植先で当事者以外に見せたくなければ、ここで task の requester/assignee/管理者チェックを足す（referral-hub はログインのみ確認）。
- 定期リマインドは移植先の cron（日次ジョブ）に組み込む。`dedupeKey` を UNIQUE にした通知テーブルが必要（`INSERT OR IGNORE` で代用可）。dayIndex の計算はサーバーのタイムゾーンに依存するので、移植先で JST に固定する。
- 「今日0時」「期限超過（dueDate < 今日0時）」の比較は、TEXT(ISO) で保存するなら同じ形式・同じタイムゾーンで文字列比較できるようにそろえる。
- `revalidatePath` はサイドバーのバッジ更新のため。Route Handler にしたらクライアント側で `router.refresh()` する。
- 権限は移植先の役割に合わせる（referral-hub の ADMIN → admin。宛先候補は移植先の有効ユーザー全員か、STAFF に絞るかを決める）。

## 依存
- 05. 通知・LINE連携・リマインド（Notification・`notify`・LINE 送信・dedupeKey・cron の `runReminders`・設定 `taskReminderDays` / `dailyDigestHour` / LINE ON/OFF）
- 09. 目標・ダッシュボード（「今日やること」に載せる場合）
- 01. 紹介案件・ベンダーMTG（「タスクを依頼」ボタンから `/tasks?link=…` で開く側。無くてもタスク単体で動く）

## 動作確認チェックリスト
- [ ] 他人宛に依頼すると担当者に「【タスク依頼】」通知が届き、自分宛では届かない
- [ ] タイトル 201 文字、`javascript:` の関連URL がエラーになり、`/meetings/12` と `https://…` は通る
- [ ] 依頼フォームで Cmd+V したスクショが「貼り付け画像_日時.png」で添付され、×で外せる。ドラッグ&ドロップでも追加できる
- [ ] 11MB のファイル・6 件目・合計 26MB で送信ボタンが無効になりエラーが出る（サーバー側でも弾く）
- [ ] 画像添付はサムネイル表示・クリックで新しいタブに表示、HTML/SVG などはダウンロードになり Content-Type が octet-stream
- [ ] 未ログインで `/tasks/attachments/1` を開くとログイン画面へ回される（無効なセッション Cookie なら 401）
- [ ] 「✓ 完了にする」→ひとこと→完了で依頼者に「【完了】」通知、2 つのタブで同時に押しても通知は 1 回
- [ ] 「未完了に戻す」で担当者に「【再開】」通知、doneAt・ひとことが消える
- [ ] 再通知・削除ボタンは依頼者と管理者だけに出る。削除で添付・コメントも消える
- [ ] チャットで自分は右・相手は左に並び、開いた時に最新が見えている。Cmd+Enter で送信、日本語変換確定の Enter では送らない
- [ ] チャット送信で相手（依頼者／担当者のうち自分以外）に「【タスクのチャット】」通知が届く。自分宛タスクでは誰にも届かない
- [ ] 自分のメッセージの「取消」でメッセージと添付が消える。他人のは取消が出ない（管理者は出る）
- [ ] 本文・チャットの URL がリンクになり新しいタブで開く。関連ページボタンも新しいタブ
- [ ] 重要・期限超過のカードが左赤線＋バッジになる
- [ ] taskReminderDays=1 で日次時刻以降に担当者ごと 1 通、今日作ったタスクは含まれず、同日 2 回目の cron では送られない。0 で送られない
- [ ] ダッシュボード「今日やること」に自分宛タスクが出て、その場で完了にできる。サイドバーに未完了件数バッジ
- [ ] MTG詳細の「タスクを依頼」からリンク・タイトル・本文・宛先が入った状態で開く
