# 07. LINE用コピー

> 一言で：ベンダーMTG 1件ごとに「状態・次にやること・お繋ぎ先と単価・リンク」をまとめた文面を自動で作り、ボタン1つでコピー（または LINE の共有画面で送信）できるようにする。表示中の未完了MTGをまとめた一括文面も作れる。文面づくりとお繋ぎ先の計算は DB に依存しない純粋関数。

## できること（使う人の目線）
- ベンダーMTG一覧の各行（スマホのカード／PC の表／カンバンのカード）にある「LINE用コピー」を押すと、その案件の「次にやること」文面がクリップボードに入る。押すと約1.8秒「✓ コピーしました」（緑）になる。
- 一覧右上の「未完了 N 件をまとめてLINE用コピー」で、表示中の未完了案件をまとめた文面をコピーする（担当者で絞り込んでいれば宛名付き）。
- MTG 詳細では「◯◯さんへ送る『次にやること』（LINE用）」カードに文面のプレビューが出て、その場で書き換えてからコピーできる。「LINEで送る」で LINE の送り先選択画面が開く。「元に戻す」「この内容でタスク依頼」もある。
- お繋ぎ先（紹介する相手の会社）と単価がバッジで並び、未定は黄色、見送り（紹介見送り・先方NG・人事NG）はグレー・取り消し線・¥0 で残る。見送りが多い時は3社まで出して「ほか見送り N社」にまとめる。

## 画面と操作

### CopyBriefButton（一覧用の小ボタン）— `src/components/CopyBrief.tsx`
- props：`text`（コピーする文面）、`label`（既定「LINE用コピー」）、`className`。
- 見た目：`btn-secondary btn-sm`。コピー成功後 1800ms だけ `border-emerald-300 bg-emerald-50 text-emerald-800`「✓ コピーしました」。
- title：「次にやること・単価をまとめた文面をコピー（LINEに貼り付けて送れます）」。
- クリックで `preventDefault` と `stopPropagation`（行やカード全体のリンクに反応させない）。
- 置き場所（`src/app/(app)/meetings/page.tsx`）：
  - スマホのカード：下段左（右にステータス選択）
  - PC の表：最終列（見出し空）
  - カンバンのカード：`mt-2 w-full`
  - PageHeader の actions：一括コピー（`label="未完了 N 件をまとめてLINE用コピー"`、`className="btn-sm"`）。対象が0件ならボタン自体を出さない。リスト・カンバン・カレンダーどのタブでも出る。

### CopyBriefPanel（詳細用）— `src/components/CopyBrief.tsx`
- props：`text`（初期文面）、`taskHref?`（タスク依頼画面へのリンク）。
- 編集できる textarea（`input font-mono text-xs leading-relaxed`、行数＝文面の行数+1、最大18行）。
- ボタン：
  - 「コピー」（`btn-primary btn-sm`、成功後 1800ms `bg-emerald-600 border-emerald-600`「✓ コピーしました」）
  - 「LINEで送る」：`https://line.me/R/share?text=${encodeURIComponent(value)}` を新しいタブで開く（LINE の緑 `bg-[#06C755] border-[#06C755] text-white`）
  - 「元に戻す」：書き換えた時だけ出る。初期文面に戻す
  - 「この内容でタスク依頼」：taskHref がある時だけ
- 下に注意書き（自由に書き換えてからコピーできる／LINEで送るは送り先を選ぶ画面が開く）。
- 使っている所：MTG 詳細（`/meetings/{id}`、カード見出し「{担当者の姓}さんへ送る『次にやること』（LINE用）」、taskHref＝`/tasks?link=/meetings/{id}&title={ベンダー}：次の対応をお願いします&body={文面}&assignee={担当ID}`）。ほかにベンダー詳細・紹介案件詳細の「お繋ぎ文章」でも同じパネルを使う（文面は別機能）。

### お繋ぎ先バッジ（一覧・詳細）
- バッジ `badge` ＋ `targetBadgeClass(t)`：
  - 見送り：`bg-gray-100 text-gray-400 border-gray-200 line-through decoration-gray-400`
  - 単価未定：`bg-amber-50 text-amber-800 border-amber-200`
  - 単価あり：`bg-indigo-50 text-indigo-800 border-indigo-200`
- 中身「会社名 (¥金額)」／「会社名 (未定)」。見送りは amount=0 なので「(¥0)」。
- 一覧は `compactTargets(targets)`：有効な会社を全部 → 見送りを先頭3社まで。残りは `text-[11px] text-gray-400`「ほか見送り N社」。詳細は全件。
- 合計単価：`formatTargetsTotal(targets, m.fee ?? vendor.referralFee)`。未定を含むと `text-amber-700`。お繋ぎ先が0件の PC 表は `text-xs text-gray-400`「未定」。

## データ
新しいテーブルは無い。00 ベンダーMTG・01 紹介案件・ベンダーの既存列を読むだけ。

`buildMeetingBrief` の入力（BriefInput）：
| 項目 | 型 | 取り元 |
|---|---|---|
| id | number | VendorMeeting.id |
| vendorName | string | Vendor.name |
| requestNote | string \| null | VendorMeeting.requestNote（依頼内容。「依頼:」「ピックアップ:」行を読む） |
| executionStatus | enum | VendorMeeting.executionStatus |
| scheduledAt | Date \| null | VendorMeeting.scheduledAt |
| place | string \| null | VendorMeeting.place（打ち合わせURL・場所） |
| schedulingUrl | string \| null | VendorMeeting.schedulingUrl（日程調整URL） |
| nextAction / nextActionDue | string \| null / Date \| null | VendorMeeting |
| minutes | string \| null | VendorMeeting.minutes（議事メモ） |
| fee | number \| null | VendorMeeting.fee（この依頼の単価） |
| vendorFee | number | Vendor.referralFee（既定 0） |
| saleshubUrl | string \| null | Vendor.saleshubUrl（セールスハブ由来。移植先では null でよい） |
| assigneeName | string | 担当者名（空白の前＝姓を宛名に使う） |
| receivedCount | number | そのベンダーの紹介案件のうち status=RECEIVED の件数 |

`meetingTargets` の入力（紹介案件1件分）：`status`, `rewardAmount`(int), `rewardUndetermined`(bool), `vendorApproval?`, `contactApproval?`（PENDING/OK/NG）, `contact.company`, `contact.name`。

出力 `MeetingTarget = { name: string; amount: number | null; declined?: boolean }`（amount null＝単価未定）。

関係する enum：ExecutionStatus（SCHEDULING=日程調整中、CONFIRMED=確定、DONE=実施済、RESCHEDULE=リスケ、CANCELLED=キャンセル、NO_MEETING=初回MTGなし）、VendorApproval（PENDING=確認待ち、OK=先方OK、NG=先方NG）。

SQLite 用の追加 DDL は無い（00・01 のテーブルをそのまま使う。日時は 00・01 と同じく TEXT＝ISO 8601 UTC。文面に入れる前に `new Date()` に戻す）。

## 決まり（ロジック）

### meetingTargets(requestNote, referrals, proposed = [], requestFee = null) — `src/lib/meeting-targets.ts`
お繋ぎ先の決め方（優先順）：
1. そのベンダーの紹介案件があれば、それを使う。
   - 見送り判定 `isDeclined`：`status === "DECLINED"` または `vendorApproval === "NG"` または `contactApproval === "NG"`。
   - まず見送りでない案件を、名前＝`contact.company ?? contact.name` で重複除去しながら `{name, amount: rewardUndetermined ? null : rewardAmount}` で追加。
   - 次に見送り案件を（まだ出ていない名前だけ）`{name, amount: 0, declined: true}` で**最後に**追加。
   - 1件でもあればここで返す。
2. 紹介案件が無ければ、`proposed`（セールスハブで提示した会社名。セールスハブ由来なので移植先では空配列）を使う。
3. それも空なら、requestNote の「ピックアップ」で始まる行から拾う：`^ピックアップ[^:：]*[:：]\s*` を消し、`、` か `,` で分け、各要素の ` /...` 以降を消して trim。
4. 2・3 の会社は `{name, amount: requestFee}`。ただし見送り済みの会社（会社名から「株式会社」と空白を除いて比較）と重複は除く。

### formatTargetsTotal(targets, fallbackFee)
- お繋ぎ先0件：fallbackFee があれば `¥{fallbackFee}`、無ければ `-`。
- それ以外：`fixed` = amount が null でないものの合計（見送りは 0 なので**合計に入らない**）。
  - fixed=0 かつ未定あり → `未定`
  - それ以外 → `¥{fixed}`、未定があれば末尾に `＋未定分`（全部見送りなら `¥0`）。
- 金額は `toLocaleString()`（3桁カンマ）。

### formatTargetAmount(amount)
null → `未定`、それ以外 → `¥{amount}`。

### compactTargets(targets, maxDeclined = 3)
`shown` = 見送りでないもの全部 ＋ 見送りの先頭 maxDeclined 件、`hiddenDeclined` = 残りの見送り件数。

### buildMeetingBrief(m, targets, { greeting }) — `src/lib/line-brief.ts`
文面の組み立て（行の順）：
```
{姓}さん                      ← greeting=true の時だけ（＋空行）
■ {ベンダー名}
依頼：{依頼タイトル}           ← requestNote に「依頼:」「依頼：」行がある時だけ
状態：{状態ラベル}（{日時}）    ← 日時は scheduledAt があり、かつ SCHEDULING 以外の時だけ
（空行）
▼次にやること
1. …
2. …
（空行）
▼お繋ぎ先・単価
・{会社}（¥金額 / 未定 / 見送り・¥0）
合計：{formatTargetsTotal(targets, fee ?? vendorFee)}
（空行）
セールスハブ：{URL}            ← requestNote 内の saleshub.jp/proposals/数字、無ければ vendor.saleshubUrl（移植不要）
ツール：{APP_URL}/meetings/{id}
```
- 宛名・一括の宛名は `assigneeName.split(/\s/)[0]`（「山田 太郎」→「山田さん」）。
- `due` = nextActionDue があれば「（期限 yyyy/MM/dd(E)）」。

「次にやること」（状態ごと。番号は 1. から順に振る）：
| 状態 | 追加される行 |
|---|---|
| SCHEDULING / RESCHEDULE | schedulingUrl が http(s) なら「日程調整：下記URLから候補日を予約して、セールスハブで日時を返信{due}」＋改行＋3字下げで URL。無ければ「日程調整：ベンダーと事前MTGの日程を調整して、セールスハブで返信{due}」 |
| CONFIRMED | 「事前MTG実施：{日時 or 日時未定}」＋ place が URL なら改行＋3字下げで URL、URL でない場所なら「（場所）」。**place が空なら「打ち合わせURLが未登録：届いた会議URLをツールのベンダーMTG一覧に入力」**。続けて「MTGで確認：お繋ぎ先がターゲットか／単価（協力金）／紹介の進め方」 |
| DONE | minutes が空なら「議事メモをツールに入力（繋げる人物・単価の確認結果）」。receivedCount>0 なら「お繋ぎ先 N 件に打診する」 |
| CANCELLED | 「このMTGはキャンセル済み（対応不要）」 |
| NO_MEETING | 「初回MTGなし：ベンダーの確認結果を待ち、OKならお繋ぎ先へ打診」。receivedCount>0 なら「ピックアップ受付のお繋ぎ先 N 件を打診中へ進める」 |

状態に関係なく続けて追加：
- amount=null のお繋ぎ先があれば「単価確認：{会社、会社} の単価をベンダーに確認」。
- `fee === null` かつ `vendorFee === 0` かつ 全お繋ぎ先の amount が null か 0 → 「単価確認：この依頼の協力金が未登録。金額を確認して共有」。
- 全お繋ぎ先が見送り（**お繋ぎ先0件でも `every` は true なので出る**）→「お繋ぎ先が未定：繋げる人物をベンダーと相談」。
- nextAction があり、自動文言と重なる書き出し（`日程調整URLから` / `ベンダーと日程調整` / `MTGを実施し`）でなければ「{nextAction}{due}」。

「お繋ぎ先・単価」：
- お繋ぎ先あり：見送りは「・{会社}（見送り・¥0）」、それ以外は `formatTargetAmount`。最後に「合計：…」。
- 0件：「・未定（依頼の協力金 ¥{fee}）」。fee が null なら vendorFee（0 でなければ）、どちらも無ければ「未登録」。

### buildBulkBrief(assigneeName, briefs)
- assigneeName があれば先頭に「{姓}さん」「対応をお願いしたい案件が N 件あります。」空行。
- 各案件の文面（greeting なしで作ったもの）を `\n\n――――――――――\n\n` でつなぐ。

### 一覧の一括コピーの対象（meetings/page.tsx）
- 今の絞り込み・並び（確定 → 日程調整中 → 実施済 → リスケ → 初回MTGなし・キャンセル）で表示中の MTG から、次を除く：CANCELLED、NO_MEETING、DONE かつ議事メモあり かつ そのベンダーに RECEIVED の紹介が無いもの。
- 対象の担当者が1人だけなら宛名あり、複数なら宛名なし。
- 各案件の文面は `buildMeetingBrief(..., { greeting: false })`、個別ボタンは `{ greeting: true }`。

### コピー処理（copyText）
`navigator.clipboard.writeText` を試し、失敗したら（非HTTPS・古いブラウザ）画面外の textarea を作って `document.execCommand("copy")`。成功した時だけ「✓ コピーしました」にする。

### 注意（今のコードの差）
- 一覧ページは紹介案件を `select: { status, rewardAmount, rewardUndetermined, contact }` で取っており、**vendorApproval / contactApproval を取っていない**。NG にすると多くの場合 status が DECLINED に変わる（00/01 の NG 処理）ので一覧でも見送りになるが、面談実施済のまま NG になった案件は一覧では見送りにならず、詳細では見送りになる。移植では一覧でも両方の回答列を SELECT して揃える。

## 参照コード
- `src/lib/meeting-targets.ts`：`MeetingTarget`, `meetingTargets`, `formatTargetsTotal`, `formatTargetAmount`, `targetBadgeClass`, `compactTargets`
- `src/lib/line-brief.ts`：`BriefInput`, `buildMeetingBrief`, `buildBulkBrief`, `requestTitle`, `saleshubLink`, `appUrl`
- `src/components/CopyBrief.tsx`：`copyText`, `CopyBriefButton`, `CopyBriefPanel`
- `src/app/(app)/meetings/page.tsx`：`targetsOf`, `briefOf`, `openMeetings`, `bulkBrief`、各表示の `<CopyBriefButton>`、お繋ぎ先バッジ
- `src/app/(app)/meetings/[id]/page.tsx`：`brief`, `taskHref`, `<CopyBriefPanel>`、お繋ぎ先・合計単価の表示
- `src/lib/labels.ts`：`EXECUTION_LABEL`／`src/lib/utils.ts`：`fmtDate`, `fmtDateTime`
- `src/lib/saleshub/proposed.ts`：`proposedCompaniesByVendor`（セールスハブ由来なので移植不要。proposed は [] を渡す）

## 移植のポイント
- **そのままコピーしてよい純粋関数**：`src/lib/meeting-targets.ts`（依存なし）と `src/lib/line-brief.ts`（依存は `meeting-targets`・`labels` の `EXECUTION_LABEL`・`utils` の `fmtDate/fmtDateTime`＝date-fns と ja ロケール、`process.env.APP_URL` だけ）。`import type { ExecutionStatus } from "@prisma/client"` は文字列リテラル union 型に置き換える。
- `src/components/CopyBrief.tsx` もクライアントコンポーネントで DB 非依存なので流用できる（`cn` と `btn-*` クラスだけ行き先に合わせる）。
- セールスハブ由来の部分：`saleshubLink`（saleshub.jp の URL 抽出と `vendor.saleshubUrl`）と `proposed` 引数は移植不要。文言中の「セールスハブで返信」は行き先の運用に合わせて言い換えてよい（例「ベンダーに日時を返信」）。
- better-sqlite3 で文面を作る時は、日時列（TEXT ISO）を `new Date()` に戻してから渡す（`fmtDateTime` は Date も文字列も受けるが、`scheduledAt` の有無判定と型を揃えるため）。
- 一覧で N 件分の文面をサーバーで全部作って props に埋めている（クリック時に API を叩かない）。件数上限は一覧の 500 件。行き先でも同じでよい。Route Handler 方式にするなら `GET /api/meetings/{id}/brief` と `GET /api/meetings/brief?…絞り込み` で文字列を返す形にもできる。
- 紹介案件の取得では `status, reward_amount, reward_undetermined, vendor_approval, contact_approval, contacts.company, contacts.name` をベンダーごとにまとめて取る（`WHERE vendor_id IN (...)` 1本で取って JS でグループ化）。
- `requestFee` には `m.fee ?? vendor.referralFee` を渡す（一覧・詳細とも同じ）。
- 「LINEで送る」は LINE の共有 URL を開くだけで、05 の Messaging API は使わない（LINE 連携していなくても使える）。
- クリップボード API は HTTPS（または localhost）でないと失敗するので、フォールバックを残す。

## 依存
- 00 ベンダーMTG（文面の元データ、一覧・詳細の置き場所）
- 01 紹介案件（先方・人事OK）（お繋ぎ先と単価、RECEIVED の件数、見送り・NG の判定）
- 02 ベンダー詳細・単価表（Vendor.referralFee。NG で紹介見送りにする処理は vendors/actions.ts の setVendorApprovalAction）
- 04 タスク（チャット・添付）（詳細の「この内容でタスク依頼」。無ければ taskHref を渡さない）
- 05 通知・LINE連携は不要（共有 URL 方式のため）

## 動作確認チェックリスト
- [ ] 日程調整中で日程調整URLがある MTG：「日程調整：下記URLから…」と URL が字下げで入る。状態行に日時が付かない
- [ ] 確定で打ち合わせURLが空：「打ち合わせURLが未登録」の行が出る。URL がある時は URL が字下げで入る
- [ ] 実施済で議事メモ空・ピックアップ受付2件：「議事メモをツールに入力」「お繋ぎ先 2 件に打診する」
- [ ] キャンセル・初回MTGなしの文言が出る
- [ ] 単価未定の紹介があると「単価確認：{会社} の単価を…」と、バッジが黄色・合計が「¥N＋未定分」か「未定」
- [ ] 紹介見送り／先方NG／人事NG の会社が最後に「（見送り・¥0）」で残り、合計に入らない。バッジはグレー＋取り消し線
- [ ] 見送り済みの会社は「ピックアップ:」行から拾う時にも出ない（「株式会社」・空白の有無が違っても）
- [ ] 全部見送り（またはお繋ぎ先0件）で「お繋ぎ先が未定：繋げる人物をベンダーと相談」
- [ ] fee も vendorFee も無い時「この依頼の協力金が未登録」
- [ ] nextAction が「日程調整URLから…」で始まる時は重複して出ない。それ以外は期限付きで出る
- [ ] 見送りが5社ある一覧行で、3社＋「ほか見送り 2社」になる
- [ ] 「LINE用コピー」を押すと文面がクリップボードに入り、1.8秒「✓ コピーしました」。行のリンクに飛ばない
- [ ] 一括コピー：担当者で絞ると宛名「◯◯さん／対応をお願いしたい案件が N 件あります。」、絞らないと宛名なし。区切り線で分かれる
- [ ] 一括の対象から キャンセル・初回MTGなし・（実施済＋メモあり＋受付0件）が外れる。対象0件でボタンが消える
- [ ] 詳細パネルで書き換え → 「元に戻す」が出て戻せる。「LINEで送る」で LINE の共有画面が開く
- [ ] 文面末尾の「ツール：」が APP_URL 付きの絶対URLになる（未設定なら相対パス）
- [ ] http（非HTTPS）環境でもコピーできる（フォールバック）
