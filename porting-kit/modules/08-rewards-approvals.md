# 08. 報酬管理・承認キュー

> 一言で：紹介案件ごとの報酬を「未確定→計上申請→承認済→請求済→入金済」で管理し、承認（計上確定）は管理者だけが承認キューで行う。承認日時（rewardApprovedAt）がそのまま「計上月」になる。

## できること（使う人の目線）

- 紹介案件を「面談実施済」にすると、報酬が自動で「計上申請」になり、管理者に通知が飛ぶ。
- 管理者は「承認キュー」で、計上申請中の報酬を1クリックで承認（計上確定）できる。単価未定・0円のものは承認ボタンの代わりに「金額を入力してから承認」が出る。
- 承認キューには、ベンダーMTGの承認待ち（承認／差し戻し理由つきで差し戻し）も並ぶ（ベンダーMTG機能＝00 を入れた場合）。
- 「報酬管理」画面で、状態ごとの合計金額・件数、直近6ヶ月の月次集計（計上／請求／入金ベース）、案件ごとの承認日・請求日・入金予定日・入金日を一覧できる。状態は一覧のドロップダウンから直接変えられる。
- 入金予定日を過ぎて未入金の行は赤字＋「遅延」バッジ。毎日、管理者に「入金遅延」通知が届く。
- 紹介案件の詳細で、報酬額・単価未定・請求日・入金予定日・入金日を入力できる。状態の変更履歴（誰がいつ何から何へ）が残る。
- 報酬一覧を CSV（Excel で開ける BOM 付き UTF-8）で出力できる。

## 画面と操作

### 報酬管理 `/rewards`（全員）

- 上部 `PageHeader`：タイトル「報酬管理」、説明「紹介報酬の計上・請求・入金状況」、右に `btn-secondary`「CSV出力」（`/api/rewards/export?status=…`）。
- 状態別サマリー：`grid gap-3 grid-cols-2 md:grid-cols-5` に 5 枚の `card px-3 py-2 hover:bg-gray-50`。各カードは状態名（`text-xs text-gray-500`）、合計金額（`text-lg font-semibold`）、件数（`text-xs text-gray-400`）。クリックでその状態に絞り込み、選択中は `ring-2 ring-blue-300`。サマリーは UNFIXED も含む全状態を集計する。
- 月次集計カード「月次集計（直近6ヶ月）」：今月から過去6ヶ月を新しい順に `table`。列は 月／計上ベース（承認月）／請求ベース（請求月）／入金ベース（入金月）。各セル「¥金額 (件数)」。スマホでは見出しを「計上」「請求」「入金」に短縮（`md:hidden` と `hidden md:inline` の出し分け）。
- タブ（`Tabs`）：「確定以降すべて」（既定。UNFIXED 以外）＋ 5 状態。
- 並び順チップ（`chip py-1 text-xs`、選択中 `chip-active`）：更新順（既定）／入金予定が近い順／承認日が新しい順／面談実施日が新しい順。null は常に末尾。
- 一覧（最大 500 件）
  - PC（`card overflow-x-auto hidden md:block` ＋ `table`）：ベンダー（`VendorTag`、行は紹介案件詳細へのリンク）／紹介先（氏名＋会社 `text-xs text-gray-500`）／面談実施／報酬額（右寄せ、単価未定は「未定」を `text-amber-700`）／状態（`StatusSelect`）／承認日／請求日／入金予定（遅延なら `text-rose-600 font-medium` ＋ `Badge value="REJECTED" label="遅延"`）／入金日。
  - スマホ（`md:hidden space-y-2` のカード）：上段にベンダータグと紹介先、右に金額。下に `grid grid-cols-2` で各日付。遅延カードは `border-rose-300`。最下段に「状態」＋ `StatusSelect`。
- 空のとき：`card` の中に `EmptyState`「該当する報酬はありません」。

### 承認キュー `/approvals`（管理者のみ。メンバーは `/?error=forbidden` へ）

- `PageHeader`「承認キュー」「管理者の承認が必要な項目」。
- カード1「ベンダーMTG 承認待ち（N）」：approvalStatus=PENDING を登録の古い順。1件ずつ `border border-gray-200 rounded p-3 grid gap-3 lg:grid-cols-3`。左2列にベンダー名リンク＋実施ステータスの `Badge`、担当／日時（未定なら「日時未定」）／形式、場所、依頼内容、登録日時。右列に `btn-primary w-full`「承認する」と差し戻しフォーム（理由必須の textarea ＋ `btn-danger w-full`「差し戻す」）。空なら「承認待ちのMTGはありません」。
- カード2「報酬 計上申請（N）」：rewardStatus=APPLIED を面談実施日の古い順で `table`。列 ベンダー／紹介先／面談実施日（meetingDoneAt、無ければ meetingAt）／報酬額／操作。操作は、金額確定なら `btn-primary btn-sm`「承認（計上確定）」、単価未定 or 0円なら `btn-secondary btn-sm`「金額を入力してから承認」（紹介案件詳細へ）。空なら「計上申請中の報酬はありません」。
- 承認ボタンは `SubmitButton`（押下中は「処理中...」で無効化）。

### 紹介案件詳細 `/referrals/[id]` の報酬部分

- カード「報酬」：金額（`text-lg font-semibold`、未定は `text-amber-700`）と状態 `Badge`、その下に `StatusSelect`（`className="input"` で幅いっぱい）。単価未定なら注意文（amber）。補足「承認は管理者のみ。請求・入金は誰でも更新できます。」
- カード「紹介ステータス」の補足：「面談実施済にすると報酬が自動で計上申請になります。」
- カード「請求・入金」＝ `RewardForm`：`grid gap-3 sm:grid-cols-4` に 報酬額（`MoneyInput`＋「単価未定」チェック）／請求日／入金予定日（ヒント「過ぎても未入金なら管理者に通知」）／入金日（すべて `type="date"`）。承認済なら「計上承認日時：…」。`btn-secondary`「保存」。成功は `SuccessMessage`「保存しました」、失敗は `ErrorMessage`（入力は消えない＝`useStickyAction`）。
- カード「変更履歴」＝ `HistoryList`（新しい順。「日時 変更者 項目：旧 → **新**（メモ）」。変更者 null は「システム」）。

## データ

報酬は独立テーブルを持たず、紹介案件（Referral）の列で持つ。

### referrals（報酬に関わる列のみ。他の列は 01 紹介案件を参照）

| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| rewardAmount | INTEGER | 0 | 報酬額（円）。0〜2,000,000,000 |
| rewardUndetermined | INTEGER(0/1) | 0 | 単価未定。1 のとき rewardAmount は 0 にする |
| rewardStatus | TEXT | 'UNFIXED' | 報酬ステータス（下の enum） |
| rewardApprovedAt | TEXT(ISO) | NULL | 承認（計上確定）日時＝計上月の基準 |
| invoicedAt | TEXT(ISO) | NULL | 請求日（日付のみ。00:00） |
| paymentDueAt | TEXT(ISO) | NULL | 入金予定日（日付のみ） |
| paidAt | TEXT(ISO) | NULL | 入金日（日付のみ） |
| meetingDoneAt | TEXT(ISO) | NULL | 面談実施日時（MEETING_DONE になった時に自動で入る。並び・表示に使う） |

RewardStatus：

| 値 | ラベル | 色（STATUS_COLOR） |
|---|---|---|
| UNFIXED | 未確定 | bg-slate-100 text-slate-700 border-slate-200 |
| APPLIED | 計上申請 | bg-amber-100 text-amber-800 border-amber-200 |
| APPROVED | 承認済 | bg-emerald-100 text-emerald-800 border-emerald-200 |
| INVOICED | 請求済 | bg-sky-100 text-sky-800 border-sky-200 |
| PAID | 入金済 | bg-emerald-100 text-emerald-800 border-emerald-200 |

### status_histories（変更履歴。全モジュール共通）

| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| id | INTEGER PK | 自動 | |
| entityType | TEXT | — | VENDOR / VENDOR_MEETING / REFERRAL |
| entityId | INTEGER | — | 対象の id |
| field | TEXT | — | status / rewardStatus / approvalStatus / executionStatus / meetingStatus / forceUnlocked / assigneeId |
| fromValue | TEXT | NULL | 変更前（enum の値。表示時にラベルへ変換） |
| toValue | TEXT | NULL | 変更後 |
| note | TEXT | NULL | 理由・自動変更の説明（例「面談実施済に伴い自動で計上申請」） |
| changedById | INTEGER | NULL | 変更者。NULL は「システム」 |
| changedAt | TEXT(ISO) | now | |

日時は **TEXT（ISO 8601、UTC の `toISOString()`）** に統一する。日付だけの列は「その日の 00:00（日本時間）」を ISO にして入れる。

```sql
-- referrals に足す列（01 で referrals を作る場合はそちらに含める）
ALTER TABLE referrals ADD COLUMN rewardAmount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE referrals ADD COLUMN rewardUndetermined INTEGER NOT NULL DEFAULT 0;
ALTER TABLE referrals ADD COLUMN rewardStatus TEXT NOT NULL DEFAULT 'UNFIXED'
  CHECK (rewardStatus IN ('UNFIXED','APPLIED','APPROVED','INVOICED','PAID'));
ALTER TABLE referrals ADD COLUMN rewardApprovedAt TEXT;
ALTER TABLE referrals ADD COLUMN invoicedAt TEXT;
ALTER TABLE referrals ADD COLUMN paymentDueAt TEXT;
ALTER TABLE referrals ADD COLUMN paidAt TEXT;
CREATE INDEX IF NOT EXISTS idx_referrals_reward_status ON referrals(rewardStatus);
CREATE INDEX IF NOT EXISTS idx_referrals_reward_approved ON referrals(rewardApprovedAt);
CREATE INDEX IF NOT EXISTS idx_referrals_paid ON referrals(paidAt);

CREATE TABLE IF NOT EXISTS status_histories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entityType TEXT NOT NULL CHECK (entityType IN ('VENDOR','VENDOR_MEETING','REFERRAL')),
  entityId INTEGER NOT NULL,
  field TEXT NOT NULL,
  fromValue TEXT,
  toValue TEXT,
  note TEXT,
  changedById INTEGER REFERENCES users(id),
  changedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_status_histories_entity ON status_histories(entityType, entityId);
```

## 決まり（ロジック）

### 状態遷移と権限（`setRewardStatusAction`）

- 同じ状態への変更は何もしない。不正な値はエラー。
- **管理者のみ**：
  - → APPROVED（承認）
  - APPROVED → APPLIED（承認取消）
  - UNFIXED / APPLIED → INVOICED / PAID（承認を飛ばした請求・入金）
- **金額チェック**：APPROVED / INVOICED / PAID へは、単価未定 または 金額 0 以下なら誰でもエラー「報酬額が未定です…」。
- 上記以外は全員可（例：APPLIED↔UNFIXED、APPROVED→INVOICED→PAID、PAID→INVOICED）。
  - 「承認より前への戻し」（現在が APPROVED・INVOICED・PAID で、移動先が UNFIXED・APPLIED）は管理者のみ（`isApprovedOrLater`）。承認済み以降の報酬額の変更も管理者のみ（`assertCanChangeApprovedAmount`。`saveRewardAction` と一覧の `updateRewardAmountAction` の両方）。2026-10-15 に referral-hub でも対応済み。
- 日時の自動記入（どれも「空のときだけ」入れる。戻しても消さない）：
  - APPROVED / INVOICED / PAID にしたとき rewardApprovedAt が空なら今（管理者が承認を飛ばした場合も計上集計に載るように）。
  - INVOICED にしたとき invoicedAt が空なら今。
  - PAID にしたとき paidAt が空なら今。
- 更新と履歴（field=rewardStatus）は 1 トランザクション。

### 承認（`approveRewardAction`、承認キューのボタン）

- 管理者のみ。現在が APPLIED 以外ならエラー「計上申請中の報酬のみ承認できます」（二重クリック・同時承認はここで弾かれる）。
- 単価未定・0円はエラー。
- rewardStatus=APPROVED、rewardApprovedAt=今（上書き）、履歴 APPLIED→APPROVED。

### 自動の計上申請（01 紹介案件のステータス変更内）

- 紹介ステータスが MEETING_DONE に**変わった**とき：meetingDoneAt が空なら今を入れる。さらに rewardStatus が UNFIXED なら APPLIED にし、履歴（note「面談実施済に伴い自動で計上申請」）を残す。
- APPLIED にした場合は全管理者へ通知 `APPROVAL_PENDING`：タイトル「【計上申請】{ベンダー} × {紹介先} の報酬 {金額 or 未定}」、本文は単価未定なら「…単価が未定です。紹介案件で金額を入力してから承認してください。」、そうでなければ「…承認キューで確認してください。」、リンク `/referrals/{id}`。

### 請求・入金の保存（`saveRewardAction`）

- 全員可。rewardAmount（単価未定チェック時は 0）、rewardUndetermined、invoicedAt、paymentDueAt、paidAt を保存（空欄は NULL）。**状態は変えず、履歴も残さない**。金額は `money()` で整数・0〜20億を検証。
- 承認後でも金額を変えられる（制限なし）。

### 集計

- **計上（承認月）**：rewardApprovedAt がその月 かつ rewardStatus ∈ {APPROVED, INVOICED, PAID} の rewardAmount 合計。
- **請求（請求月）**：invoicedAt がその月の合計（状態は問わない）。
- **入金（入金月）**：paidAt がその月 かつ rewardStatus=PAID の合計。
- 月の範囲は `monthRange("yyyy-MM")` → 月初 00:00〜月末 23:59:59.999（サーバーのローカル時刻）。直近6ヶ月は、6ヶ月前の月初以降に承認・入金・請求のどれかがある行を 1 回で取得し、メモリで振り分ける。
- **遅延**：rewardStatus≠PAID かつ paymentDueAt < 今日 00:00。

### 入金遅延の通知（PAYMENT_LATE、05 のリマインド処理内）

- 5分おきの cron の中で、その日の「日次時刻」（設定 dailyDigestHour、既定 8 時）以降に判定。
- 対象：rewardStatus ∈ {APPROVED, INVOICED} かつ paymentDueAt < 今日 00:00。
- 全管理者へ「【入金遅延】{ベンダー}：{紹介先} の紹介報酬 ¥{金額}」「入金予定日 {日付} を過ぎています。」リンク `/referrals/{id}`。dedupeKey `referral:{id}:late:{yyyyMMdd}:u{管理者id}` で 1日1回。

### 承認キューのベンダーMTG（00 を入れた場合）

- 承認 `approveMeetingAction`：管理者のみ。既に APPROVED なら何もしない（二重通知防止）。APPROVED にし rejectReason を消す。履歴と担当者への通知 `APPROVED`。
- 差し戻し `rejectMeetingAction`：管理者のみ。理由必須。REJECTED＋rejectReason、履歴（note=理由）、担当者へ通知 `REJECTED`（本文「理由: …」）。
- 詳細は 00 ベンダーMTG管理を参照。

### 履歴（`recordHistory`）

- fromValue と toValue が同じ（null 同士を含む）なら記録しない。
- 本体の更新と同じトランザクションの中で呼ぶ。

### CSV 出力（`GET /api/rewards/export?status=`）

- ログイン必須（未ログイン 401）。status 指定がなければ UNFIXED 以外、id 昇順。
- 列：案件ID, ベンダー, 紹介先氏名, 紹介先会社, 紹介ステータス, 面談実施日, 報酬額, 報酬ステータス, 承認日, 請求日, 入金予定日, 入金日（日付は yyyy-MM-dd）。
- 文字列が `= + - @ タブ CR` で始まるときは先頭に `'` を付ける（Excel の数式実行対策）。`" , 改行` を含む値はダブルクォートで囲む。先頭に BOM、改行は CRLF。ファイル名 `rewards_yyyy-MM-dd.csv`。

## 参照コード

- `src/app/(app)/rewards/page.tsx`：`SORTS`、状態別サマリー、月次集計（`summary`）、遅延判定、PC/スマホの出し分け
- `src/app/(app)/approvals/page.tsx`：承認キュー全体
- `src/app/(app)/referrals/actions.ts`：`approveRewardAction`、`setRewardStatusAction`、`saveRewardAction`、`changeReferralStatus`（自動計上申請）、`revalidateReferral`
- `src/app/(app)/referrals/[id]/page.tsx`：カード「報酬」「請求・入金」「変更履歴」
- `src/app/(app)/referrals/[id]/RewardForm.tsx`
- `src/app/(app)/meetings/actions.ts`：`approveMeetingAction`、`rejectMeetingAction`
- `src/app/(app)/meetings/[id]/MeetingControls.tsx`：`RejectForm`
- `src/app/api/rewards/export/route.ts`：`csvCell`、`GET`
- `src/lib/history.ts`：`recordHistory`
- `src/components/HistoryList.tsx`：`FIELD_LABEL`、`valueLabel`
- `src/lib/labels.ts`：`REWARD_LABEL`、`REWARD_ORDER`、`STATUS_COLOR`
- `src/lib/stats.ts`：`monthRange`
- `src/lib/cron/reminders.ts`：「入金遅延」ブロック
- `src/lib/notifications.ts`：`notifyAdmins`
- `prisma/schema.prisma`：`Referral`、`RewardStatus`、`StatusHistory`、`HistoryEntity`

## 移植のポイント

- **権限**：referral-hub の ADMIN → BizLabo の admin（必要なら clerk も）。承認・承認取消・承認飛ばしの判定は API 側で必ず行う（画面で隠すだけにしない）。承認キュー画面とその API は `requireUser(STAFF)` ではなく管理者用ガードにする。
- **Server Actions → Route Handlers**：
  - `POST /api/referrals/[id]/reward-status`（body: status）＝ setRewardStatusAction
  - `POST /api/referrals/[id]/reward-approve` ＝ approveRewardAction
  - `PUT /api/referrals/[id]/reward` ＝ saveRewardAction
  - 失敗時は `{ error }` を 400/403 で返し、画面側は 10 の FlashBanner 相当（またはフォーム上の ErrorMessage）で出す。
- **トランザクション**：better-sqlite3 は同期 API なので `db.transaction(() => { UPDATE …; INSERT INTO status_histories … })()` で包む。通知（LINE 送信を含む）はトランザクションの外で送る。
- **二重承認防止**：`UPDATE referrals SET rewardStatus='APPROVED', rewardApprovedAt=? WHERE id=? AND rewardStatus='APPLIED'` とし、`changes === 0` ならエラーにすると同時押しにも強い。
- **集計**：Prisma の groupBy/aggregate は SQL の `SUM`/`COUNT ... GROUP BY rewardStatus` に置き換える。ISO 文字列（UTC）同士は文字列比較で範囲検索できるが、月の境界は日本時間の月初・月末を ISO（UTC）に変換して渡すこと（`2026-10-01T00:00+09:00` → `2026-09-30T15:00:00.000Z`）。
- **日付だけの列**：`<input type="date">` の値 `yyyy-MM-dd` は日本時間 00:00 として ISO にする。表示時は日本時間に戻す。
- **そのまま流用できる純粋関数**：`csvCell`（`src/app/api/rewards/export/route.ts`）、`fmtReward`・`fmtYen`・`money`（`src/lib/utils.ts`）、`REWARD_LABEL`・`REWARD_ORDER`・`STATUS_COLOR`（`src/lib/labels.ts`）、`HistoryList` の `FIELD_LABEL`/`valueLabel`。
- revalidatePath は不要（Route Handler 方式なら、操作後に `router.refresh()` か一覧の再取得）。

## 依存

- 01 紹介案件（報酬は紹介案件の列。MEETING_DONE で自動計上申請）
- 05 通知・LINE連携（APPROVAL_PENDING / APPROVED / REJECTED / PAYMENT_LATE）
- 10 画面のデザイン一式（StatusSelect、SubmitButton、Badge、Tabs、FlashBanner、useStickyAction）
- 00 ベンダーMTG管理（任意。承認キューの「ベンダーMTG 承認待ち」欄。入れない場合はその欄を出さない）

## 動作確認チェックリスト

- [ ] 紹介案件を「面談実施済」にすると報酬が「計上申請」になり、履歴に「面談実施済に伴い自動で計上申請」が残る
- [ ] そのとき全管理者に「【計上申請】…」の通知が届く（単価未定なら本文が金額入力を促す文になる）
- [ ] 承認キューに計上申請の行が面談実施日の古い順で出る。金額確定なら「承認（計上確定）」、未定・0円なら「金額を入力してから承認」が出る
- [ ] 承認すると rewardApprovedAt が入り、報酬管理の月次集計「計上ベース」のその月に載る
- [ ] 承認ボタンを2回素早く押しても履歴が1件だけ
- [ ] メンバーは APPROVED にできない／承認取消できない／計上申請から請求済・入金済に飛ばせない（エラーがフラッシュ表示される）
- [ ] 管理者が計上申請から直接「入金済」にすると、承認日時・入金日が自動で入る
- [ ] 単価未定・0円の報酬は承認・請求済・入金済のどれにも進めない
- [ ] 請求・入金フォームで日付を保存できる。サーバーエラー時も入力が消えない
- [ ] 入金予定日を過ぎた未入金の行が赤字＋「遅延」になり、日次時刻以降に管理者へ「入金遅延」通知が1日1回届く
- [ ] 報酬管理のタブ・並び順・状態カードの絞り込みが URL に残り、組み合わせても崩れない
- [ ] スマホ幅でカード表示になり、状態ドロップダウンが使える
- [ ] CSV を Excel で開いて文字化けしない。`=` で始まる会社名が数式にならない
- [ ] メンバーで `/approvals` を開くとダッシュボードに戻され「その画面・操作は管理者のみ利用できます。」が出る
