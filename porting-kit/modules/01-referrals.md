# 01. 紹介案件（先方・人事OK）

> 一言で：ベンダーに紹介する「繋がり（人事）」1件ごとの案件を、ピックアップ受付〜面談実施済〜紹介見送りのステータスで管理する。先方（ベンダー）が OK になった案件を一覧に出し（人事が確認待ちでも消さない）、それ以外は「先方OK待ちの候補」に畳む。

## できること（使う人の目線）

- 紹介案件の一覧をリスト／カンバン／カレンダーで見る。
- 一覧には「先方OK かつ 人事OK」の案件（または手動で「一覧に追加」した案件）だけが出る。
- まだ先方 OK でない案件は、畳まれた「先方OK待ちの候補（N件）」に先方・人事の回答バッジ付きで並ぶ。「＋ 一覧に追加」で先に一覧へ出せ、一覧側の「先方OK待ちの候補に戻す」で戻せる。
- 一覧の行で人事がまだ確認待ちなら、紹介先の下に「人事 確認待ち」バッジ（紹介見送りの行には出さない）。
- 一覧上で、ステータス（ドロップダウン）、面談日時、報酬（空欄＝未定）、謝礼金をその場で変更できる。
- 面談日時が決まった案件が一番上、紹介見送りは一番下にグレーで出る。日程調整中は黄色。
- ステータスが一定日数（設定「stagnationDays」、既定7日）変わらない案件に「停滞」バッジが付く。
- ベンダー別チップ・ステータス別件数チップ・絞り込み（紹介先・ベンダー・ステータス・報酬状態・並び順）で絞り込める。
- 詳細画面でステータス・報酬状態の変更、請求・入金の入力、お繋ぎの手順／お繋ぎ文章（〇〇様を氏名に置換）のコピー、変更履歴の閲覧ができる。
- ベンダーMTG未実施のベンダーの案件は「紹介先に打診中」以降へ進めない。管理者は理由付きで強制解除できる。
- 「面談実施済」にすると報酬が自動で「計上申請」になり、管理者に通知が飛ぶ。

## 画面と操作

### 一覧 `/referrals`（`src/app/(app)/referrals/page.tsx`）

- 上部：見出し「紹介案件」＋「+ 紹介案件登録」（`/referrals/new`）。その下に「今日の商談」（`TodaySchedule`。別モジュール）。
- タブ：リスト（`view=list`）／カンバン（`view=kanban`）／カレンダー（`/referrals?view=calendar`。絞り込みは引き継がない）。
- カレンダー以外のとき：
  - ベンダーチップ（`VendorChips`）：一覧対象（LISTED）の件数があるベンダーだけ表示。ステータス絞り込みは無視して数える。
  - ステータス件数チップ（`CountChips`）：REFERRAL_ORDER 順。ベンダー選択中はそのベンダーの件数。クリックで `status=…&view=list`。
  - 絞り込みパネル（`FilterPanel`、スマホでは折りたたみ）：紹介先（氏名・会社名の部分一致、大文字小文字無視）、ベンダー、ステータス（リスト時のみ）、報酬状態、並び順。「絞り込む」「クリア」。
  - 「先方OK待ちの候補」：`<details>` で既定は閉じる。`card mb-3 border-gray-200 bg-gray-50`。見出し「先方OK待ちの候補（N件）」＋説明文。
    - 各行（`text-gray-500 opacity-70 hover:opacity-100`）：会社名（太字）→ 下に氏名（会社名があるときのみ）、ベンダータグ、回答バッジ「先方 OK/NG/確認待ち」「人事 …」、ベンダーMTGの状況（`MTG 日時`／`MTG日程調整中`／`MTG未設定`）、報酬セル（その場編集可）、右端に「＋ 一覧に追加」（`btn-secondary btn-sm`）。
    - 回答バッジ色：OK＝`bg-emerald-100 text-emerald-800 border-emerald-200`、NG＝`bg-rose-100 text-rose-800 border-rose-200`、確認待ち＝`bg-gray-100 text-gray-600 border-gray-200`。
    - 候補が0件ならセクションごと出さない。

#### リスト（PC：`hidden md:block` のテーブル）

列：紹介先／ベンダー／ステータス／面談日時／次アクション／期限／報酬（右寄せ）／謝礼金（右寄せ）／報酬状態。

- 紹介先セル：会社名（`text-blue-700 font-medium`、詳細へのリンク）→ 下に氏名（`text-xs text-gray-500`）。会社名が無ければ氏名だけ。
  - `listedEarly` で一覧に出ていて、まだ先方 OK でない行には小さく「先方OK待ちの候補に戻す」（`text-[11px] text-gray-400 underline`）。
- ステータス：`StatusSelect`（選ぶと即送信）。停滞なら横に「停滞」バッジ（`bg-amber-100 text-amber-800 border-amber-200`、title に「N日以上停滞」）。
- 面談日時・報酬・謝礼金：その場編集セル（後述）。
- 期限：期限切れ（今日より前、かつ MEETING_DONE / DECLINED 以外）は `text-rose-600 font-medium`。
- 報酬：未定なら `text-amber-700 font-medium` で「未定」。
- 報酬状態：`Badge`（色は labels.ts の STATUS_COLOR）。
- 行の色 `rowTone`：DECLINED＝`bg-gray-100 opacity-60`、SCHEDULING＝`bg-yellow-50`、他は無色。
- 0件：`EmptyState`「該当する紹介案件がありません」。

#### リスト（スマホ：`md:hidden` のカード）

カード `card p-3`＋rowTone、停滞なら `border-amber-300`。上段：会社名／氏名（左）と報酬セル（右）。中段：ベンダータグ、「報酬 ○○」バッジ、停滞バッジ。下段：「面談」日時セル、「謝礼金」セル、次アクション（2行まで、期限付き）、ステータスのドロップダウン。

#### カンバン

`grid gap-3 md:grid-cols-3 xl:grid-cols-6`。REFERRAL_ORDER の6列、列見出しにステータスバッジと件数。カード：会社名リンク、氏名、ベンダータグ（リンクなし）、面談日時、報酬（`fmtReward`、未定は amber）、ステータスのドロップダウン。停滞は `border-amber-300`、rowTone も適用。並びは一覧と同じ順（後述）。ドラッグ移動はない。

#### カレンダー

`MonthCalendar`（ベンダーMTG＝青、紹介面談＝紫。DECLINED の面談は出さない）。`month=yyyy-MM` で月送り。詳細は別モジュール。

### その場編集セル（`src/components/InlineCell.tsx`、`src/app/(app)/referrals/InlineCells.tsx`）

- 共通部品 `InlineCell`：表示中は値＋✎（クリックで編集）。値が無いと点線ボタン「＋ {emptyLabel}」（`border-dashed border-gray-300`）。
- 編集中：入力欄＋「保存」「取消」。Enter で保存（IME 変換中の Enter は無視）、Esc で取消。失敗時は赤字でエラー。成功で `router.refresh()`。
- `save(id, value)` は `{ ok, error? }` を返す関数（Server Action）。
- 面談日時 `MeetingAtCell`：`datetime-local`。空で保存すると未定（null）。表示は `fmtDateTime`。emptyLabel「日時を入力」。
- 謝礼金 `ThankYouFeeCell`：テキスト（`inputMode=numeric`）、入力中に全角→半角・数字以外除去・先頭0除去・3桁カンマ（`yen()`）。空で保存＝null（未入力）。表示「¥10,000」。
- 報酬 `RewardCell`：同じく数値入力。空で保存すると「未定」（`rewardAmount=0, rewardUndetermined=true`）。数値なら `rewardUndetermined=false`。placeholder「空欄で未定」。
- 金額上限 100,000,000。超えると「金額が大きすぎます」。

### 詳細 `/referrals/[id]`（`src/app/(app)/referrals/[id]/page.tsx`）

- タイトル「氏名 × ベンダー名」、説明に会社名／役職。ボタン「タスクを依頼」（`/tasks?link=…`、別モジュール）「編集」。
- `?blocked=STATUS` 付きで来たら警告枠（`border-amber-300 bg-amber-50`）：「『○○』へ進められません。ベンダーMTGが実施済になっていません」＋ベンダー詳細へのリンク。管理者には「強制解除の理由（任意）」入力と「管理者権限で強制解除」（`btn-danger`、確認ダイアログ付き）。
- 強制解除済なら灰色の注記（理由付き）。
- 案件情報カード：紹介先（繋がり詳細へリンク）、ベンダー（＋MTG状態バッジ）、ピックアップ日、ステータス、ピックアップ内容、面談日時、謝礼金、面談形式、会議URL・場所（http なら外部リンク）、面談実施日、面談結果メモ、次アクション、期限、メモ。
- 紹介ステータスカード：ドロップダウン。ベンダーMTG未実施かつ未解除なら注意文。「『面談実施済』にすると報酬が自動で『計上申請』になります」。
- 報酬カード：金額（未定は amber）、報酬状態バッジとドロップダウン。「承認は管理者のみ」。
- お繋ぎの手順／お繋ぎ文章（ベンダーに入力があるときだけ、`lg:grid-cols-2`）。文章は `introMessageFor` で `[〇○◯]{1,3}様` を「氏名様」に置換（氏名が会社名と同じ・空なら「ご担当者様」）してコピー用パネル（`CopyBriefPanel`）で出す。
- 請求・入金カード（`RewardForm`）：報酬額＋「単価未定」チェック、請求日、入金予定日、入金日、計上承認日時の表示。
- 変更履歴カード（`HistoryList`、StatusHistory を新しい順）。

### 登録・編集 `/referrals/new`、`/referrals/[id]/edit`（`ReferralForm.tsx`）

- 新規：ベンダー（MTG状態・単価表有無のヒント）、紹介先（絞り込み＋リスト選択）、ピックアップ日、報酬額（単価表→判定、なければベンダー単価を自動入力。判定の理由と候補金額ボタンを表示）、単価未定、謝礼金、ピックアップ内容、面談日時・形式・場所、次アクション・期限、メモ。
- URL パラメータ `vendorId, contactId, reward, undetermined=1, note` で初期値を入れられる。
- 同じベンダー×繋がりの案件が既にあれば「重複の可能性」エラー。「重複を無視して登録」にチェックで登録可。
- 編集時はベンダー・紹介先は変えられない（hidden）。面談結果メモが出る。

## データ

### referrals（Prisma `Referral`）

| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| id | INTEGER PK | 自動 | |
| vendor_id | INTEGER | 必須 | ベンダー（02） |
| contact_id | INTEGER | 必須 | 紹介先＝繋がり（人事） |
| picked_up_at | TEXT | now | ピックアップ日 |
| status | TEXT | 'RECEIVED' | 紹介ステータス（下表） |
| status_changed_at | TEXT | now | 最後にステータスが変わった日時（停滞判定・並び順） |
| meeting_at | TEXT NULL | | 面談日時 |
| meeting_format | TEXT NULL | | ONLINE＝オンライン／VISIT＝訪問 |
| meeting_place | TEXT NULL | | 会議URL・場所 |
| meeting_result | TEXT NULL | | 面談結果メモ |
| meeting_done_at | TEXT NULL | | 面談実施日（MEETING_DONE になった時に自動） |
| next_action / next_action_due | TEXT NULL | | 次アクションと期限（日付） |
| reward_amount | INTEGER | 0 | 報酬額（円）。未定のときは 0 |
| reward_undetermined | INTEGER(bool) | 0 | 単価未定 |
| thank_you_fee | INTEGER NULL | | 謝礼金（紹介先へのお礼）。null＝未入力 |
| vendor_approval | TEXT | 'PENDING' | 先方（ベンダー）の回答 |
| contact_approval | TEXT | 'PENDING' | 人事（紹介先）の回答 |
| listed_early | INTEGER(bool) | 0 | 先方OK前でも一覧に出す |
| reward_status | TEXT | 'UNFIXED' | 報酬状態 |
| reward_approved_at / invoiced_at / payment_due_at / paid_at | TEXT NULL | | 計上承認・請求・入金予定・入金 |
| force_unlocked | INTEGER(bool) | 0 | ベンダーMTG未実施ブロックの強制解除 |
| force_unlock_reason | TEXT NULL | | 解除理由 |
| pickup_note | TEXT NULL | | ピックアップ内容 |
| memo | TEXT NULL | | メモ |
| created_at / updated_at | TEXT | now | |

enum：

- ReferralStatus：RECEIVED＝ピックアップ受付／CONTACTING＝紹介先に打診中／SCHEDULING＝日程調整中／MEETING_CONFIRMED＝面談確定／MEETING_DONE＝面談実施済／DECLINED＝紹介見送り（この順が REFERRAL_ORDER）
- VendorApproval（vendor_approval・contact_approval 共通）：PENDING＝確認待ち／OK／NG
- RewardStatus：UNFIXED＝未確定／APPLIED＝計上申請／APPROVED＝承認済／INVOICED＝請求済／PAID＝入金済
- ステータスバッジ色（STATUS_COLOR）：RECEIVED `bg-slate-100 text-slate-700`、CONTACTING `bg-sky-100 text-sky-800`、SCHEDULING `bg-slate-100 text-slate-700`、MEETING_CONFIRMED `bg-indigo-100 text-indigo-800`、MEETING_DONE `bg-emerald-100 text-emerald-800`、DECLINED `bg-gray-200 text-gray-600`。

### status_history（Prisma `StatusHistory`。他モジュールと共用）

entity_type（VENDOR / VENDOR_MEETING / REFERRAL）、entity_id、field、from_value、to_value、note、changed_by_id、changed_at。from と to が同じなら記録しない（`recordHistory`）。

### settings

`stagnationDays`（既定 7）。

### SQLite 例（日時は TEXT(ISO 8601) に統一）

```sql
CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  picked_up_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  status TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED','CONTACTING','SCHEDULING','MEETING_CONFIRMED','MEETING_DONE','DECLINED')),
  status_changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  meeting_at TEXT,
  meeting_format TEXT CHECK (meeting_format IN ('ONLINE','VISIT')),
  meeting_place TEXT,
  meeting_result TEXT,
  meeting_done_at TEXT,
  next_action TEXT,
  next_action_due TEXT,
  reward_amount INTEGER NOT NULL DEFAULT 0,
  reward_undetermined INTEGER NOT NULL DEFAULT 0,
  thank_you_fee INTEGER,
  vendor_approval TEXT NOT NULL DEFAULT 'PENDING' CHECK (vendor_approval IN ('PENDING','OK','NG')),
  contact_approval TEXT NOT NULL DEFAULT 'PENDING' CHECK (contact_approval IN ('PENDING','OK','NG')),
  listed_early INTEGER NOT NULL DEFAULT 0,
  reward_status TEXT NOT NULL DEFAULT 'UNFIXED'
    CHECK (reward_status IN ('UNFIXED','APPLIED','APPROVED','INVOICED','PAID')),
  reward_approved_at TEXT,
  invoiced_at TEXT,
  payment_due_at TEXT,
  paid_at TEXT,
  force_unlocked INTEGER NOT NULL DEFAULT 0,
  force_unlock_reason TEXT,
  pickup_note TEXT,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_referrals_vendor ON referrals(vendor_id);
CREATE INDEX IF NOT EXISTS idx_referrals_contact ON referrals(contact_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_meeting_at ON referrals(meeting_at);
CREATE INDEX IF NOT EXISTS idx_referrals_status_changed ON referrals(status_changed_at);

CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('VENDOR','VENDOR_MEETING','REFERRAL')),
  entity_id INTEGER NOT NULL,
  field TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  note TEXT,
  changed_by_id INTEGER,
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_status_history_entity ON status_history(entity_type, entity_id);
```

ISO 文字列は辞書順＝時刻順になるので、`<`・ORDER BY がそのまま使える（必ず UTC の `Z` 付きで揃える）。

## 決まり（ロジック）

### 確定・見込みの金額（一覧の表の上）

- 面談日（商談日）の月ごとに分ける：箱の上に月のチップ（面談がある月＋今月、「面談日未定」「すべて」。既定は今月、`?tm=YYYY-MM|none|all`）。箱の下に畳める「月別の内訳（面談日ベース）」の表（月・確定・見込み・合計・件数・謝礼金。行を押すとその月）。月は日本時間（`monthKeyJst`・`totalsByMonth`）。
- 3つの箱：「確定」（緑 `border-emerald-200 bg-emerald-50/60`）・「見込み」（黄 `border-amber-200 bg-amber-50/60`）・「確定＋見込み」。各箱に金額・件数・（金額未定の件数）・謝礼金の合計。PC は3列、スマホは縦並び。
- 対象は LISTED の案件。ベンダーの絞り込みは効かせ、ステータス・報酬状態の絞り込みは無視する。
- 確定＝ `status='MEETING_DONE'` または `reward_status != 'UNFIXED'`。見込み＝それ以外。紹介見送りはどちらにも入れない。
- 報酬が「未定」の案件は金額に足さず、件数と「うち金額未定 N件」にだけ数える。
- 参照コード：`src/lib/referral-totals.ts`（`referralTotals`・`isFixedReferral`。**純粋関数。そのまま流用可**）、`src/app/(app)/referrals/page.tsx` の `TotalBox`。

### 一覧に出す条件（LISTED）

- 面談の日程が決まった（面談日時が入った・面談確定・面談実施済）案件は、先方・人事の回答が確認待ちなら自動で OK にする（NG は触らない。履歴に「面談の日程が決まったため自動で OK」）。`approveByProgress()`（`src/lib/referral-progress.ts`）を、登録・編集・ステータス変更・面談日時のその場入力のあとに呼ぶ。

- 手で登録した紹介案件（登録フォーム）は先方OK（`vendor_approval='OK'`）で作る。面談日時が入った・日程調整中以降に進んだ案件も、回答に関わらず一覧に出す（手で面談を入れたのに一覧に出ない、を防ぐ）。

- `vendor_approval='OK' OR listed_early=1 OR meeting_at IS NOT NULL OR status IN ('SCHEDULING','MEETING_CONFIRMED','MEETING_DONE')` の案件だけを一覧・件数チップ・ベンダーチップの対象にする。
- 「先方OK待ちの候補」＝ LISTED でない かつ status≠DECLINED。ステータス・報酬状態の絞り込みは候補には効かない（ベンダー・紹介先検索は効く）。
- 候補から除外：そのベンダーの最新のベンダーMTG（created_at 降順の先頭）が CANCELLED のもの。
- 候補の並び：確定済み（CONFIRMED かつ日時あり）のベンダーMTGがある → 日時の新しい順、次に MTG 日程調整中（SCHEDULING / RESCHEDULE / CONFIRMED で日時なし）、最後に MTG 未設定。同順位は vendor_id, id 昇順。
- 「一覧に追加」＝ `listed_early=1`、「先方OK待ちの候補に戻す」＝ `listed_early=0`（先方 OK の行には戻すボタンを出さない）。
- 以前は「先方OK かつ 人事OK」で一覧に出していたが、人事が確認待ちの間に一覧から消えて追えなくなるため、先方OKだけで出すように変えた。

### 一覧の並び順

1. まず選んだ並び順（`sort`）で取得（最大500件）：
   - updated（既定）：status_changed_at 降順
   - meeting：meeting_at 昇順（null は最後）→ status_changed_at 降順
   - due：next_action_due 昇順（null 最後）→ status_changed_at 降順
   - picked：picked_up_at 降順 → id 降順
   - stale：status_changed_at 昇順
2. そのうえでグループ分けして安定ソート：
   - 0：DECLINED 以外で meeting_at あり → meeting_at の新しい順（降順）
   - 1：その他 → 1 の順のまま
   - 2：DECLINED → 1 の順のまま（一番下）
- カンバンの列内も同じ順。

### 停滞

- `status NOT IN (MEETING_DONE, DECLINED) AND status_changed_at < 現在 − stagnationDays日` を停滞とし、「停滞」バッジと `border-amber-300`。
- 定期処理（`src/lib/cron/reminders.ts`）で管理者に STAGNANT 通知：停滞到達時とその後7日ごと（dedupeKey に status_changed_at と週バケットを含めて二重通知を防ぐ）。

### ステータス変更（`changeReferralStatus`）

- 同じ値なら何もしない。
- 行き先が CONTACTING / SCHEDULING / MEETING_CONFIRMED / MEETING_DONE（`REFERRAL_REQUIRES_VENDOR_DONE`）で、ベンダーの meetingStatus が NOT_DONE かつ force_unlocked=0 なら変更せず `/referrals/{id}?blocked={status}` へ戻す。NOT_REQUIRED（MTG不要）・DONE なら進める。RECEIVED・DECLINED へはいつでも変えられる。
- 変更時は `status_changed_at=now` と履歴（field=status）をトランザクションで記録。
- MEETING_DONE になったら：`meeting_done_at` が空なら now を入れる。報酬状態が UNFIXED なら APPLIED にし、履歴（note「面談実施済に伴い自動で計上申請」）を残し、管理者全員に APPROVAL_PENDING 通知（タイトル「【計上申請】ベンダー × 氏名 の報酬 ¥…／未定」、未定なら「単価が未定です…金額を入力してから承認」）。UNFIXED 以外（既に申請・承認済など）は報酬を触らない。
- MEETING_DONE から戻しても報酬状態は戻さない。
- 一括「紹介先に打診中へ進める」（`advanceToContactingAction`、ベンダーMTG画面から使う）：RECEIVED のものだけ対象。ブロックされた件数を通知に含め、全件ブロックならエラー。

### 強制解除（`forceUnlockAction`）

管理者のみ。`force_unlocked=1`・理由を保存し、履歴（field=forceUnlocked、false→true）。以後その案件は MTG 未実施でも進められる。

### 先方・人事の回答との連動（入力はベンダー詳細。02 参照）

- どちらかが NG になったら、status が RECEIVED / CONTACTING / SCHEDULING / MEETING_CONFIRMED なら DECLINED に。MEETING_DONE はそのまま。
- NG を取り消して両方とも NG でなくなり、status が DECLINED なら RECEIVED に戻す（元のステータスには戻さない）。
- この変更は vendor MTG ロックを通らない。

### 報酬

- 承認（APPROVED）と、APPROVED→APPLIED の取消は管理者のみ。
- UNFIXED / APPLIED から INVOICED / PAID へ飛ばすのは管理者のみ。
- 未定または 0 円の報酬は APPROVED / INVOICED / PAID へ進めない。
- APPROVED/INVOICED/PAID にしたとき reward_approved_at が空なら now、INVOICED で invoiced_at、PAID で paid_at を空なら now。
- 詳細は報酬モジュール側。ここではステータス自動連動だけ押さえる。

### その場編集の保存

- 面談日時：空＝null。形式不正は「日時の形式が正しくありません」。
- 謝礼金：NFKC 正規化して数字以外を除去、空＝null、上限 1億。
- 報酬：同様、空＝`reward_amount=0, reward_undetermined=1`、数値＝`reward_undetermined=0`。
- いずれも id が正の整数かを確認し、ログイン必須。履歴は残さない。

### 登録

- 新規作成時に履歴（null→RECEIVED）。報酬未定チェック時は reward_amount=0。報酬未入力ならベンダー単価。
- 重複チェック：同じ vendor_id×contact_id があれば止める（`ignoreDuplicate=1` で無視）。

### 権限

- 閲覧・編集・ステータス変更：ログインユーザー全員（referral-hub の ADMIN / MEMBER）。
- 強制解除・報酬承認：ADMIN のみ。
- 移植先では：一般操作＝requireUser(STAFF)、強制解除・承認＝admin（必要に応じて clerk も）に対応付ける。

## 参照コード

- `src/app/(app)/referrals/page.tsx`：`SORTS`、`LISTED`、`AnswerBadge`、`rowTone`、候補の `mtgRank`/`mtgAt`・`cancelledVendors`、`group` による並び替え、`isStagnant`
- `src/app/(app)/referrals/actions.ts`：`changeReferralStatus`、`setReferralStatusAction`、`advanceToContactingAction`、`forceUnlockAction`、`approveRewardAction`、`setRewardStatusAction`、`saveRewardAction`、`updateReferralMeetingAtAction`、`updateThankYouFeeAction`、`updateRewardAmountAction`、`setListedEarlyAction`、`createReferralAction`、`updateReferralAction`
- `src/app/(app)/referrals/InlineCells.tsx`：`MeetingAtCell`、`ThankYouFeeCell`、`RewardCell`、`yen`
- `src/components/InlineCell.tsx`：`InlineCell`
- `src/app/(app)/referrals/[id]/page.tsx`：ブロック表示、`introMessageFor`
- `src/app/(app)/referrals/[id]/RewardForm.tsx`
- `src/app/(app)/referrals/ReferralForm.tsx`：`judge`、`applyFee`、`FeeHint`
- `src/lib/labels.ts`：`REFERRAL_LABEL`、`REFERRAL_ORDER`、`REFERRAL_REQUIRES_VENDOR_DONE`、`REWARD_LABEL`、`STATUS_COLOR`
- `src/lib/history.ts`：`recordHistory`
- `src/lib/cron/reminders.ts`：停滞通知
- `prisma/schema.prisma`：`Referral`、`StatusHistory`、enum `ReferralStatus`・`VendorApproval`・`RewardStatus`

## 移植のポイント

- Prisma の `findMany` + `include` は JOIN で書く。一覧は `referrals r JOIN vendors v JOIN contacts c` を1本で取り、LISTED を `WHERE (r.vendor_approval='OK' OR r.listed_early=1)` で書く。
- `meetingAt: { sort: 'asc', nulls: 'last' }` は SQLite では `ORDER BY meeting_at IS NULL, meeting_at`。
- `contains` + `mode: insensitive` は `LIKE '%'||?||'%'`（SQLite の LIKE は ASCII のみ大文字小文字無視。日本語はそのままで問題ない）。
- グループ並べ替え（面談日時あり→その他→見送り）は SQL で取得後に JS で安定ソートするのが確実（元コードもそうしている）。
- `prisma.$transaction(async tx => …)` は `db.transaction(() => { … })()`（better-sqlite3 は同期）。通知送信はトランザクションの外で。
- Server Actions → Route Handlers にするなら：
  - `PATCH /api/referrals/[id]/status`（body: status）→ ブロック時は 409 と `{ blocked: status }` を返し、画面側で警告枠を出す。
  - `PATCH /api/referrals/[id]/inline`（field: meetingAt | thankYouFee | rewardAmount, value）→ `{ ok, error }`。`InlineCell` の `save` に fetch を渡せばそのまま使える。
  - `POST /api/referrals/[id]/listed`、`POST /api/referrals/[id]/force-unlock`（admin）。
  - `revalidatePath` の代わりに、クライアントは保存後 `router.refresh()`（InlineCell は既にそうしている）。
- `runWithFlash` の「returnTo に戻ってフラッシュ表示」は移植先のトースト等に置き換える。
- 日時は ISO 文字列で保存。`datetime-local` の値（ローカル時刻、秒なし）は JST として解釈して UTC ISO にする（`parseDateTimeInput` 相当を用意）。
- 金額入力の正規化 `yen()`（InlineCells.tsx 内）と `introMessageFor`（詳細ページ内）は純粋関数なのでそのまま流用可。`src/components/InlineCell.tsx` は `useRouter` 以外に依存がなく流用可。
- `src/lib/fee-table.ts` は純粋関数（02 参照）。
- セールスハブ由来の項目（pickup_note の「セールスハブ記載内容」、ReferralForm の reward/note パラメータ）は、セールスハブ由来なので移植不要（列自体は自由記述のメモとして残してよい）。

## 依存

- 02. ベンダー詳細・単価表・提案した人事チェックリスト（vendors、meetingStatus、先方・人事の回答入力、単価表）
- 繋がり（contacts）モジュール
- ベンダーMTG モジュール（候補のMTG状況表示、一括で打診中へ進める、meetingStatus の自動更新）
- 報酬・承認モジュール（報酬状態の承認・請求・入金）
- 通知モジュール（APPROVAL_PENDING、STAGNANT）
- 今日の商談・カレンダー（TodaySchedule / MonthCalendar）
- 設定（stagnationDays）

## 動作確認チェックリスト

- [ ] 先方OKの案件は人事が確認待ちでも一覧に出て「人事 確認待ち」バッジが付き、先方が確認待ちの案件は「先方OK待ちの候補」に出る
- [ ] 候補の「＋ 一覧に追加」で一覧に出て、一覧の「先方OK待ちの候補に戻す」で候補に戻る（先方OKの行には戻すボタンが出ない）
- [ ] 候補に DECLINED が出ない。最新のベンダーMTGがキャンセルのベンダーの候補も出ない
- [ ] 候補の並びが「MTG確定（新しい順）→ 日程調整中 → 未設定」になる
- [ ] 面談日時のある案件が一番上（日時の新しい順）、DECLINED が一番下に `bg-gray-100 opacity-60` で出る
- [ ] SCHEDULING の行が `bg-yellow-50` になる
- [ ] 紹介先セルが会社名（上）・氏名（下）の2段になる。会社名が無ければ氏名のみ
- [ ] 面談日時・報酬・謝礼金をその場で編集でき、Enter 保存・Esc 取消が動く。IME 確定の Enter で保存されない
- [ ] 報酬を空欄で保存すると「未定」（amber）、数値で保存すると未定が外れる
- [ ] 謝礼金を空欄で保存すると「＋ 謝礼金」ボタン表示に戻る
- [ ] ベンダーMTG未実施のベンダーの案件を「紹介先に打診中」にすると止まり、警告枠が出る。MTG不要なら進める
- [ ] 管理者が強制解除すると進められるようになり、履歴に残る。一般ユーザーには解除ボタンが出ない
- [ ] 「面談実施済」にすると meeting_done_at が入り、報酬が UNFIXED→APPLIED になり、管理者に通知が届く（既に APPLIED 以降なら変わらない）
- [ ] ステータス変更で status_changed_at が更新され、変更履歴に出る
- [ ] stagnationDays 日以上変わらない案件に「停滞」バッジが出る（MEETING_DONE・DECLINED には出ない）
- [ ] ステータス件数チップ・ベンダーチップの件数が LISTED のみを数えている
- [ ] 表の上に確定・見込み・合計の金額が出て、面談実施済にすると見込みから確定へ移り、紹介見送りにすると消える
- [ ] 並び順の5種類がそれぞれ効く
- [ ] スマホ幅でカード表示になり、各セルが編集できる
- [ ] 詳細のお繋ぎ文章で「〇〇様」が紹介先の氏名に置き換わる
- [ ] 同じベンダー×繋がりの重複登録が止まり、「重複を無視して登録」で登録できる
