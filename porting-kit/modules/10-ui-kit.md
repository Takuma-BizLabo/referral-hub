# 10. 画面のデザイン一式（UI部品）

> 一言で：濃紺のサイドバー＋薄いグレー背景＋白いカードの業務画面を作るための、Tailwind v4 の部品クラスと React 部品一式。状態ごとの色分け、その場編集、送信中表示、エラーで入力が消えない仕組み、デプロイ後の自動再読み込みまで含む。

## できること（使う人の目線）

- どの画面も同じ見た目：左に濃紺のメニュー、上にページ名と主ボタン、中身は白いカード。スマホでは上部バー＋ハンバーガーで引き出すメニュー。
- 状態（承認待ち・確定・実施済など）はいつも同じ色のバッジで出る。一覧の行も状態で背景色が変わり、終わった・止まった行はグレーアウトする。
- 一覧のドロップダウンを変えるだけで状態が保存される（送信中はくるくる表示）。
- 日時・金額・URL などは一覧のセルをクリックしてその場で入力・変更できる（Enter で保存、Esc で取消）。
- ボタンは押すと「処理中...」になり二重送信できない。削除などは確認ダイアログを出せる。
- 操作の成功・失敗は画面上部の緑／赤の帯で出る（× で閉じる）。フォームのエラーはフォームの上に出て、入力内容は消えない。
- ツールを更新した直後の古い画面で操作しても、自動で1回だけ再読み込みして案内を出す。
- 絞り込みはスマホで折りたたみ。件数つきのチップで状態・ベンダーをワンタップで絞れる。

## 画面と操作

### 全体レイアウト（`Shell`）

- ルート：`min-h-screen flex`。`<html lang="ja">`、`body` は `antialiased min-h-screen`、`viewport.themeColor = #1b2338`。
- PC サイドバー：`<aside class="hidden md:block w-60 shrink-0 bg-sidebar sticky top-0 h-screen">`。中身は縦に
  1. ロゴ：`w-9 h-9 rounded-lg bg-primary` に白の太字1文字、横にアプリ名（`font-bold`）と小さな説明（`text-[11px] text-gray-400`）。
  2. 主ボタン2つ：`grid grid-cols-2 gap-2` に `btn-primary py-2.5 text-xs`（「+ MTG登録」「+ 紹介案件」）。
  3. ナビ：`nav-link`（アイコン16px＋ラベル）。現在地は `nav-link-active`（`bg-primary text-white font-semibold`）。判定は `pathname.startsWith(href)`、ダッシュボードだけ完全一致。
  4. タスクは先頭固定。未完了があれば非選択時も `bg-rose-500/15 text-white font-semibold` で目立たせ、右端に赤い丸バッジ（`ml-auto min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold`）で件数。
  5. 管理者だけ：見出し「🔒 管理者だけ」（`px-3 pt-4 pb-1 text-[11px] text-gray-400`）の下に承認キュー・目標設定。
  6. 設定（`mt-2`）。
  7. 下部：`border-t border-white/10` に氏名（`font-bold`）＋役割バッジ（管理者 `bg-amber-400/20 text-amber-200`、他 `bg-white/10 text-gray-200`、`border-0 text-[10px]`）、ログインID（`font-mono`）と「ログアウト」。
- アイコンは SVG パス文字列の辞書（stroke 2、round）。外部アイコンライブラリは使わない。
- スマホ：`md:hidden sticky top-0 z-30 h-12 bg-sidebar text-white` の上部バー（ハンバーガー、アプリ名、右に通知ベル）。メニューは `fixed inset-0 z-40` のドロワー：背景 `bg-black/40`（タップで閉じる）、本体 `w-72 max-w-[85vw] h-dvh bg-sidebar shadow-xl`、右上に ×。画面遷移・Esc で閉じ、開いている間は `body` のスクロールを止める。
- 本文：`<main class="flex-1 px-4 md:px-6 pb-8 pt-3 md:-mt-8 max-w-[1400px] w-full">`。先頭に `FlashBanner`（`Suspense` で包む）。PC は右上に通知ベル（`md:flex justify-end px-6 pt-4`、本文を `-mt-8` で持ち上げてページ見出しと同じ高さに並べる）。

### ページの型

- `PageHeader`：左に `h1 text-xl font-semibold text-gray-900`＋説明 `text-sm text-gray-500 mt-0.5`、右に操作ボタン群（`flex flex-wrap gap-2`）。`mb-4`。主ボタンは右端に `btn-primary`、補助は `btn-secondary`。
- 中身は `space-y-4` でカードを縦に積む。2列は `grid gap-4 lg:grid-cols-2`、詳細画面は `lg:grid-cols-3`（左2列＝情報、右1列＝操作カード）。
- 一覧画面の並び：PageHeader → `Tabs`（表示切替）→ `VendorChips`／`CountChips` → `FilterPanel`（中に `form.card p-3 mb-3 flex flex-wrap gap-2 items-end`、最後に「絞り込む」「クリア」）→ 一覧。

### 一覧のレスポンシブ（PC はテーブル、スマホはカード）

```
<ul class="md:hidden space-y-2">  … <li class="card p-3 {行の色}"> …
<div class="card overflow-x-auto hidden md:block"><table class="table"> …
```

- スマホカード：上段 `flex items-start justify-between gap-2`（左にベンダータグ＋主情報 `min-w-0`、右に金額やバッジ）、中段 `text-xs text-gray-500` の補足、下段 `mt-2 flex items-center justify-between` に操作（StatusSelect など）。
- テーブル：日付・金額・名前は `whitespace-nowrap`、金額は `text-right`、長文は `max-w-xs truncate`。
- 見出しを短くする：`<span class="md:hidden">計上</span><span class="hidden md:inline">計上ベース（承認月）</span>`。
- カンバン：`grid gap-3 md:grid-cols-3 xl:grid-cols-6 overflow-x-auto`、列は `card bg-gray-50 min-w-56`（見出しに Badge と件数）、カードは `card p-2.5 text-sm shadow-sm`。
- 横スクロールのチップ列：`flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible md:pb-0`（スマホは画面端まで横スクロール、PC は折り返し）。
- グリッドの子は `min-width: 0`（globals.css の base）。これが無いとスマホでカードがはみ出す。

### 状態の色（全画面共通の約束）

`Badge`／`CountChips` の色は `STATUS_COLOR`（`src/lib/labels.ts`）。キーは enum の値（異なる enum で同じ値は同じ色）。該当なしは `bg-gray-100 text-gray-700 border-gray-200`。

| 値 | 意味 | クラス |
|---|---|---|
| PENDING | 承認待ち | bg-amber-100 text-amber-800 border-amber-200 |
| APPROVED | 承認済 | bg-emerald-100 text-emerald-800 border-emerald-200 |
| REJECTED | 差し戻し（「遅延」バッジにも流用） | bg-rose-100 text-rose-800 border-rose-200 |
| SCHEDULING | 日程調整中 | bg-slate-100 text-slate-700 border-slate-200 |
| CONFIRMED | 確定 | bg-sky-100 text-sky-800 border-sky-200 |
| DONE | 実施済 | bg-emerald-100 text-emerald-800 border-emerald-200 |
| RESCHEDULE | リスケ | bg-amber-100 text-amber-800 border-amber-200 |
| CANCELLED | キャンセル | bg-gray-200 text-gray-600 border-gray-300 |
| NO_MEETING | 初回MTGなし | bg-teal-50 text-teal-800 border-teal-200 |
| RECEIVED | ピックアップ受付 | bg-slate-100 text-slate-700 border-slate-200 |
| CONTACTING | 紹介先に打診中 | bg-sky-100 text-sky-800 border-sky-200 |
| MEETING_CONFIRMED | 面談確定 | bg-indigo-100 text-indigo-800 border-indigo-200 |
| MEETING_DONE | 面談実施済 | bg-emerald-100 text-emerald-800 border-emerald-200 |
| DECLINED | 紹介見送り | bg-gray-200 text-gray-600 border-gray-300 |
| UNFIXED / APPLIED / INVOICED / PAID | 報酬 | slate / amber / sky / emerald（各 -100 / -800 / -200） |
| NOT_DONE / NOT_REQUIRED | ベンダーMTG状態 | slate / bg-teal-50 text-teal-800 border-teal-200 |

一覧の**行の背景**（`rowTone`）：

| 画面 | 状態 | クラス |
|---|---|---|
| ベンダーMTG | CONFIRMED 確定 | bg-sky-50 |
| ベンダーMTG | SCHEDULING 日程調整中 | bg-yellow-50 |
| ベンダーMTG | DONE 実施済 | bg-pink-50 |
| ベンダーMTG | NO_MEETING / CANCELLED | bg-gray-100 opacity-60 |
| ベンダーMTG | RESCHEDULE | なし |
| 紹介案件 | DECLINED 紹介見送り | bg-gray-100 opacity-60 |
| 紹介案件 | SCHEDULING 日程調整中 | bg-yellow-50 |

その他の色の約束：

- 注意（期限超過・遅延）：文字 `text-rose-600 font-medium`、カード枠 `border-rose-300`。停滞は `border-amber-300`。
- 未定の金額：`text-amber-700`（「未定」表示）。
- 見送りのお繋ぎ先：`bg-gray-100 text-gray-400 border-gray-200 line-through`、未定 `bg-amber-50 text-amber-800 border-amber-200`、確定 `bg-indigo-50 text-indigo-800 border-indigo-200`。
- カレンダー・今日の商談：ベンダーMTG＝sky（`bg-sky-100 text-sky-900`）、紹介面談＝indigo（`bg-indigo-100 text-indigo-900`）、実施済は `opacity-60`。今日は `bg-blue-50/60`、日付丸 `bg-blue-600 text-white`。日曜 `text-rose-500`、土曜 `text-blue-500`。
- 先方/人事の回答：OK＝emerald、NG＝rose、確認待ち＝gray。
- 警告ボックス：`rounded border border-rose-200 bg-rose-50 text-rose-800`（差し戻し）、`border-amber-200 bg-amber-50 text-amber-700/900`（注意）、`rounded-xl border-2 border-blue-200 bg-blue-50/60`（次のステップの案内）。

### ベンダーの識別色（`VendorTag`／`VendorChips`）

- `vendorColor(id)` ＝ `PALETTE[id % 10]`。順に teal-600 / blue-600 / amber-500 / rose-600 / violet-600 / lime-600 / orange-600 / cyan-600 / pink-600 / indigo-600（文字は白、`dot` は1段薄い -500／-400）。
- `VendorTag`：`inline-flex rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap {bg} {text}`。既定でベンダー詳細へのリンク（`link={false}` で無効。行全体がリンクのとき）。
- `VendorChips`：先頭「全案件 N」、各ベンダーは `chip` の中に色の丸（`w-2.5 h-2.5 rounded-full {dot}`）＋名前＋件数（`font-bold`）。選択中 `chip-active`。

## データ

テーブルなし。状態は URL で持つ：

| URL パラメータ | 意味 |
|---|---|
| `?error=…` | 赤い帯で表示するメッセージ（300字まで）。既知コード `forbidden` は「その画面・操作は管理者のみ利用できます。」に変換 |
| `?notice=…` | 緑の帯で表示するメッセージ |
| `returnTo`（フォームの hidden） | 操作後・エラー時に戻る画面（現在の URL から error/notice/blocked を除いたもの） |

ブラウザの `sessionStorage` に `rh:stale-reload-at`（最後に自動再読み込みした時刻 ms）を持つ。SQLite の CREATE TABLE は不要。

## 決まり（ロジック）

### globals.css（Tailwind v4）

- `@import "tailwindcss";` の後に `:root` で色を定義し、`@theme inline` で Tailwind の色名にする：`--background #f4f6fa`、`--foreground #1f2937`、`--sidebar #1b2338`、`--sidebar-hover #273050`、`--primary #2f5bff` → `bg-background`、`bg-sidebar`、`hover:bg-sidebar-hover`、`bg-primary`、`border-l-primary` が使える。
- `html { font-size: 15px }`。フォント：`-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, "Noto Sans JP", sans-serif`。
- `@layer base { .grid > * { min-width: 0 } }`。
- `@layer components` の部品クラス：

| クラス | 中身 |
|---|---|
| .btn-primary | `inline-flex items-center justify-center gap-1 rounded-lg border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary border-primary text-white hover:bg-blue-700 hover:border-blue-700` |
| .btn-secondary | 同じ土台 ＋ `bg-white border-gray-300 text-gray-800 hover:bg-gray-50` |
| .btn-danger | 同じ土台 ＋ `bg-white border-rose-300 text-rose-700 hover:bg-rose-50` |
| .btn-dark | 同じ土台（disabled なし）＋ `bg-gray-900 border-gray-900 text-white hover:bg-gray-800` |
| .btn-sm | `px-2.5 py-1 text-xs`（`btn-primary btn-sm` のように重ねる） |
| .input | `w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 disabled:bg-gray-100`（select・textarea にも使う） |
| .label | `block text-xs font-medium text-gray-600 mb-1` |
| .card | `bg-white border border-gray-200 rounded-xl` |
| .table | `w-full text-sm`。th：`text-left text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200 px-2 md:px-3 py-2.5 whitespace-nowrap`。td：`border-b border-gray-100 px-2 md:px-3 py-3 align-middle`。行ホバー `bg-blue-50/40` |
| .badge | `inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap`（色は別クラスで足す） |
| .chip / .chip-active | `inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 whitespace-nowrap` ／ `bg-gray-900 border-gray-900 text-white` |
| .nav-link / .nav-link-active | `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-200 hover:bg-sidebar-hover` ／ `bg-primary text-white font-semibold hover:bg-primary` |
| .kpi | `px-4 py-3 border-r border-gray-200 last:border-r-0 min-w-28` |
| no-scrollbar | `@utility` で定義（スクロールバーを隠す） |

- **注意**：Tailwind v4 の `@apply` は自作の部品クラス（`.btn` など）を参照できない。だから `.btn-primary` などは土台のユーティリティを毎回書き並べている。`.btn` 単体も定義はあるが、部品側では使わない。

### `src/components/ui.tsx`

- `PageHeader({ title, description?, actions? })`：上記。
- `Card({ title?, actions?, className?, children })`：`section.card`。タイトルか actions があれば `header`（`flex items-center justify-between border-b border-gray-200 px-4 py-2.5`、`h2 text-sm font-semibold text-gray-800`）。本文 `p-4`。
- `Tabs({ items: {href,label,active}[] })`：リンクのタブ。`flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto no-scrollbar`、各 `px-3 py-2 text-sm border-b-2 -mb-px`、選択中 `border-blue-600 text-blue-700 font-medium`、他 `border-transparent text-gray-500 hover:text-gray-800`。状態は URL（`?view=` など）で持つ。
- `Field({ label, required?, hint?, className?, children })`：`label.label`＋必須なら赤い `*`（`text-rose-500`）＋ヒント `text-xs text-gray-400 mt-1`。
- `Badge({ value, label, className? })`：`badge` ＋ `STATUS_COLOR[value]`。
- `EmptyState({ message })`：`py-10 text-center text-sm text-gray-400`。
- `Description({ items: {label, value}[] })`：`dl grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm`、dt `text-xs text-gray-500`、dd `break-words whitespace-pre-wrap`、値が null/undefined なら「-」。
- `ErrorMessage` / `SuccessMessage`：`rounded-lg border px-3 py-2 text-sm`、赤（rose-200/50/700、`role="alert"`）／緑（emerald、`role="status"`）。message が空なら何も出さない。
- `Stat`、`ProgressBar`（09 参照）。

### `StatusSelect`（ドロップダウンを変えたら即保存）

- `form action={serverAction}` の中に hidden `id`、hidden `returnTo`（`ReturnToInput`）、任意の hidden（`extra`）、`select`。`onChange` で `form.requestSubmit()`。
- 送信中（`useFormStatus().pending`）は select を `disabled opacity-60`、横に回転アイコン（`w-3 h-3 rounded-full border-2 border-gray-300 border-t-primary animate-spin`）。
- 送信が終わったら（失敗して元の画面に戻った場合も）select の表示をサーバーの値に戻す。
- 既定クラス `input text-xs py-0.5 w-auto`。詳細画面では `className="input"` で幅いっぱい。`onClick` で伝播を止める（行クリックと干渉させない）。
- サーバー側は `runWithFlash` で包み、失敗時は `?error=` 付きで元の画面へ戻す。

### `SubmitButton`

- `type="submit"`、押下中は `disabled`＋`aria-busy`＋文言を `pendingText`（既定「処理中...」）に。
- `confirm="…"` を渡すと `window.confirm` で確認し、キャンセルなら送信しない。
- `pending` を渡すと（`useStickyAction` のフォーム）それを優先、無ければ `useFormStatus`。`disabled` も渡せる。既定クラス `btn-primary`。

### `InlineCell`（クリックでその場編集）

- props：`id`、`initial`（入力欄の初期値）、`display`（表示文字列。null なら未入力）、`emptyLabel`、`inputType`（`datetime-local` | `text`）、`save(id, value) => Promise<{ok, error?}>`、`align`、`format`（入力中の整形。金額の桁区切りなど）。
- 表示：値あり＝`group inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-white/70` に値＋薄い ✎（`text-gray-300 group-hover:text-gray-600`）、title「クリックして変更」。値なし＝点線ボタン `rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-700`「＋ {emptyLabel}」。
- 編集：`min-w-44` に `input text-xs py-1`（autoFocus）と「保存」（`btn-primary btn-sm`、保存中は「保存中...」）「取消」（`btn-secondary btn-sm`）。Enter で保存（**日本語変換中の Enter は無視**＝`isComposing`）、Esc で取消。text のときは `inputMode="numeric"`。
- 保存成功で閉じて `router.refresh()`。失敗はセルの下に `text-[11px] text-rose-600` でエラー、編集状態のまま。
- サーバー側（save 関数）は例外を投げず `{ ok:false, error }` を返す。空文字＝未入力（null）に戻す。
- 同じ形の URL 用セル（`MeetingPlaceCell`）は、URL ならリンク表示（`https://` を省いて `truncate`、別タブ）＋ ✎ ボタン、`javascript:` を拒否、500字まで。

### `CountChips`

- 先頭「{totalLabel} N」（選択なしのとき `bg-gray-900 text-white`、選択ありのとき `bg-white text-gray-700 border-gray-300`）、各状態は `badge px-2 py-1 ＋ STATUS_COLOR[value]`「ラベル 件数」、選択中は `ring-2 ring-gray-900`。リンクで絞り込む。

### `FilterPanel`

- スマホ：`md:hidden btn-secondary w-full mb-3 justify-between` の開閉ボタン「絞り込み（N件指定中）」＋ ▼/▲。指定中なら `border-blue-300 text-blue-800`。PC：常に表示（`md:block`）。

### フラッシュ（`runWithFlash` ＋ `FlashBanner`）

- `runWithFlash(formData, fn)`（サーバー側）：fn が例外 → `console.error` して「戻り先」に `?error=<日本語メッセージ>` を付けて redirect。fn が `{ notice }` を返したら `?notice=` 付きで redirect。`redirect()`／`notFound()` は素通し（`unstable_rethrow`）。
- 戻り先：フォームの `returnTo`（`/` で始まり `//` や `/\` で始まらないものだけ＝オープンリダイレクト防止）→ 無ければ同一ホストの Referer → 無ければ `/`。既存の error/notice は消してから付ける。
- 例外メッセージは `friendlyErrorMessage` で日本語化（DB の「見つからない」「重複」「接続できない」などを利用者向けの文に。それ以外は Error.message）。
- `FlashBanner`（クライアント）：`?error` があれば赤（`mb-3 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800`、見出し「エラー」）、`?notice` なら緑（emerald、見出し「完了」）。× で URL から error/notice を消す（`router.replace`、スクロールしない）。

### `useStickyAction`（フォームの入力をエラーで消さない）

- React 19 はフォームの action が終わると入力を初期値に戻すため、サーバーの入力エラーで入力が消える。これを避けるため `onSubmit` で `preventDefault` し、`new FormData(form, submitter)` を `startTransition(() => dispatch(fd))` で送る。
- 使い方：`const [state, action, pending, onSubmit] = useStickyAction(fn, undefined)` → `<form action={action} onSubmit={onSubmit}>`、`<SubmitButton pending={pending}>`、`<ErrorMessage message={state?.error}/>`、`<SuccessMessage message={state?.success}/>`。
- サーバー関数は `{ error?, success? }` を返す（例外は `errorState(e)` で包む）。
- 送信中は二重送信しない。
- サーバーに届かなかった場合も画面全体のエラーにせず、フォーム上にエラーを返す：
  - 古い画面（`UnrecognizedActionError`／"was not found on the server"）：「ツールが更新されたため送信できませんでした。入力内容を控えてから画面を再読み込み（Cmd+R）し、もう一度送信してください。」（入力が消えないよう**自動では再読み込みしない**）
  - その他（1MB超・通信エラーなど）：「送信できませんでした。入力内容や添付ファイルが大きすぎるか…」
  - redirect / notFound はそのまま投げ直す。

### `ErrorView`（error.tsx 共通）

- 古いデプロイの操作（`UnrecognizedActionError`、または message が "was not found on the server" / "older or newer deployment" / "Failed to find Server Action"）なら「ツールが新しくなりました」を出し、**自動で `location.reload()`**。ただし `sessionStorage['rh:stale-reload-at']` から 30 秒以内ならループ防止で再読み込みしない。
- DB 接続系（message に prisma/database/ECONNREFUSED/connect）は「データベースに接続できませんでした…」、それ以外は「予期しないエラーが発生しました…」。`digest` があれば「エラーID」を `font-mono text-[11px]` で。
- 見た目：`card max-w-lg p-6 text-center`、上に赤丸の「!」（`w-12 h-12 rounded-full bg-rose-50 text-rose-600`）、ボタン「再読み込み」（`btn-primary`、画面ごと再読み込み）「ダッシュボードへ」。`compact` でアプリ内（サイドバー付き）用の余白。
- `global-error.tsx` は CSS が読めない前提でインラインスタイル。404 は `NotFoundView`（灰色の大きな「404」＋主要画面へのボタン）。

### 日付・金額の表示（`src/lib/utils.ts`、date-fns ＋ ja ロケール）

| 関数 | 出力 |
|---|---|
| fmtDateTime(d) | `2026/10/15(水) 14:00`。null・不正は「-」 |
| fmtDate(d) | `2026/10/15(水)` |
| fmtMonthDay(d) | `10/15(水) 14:00` |
| fmtYen(n) | `¥40,000`（null は「-」） |
| fmtReward(n, undetermined) | 未定なら「未定」、他は fmtYen |
| toInputDateTime(d) | `<input type="datetime-local">` 用 `yyyy-MM-ddTHH:mm`（null は ""） |
| toInputDate(d) | `<input type="date">` 用 `yyyy-MM-dd` |
| parseDateTimeInput / parseDateInput | 入力文字列 → Date（空・不正は null） |
| str / num / int / money | フォーム値の整形（空→null、`, ¥ 空白` を除去、money は整数・0〜20億を検証） |
| cn(...) | falsy を除いてクラスを連結 |

金額入力は `MoneyInput`：表示は桁区切り（左に `¥`、`pl-7 text-right tabular-nums`）、全角数字も NFKC で受け付け、送信は hidden に数字だけ。

### 見た目の原則

- **地は薄いグレー、情報は白いカード、ナビは濃紺**。影はほぼ使わず、`border-gray-200` の細い枠と `rounded-xl`（カード）／`rounded-lg`（ボタン・入力）で区切る。
- **主役の色は1色（#2f5bff）だけ**。主ボタン・選択中ナビ・今日の印に限定。補助操作は白ボタン。
- **状態は色で即わかる**：同じ状態は全画面で同じ色。進行中＝寒色（sky/indigo）、注意＝amber、問題＝rose、完了＝emerald、終わった・止まった＝グレー＋`opacity-60`。行の背景は -50 の薄い色に留める。
- **文字は小さめ・階層ははっきり**：本文 `text-sm`、補足 `text-xs text-gray-500`、さらに薄い補足 `text-[11px] text-gray-400`、見出し `font-semibold`、数字は `text-2xl font-bold`。
- **画面遷移を減らす**：一覧から状態・日時・金額・URL をその場で変えられる。保存中の表示とエラーはその場に出す。
- **失敗しても入力を失わない、迷わせない**：エラーは日本語で、次に何をすればよいかまで書く。
- **スマホでも全部できる**：テーブルはカードに、絞り込みは折りたたみ、チップは横スクロール、ボタンは折り返し。
- **空のときも一言**：`EmptyState` で「該当する…はありません」。

## 参照コード

- `src/app/globals.css`：トークン、部品クラス、`.grid > *`、`no-scrollbar`
- `src/app/layout.tsx`：`metadata`、`viewport`
- `src/app/(app)/layout.tsx`：Shell に渡す未読数・未完了タスク数
- `src/components/Shell.tsx`：`I`（アイコン）、`NAV`、`ADMIN_NAV`、`Shell`
- `src/components/ui.tsx`：`PageHeader`、`Card`、`Badge`、`Field`、`EmptyState`、`ErrorMessage`、`SuccessMessage`、`Stat`、`ProgressBar`、`Tabs`、`Description`
- `src/components/StatusSelect.tsx`、`src/components/SubmitButton.tsx`、`src/components/ReturnTo.tsx`
- `src/components/InlineCell.tsx`、`src/app/(app)/meetings/MeetingPlaceCell.tsx`、`src/app/(app)/referrals/InlineCells.tsx`
- `src/components/VendorTag.tsx`（`VendorTag`、`VendorChips`）、`src/lib/colors.ts`（`vendorColor`）
- `src/components/CountChips.tsx`、`src/components/FilterPanel.tsx`、`src/components/MoneyInput.tsx`
- `src/components/FlashBanner.tsx`、`src/lib/flash.ts`（`runWithFlash`、`withFlashParam`、`backPath`、`safePath`）
- `src/lib/use-sticky-action.ts`、`src/lib/action-state.ts`、`src/lib/errors.ts`（`friendlyErrorMessage`、`ERROR_CODE_MESSAGE`）
- `src/components/ErrorView.tsx`、`src/app/error.tsx`、`src/app/(app)/error.tsx`、`src/app/global-error.tsx`、`src/components/NotFoundView.tsx`
- `src/lib/labels.ts`：`STATUS_COLOR` と各 `*_LABEL`
- `src/app/(app)/meetings/page.tsx`・`src/app/(app)/referrals/page.tsx`：`rowTone`、PC/スマホの出し分けの実例
- `src/lib/utils.ts`：日付・金額の関数

## 移植のポイント

- Tailwind v4 同士なので、`globals.css` の `:root`・`@theme inline`・`@layer components`・`@utility no-scrollbar` はほぼそのまま貼れる。BizLabo 側に同名クラス（`.card`、`.btn-primary`、`.input`、`.table` など）が既にあれば、衝突しないよう接頭辞（例 `.rh-card`）を付けるか、`/hr` 配下だけで読み込む CSS に分ける。自作クラスを `@apply` で参照しないこと（v4 では動かない）。
- 色名 `bg-primary`／`bg-sidebar` は `@theme inline` の登録が前提。既存のテーマ変数と名前がぶつかる場合はリネームする。
- **Route Handlers にする場合**：
  - `StatusSelect`：`requestSubmit` ではなく `fetch(POST)` → 成功で `router.refresh()`、失敗で `router.replace(?error=…)` か、その場にエラー表示。送信中の disabled とスピナー、失敗時に元の値へ戻す挙動は残す。
  - `runWithFlash` の代わりに、API は `{ error }`／`{ notice }` を JSON で返し、クライアントで `withFlashParam` 相当の URL にして `router.replace` する（`FlashBanner` はそのまま使える）。
  - `useStickyAction` の代わりに、制御フォーム（または `defaultValue` のまま `onSubmit` で `fetch`）にすれば入力は消えない。送信中フラグで二重送信を防ぐ。
  - `ErrorView` の古いデプロイ判定は Server Actions 特有。Route Handlers だけなら不要だが、Next 16 でも Server Actions を使う画面が残るなら残す。
- `InlineCell` は `save` を差し替えるだけで使える（`fetch` で `{ok, error}` を返す関数を渡す）。
- フォント・`html { font-size: 15px }` は全体に効くので、BizLabo 全体を変えたくなければ `/hr` のラッパー要素に限定する。
- **そのまま流用できる純粋関数・部品**：`src/lib/utils.ts`（`fmtDateTime`・`fmtDate`・`fmtMonthDay`・`fmtYen`・`fmtReward`・`toInputDateTime`・`toInputDate`・`parse*`・`str`・`num`・`int`・`money`・`cn`・`httpUrl`・`safeLinkUrl`）、`src/lib/colors.ts`、`src/lib/labels.ts` の `STATUS_COLOR`、`src/lib/errors.ts`（Prisma 部分は better-sqlite3 の `SQLITE_CONSTRAINT_UNIQUE` などに読み替え）、`src/lib/flash.ts` の `withFlashParam`・`safePath`。React 部品では `ui.tsx`・`SubmitButton`・`InlineCell`・`VendorTag`・`CountChips`・`FilterPanel`・`FlashBanner`・`MoneyInput` が Next の `Link`/`useRouter` 以外に依存しない。

## 依存

なし（ほかの全モジュールの土台）。

## 動作確認チェックリスト

- [ ] PC で左に濃紺サイドバー、現在地が青く塗られる。管理者だけ「🔒 管理者だけ」の下に承認キュー・目標設定が出る
- [ ] 未完了タスクがあるとサイドバーの「タスク」が赤く目立ち、件数バッジが出る
- [ ] スマホ幅で上部バーとハンバーガーが出て、ドロワーが開く。背景タップ・Esc・画面遷移で閉じ、開いている間は背面がスクロールしない
- [ ] ボタン・入力欄・カード・テーブル・バッジ・チップが referral-hub と同じ見た目になる（角丸・枠線・文字サイズ）
- [ ] 状態バッジの色が表のとおり。ベンダーMTGの行が 確定＝薄い青、日程調整中＝薄い黄、実施済＝薄いピンク、キャンセル・初回MTGなし＝グレーアウトになる
- [ ] 一覧のドロップダウンを変えると保存され、送信中はスピナーが出て操作できない。失敗すると赤い帯が出て、ドロップダウンが元の値に戻る
- [ ] InlineCell：クリック → 入力 → Enter で保存。日本語変換確定の Enter では保存されない。Esc で元に戻る。エラーはセルの下に出る
- [ ] SubmitButton を連打しても1回しか送信されない。confirm 付きはキャンセルで送信されない
- [ ] サーバー側の入力エラーでフォームの入力内容が消えない
- [ ] `?error=forbidden` で「その画面・操作は管理者のみ利用できます。」が出て、× で URL から消える
- [ ] デプロイ後、古い画面でボタンを押すと自動で1回だけ再読み込みされ、30秒以内に再発しても無限ループしない
- [ ] スマホ幅で一覧がカード表示になり、横にはみ出さない。チップ列は横スクロールできる
- [ ] 絞り込みフォームがスマホで折りたたまれ、指定中の件数がボタンに出る
- [ ] 日付が `2026/10/15(水) 14:00` 形式で、金額が `¥40,000` 形式で出る。未定は「未定」（黄色）
