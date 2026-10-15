# 06. 今日の商談・カレンダー

> 一言で：ベンダーMTG一覧と紹介案件一覧の上に「今日の商談」カードを出し、一覧のタブに「カレンダー」（月表示）を足す。どちらもベンダーMTG（青系 sky）と紹介面談（紫系 indigo）を同じ画面に並べる、読み取り専用の表示機能。

## できること（使う人の目線）
- ベンダーMTG一覧・紹介案件一覧を開くと、いちばん上に今日の商談（ベンダーMTGと紹介面談）が時刻順に出る。
- 今日の件数、明日の件数がひと目で分かる。今日が0件なら「次の商談」の日時と相手が出る。
- 打ち合わせ場所が URL なら「参加URLを開く ↗」で会議にすぐ入れる。
- 実施済の商談は薄く表示され「実施済」バッジが付く。
- 一覧の「カレンダー」タブで月カレンダーを見る。前月・翌月・今月に移動できる。予定をクリックすると詳細へ。
- 旧URL `/meetings/calendar` を開いても、ベンダーMTG一覧のカレンダー表示に自動で移る。

## 画面と操作

### 今日の商談カード — `src/components/TodaySchedule.tsx`（Server Component、引数なし）
- 置き場所：`/meetings` と `/referrals` の PageHeader の直後、タブの上。**どのタブ（リスト・カンバン・カレンダー）でも出る**。両ページとも同じ内容（全ユーザー・全担当の予定）。
- 枠：`card mb-3 border-blue-200`。
- 見出し行（`border-b border-gray-100 px-4 py-2.5`、折り返し可）：
  - 左：「今日の商談」＋日付 `M/d(E)`（例 10/15(水)、`text-sm text-gray-500`）＋件数の丸バッジ `rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white`「N件」。
  - 右（`text-xs text-gray-500`）：「明日 N件」。今日が0件で次の予定があれば「 ・ 次の商談 yyyy/MM/dd(E) HH:mm {相手}」を続ける。
- 空（今日0件）：`px-4 py-3 text-sm text-gray-500`「今日の商談はありません。」
- 行（`divide-y divide-gray-100`、各行 `flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm`。スマホは自然に折り返す）：
  1. 時刻 `HH:mm`（`w-12 font-semibold tabular-nums`）
  2. 種類バッジ：ベンダーMTG＝`badge bg-sky-100 text-sky-900 border-sky-200`「ベンダーMTG」／紹介面談＝`badge bg-indigo-100 text-indigo-900 border-indigo-200`「紹介面談」
  3. 相手（リンク `font-medium text-blue-700 hover:underline`）：MTG はベンダー名 → `/meetings/{id}`。面談は「会社名（氏名）」、会社が無ければ氏名だけ → `/referrals/{id}`
  4. 補足 `text-xs text-gray-500`：MTG「ベンダーMTG ・ {担当者名}」、面談「紹介面談 ・ {ベンダー名}」
  5. 実施済なら `badge bg-pink-50 text-pink-800 border-pink-200`「実施済」、行全体に `opacity-60`
  6. 場所が `http(s)://` で始まる時だけ右端に「参加URLを開く ↗」（`ml-auto btn-secondary btn-sm`、`target="_blank" rel="noopener noreferrer"`）

### 月カレンダー — `src/components/MonthCalendar.tsx`（Server Component）
- props：`month?: string`（`yyyy-MM`）、`monthHref(month: string | null) => string`（前月・翌月・今月リンクを作る関数。null は今月＝month なし）。
- 操作行：「← 前月」「yyyy年M月」「翌月 →」「今月」（いずれも `btn-secondary btn-sm` のリンク）。右端に凡例：`bg-sky-200` の四角「ベンダーMTG」、`bg-indigo-200` の四角「紹介面談」。
- 表：`card overflow-x-auto` の中に `min-w-[700px]`（スマホは横スクロール）。
  - 曜日ヘッダー（日始まり）：`grid grid-cols-7 bg-gray-50 text-xs text-gray-500`、日曜 `text-rose-500`、土曜 `text-blue-500`。
  - 日セル：`min-h-24 border-b border-r border-gray-100 p-1`。前後月の日は `bg-gray-50 text-gray-400`。今日は `bg-blue-50/60` で、日付数字を青丸 `bg-blue-600 font-medium text-white`（`h-6 w-6 rounded-full`）。
  - 予定（1件1行、`block truncate rounded px-1 py-0.5 text-[11px]`）：
    - ベンダーMTG：`bg-sky-100 text-sky-900 hover:bg-sky-200`、表示「HH:mm ベンダー名」、title「HH:mm ベンダー名（担当者）」→ `/meetings/{id}`
    - 紹介面談：`bg-indigo-100 text-indigo-900 hover:bg-indigo-200`、表示「HH:mm 会社名(無ければ氏名)×ベンダー名」→ `/referrals/{id}`
    - 実施済（MTG=DONE、面談=MEETING_DONE）は `opacity-60`
    - 1日の中は MTG（時刻順）→ 面談（時刻順）の順。件数上限なし（セルが縦に伸びる）。
- 空の月でも枠だけ表示（特別な空表示はない）。

### 一覧ページへの組み込み（カレンダータブ）
- `src/app/(app)/meetings/page.tsx` と `src/app/(app)/referrals/page.tsx` で同じ作り：
  - クエリ `view` は `list | kanban | calendar`（それ以外は list）。`month` は検証せずそのまま渡す（MonthCalendar 側で不正なら今月）。
  - タブ（`Tabs`：選択中 `border-blue-600 text-blue-700 font-medium`）：「リスト」「カンバン」は今の絞り込みを保ったまま view だけ替える。「カレンダー」は `/meetings?view=calendar`（`/referrals?view=calendar`）で**絞り込みを捨てる**。
  - `view === "calendar"` のときは、ベンダーチップ・ステータスチップ・検索／絞り込みパネル（FilterPanel など）を**丸ごと出さない**。代わりに `<MonthCalendar month={sp.month} monthHref={(m) => `/meetings?view=calendar${m ? `&month=${m}` : ""}`} />`（referrals は `/referrals?...`）。
  - カレンダーは絞り込み（担当者・ベンダー・ステータス）を反映しない。常に全件。
- `/meetings` の PageHeader 右には「カレンダー」ボタン（`btn-secondary`、`/meetings?view=calendar`）もある。
- 旧ページ `src/app/(app)/meetings/calendar/page.tsx`：`month` が `^\d{4}-\d{2}$` のときだけ引き継ぎ、`redirect("/meetings?view=calendar[&month=yyyy-MM]")`。

## データ
新しいテーブル・列は無い。00・01 の既存列を読むだけ。

| 読む元 | 列 | 使い道 |
|---|---|---|
| VendorMeeting | id, scheduledAt (datetime?), executionStatus (enum), place (string?：URL か場所) | 時刻・実施済判定・参加URL |
| VendorMeeting → Vendor | name | 表示名 |
| VendorMeeting → User(assignee) | name | 補足・title |
| Referral | id, meetingAt (datetime?), status (enum), meetingPlace (string?) | 時刻・実施済判定・参加URL |
| Referral → Contact | name, company? | 表示名 |
| Referral → Vendor | name | 補足 |

関係する enum：
- ExecutionStatus：SCHEDULING=日程調整中、CONFIRMED=確定、DONE=実施済、RESCHEDULE=リスケ、CANCELLED=キャンセル、NO_MEETING=初回MTGなし
- ReferralStatus：RECEIVED=ピックアップ受付、CONTACTING=紹介先に打診中、SCHEDULING=日程調整中、MEETING_CONFIRMED=面談確定、MEETING_DONE=面談実施済、DECLINED=紹介見送り

SQLite（テーブルは 00・01 のもの。日時は TEXT＝ISO 8601 UTC に統一）で必要な索引だけ：
```sql
CREATE INDEX IF NOT EXISTS idx_vendor_meetings_scheduled_at ON vendor_meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_referrals_meeting_at ON referrals(meeting_at);
```
今日の商談の取得例：
```sql
-- :start = 今日0時(JST)のISO, :horizon = 60日後0時のISO
SELECT m.id, m.scheduled_at, m.execution_status, m.place, v.name AS vendor_name, u.name AS assignee_name
FROM vendor_meetings m JOIN vendors v ON v.id = m.vendor_id JOIN users u ON u.id = m.assignee_id
WHERE m.scheduled_at >= :start AND m.scheduled_at < :horizon
  AND m.execution_status NOT IN ('CANCELLED','NO_MEETING')
ORDER BY m.scheduled_at LIMIT 50;

SELECT r.id, r.meeting_at, r.status, r.meeting_place, c.name, c.company, v.name AS vendor_name
FROM referrals r JOIN contacts c ON c.id = r.contact_id JOIN vendors v ON v.id = r.vendor_id
WHERE r.meeting_at >= :start AND r.meeting_at < :horizon AND r.status <> 'DECLINED'
ORDER BY r.meeting_at LIMIT 50;
```

## 決まり（ロジック）

### TodaySchedule
- 期間：`start = startOfDay(now)`、`end = start+1日`、`horizon = start+60日`。
- 取得：
  - ベンダーMTG：`start ≤ scheduledAt < horizon` かつ executionStatus が CANCELLED・NO_MEETING 以外。scheduledAt 昇順、最大50件。
  - 紹介：`start ≤ meetingAt < horizon` かつ status ≠ DECLINED（MEETING_DONE は含む）。meetingAt 昇順、最大50件。
- 両方を1つの配列にして時刻で並べ替える。
  - 今日 = `at < end`
  - 明日の件数 = `end ≤ at < end+1日`
  - 次の商談 = `at ≥ end` の最初の1件（今日が0件の時だけ表示）
- 実施済：MTG は `executionStatus === "DONE"`、面談は `status === "MEETING_DONE"`。
- 参加URL：place / meetingPlace が `/^https?:\/\//` に合う時だけ。
- 今日すでに過ぎた時刻の予定も今日の欄に残る（0時からの範囲で取るため）。
- 権限による絞り込みは無い（ログインしていれば全員分が見える）。

### MonthCalendar
- `month` を `parse(month, "yyyy-MM")`。無い・不正なら今日の月。
- 表示範囲：月初を含む週の日曜 〜 月末を含む週の土曜（`startOfWeek/endOfWeek`、`weekStartsOn: 0`）。前後月の日も予定を出す。
- 取得：MTG は `gridStart ≤ scheduledAt ≤ gridEnd`、CANCELLED・NO_MEETING 除外。紹介は `gridStart ≤ meetingAt ≤ gridEnd`、DECLINED 除外。件数上限なし。
- 日ごとの振り分けは `isSameDay`（サーバーのローカル時刻＝JST）。
- 前月・翌月リンクは `addMonths(月初, ±1)` を `yyyy-MM` に。今月リンクは `monthHref(null)`。

### 依存の扱い
- 00 ベンダーMTG を移植していない場合は、MTG の取得・青い表示・凡例「ベンダーMTG」を外し、**紹介面談（indigo）だけ**を出す。カードの見出しはそのまま「今日の商談」でよい。
- 今日の商談・カレンダーは表示だけなので、MTG／紹介の登録・更新時に追加の処理は要らない（一覧ページの再描画で反映）。referral-hub では MTG・紹介の更新アクションが `/meetings/calendar` も revalidate しているが、今はリダイレクトだけのページなので移植不要。

## 参照コード
- `src/components/TodaySchedule.tsx`：`TodaySchedule`（取得・合体・今日／明日／次の判定・行の描画）
- `src/components/MonthCalendar.tsx`：`MonthCalendar`（月の範囲・取得・グリッド）
- `src/app/(app)/meetings/page.tsx`：`MeetingsPage` の `view` 判定、`withView`、`Tabs` の items、`view !== "calendar"` で絞り込みを隠す箇所、`<MonthCalendar ... monthHref>`、PageHeader の「カレンダー」ボタン
- `src/app/(app)/referrals/page.tsx`：`ReferralsPage` の同じ箇所
- `src/app/(app)/meetings/calendar/page.tsx`：`CalendarPage`（リダイレクト）
- `src/components/ui.tsx`：`Tabs`
- `src/lib/utils.ts`：`fmtDateTime`（`yyyy/MM/dd(E) HH:mm`）、`cn`
- `src/app/globals.css`：`.card` `.badge` `.btn-secondary` `.btn-sm`

## 移植のポイント
- どちらも Server Component で Prisma を直接呼んでいる。行き先ではサーバー側で better-sqlite3 を同期で呼んで同じ形の配列を作り、描画部分（JSX）はほぼそのまま使える。Route Handler 経由にするなら `GET /api/schedule/today` と `GET /api/schedule/month?month=yyyy-MM` を作り、クライアントで描画する。
- 日付計算は date-fns（`startOfDay, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addMonths, parse, isValid, format`、`ja` ロケール）。サーバーの TZ を Asia/Tokyo にしておくこと（日の境目・`isSameDay` が JST になる）。ISO(UTC) 文字列で保存している場合、範囲の端は JST で作った `Date` を `toISOString()` してから SQL に渡す。取り出した文字列は `new Date()` に戻してから `format`。
- `include` の JOIN は SQL の JOIN に置き換える（上の SQL 例）。2本の SELECT を JS でまとめて時刻ソートする作りはそのまま。
- `month` は URL から来るので、`yyyy-MM` 以外なら今月にする処理を必ず残す。
- 一覧ページの「カレンダー」タブは、行き先の一覧ページにある view 切り替えの仕組みに合わせる。要点は3つ：カレンダーへのリンクは絞り込みを捨てる／カレンダー時は絞り込みUIを出さない／前月・翌月リンクは `view=calendar&month=` を保つ。
- 色の約束（sky＝ベンダーMTG、indigo＝紹介面談、pink＝実施済バッジ、今日＝blue-50/60 と blue-600 の丸）は他画面と揃えるため変えない。
- 純粋に流用できる関数は特に無い（どちらも DB 取得と描画が一体）。日付範囲を作る部分を `todayRange(now)` `monthGrid(month)` のような純関数に切り出すと移植しやすい。

## 依存
- 00 ベンダーMTG（VendorMeeting の日時・状態・場所、担当者名）— 無ければ紹介面談だけを表示する
- 01 紹介案件（Referral の面談日時・状態・場所、Contact の会社名・氏名）
- 一覧画面（00 のベンダーMTG一覧、01 の紹介案件一覧）のタブ切り替え

## 動作確認チェックリスト
- [ ] 今日の MTG と紹介面談が時刻順に混ざって並び、MTG は sky、面談は indigo のバッジになる
- [ ] 件数バッジ（N件）と「明日 N件」が正しい
- [ ] 今日0件のとき「今日の商談はありません。」と、右上に「次の商談 日時 相手」が出る（今日1件以上なら次の商談は出ない）
- [ ] キャンセル・初回MTGなしの MTG、紹介見送りの面談は出ない
- [ ] 実施済の行が薄くなり「実施済」バッジが付く
- [ ] 場所が https の URL の時だけ「参加URLを開く ↗」が出て、新しいタブで開く
- [ ] 面談の相手は「会社名（氏名）」、会社が空なら氏名だけ
- [ ] リンクで各詳細ページへ飛べる
- [ ] 一覧の「カレンダー」タブで月カレンダーが出て、チップ・絞り込みパネルが消える
- [ ] 前月・翌月・今月の移動ができ、URL の month が変わる。`month=abc` でも今月が出てエラーにならない
- [ ] 今日のセルが薄い青で、日付が青丸。前後月の日はグレー
- [ ] 日曜が赤、土曜が青の見出し
- [ ] 23:30 JST の予定がその日のセルに入る（UTC で前日にずれない）
- [ ] スマホでカレンダーが横スクロールでき、今日の商談カードの行が折り返して崩れない
- [ ] `/meetings/calendar?month=2026-09` が `/meetings?view=calendar&month=2026-09` に移る
- [ ] 00 を移植していない構成で、紹介面談だけが表示されエラーにならない
