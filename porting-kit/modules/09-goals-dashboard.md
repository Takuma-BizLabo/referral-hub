# 09. 目標・ダッシュボード

> 一言で：ログイン直後の画面に「今日やること」を優先順の1本のリストで出し、その下に KPI の帯と今月の目標達成率を出す。月ごとの目標（全体＋担当者別MTG件数）は管理者が設定する。

## できること（使う人の目線）

- 開くとまず「今日やること」：自分宛タスク、差し戻されたMTG、期限切れの次アクション、今日のMTG・面談、議事メモ未入力、（管理者なら）承認待ち、が大事な順に並ぶ。各行から「開く」「修正する」「入力する」で該当画面へ飛べる。タスクはその場で「✓ 完了にする」（ひとことコメント付き）ができる。
- KPI の帯：今日やること件数／あなた宛タスク／今日の予定／期限切れ／メモ未入力／停滞案件／承認待ち（管理者）または差し戻し（メンバー）／今月のMTG（目標）／今月の計上（入金）。件数があると赤や黄色で目立つ。
- 「今月の目標達成率」：ベンダーMTG件数（全体と担当者別）、紹介件数、報酬（計上）、報酬（入金）を進捗バーで。メンバーは自分の行だけ、管理者は全員分。
- 「停滞中の紹介案件」：ステータスが N 日（設定、既定7日）以上変わっていない案件。管理者には入金遅延の件数と報酬管理へのリンクも。
- 管理者は「目標設定」で月を切り替えて、全体目標4項目と担当者別MTG件数を入力できる。横に今の実績も出る。

## 画面と操作

### ダッシュボード `/`（全員）

並びは上から：`PageHeader`（「ダッシュボード」、説明「yyyy/MM/dd(曜) ／ {氏名} さん」）→ 今日やること → KPI の帯 → `grid gap-4 lg:grid-cols-2` に「今月の目標達成率」と「停滞中の紹介案件」。

**今日やること**（`Card` タイトル「今日やること（N）」、右上に「タスク一覧へ」リンク）

- 各行：`rounded-lg border border-gray-200 border-l-4 bg-white px-3 py-2.5` ＋ 左の太線色（下表の bar）。左に種類バッジ（`badge` ＋ tone の badge 色）とタイトル（`font-medium`、リンク）、下に補足（`text-xs text-gray-500 line-clamp-2`）。右にタスクなら「✓ 完了にする」（`btn-primary btn-sm`。押すとコメント欄＋「完了」「キャンセル」に変わる）と、`btn-secondary btn-sm` の開くボタン。
- 空のとき：`EmptyState`「今日やることはありません。おつかれさまです。」
- スマホ：`flex flex-wrap` でボタン群が下に折り返す（タイトル側は `basis-60`）。

| 種類（kind） | 優先度 | tone | 中身 | リンク先・ボタン名 |
|---|---|---|---|---|
| 重要タスク／期限超過タスク | 1 | rose | 自分が担当の未完了タスクで important か期限超過 | 添付・コメントがあれば `/tasks?focus={id}`「開く」、なければ linkUrl「関連ページ」（別タブ）、どちらもなければ「開く」 |
| 差し戻し | 2 | rose | 自分が担当で REJECTED のベンダーMTG。補足「理由: …」 | `/meetings/{id}/edit`「修正する」 |
| 期限切れ | 2 | rose | 次アクション期限 < 今日 のベンダーMTG（キャンセル・初回MTGなし除く）と紹介案件（実施済・見送り除く）。nextAction が空のものは除外。各20件まで | 詳細「開く」 |
| タスク（今日期限） | 3 | blue | 期限が今日のタスク | 同上 |
| 今日のMTG | 3 | sky | 今日の日時で、日程調整中・確定・リスケのベンダーMTG。タイトル「HH:mm ベンダー名」 | `/meetings/{id}` |
| 今日の面談 | 3 | indigo | 今日の面談日時で、日程調整中・面談確定の紹介案件 | `/referrals/{id}` |
| メモ未入力 | 4 | amber | 実施済で議事メモが空のMTG（管理者は全員分、メンバーは自分の分。古い順10件） | `/meetings/{id}#minutes`「入力する」 |
| 承認待ち | 4 | amber | 管理者のみ。「承認待ちが N 件あります」「MTG x 件 ・ 報酬計上 y 件」 | `/approvals`「承認キューへ」 |
| セールスハブ新着 | 5 | emerald | セールスハブ由来なので移植不要 | — |
| タスク（その他） | 6 | blue | 期限なし・先の期限のタスク | 同上 |

並び：優先度の小さい順 → 同じ優先度の中は時刻（今日のMTG・面談の日時）順。時刻のない項目は 0 扱いで先頭寄りになる。

tone の色（`TONE`）：

| tone | badge | bar |
|---|---|---|
| rose | bg-rose-100 text-rose-800 border-rose-200 | border-l-rose-500 |
| amber | bg-amber-100 text-amber-800 border-amber-200 | border-l-amber-400 |
| sky | bg-sky-100 text-sky-800 border-sky-200 | border-l-sky-400 |
| indigo | bg-indigo-100 text-indigo-800 border-indigo-200 | border-l-indigo-400 |
| blue | bg-blue-50 text-blue-800 border-blue-200 | border-l-primary |
| emerald | bg-emerald-100 text-emerald-800 border-emerald-200 | border-l-emerald-400 |

**KPI の帯**：`card flex flex-wrap overflow-x-auto` の中に `Kpi` を並べる。1つは `.kpi`（`px-4 py-3 border-r border-gray-200 last:border-r-0 min-w-28`）で、ラベル `text-xs text-gray-500`、数値 `text-2xl font-bold mt-0.5`（既定 `text-gray-900`、注意色は `text-rose-600`／`text-amber-600`）、補足 `text-[11px] text-gray-400`。リンク付きは `hover:bg-gray-50`。

| ラベル | 値 | 補足 | リンク | 色 |
|---|---|---|---|---|
| 今日やること | リスト件数 | 下のリストの件数 | — | >0 で rose |
| あなた宛タスク | 未完了タスク数 | 未完了 | /tasks | >0 で rose |
| 今日の予定 | 今日のMTG＋今日の面談 | MTG・面談 | /meetings?view=calendar | — |
| 期限切れ | MTG＋紹介の期限切れ | 次アクション超過 | — | >0 で rose |
| メモ未入力 | 件数 | 実施済MTG | — | >0 で amber |
| 停滞案件 | 件数（最大10） | {N}日以上 | — | >0 で amber |
| 🔒 承認待ち（管理者） | MTG承認待ち＋報酬計上申請 | MTG・報酬計上 | /approvals | >0 で rose |
| 差し戻し（メンバー） | 自分の差し戻し数 | 修正して再申請 | /meetings?approval=REJECTED | >0 で rose |
| 今月のMTG | 実績 | 目標 {全体目標} | — | — |
| 今月の計上 | 計上額 | 入金 {入金額} | — | — |

**今月の目標達成率**（`Card`「今月の目標達成率（yyyy年MM月）」、管理者には右上「目標を設定」→ `/goals`）：項目ごとに「名前 … 実績 / 目標」と `ProgressBar`。担当者別は `pl-4` で「└ 氏名」、文字 `text-gray-600`。

`ProgressBar`：`h-2 rounded bg-gray-200` の中に幅 % のバー。100%以上 `bg-emerald-500`、60%以上 `bg-blue-500`、それ未満 `bg-amber-500`。下に「N%」、目標 0 なら「目標未設定」。

**停滞中の紹介案件**（`Card`「停滞中の紹介案件（N日以上）」）：`divide-y` のリストで、状態 `Badge`、「氏名 × ベンダー」リンク、右に「yyyy/MM/dd(曜)〜」。空なら「停滞している案件はありません」。管理者で入金遅延があれば下に `text-xs text-rose-600`「入金予定日を過ぎた未入金が N 件あります。報酬管理へ」（`/rewards?status=INVOICED`）。

### 目標設定 `/goals`（管理者のみ）

- `PageHeader`「目標設定」「月ごとの目標を設定します。ダッシュボードに達成率が表示されます。」、右に「← 前月」「yyyy年MM月」「翌月 →」（`?month=yyyy-MM`。不正値は今月）。
- `grid gap-4 lg:grid-cols-2`：左「目標入力」、右「現在の実績」（ダッシュボードと同じ進捗バー。全員分）。
- 目標入力フォーム：`grid gap-3 sm:grid-cols-2` に ベンダーMTG件数（全体）・紹介件数（`type=number min=0`）・報酬 計上ベース（円）・報酬 入金ベース（円）（`MoneyInput`）。その下「担当者別 MTG件数」に有効ユーザーごとの数値欄（name=`user_{id}`）。`SubmitButton`「保存」→ `SuccessMessage`「目標を保存しました」。月を変えるとフォームを作り直す（`key={yearMonth}`）。

## データ

### monthly_goals

| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| id | INTEGER PK | 自動 | |
| yearMonth | TEXT | — | 'yyyy-MM'（例 2026-10） |
| userId | INTEGER | NULL | NULL＝全体目標、値あり＝その担当者の目標（使うのは meetingTarget だけ） |
| meetingTarget | INTEGER | 0 | ベンダーMTG件数 |
| referralTarget | INTEGER | 0 | 紹介件数（全体行のみ） |
| rewardAccrualTarget | INTEGER | 0 | 報酬・計上ベース（円、全体行のみ） |
| rewardPaidTarget | INTEGER | 0 | 報酬・入金ベース（円、全体行のみ） |

ユーザー削除時は担当者行も消す（Prisma では onDelete: Cascade）。referral-hub には (yearMonth, userId) の一意制約はなく、保存処理で「探して更新、無ければ作成」している。SQLite では NULL を含む一意制約が効かないので、同じく探して更新するか、全体行を userId=0 にして UNIQUE を付ける。

日時列はない（他モジュールに合わせ、日時は TEXT(ISO) で統一）。

```sql
CREATE TABLE IF NOT EXISTS monthly_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  yearMonth TEXT NOT NULL,
  userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
  meetingTarget INTEGER NOT NULL DEFAULT 0,
  referralTarget INTEGER NOT NULL DEFAULT 0,
  rewardAccrualTarget INTEGER NOT NULL DEFAULT 0,
  rewardPaidTarget INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_monthly_goals_ym ON monthly_goals(yearMonth);
```

設定値 `stagnationDays`（停滞日数、既定 "7"）は settings テーブル（key/value）から読む（05 と共通）。

## 決まり（ロジック）

### 実績の数え方（`monthlyActuals(yearMonth)`、`src/lib/stats.ts`）

月の範囲は `monthRange` ＝ その月の月初 00:00 〜 月末 23:59:59.999（サーバーのローカル時刻）。

| 実績 | 条件 |
|---|---|
| ベンダーMTG件数（全体・担当者別） | executionStatus=DONE かつ doneAt が月内。担当者別は assigneeId で集計（予定日ではなく**実施済にした日時**で数える） |
| 紹介件数 | pickedUpAt（ピックアップ受付日）が月内の紹介案件数。ステータスは問わない（見送りも含む） |
| 報酬（計上） | rewardApprovedAt が月内 かつ rewardStatus ∈ {APPROVED, INVOICED, PAID} の rewardAmount 合計 |
| 報酬（入金） | paidAt が月内 かつ rewardStatus=PAID の rewardAmount 合計 |

### 目標の読み方（`monthlyGoals(yearMonth)`）

- その月の行をすべて取り、userId=NULL の行を overall、それ以外を `perUser[userId] = meetingTarget` にする。行が無ければ目標 0 扱い（画面は「目標未設定」）。

### 目標の保存（`saveGoalsAction`）

- 管理者のみ。yearMonth は `^\d{4}-\d{2}$` でなければエラー。金額・件数は `money()`（整数・0〜20億、空は 0）。
- 全体行：あれば更新、無ければ作成。
- 担当者行：有効ユーザーごとに `user_{id}` があれば、あれば meetingTarget を更新、無ければ作成。

### ダッシュボードの抽出条件（`src/app/(app)/page.tsx`）

- 「今日」は `startOfDay(now)`〜`endOfDay(now)`（サーバーのローカル時刻）。
- 停滞：status が MEETING_DONE・DECLINED 以外で statusChangedAt < 今 − stagnationDays 日（古い順10件）。
- 入金遅延件数（管理者表示）：rewardStatus ∈ {APPROVED, INVOICED} かつ paymentDueAt < 今日 00:00。
- 承認待ち件数：管理者のときだけ数える（メンバーは 0 固定）。
- 自分宛タスク：assigneeId=自分・OPEN を「重要→期限が近い→新しい」順。補足に「依頼者 から ・ 期限 … ・ 📎添付 N 件 ・ 💬 N 件 ・ 本文先頭60字」。
- 「今日の予定」KPI と「今日のMTG」は日程調整中・確定・リスケのみ（実施済は含めない）。
- セールスハブ未読をスレッドごとにまとめて priority 5 に入れる処理はセールスハブ由来なので移植不要。

## 参照コード

- `src/app/(app)/page.tsx`：`DashboardPage`（抽出クエリ・items の組み立て・並び）、`Kpi`、`TodoItem`、`TONE`、`TodoList`、`fmtTime`
- `src/app/(app)/goals/page.tsx`：月の切り替え、実績表示
- `src/app/(app)/goals/GoalsForm.tsx`
- `src/app/(app)/goals/actions.ts`：`saveGoalsAction`
- `src/lib/stats.ts`：`monthRange`、`monthlyActuals`、`monthlyGoals`
- `src/components/ui.tsx`：`ProgressBar`、`Card`、`EmptyState`、`Badge`
- `src/components/TaskControls.tsx`：`CompleteTaskForm`
- `src/lib/settings.ts`：`SETTING_DEFAULTS.stagnationDays`、`getSettingNumber`
- `src/app/globals.css`：`.kpi`
- `prisma/schema.prisma`：`MonthlyGoal`

## 移植のポイント

- ダッシュボードは Server Component のまま、DB 読み取りを better-sqlite3 の同期クエリに置き換えればよい（Route Handler にする必要はない）。`Promise.all` の各クエリは順番に実行して構わない。
- Prisma の `groupBy` は `SELECT assigneeId, COUNT(*) FROM vendor_meetings WHERE executionStatus='DONE' AND doneAt BETWEEN ? AND ? GROUP BY assigneeId`、`aggregate _sum` は `SELECT COALESCE(SUM(rewardAmount),0)` に置き換える。
- 月の範囲・「今日」は日本時間で計算し、ISO（UTC）に変換して比較する（サーバーが UTC で動く環境だと referral-hub のローカル時刻依存の計算はずれる）。
- 目標保存は Route Handler にするなら `PUT /api/goals/[yearMonth]`、管理者（＋必要なら clerk）ガード。全体行と担当者行の保存は 1 トランザクションにまとめる。
- 00 ベンダーMTG管理を入れない場合：「差し戻し」「期限切れ（MTG）」「今日のMTG」「メモ未入力」「MTG承認待ち」「今月のMTG」KPI、目標の MTG 件数を外す（紹介・報酬・タスクだけ残す）。
- 04 タスクを入れない場合はタスク行と「あなた宛タスク」KPI を外す。
- **そのまま流用できる純粋関数**：`TONE`・`TodoItem` 型と並べ替え（`priority` → `at`）、`ProgressBar` の色分け（`src/components/ui.tsx`）、`monthRange`（date-fns のみ。`src/lib/stats.ts`）、`fmtDate`・`fmtYen`・`fmtMonthDay`・`yearMonthOf`（`src/lib/utils.ts`）。

## 依存

- 01 紹介案件（期限切れ・今日の面談・停滞・紹介件数）
- 08 報酬管理・承認キュー（計上・入金の実績、承認待ち件数、入金遅延件数）
- 10 画面のデザイン一式（Card、ProgressBar、Badge、EmptyState、.kpi）
- 04 タスク（任意。タスク行・完了ボタン）
- 00 ベンダーMTG管理（任意。MTG関連の行・KPI・目標）
- 05 通知・LINE連携（任意。停滞日数の設定を共有）

## 動作確認チェックリスト

- [ ] 重要タスク・期限超過タスクがリストの一番上、次に差し戻し・期限切れ、次に今日のMTG/面談（時刻順）が並ぶ
- [ ] タスク行の「✓ 完了にする」でコメントを入れて完了でき、リストから消える
- [ ] 差し戻しの行から編集画面に飛べ、保存（再申請）するとリストから消える
- [ ] 期限切れは次アクションが空の案件・キャンセル済み・見送り済みを含まない
- [ ] メンバーには承認待ちが出ず、KPI は「差し戻し」になる。管理者には「🔒 承認待ち」が出る
- [ ] 件数があると KPI の数字が赤／黄色になる。リンク付き KPI から該当画面へ飛べる
- [ ] 目標設定で月を切り替えて保存し、ダッシュボードの達成率に反映される。目標 0 は「目標未設定」と出る
- [ ] ベンダーMTGを「実施済」にすると、その月の MTG 実績（全体と担当者別）が 1 増える
- [ ] 報酬を承認するとその月の「報酬（計上）」、入金済にすると「報酬（入金）」が増える
- [ ] 紹介案件を登録すると（ピックアップ日が今月なら）紹介件数が 1 増える
- [ ] 進捗バーの色が 60% 未満＝黄、60%以上＝青、100%以上＝緑になる
- [ ] 停滞日数の設定を変えると停滞案件の件数・見出しが変わる
- [ ] 日本時間の月末 23:30 に実施済にした MTG がその月に数えられる（UTC ずれがない）
- [ ] スマホ幅で KPI の帯が折り返し、今日やることのボタンが押せる
