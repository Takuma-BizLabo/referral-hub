# LINE公式アカウントで通知を送る仕組み（作り方の共有）

紹介案件管理ツール（referral-hub）で作った「ツール内通知＋LINE公式アカウントからの通知」の作り方です。株式会社BizLabo 用に、別のコードで同じ仕組みを作るために書いています。

- 前提の技術：Next.js（App Router・Server Actions）＋ Prisma ＋ PostgreSQL、Railway で常駐稼働
- 別の技術でも、考え方とAPIの呼び方はそのまま使えます
- 参照元のコード：`~/Downloads/referral-hub` の `src/lib/line.ts`・`src/lib/notifications.ts`・`src/app/api/line/webhook/route.ts`・`src/app/(app)/settings/line/`・`src/lib/cron/`

---

## 1. 全体像

```
[アプリの出来事]（MTG確定・タスク依頼・期限など）
        │  notify({ userId, type, title, body, linkUrl, dedupeKey })
        ▼
[Notification テーブル]（ツール内のベル・通知一覧）
        │  種類ごとに「LINEにも送る」が ON のときだけ
        ▼
[LINE Messaging API  push]  →  本人のLINEトークに届く

[5分おきのタイマー]（サーバー常駐）→ runReminders() → 前日・1時間前・期限などを判定して notify()

[ユーザーの紐付け]  ツールで6桁コード発行 → 公式アカウントのトークにコードを送る
        → Webhook でコードを受け取り、LINEの userId をユーザーに保存
```

ポイント：

- 通知は必ず「まずツール内に作る → 条件を満たせばLINEにも送る」の順。LINEが失敗しても通知はツールに残る。
- 公式アカウントは全員で1つを共有。誰に送るかは、ユーザーごとに保存した LINE の userId で決める。
- 同じ通知が二重に届かないよう、`dedupeKey`（一意キー）で1回だけ作る。

---

## 2. LINE側の準備（1回だけ）

1. LINE Official Account Manager で公式アカウントを作る（例：「BizLabo 通知」）。
2. 公式アカウントの「設定 → Messaging API」で Messaging API を有効にする（プロバイダーを選ぶ／作る）。
3. LINE Developers コンソール（https://developers.line.biz/console/ ）で、そのチャネルを開く。
   - 「Messaging API設定」タブ
     - **チャネルアクセストークン（長期）** を発行 → 環境変数 `LINE_CHANNEL_ACCESS_TOKEN`
     - **Webhook URL** に `https://（アプリのURL）/api/line/webhook` を入れる → **Webhookの利用：ON** → 「検証」で成功を確認
     - **応答メッセージ：OFF**（LINE側の自動返信を止める。止めないと、連携コードを送ったときに定型文も返ってしまう）
   - 「チャネル基本設定」タブ
     - **チャネルシークレット** → 環境変数 `LINE_CHANNEL_SECRET`
4. 公式アカウントの友だち追加用QRコード（Messaging API設定タブにある）を、通知を受け取るメンバーに共有する。

---

## 3. 環境変数

| 名前 | 必須 | 内容 |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINEを使うとき | チャネルアクセストークン（長期） |
| `LINE_CHANNEL_SECRET` | LINEを使うとき | Webhook の署名検証に使う |
| `APP_URL` | ○ | 公開URL（例：`https://xxx.up.railway.app`）。通知文の最後にリンクを付けるのに使う |
| `CRON_ENABLED` | 任意 | `false` で5分おきのタイマーを止める（ローカル開発用） |
| `CRON_SECRET` | 任意 | 外部のcronから `/api/cron/run` を叩く場合の合言葉 |

LINEの2つが未設定でもアプリは動くようにしておく（通知はツール内だけになる）。トークンはコードやGitに書かない。

---

## 4. データ（Prisma）

```prisma
model User {
  id                    Int       @id @default(autoincrement())
  name                  String
  role                  Role
  isActive              Boolean   @default(true)
  lineUserId            String?   @unique // LINE の userId（Webhook で受け取る）
  lineLinkCode          String?   @unique // 連携用の6桁コード
  lineLinkCodeExpiresAt DateTime?         // コードの期限（30分）
  notifications         Notification[]
  // …ほかの項目
}

model Notification {
  id         Int       @id @default(autoincrement())
  userId     Int
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type       String    // 通知の種類（MEETING_1DAY など）
  title      String
  body       String?
  linkUrl    String?   // ツール内のパス（/meetings/12 など）
  dedupeKey  String?   @unique // 同じ通知を2回作らないためのキー
  readAt     DateTime?
  lineSentAt DateTime? // LINE に送れた日時
  lineError  String?   // LINE に送れなかった理由
  createdAt  DateTime  @default(now())

  @@index([userId, readAt])
  @@index([userId, createdAt])
}

model Setting {
  key   String @id
  value String
}
```

`Setting` には次を入れる：

- `line.<種類>` = `"1"` / `"0"`：その種類をLINEにも送るか（管理者が画面で切り替える）
- `lineLimitReachedMonth` = `"2026-10"`：LINEの月の上限に達した月（後述）

---

## 5. コード

### 5-1. LINE API を呼ぶ（`src/lib/line.ts`）

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

const LINE_API = "https://api.line.me/v2/bot";

export function lineConfigured() {
  return !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

/** 1人にテキストを送る（push） */
export async function pushLineText(lineUserId: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN が設定されていません");
  const res = await fetch(`${LINE_API}/message/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LINE push 失敗 (${res.status}): ${body.slice(0, 300)}`);
  }
}

/** 今月の上限と使用数。取れなければ null */
export async function getLineQuota(): Promise<{ limit: number | null; used: number } | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const h = { Authorization: `Bearer ${token}` };
    const [q, c] = await Promise.all([
      fetch(`${LINE_API}/message/quota`, { headers: h, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${LINE_API}/message/quota/consumption`, { headers: h, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (!c) return null;
    return { limit: q?.type === "limited" ? Number(q.value) : null, used: Number(c.totalUsage ?? 0) };
  } catch {
    return null;
  }
}

/** 月の送信上限に達したエラーか（429 + "monthly limit"） */
export function isMonthlyLimitError(e: unknown) {
  return e instanceof Error && /\(429\)/.test(e.message) && /monthly limit/i.test(e.message);
}

/** Webhook の署名検証（x-line-signature） */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Webhook への返信（reply は無料。push と違い通数に数えない） */
export async function replyLineText(replyToken: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  await fetch(`${LINE_API}/message/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  }).catch(() => {});
}
```

### 5-2. 通知を作って送る（`src/lib/notifications.ts`）

アプリのどこからでも、この `notify()` だけを呼ぶ。

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { isMonthlyLimitError, lineConfigured, pushLineText } from "./line";
import { getLineEnabledMap, getSettingRaw, setSetting } from "./settings";

export type NotifyInput = {
  userId: number;
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  /** 同じキーの通知は1回しか作らない（定期処理の重複防止） */
  dedupeKey?: string | null;
  /** false ならこの通知は LINE に送らない（初回取り込みなど） */
  line?: boolean;
};

const LINE_LIMIT_KEY = "lineLimitReachedMonth";
export function jstMonth(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 7); // 日本時間の YYYY-MM
}
export async function lineLimitReachedThisMonth() {
  return (await getSettingRaw(LINE_LIMIT_KEY)) === jstMonth();
}
const LINE_LIMIT_MESSAGE = "LINEの今月の送信上限に達したため送っていません（翌月1日に復活）";

function appUrl(path: string | null | undefined) {
  if (!path) return "";
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

export async function notify(input: NotifyInput): Promise<boolean> {
  // 1) ツール内通知（dedupeKey があれば1回だけ）
  if (input.dedupeKey) {
    const exists = await prisma.notification.findUnique({ where: { dedupeKey: input.dedupeKey } });
    if (exists) return false;
  }
  let n;
  try {
    n = await prisma.notification.create({
      data: { userId: input.userId, type: input.type, title: input.title, body: input.body ?? null, linkUrl: input.linkUrl ?? null, dedupeKey: input.dedupeKey ?? null },
    });
  } catch (e) {
    // 同時に同じ dedupeKey が作られた場合（一意制約違反）は作らない
    if (input.dedupeKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }

  // 2) LINE（失敗してもツール内通知は残す）
  try {
    if (!lineConfigured() || input.line === false) return true;
    const enabled = await getLineEnabledMap();
    if (!enabled[input.type]) return true;
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user?.lineUserId || !user.isActive) return true;
    if (await lineLimitReachedThisMonth()) {
      await prisma.notification.update({ where: { id: n.id }, data: { lineError: LINE_LIMIT_MESSAGE } });
      return true;
    }
    const text = [input.title, input.body, appUrl(input.linkUrl)].filter(Boolean).join("\n");
    await pushLineText(user.lineUserId, text);
    await prisma.notification.update({ where: { id: n.id }, data: { lineSentAt: new Date() } });
  } catch (e) {
    const limit = isMonthlyLimitError(e);
    if (limit) await setSetting(LINE_LIMIT_KEY, jstMonth()); // 今月はもう送らない
    await prisma.notification.update({
      where: { id: n.id },
      data: { lineError: limit ? LINE_LIMIT_MESSAGE : e instanceof Error ? e.message.slice(0, 500) : "LINE送信エラー" },
    });
  }
  return true;
}

/** 全管理者に送る（dedupeKey は人ごとに分ける） */
export async function notifyAdmins(input: Omit<NotifyInput, "userId">) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true } });
  for (const a of admins) {
    await notify({ ...input, userId: a.id, dedupeKey: input.dedupeKey ? `${input.dedupeKey}:u${a.id}` : null });
  }
}
```

### 5-3. 種類ごとの「LINEにも送る」設定（`src/lib/settings.ts`）

```ts
export const NOTIFICATION_TYPES = [
  { key: "MEETING_1DAY", label: "商談の前日", defaultLine: true },
  { key: "MEETING_1HOUR", label: "商談の1時間前", defaultLine: true },
  { key: "TASK_ASSIGNED", label: "タスクの割当", defaultLine: true },
  { key: "STAGNANT", label: "停滞", defaultLine: false }, // 量が多いものは既定で OFF
  // …BizLabo で必要な種類を並べる
] as const;

export async function getLineEnabledMap(): Promise<Record<string, boolean>> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: "line." } } });
  const map: Record<string, boolean> = {};
  for (const t of NOTIFICATION_TYPES) {
    const row = rows.find((r) => r.key === `line.${t.key}`);
    map[t.key] = row ? row.value === "1" : t.defaultLine;
  }
  return map;
}
```

管理者用の設定画面に、種類ごとのチェックボックス（`line.<種類>` を保存）を置く。

### 5-4. ユーザーの紐付け

**① 連携コードの発行（Server Action）**

```ts
"use server";
import { randomInt } from "node:crypto";

/** 6桁の連携コードを発行（30分有効） */
export async function issueLineCodeAction() {
  const user = await assertUser();
  let code = "";
  for (let i = 0; i < 10; i++) {
    code = String(randomInt(100000, 999999));
    if (!(await prisma.user.findUnique({ where: { lineLinkCode: code } }))) break;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { lineLinkCode: code, lineLinkCodeExpiresAt: new Date(Date.now() + 30 * 60 * 1000) },
  });
  revalidatePath("/settings/line");
}

export async function unlinkLineAction() {
  const user = await assertUser();
  await prisma.user.update({ where: { id: user.id }, data: { lineUserId: null, lineLinkCode: null, lineLinkCodeExpiresAt: null } });
  revalidatePath("/settings/line");
}

/** テスト送信。上限の記録を外して実際に送ってみる（プランを上げたあとの再開確認にも使う） */
export async function sendLineTestAction() {
  const user = await assertUser();
  await setSetting("lineLimitReachedMonth", "");
  await notify({ userId: user.id, type: "TASK_ASSIGNED", title: "【テスト】LINE連携の確認メッセージです", body: "このメッセージが届いていれば連携は正常です。" });
  revalidatePath("/settings/line");
}
```

**② Webhook（`src/app/api/line/webhook/route.ts`）**

```ts
import { NextResponse } from "next/server";

type LineEvent = { type: string; replyToken?: string; source?: { userId?: string }; message?: { type: string; text?: string } };

export async function POST(req: Request) {
  const raw = await req.text(); // 署名検証のため、JSON にする前の生の本文を使う
  if (!verifyLineSignature(raw, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const body = JSON.parse(raw) as { events?: LineEvent[] };
  for (const ev of body.events ?? []) {
    const lineUserId = ev.source?.userId;
    if (!lineUserId) continue;
    if (ev.type === "follow" && ev.replyToken) {
      await replyLineText(ev.replyToken, "友だち追加ありがとうございます。\nツールの「設定 → LINE連携」で発行した6桁のコードを送ってください。");
      continue;
    }
    if (ev.type !== "message" || ev.message?.type !== "text") continue;
    const code = (ev.message.text ?? "").trim().match(/\d{6}/)?.[0];
    if (!code) {
      if (ev.replyToken) await replyLineText(ev.replyToken, "連携するには、ツールで発行した6桁のコードを送ってください。");
      continue;
    }
    const user = await prisma.user.findUnique({ where: { lineLinkCode: code } });
    if (!user || !user.lineLinkCodeExpiresAt || user.lineLinkCodeExpiresAt < new Date()) {
      if (ev.replyToken) await replyLineText(ev.replyToken, "コードが無効か期限切れです。ツールでコードを再発行してください。");
      continue;
    }
    // 同じ LINE が別のユーザーに紐付いていたら外す
    await prisma.user.updateMany({ where: { lineUserId, id: { not: user.id } }, data: { lineUserId: null } });
    await prisma.user.update({ where: { id: user.id }, data: { lineUserId, lineLinkCode: null, lineLinkCodeExpiresAt: null } });
    if (ev.replyToken) await replyLineText(ev.replyToken, `${user.name} さんのアカウントと連携が完了しました。`);
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true }); // LINE の「検証」ボタン用
}
```

Webhook の URL はログインなしで呼べるようにする（middleware の認証から `/api/line/webhook` を外す）。守りは署名検証で行う。

**③ 画面（設定 → LINE連携）**

- 未連携：手順（友だち追加 → コード発行 → トークに送る）と「連携コードを発行」ボタン。発行中は大きく6桁と期限を出す。
- 連携済：「連携済」バッジ、最終送信日時、「テスト送信」「連携を解除」。
- 管理者だけ：今月の送信状況（`getLineQuota()` の「使用数 / 上限」、ツールから送った数、送れなかった件数、種類別・送り先別の数）。上限に達した月は赤い帯で知らせる。

### 5-5. 5分おきの定期処理（リマインド）

サーバーが常駐する環境（Railway など）なら、アプリの起動時にタイマーを始めるのが一番簡単。

```ts
// src/instrumentation.ts（Next.js が起動時に1回呼ぶ）
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = process.env.TZ || "Asia/Tokyo";
    if (process.env.CRON_ENABLED !== "false") {
      const { startScheduler } = await import("./lib/cron/scheduler");
      startScheduler();
    }
  }
}
```

```ts
// src/lib/cron/scheduler.ts
const INTERVAL_MS = 5 * 60 * 1000;
const g = globalThis as unknown as { __schedulerStarted?: boolean };

export function startScheduler() {
  if (g.__schedulerStarted) return; // 二重起動を防ぐ
  g.__schedulerStarted = true;
  const tick = async () => {
    try {
      const { runReminders } = await import("./reminders");
      const r = await runReminders();
      if (r.created > 0) console.log(`[cron] 通知を ${r.created} 件作成`);
    } catch (e) {
      console.error("[cron] エラー", e);
    }
  };
  setTimeout(tick, 15_000);
  setInterval(tick, INTERVAL_MS);
}
```

Vercel などサーバーが常駐しない環境では、代わりに外部のcron（Railway Cron・GitHub Actions など）から `/api/cron/run` を `Authorization: Bearer <CRON_SECRET>` 付きで5分おきに叩く。

**リマインドの判定の書き方（`runReminders`）**

- 5分おきに「今送るべきもの」を探して `notify()` を呼ぶだけにする。送ったかどうかは `dedupeKey` で判定するので、何度動いても二重にならない。
- 例：
  - 1時間前：開始が「今から55〜65分後」の予定 → `dedupeKey: "meeting-1h:<id>:<開始時刻>"`（日時を入れておくと、日時が変わったときにもう一度送れる）
  - 前日：日次の時刻（設定、例 8時）以降に、翌日の予定 → `"meeting-1d:<id>:<日付>"`
  - 期限当日：`"due:<id>:<日付>"`
  - 停滞：`"stagnant:<id>:<14日などの段階>"`
- 日付・時刻は日本時間で扱う（`TZ=Asia/Tokyo` を設定する）。

---

## 6. 送信数と料金（実際にはまった点）

- 無料プラン（コミュニケーションプラン）は **月200通**。紹介案件管理ツールでは月の半ば（10/14）に使い切り、その後の通知がLINEに届かなくなった。LINEは `429 {"message":"You have reached your monthly limit."}` を返す。
- **数え方は「送り先1人につき1通」**。全員（例：3人）に送る通知は3通になる。管理者全員に送る通知が多いと、すぐ増える。
- Webhook への返信（reply）は数に入らない。数に入るのは push。
- 月が変わる（日本時間の1日）と元に戻る。月の途中でプランを上げると、その月から増える。
- プラン（税別、2026年時点の第三者サイトのまとめ。申し込み画面で確認すること）：

| プラン | 月額 | 送れる数 |
|---|---|---|
| コミュニケーション | 0円 | 200通 |
| ライト | 5,000円 | 5,000通 |
| スタンダード | 15,000円 | 30,000通（超えた分は追加料金） |

**作るときに最初から入れておくこと**

1. 上限エラー（429・monthly limit）を見分け、その月は送るのをやめて「未送信（上限）」と記録する（上の `notify()`）。止めないと、失敗が毎回記録されるだけになる。
2. 管理者画面に今月の使用数を出す（`/v2/bot/message/quota` と `/v2/bot/message/quota/consumption`）。
3. 種類ごとに LINE の ON/OFF を切り替えられるようにし、量が多い種類（停滞・期限超過など）は既定で OFF にする。
4. 量を減らしたいなら、すぐ知らせる必要のない通知を1日1回のまとめ（ダイジェスト）にする。

---

## 7. ほかの注意点

- 通知本文は4,900文字で切る（LINEの上限は5,000文字）。
- 通知文の最後にツールのURLを付ける（`APP_URL` ＋ `linkUrl`）。スマホのLINEから押して開ける。
- ツール内の通知一覧で「LINE送信済」「LINE送信失敗（理由）」を表示すると、届かないときの原因がすぐ分かる。
- 初回の取り込み・データ移行で大量に通知ができるときは `line: false` にして LINE に送らない。
- テスト環境・ローカルでは本番のトークンを使わない（メンバーに誤送信される）。`CRON_ENABLED=false` で定期処理も止める。
- ユーザーを無効にしたら LINE も送らない（`user.isActive` を確認）。

---

## 8. 別のClaude Codeに渡すときの依頼文（コピー用）

```
~/Downloads/referral-hub/porting-kit/line-notification-guide.md を読んで、
このBizLaboのコードに、LINE公式アカウントで通知を送る仕組みを作ってください。

- 仕組みはガイドのとおり（ツール内通知を作る → 種類ごとにONならLINEにpush、6桁コードでユーザーを紐付け、Webhookは署名検証、5分おきのリマインド、dedupeKeyで二重送信防止、月の上限に達したらその月は送らない）
- 既存のこのコードの技術・画面の作りに合わせてください
- どんな通知を送るか（種類の一覧）は、作り始める前に私に確認してください
- LINEのトークン類は環境変数で受け取り、コードに書かないでください
- 参考の実装は ~/Downloads/referral-hub の src/lib/line.ts、src/lib/notifications.ts、src/app/api/line/webhook/route.ts、src/app/(app)/settings/line/、src/lib/cron/ です
```
