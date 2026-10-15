# 13. 謝礼金の人事別計算

> 一言で：紹介案件ごとに入れた謝礼金（紹介先＝人事へのお礼）を、人事ごとに合計して見せる。

## できること（使う人の目線）

- 紹介案件の一覧で謝礼金を入力（01 のその場編集）。
- 繋がりリストの「謝礼金」列に、その人事の合計と件数（例：¥15,000（1件））。
- 繋がり詳細の「紹介履歴」に、案件ごとの謝礼金の列と、見出し右に「謝礼金の合計 ¥◯（◯件・紹介見送りを除く）」。
- 報酬管理に「人事ごとの謝礼金（◯人・合計 ¥◯）」の表：人事・ベンダー・件数・うち面談実施済の額・合計。合計の多い順。

## 画面と操作

- 繋がりリスト（referral-hub：`/contacts`）：列「謝礼金」（右寄せ）。無ければ「-」。
- 繋がり詳細（`/contacts/[id]`）：紹介履歴の表に「謝礼金」列、カード右上に合計。
- 報酬管理（`/rewards`）：月次集計の上に「人事ごとの謝礼金」カード。人事名は繋がり詳細へのリンク。空なら「謝礼金が入っている紹介案件はまだありません…」。

## データ

- 01 の `referrals.thank_you_fee`（整数・NULL＝未入力）をそのまま使う。新しい列は不要。

## 決まり（ロジック）

- 合計の対象：`thank_you_fee > 0` かつ `status != 'DECLINED'`（紹介見送りは数えない）。
- 「うち面談実施済」：その中で `status = 'MEETING_DONE'` の分の合計（実際に払う見込みが高い額）。
- 件数：対象になった紹介案件の数。
- 報酬管理の表は合計の降順。ベンダーは重複なしで「、」区切り。

## 参照コード

- `src/lib/thank-you.ts`：`thankYouTotal`（**純粋関数。そのまま流用可**）
- `src/app/(app)/contacts/page.tsx`：`thankYouText`（一覧の列）
- `src/app/(app)/contacts/[id]/page.tsx`：紹介履歴の列と合計
- `src/app/(app)/rewards/page.tsx`：「人事ごとの謝礼金」（`thankRows` → `byContact` → `thankList`）
- `src/app/(app)/referrals/InlineCells.tsx`：謝礼金のその場編集（01）

## 移植のポイント

- 集計は SQL の GROUP BY でもよい：
  ```sql
  SELECT contact_id, SUM(thank_you_fee) AS total, COUNT(*) AS cnt,
         SUM(CASE WHEN status = 'MEETING_DONE' THEN thank_you_fee ELSE 0 END) AS done
  FROM referrals
  WHERE thank_you_fee > 0 AND status != 'DECLINED'
  GROUP BY contact_id ORDER BY total DESC;
  ```
- 今は「入力された謝礼金の合計」。報酬の◯%などで自動計算したい場合は、謝礼金の入力時の既定値として足す（合計の仕組みはそのまま使える）。

## 依存

- 01 紹介案件（謝礼金の入力）、03 繋がりリスト、08 報酬管理（表の置き場所）

## 動作確認チェックリスト

- [ ] 紹介案件で謝礼金を入れると、繋がりリストの列に合計と件数が出る
- [ ] 紹介見送りにした案件の謝礼金は合計から外れる
- [ ] 報酬管理の表で、面談実施済の分と合計が分かれて出る
