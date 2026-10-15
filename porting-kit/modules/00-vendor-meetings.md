# 00. ベンダーMTG管理（任意）

> 一言で：商談担当者がベンダーと行う事前MTGを、登録→管理者承認→日程調整→確定→実施（議事メモ）まで管理する。一覧は状態で色分けされ、日時・打ち合わせURLをその場で入力でき、各MTGの「お繋ぎ先」と単価がバッジで見える。
> 今回の選択では未選択だが、06（今日の商談・カレンダー）と 07（LINE用コピー）がこのテーブルを使うため、入れる場合の設計として書く。

セールスハブ由来の機能（チャットからのMTG自動作成と承認スキップ、日程の自動確定、取込内容の確認ボタン、セールスハブで提示した会社の自動抽出）はセールスハブ由来なので移植不要。

## できること（使う人の目線）

- MTG を登録すると「承認待ち」になり、管理者に通知が飛ぶ。担当者を他人にした場合は担当者にも通知。
- 管理者は詳細画面か承認キュー（08）で承認／差し戻し（理由必須）。差し戻されたら担当者が修正して保存すると再申請になる。
- 一覧は「確定 → 日程調整中 → 実施済 → リスケ → 初回MTGなし・キャンセル」の順に並び、行の色で状態が一目でわかる。
- 一覧のセルをクリックして、MTG日時と打ち合わせURL（Zoom・Meet など）をその場で入力・変更できる。実施ステータスはドロップダウンで即変更。
- 各MTGに「お繋ぎ先」（そのベンダーに紹介する会社）と単価がバッジで出る。見送りになった会社はグレーの取り消し線・¥0 で残り、4社目以降は「ほか見送り N社」にまとまる。合計単価も出る。
- リスト／カンバン／カレンダーを切り替えられる。ベンダー別・状態別の件数チップ、担当・承認・ベンダー・ベンダー名で絞り込み、4種類の並び順。
- 実施済にすると、ベンダーの「MTG状態」も実施済になり、紹介案件を「紹介先に打診中」へ進められるようになる。詳細画面に「ピックアップ受付の案件をまとめて打診中へ進める」案内が出る。
- 「初回MTGなし」にすると、ベンダーの MTG 状態が「不要」になり、事前MTGなしで紹介を進められる。MTG が再び動き出したら自動で「未実施」に戻る。
- 詳細画面で議事メモ・次アクション・期限を保存。変更履歴が残る。

## 画面と操作

### 一覧 `/meetings`（全員）

- `PageHeader`「ベンダーMTG」「商談担当者がベンダーと行う事前MTG」。右に「未完了 N 件をまとめてLINE用コピー」（07）、`btn-secondary`「カレンダー」、`btn-primary`「+ MTG登録」。
- その下に「今日の商談」（06 の `TodaySchedule`）。
- `Tabs`：リスト（`?view=list`、既定）／カンバン（`view=kanban`）／カレンダー（`view=calendar`、06 の `MonthCalendar`。カレンダーでは下のチップ・絞り込みを出さない）。旧 `/meetings/calendar` は `/meetings?view=calendar&month=` へリダイレクト。
- `VendorChips`：MTG があるベンダーだけ、件数つき。件数はベンダー・実施状態の絞り込みを外した件数（担当・承認・名前の絞り込みは効く）。
- `CountChips`：`EXECUTION_ORDER` 順に状態別件数（ベンダー選択中はそのベンダーだけ）。クリックで `execution=` を付けてリスト表示。
- `FilterPanel` 内のフォーム：ベンダー名（部分一致・大小無視）、担当、承認、実施（リストのみ）、ベンダー、並び順。「絞り込む」「クリア」。
- 並び順（`SORTS`）：日時が早い順（既定。日時未定は末尾）／日時が新しい順／期限が近い順／登録が新しい順。取得は最大500件。
- **表示順**：取得後に `STATUS_RANK` で安定ソート（同じグループ内は選んだ並び順のまま）：CONFIRMED 0 → SCHEDULING 1 → DONE 2 → RESCHEDULE 3 → NO_MEETING・CANCELLED 4。
- **行の色**（`rowTone`）：CONFIRMED `bg-sky-50`／SCHEDULING `bg-yellow-50`／DONE `bg-pink-50`／NO_MEETING・CANCELLED `bg-gray-100 opacity-60`／RESCHEDULE なし。

PC テーブル（`card overflow-x-auto hidden md:block`）の列：

| 列 | 中身 |
|---|---|
| 日時 | `MeetingDateCell`（`text-blue-700`、未入力は点線「＋ 日時を入力」）、下に `text-[11px] text-gray-400`「詳細を開く」 |
| ベンダー | `VendorTag` |
| 単価 | 合計単価（右寄せ `font-medium`。未定を含むと `text-amber-700`） |
| お繋ぎ先 | `max-w-sm` にバッジ「会社名 (¥金額)」。無ければ `text-xs text-gray-400`「未定」 |
| 担当 | 氏名 |
| 形式・打ち合わせURL | 上に形式（`text-xs text-gray-500`）、下に `MeetingPlaceCell` |
| 承認 | `Badge`（承認待ち amber／承認済 emerald／差し戻し rose） |
| 実施 | `StatusSelect`（`EXECUTION_ORDER`） |
| 次アクション | `text-gray-600 max-w-xs truncate`、無ければ「-」 |
| 期限 | 日付。期限 < 今日 かつ キャンセル・初回MTGなし以外なら `text-rose-600 font-medium` |
| （右端） | LINE用コピー（07） |

スマホ（`md:hidden`）カード：`card p-3 {rowTone}`。上段左にベンダータグと日時セル（`text-sm font-medium text-blue-700`）、右に承認バッジ。次に「担当 ／ 形式 ／ 単価 合計」、お繋ぎ先バッジ、`MeetingPlaceCell compact`、「次: …（期限）」（`line-clamp-2`）、最下段に LINE用コピーと実施 `StatusSelect`。

カンバン：`grid gap-3 md:grid-cols-3 xl:grid-cols-6 overflow-x-auto`。列は `EXECUTION_ORDER`（日程調整中・確定・実施済・初回MTGなし・リスケ・キャンセル）、`card bg-gray-50 min-w-56`、見出しに状態 Badge と件数。カード `card p-2.5 text-sm shadow-sm`：ベンダータグ（詳細へ）、日時（未定は「日時未定」）、「担当 ／ 形式 ／ 合計 …」、お繋ぎ先バッジ、LINE用コピー（`w-full`）、承認 Badge と実施 StatusSelect。カードのドラッグ移動はない（ドロップダウンで移す）。

空のとき（リスト）：`card` に `EmptyState`「該当するMTGがありません」。

**お繋ぎ先バッジ**（`targetBadgeClass`）：確定 `bg-indigo-50 text-indigo-800 border-indigo-200`／単価未定 `bg-amber-50 text-amber-800 border-amber-200`／見送り `bg-gray-100 text-gray-400 border-gray-200 line-through decoration-gray-400`。一覧とカンバンは `compactTargets`（見送りは3社まで、残りは `text-[11px] text-gray-400`「ほか見送り N社」）。

**MeetingDateCell**：10 の `InlineCell`（`inputType="datetime-local"`、`emptyLabel="日時を入力"`）。保存は `updateMeetingScheduledAtAction(id, value)`。空で保存すると日時未定に戻る。**ステータスは変えない**。

**MeetingPlaceCell**：未入力は点線ボタン「＋ URLを入力」。入力済みは `http(s)://` ならリンク（`https://` を省いて表示、`truncate`、別タブ、`text-blue-700 underline`）、それ以外（住所など）は文字。横に ✎。編集は placeholder「https://zoom.us/j/... や住所」、Enter 保存・Esc 取消。保存は `updateMeetingPlaceAction(id, place)`。

### 登録 `/meetings/new`・編集 `/meetings/[id]/edit`（全員）

- 登録の説明「登録すると管理者の承認待ちになります」。`?vendorId=` でベンダーを初期選択、担当は自分が初期値。
- `MeetingForm`（`card p-4 space-y-4 max-w-3xl`、`grid gap-4 sm:grid-cols-2`）：ベンダー*、商談担当者*、日時（datetime-local、ヒント「未定の場合は空欄」）、形式（オンライン／訪問）、打ち合わせURL・場所（2列幅、ヒント「Zoom・Google Meet などの会議URL、または訪問先の住所」）、日程調整URL（2列幅、ヒント「TimeRex・Spir など、ベンダーから送られた候補日選択ページ」）、実施ステータス（登録時のみ。既定 日程調整中）、この依頼の紹介単価（`MoneyInput`、空ならベンダー共通単価）、ベンダーからの依頼内容（textarea）、次アクション、次アクション期限（date）。
- 差し戻し中の編集では注意文（amber）「このMTGは差し戻されています。保存すると再申請（承認待ち）になります。」
- ボタン：登録「登録して承認申請」／編集「保存」、`btn-secondary`「キャンセル」。エラーはフォーム上（入力は消えない）。

### 詳細 `/meetings/[id]`（全員）

上から：

1. `PageHeader`「ベンダーMTG：{ベンダー}」「担当：{氏名}」、右に「タスクを依頼」（04。リンク・タイトル・本文・担当を渡す）、`btn-primary`「編集」。
2. 「{名}さんへ送る『次にやること』（LINE用）」カード（07）。
3. 差し戻し中：`rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800`「差し戻されています／理由：…／内容を修正して『編集 → 保存』すると再申請になります。」
4. 実施済 かつ そのベンダーに「ピックアップ受付」の紹介案件があるとき：`rounded-xl border-2 border-blue-200 bg-blue-50/60 p-4` の「次のステップ」。案件ごとのチェックボックス（初期 ON、会社・氏名・報酬）と「選んだ案件を『紹介先に打診中』へ進める」（01 の `advanceToContactingAction`）。ベンダーの MTG 状態が未実施なら、amber の注意と「ベンダーのMTG状態を実施済にする」ボタンを出し、進めるボタンは無効。
5. `grid gap-4 lg:grid-cols-3`：
   - 左2列「MTG情報」（`Description`）：ベンダー（リンク）、ベンダーMTG状態 Badge、日時、形式、打ち合わせURL・場所（http ならリンク）、日程調整URL（リンク）、承認 Badge、実施 Badge、実施日時、この依頼の紹介単価（未入力なら「¥… （ベンダー共通）」）、お繋ぎ先の合計単価、依頼内容、次アクション、期限。
   - 右列：「お繋ぎ先（この依頼で繋げる人物）」＝そのベンダーの紹介案件のうち見送り以外を「会社 氏名 … ¥金額 ・ 紹介ステータス」で。無ければお繋ぎ先バッジ＋「繋がりリストに該当がないため紹介案件は未作成です。」、それも無ければ「まだ候補がありません。」。下に `btn-secondary btn-sm`「+ 紹介案件を追加」。
   - 「実施ステータス」：select ＋「ステータスを更新」。実施済を選んでベンダーが未実施なら「実施済にすると、ベンダーの『MTG状態』も実施済になり…」の説明。
   - 管理者で未承認のとき「承認（管理者）」：`btn-primary w-full`「承認する」と差し戻しフォーム。
6. `#minutes`「議事メモ・次アクション」：議事メモ（6行。ヒント「実施後24時間以内に入力しないとリマインドされます」）、次アクション、期限、「保存」。
7. 「変更履歴」（08 の `HistoryList`）。

## データ

### vendor_meetings

| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| id | INTEGER PK | 自動 | |
| vendorId | INTEGER | — | ベンダー（02） |
| assigneeId | INTEGER | — | 商談担当者（users） |
| scheduledAt | TEXT(ISO) | NULL | MTG日時。NULL＝日時未定 |
| format | TEXT | 'ONLINE' | 形式 |
| place | TEXT | NULL | 打ち合わせURL（Zoom・Meet など）または場所。500字まで |
| schedulingUrl | TEXT | NULL | 日程調整URL（TimeRex・Spir など）。500字まで |
| approvalStatus | TEXT | 'PENDING' | 承認 |
| rejectReason | TEXT | NULL | 差し戻し理由 |
| executionStatus | TEXT | 'SCHEDULING' | 実施ステータス |
| minutes | TEXT | NULL | 議事メモ |
| nextAction | TEXT | NULL | 次アクション |
| nextActionDue | TEXT(ISO) | NULL | 期限（日付のみ。00:00） |
| doneAt | TEXT(ISO) | NULL | 実施済にした日時（09 の MTG 実績の基準） |
| requestNote | TEXT | NULL | ベンダーからの依頼内容。「ピックアップ: A社、B社」行からお繋ぎ先を拾う |
| fee | INTEGER | NULL | この依頼の紹介単価（円）。NULL＝ベンダー共通単価を使う |
| createdAt / updatedAt | TEXT(ISO) | now | |

enum：

| 列 | 値：ラベル |
|---|---|
| format | ONLINE：オンライン／VISIT：訪問 |
| approvalStatus | PENDING：承認待ち／APPROVED：承認済／REJECTED：差し戻し |
| executionStatus | SCHEDULING：日程調整中／CONFIRMED：確定／DONE：実施済／RESCHEDULE：リスケ／CANCELLED：キャンセル／NO_MEETING：初回MTGなし（ベンダーから打ち合わせ依頼がない） |
| vendors.meetingStatus（02 の列） | NOT_DONE：未実施／DONE：実施済／NOT_REQUIRED：不要（初回MTGなしで紹介可） |

`EXECUTION_ORDER`（選択肢・カンバン・チップの順）＝ SCHEDULING, CONFIRMED, DONE, NO_MEETING, RESCHEDULE, CANCELLED。

使うベンダー側の列：`vendors.name`、`vendors.referralFee`（共通単価）、`vendors.meetingStatus`、`vendors.isActive`。

日時は **TEXT（ISO 8601、UTC）** に統一。

```sql
CREATE TABLE IF NOT EXISTS vendor_meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendorId INTEGER NOT NULL REFERENCES vendors(id),
  assigneeId INTEGER NOT NULL REFERENCES users(id),
  scheduledAt TEXT,
  format TEXT NOT NULL DEFAULT 'ONLINE' CHECK (format IN ('ONLINE','VISIT')),
  place TEXT,
  schedulingUrl TEXT,
  approvalStatus TEXT NOT NULL DEFAULT 'PENDING' CHECK (approvalStatus IN ('PENDING','APPROVED','REJECTED')),
  rejectReason TEXT,
  executionStatus TEXT NOT NULL DEFAULT 'SCHEDULING'
    CHECK (executionStatus IN ('SCHEDULING','CONFIRMED','DONE','RESCHEDULE','CANCELLED','NO_MEETING')),
  minutes TEXT,
  nextAction TEXT,
  nextActionDue TEXT,
  doneAt TEXT,
  requestNote TEXT,
  fee INTEGER,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_vm_vendor ON vendor_meetings(vendorId);
CREATE INDEX IF NOT EXISTS idx_vm_assignee ON vendor_meetings(assigneeId);
CREATE INDEX IF NOT EXISTS idx_vm_scheduled ON vendor_meetings(scheduledAt);
CREATE INDEX IF NOT EXISTS idx_vm_execution ON vendor_meetings(executionStatus);
CREATE INDEX IF NOT EXISTS idx_vm_approval ON vendor_meetings(approvalStatus);
CREATE INDEX IF NOT EXISTS idx_vm_due ON vendor_meetings(nextActionDue);
```

## 決まり（ロジック）

### 登録（`createMeetingAction`）

- 全員可。ベンダー・担当は必須、形式は ONLINE/VISIT のみ、fee は 0〜20億、place・schedulingUrl は 500字で切る。
- approvalStatus=PENDING で作成し、履歴（approvalStatus: null→PENDING）。実施ステータスが日程調整中・確定・リスケなら「再オープン」（下記）。
- 全管理者へ `APPROVAL_PENDING`「【承認待ち】{ベンダー} のベンダーMTG」（本文「{担当} が登録 ／ {日時 or 日時未定}」）。担当が登録者と違えば担当へ `TASK_ASSIGNED`「【MTG担当】…が割り当てられました」。

### 編集（`updateMeetingAction`）

- 全員可。実施ステータスは変えない（フォームに無い）。
- 担当が変わったら履歴（field=assigneeId、id の文字列）。
- 差し戻し中なら PENDING に戻し rejectReason を消し、履歴（REJECTED→PENDING、note「修正して再申請」）、全管理者へ `APPROVAL_PENDING`「【再申請】…」。

### 承認・差し戻し（管理者のみ）

- 承認：既に APPROVED なら何もしない。APPROVED にし rejectReason を消す。履歴、担当へ `APPROVED`。
- 差し戻し：理由必須。REJECTED＋理由、履歴（note=理由）、担当へ `REJECTED`。
- 承認状態は実施ステータスの変更や紹介の進行をブロックしない（承認待ちのままでも実施済にできる）。

### 実施ステータス変更（`setExecutionStatusAction`、一覧・カンバン・詳細）

全員可。1トランザクションで：

1. executionStatus を更新。DONE にしたとき doneAt が空なら今。NO_MEETING にしたとき nextAction を「お繋ぎ先の紹介を進める（ベンダーの確認結果を待つ）」、nextActionDue を NULL に。
2. 履歴（executionStatus）。
3. **NO_MEETING** → ベンダーの meetingStatus が NOT_DONE なら NOT_REQUIRED に（履歴 note「MTG #{id} を『初回MTGなし』にしたため」）。
4. **SCHEDULING / CONFIRMED / RESCHEDULE** → 再オープン：ベンダーが NOT_REQUIRED で、そのベンダーの最後の meetingStatus 履歴が toValue=NOT_REQUIRED かつ note に「初回MTGなし」を含む（＝自動で不要にした）ときだけ NOT_DONE に戻す（履歴 note「MTG #{id} が再び進行中になったため」）。人が手で「不要」にした場合は戻さない。
5. **DONE** → ベンダーの meetingStatus が DONE 以外なら DONE に（履歴 note「MTG #{id} 実施済に伴い更新」）。

- 戻しても doneAt・ベンダーの DONE は消さない。CANCELLED にしてもベンダー状態は変えない。
- ベンダーの meetingStatus が NOT_DONE（かつ強制解除なし）のベンダーの紹介案件は「紹介先に打診中」以降へ進めない（01 の決まり）。

### その場編集

- `updateMeetingScheduledAtAction(id, value)`：空なら NULL、形式不正はエラー。ステータスは変えない。
- `updateMeetingPlaceAction(id, place)`：trim、500字超・`javascript:` で始まる値はエラー、空なら NULL。
- どちらも例外を投げず `{ ok, error? }` を返す。

### 議事メモ（`saveMinutesAction`）

- minutes・nextAction・nextActionDue を保存（空は NULL）。履歴なし。実施後 N 時間（既定24）未入力だとリマインド（05）。

### お繋ぎ先と単価（`meetingTargets`、純粋関数）

- 入力：requestNote、そのベンダーの紹介案件（status・rewardAmount・rewardUndetermined・vendorApproval・contactApproval・contact.company/name）、提示済み会社（セールスハブ由来。移植時は空配列）、依頼単価（fee ?? ベンダー共通単価）。
- 見送り判定：status=DECLINED、または先方（vendorApproval）・人事（contactApproval）のどちらかが NG。
- 1) 見送り以外の紹介案件を会社名（無ければ氏名）で重複なく、金額＝未定なら null、他は rewardAmount。2) 見送りの案件を `{ amount: 0, declined: true }` で末尾に。3) 1・2 が空のときだけ、requestNote の「ピックアップ…:」行を `、` `,` で区切って会社名を拾い（`/` 以降は除く）、金額＝依頼単価。見送り済みの会社（「株式会社」と空白を除いて比較）は出さない。
- 一覧のクエリは紹介案件の status・金額・会社名だけ取っている（vendorApproval/contactApproval は取らない）。NG にすると 01/02 の処理で status が DECLINED になる（面談実施済前の案件のみ）ため、一覧でも見送り表示になる。
- `formatTargetsTotal`：お繋ぎ先なし→依頼単価（無ければ「-」）。確定分の合計（見送りは 0）、未定を含めば「＋未定分」、確定 0 で未定ありなら「未定」。
- `compactTargets(targets, 3)`：見送り以外は全部、見送りは先頭3社、残りの数を hiddenDeclined に。

## 参照コード

- `src/app/(app)/meetings/page.tsx`：`SORTS`、`STATUS_RANK`、`rowTone`、件数集計（`vendorCounts`・`execCounts`）、`linkWith`、リスト・カンバン・スマホカード
- `src/app/(app)/meetings/actions.ts`：`meetingData`、`createMeetingAction`、`updateMeetingAction`、`setExecutionStatusAction`、`saveMinutesAction`、`approveMeetingAction`、`rejectMeetingAction`、`updateMeetingPlaceAction`、`updateMeetingScheduledAtAction`、`revalidateMeeting`
- `src/app/(app)/meetings/MeetingDateCell.tsx`、`src/app/(app)/meetings/MeetingPlaceCell.tsx`
- `src/app/(app)/meetings/MeetingForm.tsx`、`src/app/(app)/meetings/new/page.tsx`、`src/app/(app)/meetings/[id]/edit/page.tsx`
- `src/app/(app)/meetings/[id]/page.tsx`、`src/app/(app)/meetings/[id]/MeetingControls.tsx`（`ExecutionControls`、`RejectForm`、`MinutesForm`）
- `src/app/(app)/meetings/calendar/page.tsx`（旧URLのリダイレクト）
- `src/lib/meeting-targets.ts`：`meetingTargets`、`formatTargetsTotal`、`formatTargetAmount`、`targetBadgeClass`、`compactTargets`
- `src/lib/history.ts`：`recordHistory`、`reopenVendorMeetingStatus`
- `src/lib/labels.ts`：`EXECUTION_LABEL`、`EXECUTION_ORDER`、`APPROVAL_LABEL`、`FORMAT_LABEL`、`VENDOR_MEETING_STATUS_LABEL`、`STATUS_COLOR`
- `prisma/schema.prisma`：`VendorMeeting`、`MeetingFormat`、`ApprovalStatus`、`ExecutionStatus`、`VendorMeetingStatus`

## 移植のポイント

- Server Actions → Route Handlers の例：`POST /api/meetings`、`PUT /api/meetings/[id]`、`POST /api/meetings/[id]/execution`、`POST /api/meetings/[id]/approve`・`/reject`（管理者）、`PATCH /api/meetings/[id]`（scheduledAt／place のその場編集。`{ok, error}` を返す）、`PUT /api/meetings/[id]/minutes`。
- `setExecutionStatusAction` の 1〜5 は必ず1トランザクション（better-sqlite3 の `db.transaction`）。通知はトランザクションの外。
- 二重承認防止は `UPDATE … WHERE id=? AND approvalStatus<>'APPROVED'` の `changes` で判定すると確実。
- 一覧の Prisma の include（ベンダー＋紹介案件＋紹介先）は、MTG 一覧を取った後に `vendorId IN (…)` で紹介案件をまとめて取り、ベンダーごとに配列化して `meetingTargets` に渡す（N+1 を避ける）。
- `STATUS_RANK` の並べ替えは SQL の `ORDER BY CASE executionStatus WHEN 'CONFIRMED' THEN 0 … END, {選んだ並び}` でも、取得後に JS で安定ソートでもよい。
- ベンダー名の部分一致（大小無視）は SQLite では `name LIKE '%' || ? || '%'`（ASCII は既定で大小無視）。
- datetime-local の値は日本時間として ISO（UTC）に変換して保存し、表示時に戻す。
- `proposedCompaniesByVendor`／`proposedCompaniesForVendor`（セールスハブのスレッドから提示済み会社を拾う）は移植しない。`meetingTargets` の第3引数は `[]` を渡す。
- **そのまま流用できる純粋関数**：`src/lib/meeting-targets.ts` 全部、`src/lib/labels.ts` の MTG 関連ラベル・順序・色、`STATUS_RANK` と `rowTone`（`src/app/(app)/meetings/page.tsx` 内。切り出して使う）。

## 依存

- 02 ベンダー詳細・単価表（vendors テーブル、meetingStatus、referralFee）
- 01 紹介案件（お繋ぎ先・打診中へ進める・NG→見送り）
- 08 報酬管理・承認キュー（承認キュー画面・status_histories・HistoryList）
- 05 通知・LINE連携（APPROVAL_PENDING／APPROVED／REJECTED／TASK_ASSIGNED、前日・1時間前・議事メモ未入力・期限のリマインド）
- 10 画面のデザイン一式（InlineCell、StatusSelect、VendorChips、CountChips、FilterPanel、Badge）
- 06 今日の商談・カレンダー、07 LINE用コピー（一覧の上・右端に出す。逆にこの2つは 00 に依存）
- 04 タスク（任意。「タスクを依頼」ボタン）

## 動作確認チェックリスト

- [ ] MTG を登録すると承認待ちになり、管理者に通知が届く。担当を他人にすると担当にも通知が届く
- [ ] 管理者が承認すると担当に通知。差し戻すと理由つきで通知され、詳細に赤い差し戻し表示が出る
- [ ] 差し戻し中に編集して保存すると承認待ちに戻り、管理者に「【再申請】」が届く
- [ ] 一覧が 確定 → 日程調整中 → 実施済 → リスケ → 初回MTGなし・キャンセル の順に並び、同じ状態の中は選んだ並び順になる
- [ ] 行の色：確定＝bg-sky-50、日程調整中＝bg-yellow-50、実施済＝bg-pink-50、初回MTGなし・キャンセル＝グレー半透明
- [ ] 日時セルをクリックして入力・Enter で保存、空にすると「＋ 日時を入力」に戻る。ステータスは変わらない
- [ ] 打ち合わせURLを入力するとリンクになり別タブで開く。住所は文字で出る。`javascript:` は拒否される
- [ ] お繋ぎ先バッジに金額が出る。単価未定は黄色、見送り・NG はグレー取り消し線 ¥0 で、4社目以降は「ほか見送り N社」になる。合計単価に見送りは含まれない
- [ ] 実施済にするとベンダーの MTG 状態が実施済になり、doneAt が入る（09 の今月のMTGが増える）
- [ ] 初回MTGなしにするとベンダーが「不要」になり、次アクションが自動文言・期限なしになる。その後 日程調整中に戻すとベンダーが「未実施」に戻る（手で「不要」にしたベンダーは戻らない）
- [ ] 詳細で実施済かつピックアップ受付の案件があると「次のステップ」が出て、チェックした案件を打診中へ進められる
- [ ] カンバンで状態ごとの列と件数が出て、ドロップダウンで列を移せる
- [ ] ベンダーチップ・状態チップ・絞り込み・並び順の組み合わせが URL に残る
- [ ] スマホ幅でカード表示になり、日時・URL のその場編集と状態変更ができる
- [ ] MTG 詳細の変更履歴に承認・実施・担当変更が残り、ベンダー詳細の履歴にベンダー状態の自動変更（メモつき）が残る
