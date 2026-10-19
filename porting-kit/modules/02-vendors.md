# 02. ベンダー詳細・単価表・提案した人事チェックリスト

> 一言で：紹介先となるベンダー（サービス提供企業）を管理し、ベンダーに提案した人事（繋がり）ごとに「先方の回答」「人事の回答」を OK／NG／確認待ちでチェックする。従業員数×役職の単価表から報酬（協力金）を自動で決める。

## できること（使う人の目線）

- ベンダーの一覧・登録・編集・無効化ができる（社名、担当者、連絡先、サービス概要、紹介報酬単価、お繋ぎの手順、お繋ぎ文章、単価表、メモ）。
- ベンダー詳細の「ベンダーに提案した人事」で、まだこのベンダーに紹介していない繋がりを検索・複数選択して一括追加できる（紹介案件が「ピックアップ受付」で作られ、報酬は単価表から自動入力）。
- 提案した人事ごとに「先方の回答」「人事の回答」を ✓OK／✗NG／確認待ち のボタンで切り替える。先方 OK で紹介案件一覧（01）に出る（人事が確認待ちでも出す）。どちらか NG で紹介見送りになる。
- 回答の件数（先方・人事それぞれの確認待ち／OK／NG、両方OK）が一目でわかる。
- 報酬をその場で直せる（空欄＝未定）。
- 単価表（従業員数の範囲×役職→協力金）を登録すると、提案時・紹介案件登録時に報酬が自動で決まる。決まらないときは「未定」と理由が残る。
- ベンダーMTGの状態（未実施／実施済／不要）を切り替える。未実施のままだと紹介案件を「紹介先に打診中」以降へ進められない。
- お繋ぎの手順・お繋ぎ文章を表示・コピーできる。

## 画面と操作

### 一覧 `/vendors`（`src/app/(app)/vendors/page.tsx`）

- 見出し「ベンダー」＋「セールスハブ取込」（セールスハブ由来なので移植不要）＋「+ ベンダー登録」。
- 絞り込み：検索（社名・担当者・サービス概要の部分一致）、MTG状態（すべて／未実施／不要／実施済）、「無効も表示」チェック（既定は有効のみ）。
- テーブル列：社名（詳細リンク）／担当者／サービス概要（`max-w-xs truncate`）／単価（`fmtYen`）／MTG状態バッジ／MTG件数／紹介件数。無効のベンダーは行に `opacity-50`。
- 並び：created_at 降順。
- 0件：「ベンダーがありません」。
- スマホ専用表示はなく、`card overflow-x-auto` で横スクロール。

### 登録・編集 `/vendors/new`、`/vendors/[id]/edit`（`VendorForm.tsx`、`FeeTableEditor.tsx`）

- 項目：社名（必須）、担当者名、紹介報酬単価（円、必須、既定 0）、メール、電話、セールスハブ案件URL（移植不要）、サービス概要、お繋ぎの手順（hint「紹介するときの流れ・注意点」）、お繋ぎ文章（hint「〇〇様は紹介案件の画面で紹介先の氏名に置き換わります」）、単価表、メモ。
- 単価表エディタ：行ごとに 従業員数（以上）／従業員数（未満、空＝上限なし）／役職（セレクト：代表取締役・人事管掌役員・人事部長・営業部長・技術部長）／協力金（円）／削除。「+ 行を追加」は直前の行を複製（協力金だけ空）。下限か協力金が空の行は送信しない。hidden `feeTable` に JSON で送る。
- 保存後はベンダー詳細へ。

### 詳細 `/vendors/[id]`（`src/app/(app)/vendors/[id]/page.tsx`）

上から順に：

1. ヘッダー：社名（無効なら説明に「（無効）」）、「+ MTG登録」「+ 紹介案件」（`/referrals/new?vendorId=`）「編集」。
2. **ベンダーに提案した人事（N）** カード
   - 右上リンク「まだ紹介していない繋がり N 人を見る →」（`/contacts?notVendor={id}`）。
   - 説明文：先方が繋いでほしい相手を選んだら先方OK、人事に打診して了承をもらったら人事OK。先方OKで紹介案件一覧に表示（人事が確認待ちの間も表示）、どちらかNGなら紹介見送り。
   - 件数バッジ：「先方」確認待ち（`bg-gray-100 text-gray-700`）／✓ OK（`bg-emerald-100 text-emerald-800`）／✗ NG（`bg-rose-100 text-rose-800`）、「人事」も同様、「両方OK N」（`bg-emerald-600 text-white`）。
   - 「＋ 提案した人事を追加」（`ProposePicker`）：押すと青枠（`border-blue-200 bg-blue-50/40`）の選択パネルが開く。検索欄（会社名・氏名・役職）と該当人数、チェックボックス付きリスト（`max-h-80` スクロール。会社名／氏名・役職・規模／右端に見込み報酬。「未定」は `text-amber-700`）、選択行は `bg-blue-50`。「選んだ N 人を提案に追加」（0人なら無効）「閉じる」。注記「報酬は単価表（なければベンダー単価）から自動で入ります」。候補0件は「該当する繋がりがありません」。
   - チェックリスト表（0件は「まだ提案した人事はいません」）：列 先方の回答／人事の回答／会社（会社名 or 氏名、紹介案件詳細へリンク）／ステータスバッジ／面談日時／報酬（その場編集 `RewardCell`）／報酬状態バッジ。
   - 回答ボタン `AnswerButtons`：3つ並びのセグメント（`rounded-md border divide-x`）。選択中は OK＝`bg-emerald-600 text-white`、NG＝`bg-rose-600 text-white`、確認待ち＝`bg-gray-600 text-white`、非選択は `bg-white text-gray-500`。押すと即保存し、同じベンダー詳細に戻る（returnTo）。
   - 行の色：どちらかNG＝`bg-gray-100 opacity-60`、両方OK＝`bg-emerald-50/60`、それ以外は無色。
   - 並び：確認待ち（両方OKでもNGでもない）→ 両方OK → NG。同じグループ内は紹介案件 id の新しい順。
3. お繋ぎの手順／お繋ぎ文章（入力があるときだけ。`lg:grid-cols-2`）。手順は `whitespace-pre-wrap`、文章はコピー用パネル（ここでは置換なし。置換は紹介案件詳細で行う）。
4. 単価表（協力金）カード（単価表があるときだけ）：列 従業員数（同じ範囲は1行目だけ表示）／役職／協力金。右上「単価表に当てはまる繋がりを見る →」（`/contacts?notVendor={id}&target=1`）。
5. ベンダーMTG（N）カード：日時（なければ「日時未定」、MTG詳細へリンク）／担当／形式／承認／実施。並び scheduled_at 降順。MTG 自体は別モジュール。
6. 基本情報カード（`lg:col-span-2`）：担当者、紹介報酬単価（単価表があれば「¥…（単価表あり・下記）」）、メール、電話、セールスハブURL、サービス概要、メモ。
7. ベンダーMTGの状態カード：現在の状態バッジ、説明文、ボタン「実施済にする」（primary）「MTG不要にする」「未実施に戻す」（現在値のボタンは出さない）。下に「このベンダーを無効にする」（`btn-danger btn-sm`）／「有効に戻す」。
8. 変更履歴（VENDOR の StatusHistory、新しい順に20件）。

### 提案状況（MTG後）

- MTG状態が「実施済」のベンダーだけ、提案状況「提案前／提案中／提案済み」を手動で切り替える（`vendors.proposal_status`、既定 `NOT_PROPOSED`）。
- ベンダー一覧：「提案状況」列にその場で変えられるセレクト（実施済以外は「-」）、絞り込み「提案状況（MTG実施済）」。
- ベンダー詳細：「紹介の条件」の上に「提案状況」カード（セレクト＋説明「MTG後、人事の提案を始める前は提案前、会社情報を送って回答待ちは提案中、提案し終えたら提案済み」）。
- ベンダーMTG一覧（一覧・スマホ・カンバン）でも、MTGが実施済の行のベンダー名の下に同じ色付きセレクトを出す（`ProposalStatusSelect`。提案済みは塗りつぶしの緑「✓ 提案済み」、提案中は黄「… 提案中」、提案前は白「○ 提案前」）。
- 変更は履歴（field=`proposalStatus`）に残す。色：提案前 slate、提案中 amber、提案済み emerald。
- 参照コード：`setVendorProposalStatusAction`（`src/app/(app)/vendors/actions.ts`）、`VENDOR_PROPOSAL_LABEL`・`VENDOR_PROPOSAL_ORDER`（`src/lib/labels.ts`）。

## データ

### vendors（Prisma `Vendor`）

| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| id | INTEGER PK | 自動 | |
| name | TEXT | 必須 | 社名 |
| contact_name / contact_email / contact_phone | TEXT NULL | | 先方担当者 |
| service_summary | TEXT NULL | | サービス概要 |
| referral_fee | INTEGER | 0 | 紹介報酬単価（円）。単価表があるときは表に当てはまらない場合の目安 |
| intro_steps | TEXT NULL | | お繋ぎの手順 |
| intro_message | TEXT NULL | | お繋ぎ文章（〇〇様 → 紹介先の氏名に置換してコピー） |
| fee_table | TEXT(JSON) NULL | | 単価表。`FeeRule[]` の JSON。空なら NULL |
| saleshub_url | TEXT NULL | | セールスハブ案件URL（移植不要） |
| meeting_status | TEXT | 'NOT_DONE' | ベンダーMTGの状態 |
| memo | TEXT NULL | | |
| is_active | INTEGER(bool) | 1 | 有効 |
| created_at / updated_at | TEXT | now | |

enum VendorMeetingStatus：NOT_DONE＝未実施（`bg-slate-100 text-slate-700`）／DONE＝実施済（`bg-emerald-100 text-emerald-800`）／NOT_REQUIRED＝不要（初回MTGなしで紹介可、`bg-teal-50 text-teal-800`）。

### 単価表 FeeRule（fee_table の中身）

| キー | 型 | 意味 |
|---|---|---|
| role | 'CEO' \| 'HR_EXEC' \| 'HR_HEAD' \| 'SALES_TECH_HEAD' | 代表取締役／人事管掌役員／人事部長／営業部長・技術部長（`FEE_ROLES`） |
| min | 整数 ≥0 | 従業員数の下限（以上） |
| max | 整数 > min または null | 上限（未満）。null＝上限なし |
| fee | 整数 ≥0 | 協力金（円） |

### referrals 側で使う列（定義は 01）

vendor_approval・contact_approval（PENDING＝確認待ち／OK／NG）、status、status_changed_at、reward_amount、reward_undetermined、pickup_note、memo。

### 繋がり側で使う列（contacts）

company、name、title（役職。「クラス（正確な役職）」の1欄）、employee_size（規模。自由記述）、relation_memo（「部署: 人事部」を含むことがある）、is_active。

### SQLite 例（日時は TEXT(ISO 8601) に統一）

```sql
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  service_summary TEXT,
  referral_fee INTEGER NOT NULL DEFAULT 0,
  intro_steps TEXT,
  intro_message TEXT,
  fee_table TEXT, -- JSON: [{"role":"CEO","min":50,"max":100,"fee":30000}, ...]
  meeting_status TEXT NOT NULL DEFAULT 'NOT_DONE'
    CHECK (meeting_status IN ('NOT_DONE','DONE','NOT_REQUIRED')),
  memo TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

## 決まり（ロジック）

### 提案した人事の追加（`proposeContactsAction`）

- 選んだ contact_id（正の整数、1〜100人。0人なら「追加する人事を選んでください」、101人以上はエラー）。
- 対象は「有効（is_active）で、このベンダーとの紹介案件がまだ1件も無い」繋がりだけ。既にある人はスキップし、通知に「（N 人は登録済みのためスキップ）」。
- 1人ずつ referrals を作成：status=RECEIVED（既定）、vendor_approval/contact_approval=PENDING（既定）、`rewardFor(vendor, contact)` の結果で reward_amount・reward_undetermined、pickup_note＝`会社名 / 役職（ベンダーに提案）／単価表で決まらず：理由`、memo＝「ベンダー詳細の『提案した人事』から追加」。
- 作成ごとに履歴（null→RECEIVED、note「ベンダーに提案」）。
- 選択パネルの候補：有効で未紹介の繋がりを 会社名→氏名 順に最大1000件。見込み報酬は `rewardFor` → `fmtReward`。

### 回答の切り替え（`setVendorApprovalAction`）

- 入力：id、side（'contact' なら人事側、それ以外は先方側）、approval（PENDING/OK/NG 以外はエラー）。
- 同じ値なら何もしない。
- 変更後の両側の値で判定：
  - `anyNg`＝どちらかが NG。
  - `toDeclined`＝anyNg かつ現在の status が RECEIVED / CONTACTING / SCHEDULING / MEETING_CONFIRMED → status を DECLINED に。MEETING_DONE と既に DECLINED はそのまま（報酬に関わるため）。
  - `fromDeclined`＝NG が無くなった（変更前はどちらかNG、変更後はどちらもNGでない）かつ status が DECLINED → RECEIVED に戻す（NG前のステータスには戻らない）。
- status が変わったら status_changed_at=now と履歴（note：人事NG「人事側がNG」、先方NG「ベンダーが先方NG」、取消「NGを取り消し」）。
- 回答そのものの変更は履歴に残さない。
- ベンダーMTG未実施のロックはこの経路では見ない（DECLINED / RECEIVED への変更なので元々ロック対象外）。
- 両方 OK になったら紹介案件一覧に出る（01 の LISTED。ここで status は変えない）。

### 件数とチェックリストの並び

- 件数：このベンダーの全紹介案件について、先方・人事それぞれ PENDING/OK/NG を数える。「両方OK」＝vendor_approval='OK' AND contact_approval='OK'。
- rank：どちらかNG＝2、両方OK＝1、それ以外＝0。rank 昇順、同 rank は id 降順。

### ベンダーMTGの状態（meeting_status）

- 手動切替（`setVendorMeetingStatusAction`）：DONE / NOT_DONE / NOT_REQUIRED のみ。トランザクションで更新＋履歴（entity VENDOR、field meetingStatus）。
- 自動（ベンダーMTGモジュール側）：MTG を「実施済」にすると DONE に。「初回MTGなし」にすると NOT_DONE → NOT_REQUIRED（note に「初回MTGなし」）。その MTG がまた日程調整中・確定・リスケになると、直近の変更が「初回MTGなし」による自動の NOT_REQUIRED だった場合だけ NOT_DONE に戻す（`reopenVendorMeetingStatus`）。
- 効果：NOT_DONE のベンダーの紹介案件は CONTACTING 以降へ進めない（01 の `REFERRAL_REQUIRES_VENDOR_DONE`）。

### 有効／無効

`toggleVendorActiveAction` で is_active を反転。無効ベンダーは一覧の既定表示と紹介案件登録のベンダー選択から外れる。

### 保存時の検証（`vendorData`／`feeTableOf`）

- 社名必須（「社名は必須です」）。紹介報酬単価は金額として正規化。
- 単価表：JSON 解析失敗は「単価表の形式が正しくありません」。`parseFeeTable` で落ちた行が1つでもあれば「単価表に正しくない行があります（従業員数の上限は下限より大きく、金額は0以上の整数にしてください）」。0行なら NULL で保存。

### 単価表による報酬判定（`src/lib/fee-table.ts`。純粋関数）

- `parseFeeTable(json)`：配列でなければ []。role が FEE_ROLES のキー、min が0以上の整数、max が null か min より大きい整数、fee が0以上の整数の行だけ残す。
- `parseEmployeeSize(raw)`：NFKC 正規化・カンマ/空白除去後、人数の範囲 `[lo, hi]`（両端含む）を返す。読めなければ null。
  - 「50〜100名」「50-100」「50から100」→ [50,100]（逆順なら入れ替え）
  - 「300名以上」→ [300, ∞]、「100名未満」→ [0, 99]、「100名以下」→ [0, 100]
  - その他、最初の数値 → [n, n]（「4000.0名」→ 4000、「31（業務委託含む）名」→ 31）
- `classifyTitle(raw)` → `{ role, vague }`（上から順に判定）：
  - 空 → role=null, vague=true
  - 副社長・代表代行 → null, vague
  - 代表・社長・CEO・最高経営責任者 → CEO
  - 人事系（人事・CHRO・人材開発・人財）かつ 役員系（取締役・役員・CHRO・CxO）→ HR_EXEC
  - 人事系かつ 部長系（部長・本部長・責任者・室長・局長。ただし副部長・部長代理は除く）→ HR_HEAD
  - 営業・セールス・技術・開発・エンジニア・CTO かつ 部長系 → SALES_TECH_HEAD
  - 人事系でない役員・部長・執行役員 → null, vague（部署不明で判断できない）
  - それ以外 → null, vague=false（対象外）
- `contactDept(c)`：relation_memo の「部署: ○○」、なければ氏名の「担当者（人事部・部長クラス）」の括弧内「・」の前。セールスハブ取込の繋がり向け。
- `classPartOf(title)`：「課長クラス（採用統括）」→「課長クラス」。末尾が クラス／一般社員／代表取締役／会長／顧問 で、その後に括弧書きがある場合だけ括弧を外す。
- `judgeFee(rules, contact)`：
  1. 役職＝`classPartOf(title)`。部署が取れて役職に含まれていなければ「部署 役職」にする。
  2. `classifyTitle` で role が無ければ、vague なら `unknown`（「役職…から判断できません」／「役職が空欄です」）、そうでなければ `outside`。
  3. その role の行が表に無ければ `outside`。
  4. 規模が読めなければ `unknown`。
  5. 規模範囲 [lo,hi] と重なる行（`hi >= min && (max==null || lo < max)`）を min 昇順で集める。無ければ `outside`。
  6. 重なる行で [lo,hi] が隙間なく覆われ、かつ金額が1種類なら `matched`（reason「役職名・規模（範囲）」）。それ以外は `ambiguous`（候補金額を昇順、覆われていなければ「（対象外の可能性もあり）」）。
- `rewardFor(vendor, contact)`：
  - 単価表が空 → `referral_fee`、未定でない、reason なし。
  - matched → その金額。
  - それ以外 → `rewardAmount=0, rewardUndetermined=true, reason="単価表で決まらず：{理由}（候補：¥… / ¥…）"`。
- その他：`fmtSizeRange(min,max)`（「50名以上100名未満」「100名未満」「300名以上」）、`groupFeeTable(rules)`（同じ範囲の行をまとめて表示用に並べる）。

### 報酬の自動入力が起きる場所

- 提案した人事の一括追加（`rewardFor`）。
- 紹介案件の新規登録フォーム（`judgeFee`。ベンダー・紹介先を選び直すたびに入れ直す。ambiguous は候補金額ボタンで選べる）。01 参照。
- 繋がり一覧の `target=1`（単価表に当てはまる＝matched・ambiguous の人を、matched→金額の高い順で表示）。
- 既存の紹介案件の金額は自動で更新しない（単価表を変えても再計算しない）。

### 権限

ベンダーの登録・編集・回答・MTG状態・無効化はログインユーザー全員（`assertUser`）。移植先では requireUser(STAFF) 相当。必要なら編集・無効化を admin/clerk に絞る。

## 参照コード

- `src/app/(app)/vendors/page.tsx`：一覧と絞り込み
- `src/app/(app)/vendors/[id]/page.tsx`：`rank`、`approvalCount`、`bothOk`、`proposeCandidates`、`AnswerButtons`、単価表・MTG状態カード
- `src/app/(app)/vendors/[id]/ProposePicker.tsx`：`ProposePicker`
- `src/app/(app)/vendors/actions.ts`：`vendorData`、`feeTableOf`、`createVendorAction`、`updateVendorAction`、`setVendorMeetingStatusAction`、`toggleVendorActiveAction`、`proposeContactsAction`、`setVendorApprovalAction`
- `src/app/(app)/vendors/VendorForm.tsx`、`src/app/(app)/vendors/FeeTableEditor.tsx`
- `src/app/(app)/vendors/new/page.tsx`、`src/app/(app)/vendors/[id]/edit/page.tsx`
- `src/lib/fee-table.ts`：`FEE_ROLES`、`FeeRule`、`parseFeeTable`、`fmtSizeRange`、`parseEmployeeSize`、`classifyTitle`、`contactDept`、`classPartOf`、`judgeFee`、`groupFeeTable`、`rewardFor`
- `src/app/(app)/meetings/actions.ts`（MTG 実施済・初回MTGなしでの meetingStatus 自動更新）、`src/lib/history.ts`：`reopenVendorMeetingStatus`
- `src/app/(app)/contacts/page.tsx`：`notVendor`・`target=1`
- `prisma/schema.prisma`：`Vendor`、enum `VendorMeetingStatus`・`VendorApproval`

## 移植のポイント

- **`src/lib/fee-table.ts` は DB・Next に依存しない純粋モジュール。そのままコピーして使える**（クライアントでもサーバーでも動く）。
- fee_table は SQLite では TEXT に JSON 文字列で保存し、読むときは必ず `parseFeeTable(JSON.parse(text ?? "[]"))` を通す（不正な行を捨てる）。Prisma の `Prisma.DbNull` は単に NULL を入れればよい。
- `rewardFor` に渡す vendor の `feeTable` は「解析前の値（unknown）」を想定している。SQLite から読んだ文字列を渡すときは先に `JSON.parse` する（文字列のままだと配列でないので単価表なし扱いになる）。
- 提案の一括追加は `db.transaction()` で全件まとめると速く安全（元コードは1件ずつ非トランザクション）。「既に紹介案件がある繋がり」の除外は `NOT EXISTS (SELECT 1 FROM referrals WHERE vendor_id=? AND contact_id=c.id)` で書く。
- 回答切り替えは「referrals 更新＋必要なら status_history 追加」を1トランザクションにする。
- Route Handlers にするなら：
  - `GET/POST /api/vendors`、`GET/PATCH /api/vendors/[id]`
  - `POST /api/vendors/[id]/propose`（body: contactIds[]）→ `{ added, skipped }`
  - `PATCH /api/referrals/[id]/approval`（body: side, approval）
  - `PATCH /api/vendors/[id]/meeting-status`、`POST /api/vendors/[id]/toggle-active`
  - フォーム＋`returnTo` によるリダイレクト（`runWithFlash`）は fetch＋`router.refresh()`＋トーストに置き換える。
- `AnswerButtons` は1ボタン1フォームの構成。クライアント部品にするなら3ボタンのセグメントで、押したら API を呼んで refresh すればよい。
- `contactDept` の氏名・relation_memo からの部署抽出はセールスハブ取込の形式に合わせたもの。移植先に部署列があるなら、`judgeFee` に渡す前に title を「部署 役職」にしておけば同じ結果になる（関数自体はそのまま使ってよい）。
- セールスハブ案件URL・セールスハブ取込ボタンはセールスハブ由来なので移植不要。

## 依存

- 01. 紹介案件（先方・人事OK）（referrals テーブル、RewardCell、LISTED の条件、ステータス遷移）
- 繋がり（contacts）モジュール（提案の候補、規模・役職）
- ベンダーMTG モジュール（MTG一覧、meeting_status の自動更新）
- 共通：status_history（変更履歴）

## 動作確認チェックリスト

- [ ] ベンダーの登録・編集ができ、社名が空だとエラーになる
- [ ] 単価表に max ≤ min の行や負の金額があると保存時にエラーになる。全行削除で NULL になる
- [ ] 単価表が詳細に規模ごとにまとまって表示される
- [ ] 「提案した人事を追加」で未紹介の有効な繋がりだけが候補に出て、検索・複数選択できる
- [ ] 追加すると status=RECEIVED・回答=確認待ちの紹介案件ができ、履歴に「ベンダーに提案」が残る
- [ ] 既に紹介案件がある繋がりはスキップされ、件数が通知に出る
- [ ] 単価表なしのベンダーではベンダー単価、ありのベンダーでは判定どおりの金額、決まらなければ「未定」＋pickup_note に理由が入る
- [ ] `fee-table.ts` の判定：「50〜100名」×「人事部長」、「300名以上」×「代表取締役」、「部長クラス」（部署なし→判断できない）、「人事部・部長クラス」（部署付き→人事部長）、範囲が区切りをまたぐ規模（ambiguous と候補金額）
- [ ] 先方 OK・人事 OK にすると紹介案件一覧に出る
- [ ] どちらかを NG にすると RECEIVED〜MEETING_CONFIRMED の案件が DECLINED になり、行がグレーになる。MEETING_DONE は変わらない
- [ ] NG を確認待ち／OK に戻す（両方とも NG でなくなる）と DECLINED → RECEIVED に戻る
- [ ] 件数バッジ（先方・人事それぞれの確認待ち／OK／NG、両方OK）が正しい
- [ ] チェックリストの並びが 確認待ち → 両方OK（`bg-emerald-50/60`）→ NG（`bg-gray-100 opacity-60`）
- [ ] 報酬セルを空で保存すると「未定」になる
- [ ] MTG状態を 実施済／不要／未実施 に切り替えられ、履歴に残る。未実施だと紹介案件を打診中へ進められない
- [ ] ベンダーMTGを「実施済」にするとベンダーの状態が自動で実施済になる（MTGモジュール移植後）
- [ ] 無効にしたベンダーが一覧の既定表示から消え、「無効も表示」で薄く出る
- [ ] お繋ぎの手順・お繋ぎ文章が入力時だけ表示される
