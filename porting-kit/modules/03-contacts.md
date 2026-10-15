# 03. 繋がりリスト

> 一言で：紹介できる人（人事・決裁者など）の名簿。CSV 取込・重複チェック・タグ・役職クラス分け・「どのベンダーにまだ紹介していないか」の絞り込みと見込み単価表示、繋がり×ベンダーの紹介マトリクスを持つ。

## できること（使う人の目線）
- 繋がり（人）を一覧で見る。氏名・会社・役職・メモで検索、業種・地域・セールスハブ登録・タグで絞り込む。
- 「○○ に未紹介」でベンダーを選ぶと、そのベンダーにまだ紹介していない人だけが出る。ベンダーに単価表があれば「見込み単価」列が付き、「単価表に当てはまる人だけ表示」で対象者を金額の高い順に並べられる。各行の「紹介する」から紹介案件を作れる。
- 手入力で追加・編集する。役職は「役職クラス」（セレクト）と「正確な役職」（自由入力）に分けて入力する。
- 追加時に重複（メール一致、または氏名＋会社名一致）があれば警告し、「重複を無視して登録」にチェックすると登録できる。
- CSV（UTF-8 / Shift_JIS 自動判定）を取り込む。列の対応付けは見出しから自動推定し、手で直せる。取込前に重複を確認して、行ごとに「スキップ／上書き／両方登録」を選ぶ。
- タグをカンマ区切りで付ける（既存タグは候補表示）。
- 詳細画面で、まだ紹介していないベンダー一覧（「紹介する」ボタン付き）と紹介履歴を見る。
- 繋がりを無効にする／有効に戻す（削除はしない）。
- 紹介マトリクスで「誰をどのベンダーに紹介済みか」を表で見て、空きセルの「＋」から紹介案件を作る。

## 画面と操作

### 一覧 `/contacts`
- ヘッダー：タイトル「繋がりリスト」、説明に件数（`N 件`）。右に「CSV取込」（`btn-secondary` → `/contacts/import`）、「+ 手入力で追加」（`btn-primary` → `/contacts/new`）。
- タブ：「一覧」／「紹介マトリクス（誰をどこに紹介済みか）」。
- 未紹介ベンダー指定中のバナー：`rounded-lg border border-blue-200 bg-blue-50 text-blue-900`。ベンダー名タグ＋「にまだ紹介していない繋がりを表示中」。単価表があれば「（単価表あり：「見込み単価」は規模・役職からの判定）」、無ければ「（単価 ¥N）」。単価表があるときだけ切替ボタン：「単価表に当てはまる人だけ表示」（`btn-primary btn-sm`、`&target=1` を付ける）⇔「全員を表示」（`btn-secondary btn-sm`）。
- 絞り込みフォーム（`card p-3`、`FilterPanel` に入れてスマホでは折りたたみ。有効な条件数をバッジ表示）。GET パラメータ：
  - `q` 検索（氏名・会社・役職・関係性メモの部分一致、大小文字無視）
  - `notVendor` 未紹介のベンダー（有効ベンダーのセレクト。表示は「{name} に未紹介」）
  - `industry` 業種、`region` 地域（どちらも既存データの distinct 値のセレクト）
  - `saleshub` セールスハブ（""=すべて／`1`=登録済／`0`=未登録）
  - `tag` タグ名
  - `inactive=1` 「無効も表示」チェック
  - `target=1` は hidden で維持
  - ボタン「絞り込む」「クリア」（`/contacts` へ）
- PC（`hidden md:block`）：`table`。列は 氏名（リンク `text-blue-700 font-medium`）／会社名／役職クラス／正確な役職（`min-w-40`）／業種／規模／地域／SH（`済` か `-`）／タグ（`badge bg-gray-100 text-gray-600 border-gray-200`）／紹介済みベンダー（ベンダータグ。0 件なら `text-xs text-gray-400` で「未紹介」）／見込み単価（単価表があるときだけ）／「紹介する」（未紹介ベンダー指定時だけ。`btn-primary btn-sm` → `/referrals/new?vendorId=..&contactId=..`）。
  - 役職クラス・正確な役職は保存値 `title` を `splitTitle()` で分けて表示（無ければ `-`）。
  - 無効の行は `opacity-50`。
- 見込み単価セル（`FeeCell`。理由は `title` 属性でホバー表示）：
  - matched → `font-medium text-emerald-700` で金額
  - ambiguous → `text-amber-700` で「要確認（¥A / ¥B）」
  - unknown → `text-gray-400`「判断できない」／ outside → `text-gray-400`「対象外」
- スマホ（`md:hidden`）：カード（`card p-3`）。1行目に会社名（無ければ氏名）、2行目に「氏名 / 役職」。右上に「紹介する」。下に「業種 ／ 規模 ／ 地域 ／ SH済」、見込み単価、タグとベンダータグ。
- 空のとき：`EmptyState`「該当する繋がりがありません」。
- 件数上限：通常は 500 件まで取得（`target=1` のときだけ全件を取り、アプリ側で判定・並べ替え）。件数表示は DB の count（`target=1` のときは絞った後の件数）。
- 並び：会社名 昇順 → 氏名 昇順。
- `imported` などのパラメータは同梱リスト取込の結果表示（`border-emerald-200 bg-emerald-50`）。セールスハブ由来なので移植不要。

### 追加 `/contacts/new`・編集 `/contacts/[id]/edit`
- 共通フォーム `ContactForm`（`card p-4 max-w-3xl`、`grid sm:grid-cols-2`）。
- 項目：氏名（必須）／会社名（`?company=` で初期値を渡せる）／役職クラス（`TITLE_CLASSES` のセレクト＋「（未設定）」。hint「セールスハブに登録する区分」）／正確な役職（hint「例: 経営企画Div. 人事チーム責任者」）／業種／従業員規模（例: 50〜100名）／地域（例: 東京）／メール（type=email）／電話／その他連絡先（2列幅。LINE、Facebook など）／タグ（2列幅、カンマ区切り、`datalist` で既存タグ候補）／「セールスハブに登録済み」チェック／関係性メモ（textarea 3行）。
- エラー表示。新規で重複エラー（「重複」で始まるメッセージ）のときだけ「重複を無視して登録」チェック（`ignoreDuplicate=1`）が現れる。
- ボタン：「登録」／「保存」、「キャンセル」（詳細 or 一覧へ）。保存後は詳細へリダイレクト。

### 詳細 `/contacts/[id]`
- ヘッダー：氏名。説明は「会社 / 役職」＋無効なら「（無効）」。右に「+ この人を紹介」（`/referrals/new?contactId=`）、「編集」。
- 「基本情報」カード（`lg:col-span-2`）：会社名・役職クラス・正確な役職・業種・従業員規模・地域・セールスハブ登録（登録済／未登録）・メール・電話・その他連絡先・タグ・関係性メモ・登録日。
- 「操作」カード：有効なら「この繋がりを無効にする」（`btn-danger btn-sm`）、無効なら「有効に戻す」（`btn-secondary btn-sm`）。
- 「まだ紹介していないベンダー（N）」：有効ベンダーのうち、この人の紹介案件が 1 件もないもの。列 ベンダー／サービス概要（`truncate`）／単価／MTG状態バッジ／「紹介する」。全部紹介済みなら「すべてのベンダーに紹介済みです」。
- 「紹介履歴（N）」：ベンダー／ピックアップ日／ステータス／面談日時／報酬（単価未定なら「未定」表示の `fmtReward`）／報酬状態。id 降順。0 件なら「紹介履歴はありません」。

### CSV取込 `/contacts/import`
- 手順カード 1〜4（クライアントコンポーネント `ImportWizard`）：
  1. ファイル選択（`.csv`）。`encoding-japanese` で文字コード判定→Unicode に変換、BOM 除去。`papaparse` で `header: true, skipEmptyLines: true`。「ファイル名：N 行、M 列」を表示。
  2. 列の対応付け：`CONTACT_FIELDS` ごとにセレクト（「（取り込まない）」可）。見出しの同義語で自動推定（例：氏名＝氏名/名前/担当者名/決裁者名、会社名＝企業名/社名/法人名/勤務先、役職＝肩書/position、メモ＝関係性/備考/note、タグ＝分類 など。完全一致か部分一致。1 列は 1 項目にしか割り当てない）。先頭 5 行のプレビュー表。氏名が未対応なら「「氏名」に対応する列を選んでください」。
  3. 「重複を確認する」→ 重複行の表（行／CSVの内容／既存の繋がり／一致理由／処理セレクト）。処理の初期値は「スキップ（既存を残す）」、他に「上書き（既存を更新）」「両方登録（別人として追加）」。
  4. 「N 行を取り込む」→ 結果カード（新規登録・上書き更新・スキップ件数、エラー一覧 `text-xs text-rose-700`）。「繋がりリストへ」「続けて取り込む」（reload）。
- 対応付けを変えると重複確認結果はクリアされる。
- 管理者向けの「同梱の会社リストを取り込む」カードはセールスハブ由来なので移植不要。

### 紹介マトリクス `/contacts/matrix`
- 検索（`q`：氏名・会社名）。有効な繋がり 300 件まで、会社→氏名順。列は有効ベンダー（名前順）。
- 見出しセル：ベンダータグ＋`text-[11px] text-gray-500` で「¥単価 ／ MTG {未実施|実施済|不要}」。
- 左端の繋がり列は `sticky left-0 bg-white z-10`（見出しは `bg-gray-50`）。氏名リンク＋「会社 / 役職（保存値そのまま）」。
- セル：未紹介なら「＋」（`w-7 h-7 rounded-md border border-dashed border-gray-300 text-gray-400`、hover で `border-blue-400 text-blue-600 bg-blue-50`）→ `/referrals/new?vendorId=&contactId=`。紹介済みならステータスバッジ（`STATUS_COLOR[status]`）を縦に並べ、各バッジは紹介案件詳細へのリンク。
- 右端「合計」：紹介件数と、面談実施済（`MEETING_DONE`）の `rewardAmount` 合計（0 より大きいときだけ）。
- 空のとき「該当する繋がりがありません」。

## データ

### Contact（繋がり）
| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| id | int PK | autoincrement | |
| name | text | 必須 | 氏名 |
| company | text? | | 会社名 |
| title | text? | | 役職。「クラス（正確な役職）」の形で 1 欄に保存（下記） |
| industry | text? | | 業種（自由入力） |
| employeeSize | text? | | 従業員規模（自由入力。「50〜100名」など。単価判定で数値に解釈） |
| region | text? | | 地域 |
| email / phone / otherContact | text? | | 連絡先 |
| isOnSaleshub | bool | false | セールスハブに登録済みかのフラグ（同期処理は移植しない） |
| relationMemo | text? | | 関係性メモ。部署は「部署: 人事部」の形で書く約束（下記） |
| isActive | bool | true | false＝無効（一覧の既定表示とマトリクスから外れる） |
| createdAt / updatedAt | datetime | now | |

インデックス：name、company。

### Tag
| 列 | 型 | 意味 |
|---|---|---|
| id | int PK | |
| name | text UNIQUE | タグ名 |

### ContactTag（中間表）
| 列 | 型 | 意味 |
|---|---|---|
| contactId | int FK → Contact（ON DELETE CASCADE） | |
| tagId | int FK → Tag（ON DELETE CASCADE） | |
PK は (contactId, tagId)。

### 役職クラス（`TITLE_CLASSES`）
代表取締役／会長／顧問／役員・取締役クラス／本部長クラス／部長クラス／課長クラス／主任・係長クラス／一般社員

### SQLite の CREATE TABLE 例（日時は TEXT(ISO8601) に統一）
```sql
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  title TEXT,              -- 「部長クラス（人事部長）」の形
  industry TEXT,
  employee_size TEXT,
  region TEXT,
  email TEXT,
  phone TEXT,
  other_contact TEXT,
  is_on_saleshub INTEGER NOT NULL DEFAULT 0,
  relation_memo TEXT,      -- 「部署: 人事部 / ...」
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);
```
※ better-sqlite3 で CASCADE を効かせるには接続ごとに `PRAGMA foreign_keys = ON`。

## 決まり（ロジック）

### 役職の保存形式（`src/lib/title.ts`）
- 1 欄に「クラス（正確な役職）」で保存し、画面では 2 つに分けて表示・入力する。
- `joinTitle(cls, detail)`：両方あり・異なる → `クラス（詳細）`（全角括弧）。片方だけ → その値。両方空 → null。detail がクラスと同じなら クラスだけ。
- `splitTitle(title)`：
  1. `^(…クラス|一般社員|代表取締役|会長|顧問)\s*[（(](.*)[）)]$` に合い、前半が `TITLE_CLASSES` に含まれる → { cls, detail }（括弧内が空なら detail=null）。
  2. 値そのものが `TITLE_CLASSES` のどれか → { cls, detail: null }。
  3. それ以外（「代表」「執行役員」など詳細だけ）→ { cls: classFromDetail(値), detail: 値 }。
- `classFromDetail(detail)`：NFKC 正規化・空白除去してから上から順に判定。副社長→役員・取締役クラス／代表・社長・CEO→代表取締役／会長／顧問／取締役・役員・CxO・CHRO・CTO・CFO・COO・VP→役員・取締役クラス／本部長→本部長クラス／部長・室長・責任者・ゼネラルマネージャー・事業部長（副部長・部長代理を除く）→部長クラス／課長・マネージャー・副部長・部長代理・次長→課長クラス／主任・係長・リーダー→主任・係長クラス／該当なし→null。
- フォーム送信時：`titleClass` か `titleDetail` が送られてきたら `joinTitle` で作る。どちらも無いときは `title` をそのまま使う（旧形式との互換）。
- CSV 取込では役職列をそのまま `title` に入れる（分割しない）。表示時に `splitTitle` が推定する。

### 部署の書き方（relationMemo）
- 部署は関係性メモに「部署: 人事部」（全角コロン可）で書く約束。単価判定（`src/lib/fee-table.ts` の `contactDept`）が `部署[:：]\s*([^/／\n]+)` で読み、役職クラスに部署を足して「人事部長」等を判定する。メモ内の区切りは「 / 」。
- メモに無ければ氏名の「担当者（人事部・部長クラス）」の括弧内「・」の前を部署とみなす。

### 見込み単価（未紹介ベンダー指定時）
- そのベンダーの `feeTable` を `parseFeeTable` で読み、行ごとに `judgeFee(rules, contact)` を出す（詳細はベンダーモジュールの単価表）。役職は `classPartOf` でクラス部分だけを使う。
- `target=1` かつ単価表あり：matched と ambiguous の人だけ残し、matched を先、その中は金額の高い順（ambiguous は候補の最大値で比較）。

### 未紹介の判定
- 一覧の `notVendor`：`referrals: { none: { vendorId } }`（ステータスを問わず、そのベンダー宛の紹介案件が 1 件でもあれば「紹介済み」）。
- 詳細の「まだ紹介していないベンダー」も同じ考え方（有効ベンダーのみ）。

### 重複チェック（`src/lib/contacts.ts`）
- `normalizeName`：空白（半角・全角）を除去し小文字化。
- `normalizeCompany`：空白除去、`株式会社／有限会社／合同会社／(株)／（株）／(有)／（有）／㈱／㈲` を除去、小文字化。
- `findDuplicate({name, company, email})`：DB から「氏名が大小文字無視で完全一致」または「メールが大小文字無視で一致」の候補を最大 20 件取り、
  1. メールが一致 → 理由「メール一致」
  2. 正規化した氏名と会社名が両方一致 → 理由「氏名＋会社名一致」
  を最初に見つけたもので返す。無ければ null。
  ※ 候補取得が「氏名の完全一致」なので、空白の入り方だけ違う氏名は候補に入らない（現状の挙動）。
- 手入力の新規登録：重複があればエラー文「重複の可能性：「氏名（会社 or 会社不明）」が既に登録されています（理由）。…」を返して止める。`ignoreDuplicate=1` なら確認しない。編集時は確認しない。

### 保存（`writeContact`）
- トランザクション内で Contact を create / update → タグ名を 1 件ずつ upsert（名前で一意）→ その繋がりの ContactTag を全削除 → 付け直す。タグは毎回「全置き換え」。
- 使われなくなった Tag は消さない。
- `parseTags`：`, 、 ， ; ； / ／` で分割、trim、空を除き、重複を除く。
- `parseBool`（CSV のセールスハブ列）：`1 true yes y はい 有 あり ○ ◯ 済 登録済`（大小文字無視）なら true。それ以外・空は false。
- 文字列項目は前後空白を削り、空なら null。

### CSV 取込（`checkDuplicatesAction` / `importContactsAction`）
- 重複確認：氏名が空の行は飛ばし、各行で `findDuplicate`。結果は行番号（0 始まり）・既存 id・表示名・理由。
- 取込：
  - 氏名が空 → エラー「N行目: 氏名が空のためスキップ」、スキップ数 +1。
  - 処理が skip → スキップ。
  - ファイル内重複：キー `e:メール小文字` と `n:正規化氏名|正規化会社` を記録し、先に登録した行とキーが重なれば「このファイル内の別の行と重複しているためスキップ」。ただし「両方登録」を選んだ行はこの判定をしない。
  - overwrite かつ既存 id あり → 既存を `writeContact` で上書き（updated）。それ以外 → 新規（created）。
  - 1 行ずつ別トランザクション。失敗行はエラーに積んで続行。
- 行番号の表示は 1 始まり（見出し行を数えない）。

### 無効化
- `toggleContactActiveAction`：`isActive` を反転するだけ。紹介案件は残る。物理削除の画面はない。

### 権限
- 一覧・詳細・追加・編集・CSV 取込・無効化は、ログインしていれば誰でもできる（`requireUser` / `assertUser`）。同梱リスト取込だけ管理者（移植不要）。

## 参照コード
- `prisma/schema.prisma`：`Contact`、`Tag`、`ContactTag`
- `src/app/(app)/contacts/page.tsx`：`ContactsPage`（where 組み立て、見込み単価の判定と並べ替え）、`FeeCell`
- `src/app/(app)/contacts/actions.ts`：`contactInput`、`createContactAction`、`updateContactAction`、`toggleContactActiveAction`、`checkDuplicatesAction`、`importContactsAction`（`importBundledCompaniesAction` は移植不要）
- `src/app/(app)/contacts/ContactForm.tsx`：`ContactForm`
- `src/app/(app)/contacts/new/page.tsx`、`src/app/(app)/contacts/[id]/edit/page.tsx`
- `src/app/(app)/contacts/[id]/page.tsx`：`ContactDetailPage`
- `src/app/(app)/contacts/import/ImportWizard.tsx`：`SYNONYMS`、`guessMapping`、`decodeFile`、`ImportWizard`
- `src/app/(app)/contacts/matrix/page.tsx`：`ContactMatrixPage`
- `src/lib/contacts.ts`：`CONTACT_FIELDS`、`normalizeName`、`normalizeCompany`、`parseBool`、`parseTags`、`findDuplicate`、`upsertTags`、`writeContact`
- `src/lib/title.ts`：`TITLE_CLASSES`、`classFromDetail`、`splitTitle`、`joinTitle`
- `src/lib/fee-table.ts`：`parseFeeTable`、`judgeFee`、`contactDept`、`classPartOf`

## 移植のポイント
- そのまま流用できる純粋関数：`src/lib/title.ts` 全部、`src/lib/contacts.ts` の `CONTACT_FIELDS`・`normalizeName`・`normalizeCompany`・`parseBool`・`parseTags`、`ImportWizard.tsx` の `SYNONYMS`・`guessMapping`・`decodeFile`（`papaparse`・`encoding-japanese` が必要）、`src/lib/fee-table.ts`。
- `findDuplicate`：Prisma の `mode: "insensitive"` は SQLite では `WHERE lower(name) = lower(?) OR lower(email) = lower(?)` で代用（日本語は大小文字が無いので実害なし）。`LIMIT 20` を付け、後段の正規化比較はそのまま JS で行う。
- `writeContact`：better-sqlite3 の `db.transaction(() => {...})` で同期的に包む。タグの upsert は `INSERT INTO tags(name) VALUES (?) ON CONFLICT(name) DO NOTHING` → `SELECT id FROM tags WHERE name = ?`。ContactTag は `DELETE ... WHERE contact_id = ?` → `INSERT` の全置き換え。
- 一覧の where：
  - 検索は `(name LIKE ? OR company LIKE ? OR title LIKE ? OR relation_memo LIKE ?)`（`%q%`。英字の大小は LIKE が既定で無視）。
  - タグ：`EXISTS (SELECT 1 FROM contact_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.contact_id = c.id AND t.name = ?)`。
  - 未紹介：`NOT EXISTS (SELECT 1 FROM referrals r WHERE r.contact_id = c.id AND r.vendor_id = ?)`。
  - 業種・地域のセレクト候補は `SELECT DISTINCT industry FROM contacts WHERE industry IS NOT NULL ORDER BY industry`。
  - 紹介済みベンダーとタグは N+1 を避け、表示中 id でまとめて取ってから JS で紐付ける。
- CSV 取込の 2 アクションは Route Handler（POST JSON）にしてもよい。行数が多いとリクエストが大きくなるので、移植先の body 上限を確認する（referral-hub はエラー文で「分割してください」と案内）。
- 日時は TEXT(ISO) で保存し、更新時は `updated_at` をアプリ側で入れる（SQLite に `@updatedAt` は無い）。
- `isOnSaleshub` は単なるフラグとして残す（同期処理・同梱リスト取込はセールスハブ由来なので移植不要）。不要なら列ごと省いてよいが、CSV の対応項目とフォームのチェックも合わせて外す。
- 権限は移植先の役割（admin / clerk / caller+is_hq / caller）に合わせて `requireUser(STAFF)` などに置き換える。referral-hub では全ログインユーザーが編集できる。

## 依存
- 02. ベンダー詳細・単価表（`Vendor`、単価表 `feeTable` と `src/lib/fee-table.ts`、ベンダータグ表示）
- 01. 紹介案件（`Referral`。未紹介判定・紹介履歴・マトリクス・「紹介する」リンク先 `/referrals/new?vendorId=&contactId=`）

## 動作確認チェックリスト
- [ ] 手入力で役職クラス「部長クラス」・正確な役職「人事部長」を入れると、DB に「部長クラス（人事部長）」で保存され、編集画面で 2 欄に戻る
- [ ] 正確な役職だけ「代表」を入れると「代表」のまま保存され、一覧の役職クラス列に「代表取締役」と推定表示される
- [ ] 同じメール、または「株式会社ABC」と「ABC」で同じ氏名を登録しようとすると重複エラーになり、「重複を無視して登録」で登録できる
- [ ] タグを「A、B, A」で入れると A・B の 2 つだけ付き、編集で B を外すと ContactTag から消える
- [ ] Shift_JIS の CSV が文字化けせず読め、見出し「お名前」「企業名」「肩書」が自動で対応付く
- [ ] 重複行で「スキップ／上書き／両方登録」がそれぞれ期待どおり動き、同じファイル内の 2 行目重複がスキップされる
- [ ] 氏名が空の行がエラーに「N行目: 氏名が空のためスキップ」と出る
- [ ] 「○○ に未紹介」でそのベンダーへの紹介案件がある人が消え、「紹介する」で紹介案件作成画面に vendorId・contactId が入る
- [ ] 単価表のあるベンダーで見込み単価列が出て、「単価表に当てはまる人だけ表示」で matched が金額降順→ambiguous の順になる
- [ ] 関係性メモ「部署: 人事部」＋役職「部長クラス」の人が人事部長の単価で判定される
- [ ] 無効にした人が一覧から消え、「無効も表示」で半透明で出る。マトリクスにも出ない
- [ ] マトリクスで紹介済みセルにステータスバッジ、空きセルに「＋」が出て、合計列に面談実施済の報酬合計が出る
- [ ] スマホ幅で一覧がカード表示になり、絞り込みが折りたたまれる
