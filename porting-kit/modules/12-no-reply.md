# 12. 返信なしのグレーアウト

> 一言で：返信が返ってこない人事に「返信なし」を付けると、繋がりリスト・候補ピッカー・ベンダーのチェックリストでグレーアウトし、一番下に並ぶ。

## できること（使う人の目線）

- 繋がり（人事）の詳細の「操作」で「返信なしにする」／「返信ありに戻す」。付けた日も残る。
- 繋がりリスト：返信なしの行はグレー（`bg-gray-100 opacity-60`）＋「返信なし」バッジで、一番下に並ぶ。「返信なしを隠す」で非表示にもできる。
- 候補ピッカー（11）：既定で隠す。外すとグレーで最後に出る。
- ベンダー詳細の「提案した人事」：会社名の横に「返信なし」バッジ。

## 画面と操作

- 繋がり詳細（referral-hub：`/contacts/[id]`）：「操作」カードの上段に `btn-secondary btn-sm`「返信なしにする」。下に説明文。付いているときは「YYYY/MM/DD から返信なし。一覧と候補でグレーアウトしています」、ページの説明の末尾に「（返信なし）」。
- 繋がりリスト（`/contacts`）：絞り込みに「返信なしを隠す」（`?noreply=hide`）。
- バッジ：`badge bg-gray-200 text-gray-600 border-gray-300`。

## データ

| 列 | 型 | 既定 | 意味 |
|---|---|---|---|
| contacts.no_reply | boolean | false | 返信が返ってこない |
| contacts.no_reply_at | datetime | NULL | 付けた日時（外すと NULL） |

```sql
ALTER TABLE contacts ADD COLUMN no_reply INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contacts ADD COLUMN no_reply_at TEXT; -- ISO 8601
```

## 決まり（ロジック）

- 切り替えは誰でもできる（管理者に限らない）。付けたら `no_reply_at = 今`、外したら NULL。
- 並びは元の並び順を保ったまま、返信なしだけ最後へ（安定ソート）。
- 紹介案件のステータスや回答（01・02）は変えない。見た目と並びだけ。
- 切り替え後は繋がりリスト・繋がり詳細・ベンダー画面を再描画する。

## 参照コード

- `prisma/schema.prisma`：`Contact.noReply`・`noReplyAt`
- `src/app/(app)/contacts/actions.ts`：`toggleNoReplyAction`
- `src/app/(app)/contacts/[id]/page.tsx`：操作ボタン・説明
- `src/app/(app)/contacts/page.tsx`：`noreply` の絞り込み、並び（`sorted`）、行の色とバッジ
- `src/app/(app)/vendors/[id]/ProposePicker.tsx`：「返信なしを隠す」、行のグレー
- `src/app/(app)/vendors/[id]/page.tsx`：チェックリストのバッジ

## 移植のポイント

- 列を2つ足すだけ。画面側は「行のクラス」と「並び」の2か所を足す。
- 「返信なし」を自動で付けたい場合（例：打診から○日返信がない）は、05 の定期処理に足すとよい（今は手動）。

## 依存

- 03 繋がりリスト。11 候補ピックアップと 02 ベンダー詳細の表示が使う。

## 動作確認チェックリスト

- [ ] 繋がり詳細で「返信なしにする」→ 一覧でグレー・一番下・バッジ
- [ ] 「返信なしを隠す」で消える
- [ ] 候補ピッカーで既定で隠れ、チェックを外すとグレーで出る
- [ ] 「返信ありに戻す」で元に戻る
