import { prisma } from "../db";
import { notify, notifyAdmins } from "../notifications";
import { getSettingRaw, setSetting } from "../settings";
import { applyRules } from "./rules";
import { formatThreadAsText, messageKey, normalizeCompanyName, parseProposalFee, parseThreadList, parseThreadMessages } from "./parse";
import { format } from "date-fns";
import { Prisma } from "@prisma/client";
import { refreshThreadProposed } from "./proposed";

export type IngestPayload = {
  listHtml?: string;
  details?: { proposalId: string; html: string }[];
  loggedOut?: boolean;
  extensionVersion?: string;
};

export type IngestResult = {
  ok: boolean;
  needDetails: string[]; // 詳細HTMLが欲しい proposalId
  threads: number;
  newMessages: number;
  error?: string;
};

/** Chrome 拡張から送られた HTML を取り込み、通知と自動化を行う */
export async function ingestFromExtension(payload: IngestPayload): Promise<IngestResult> {
  const now = new Date();
  await setSetting("saleshub.lastIngestAt", now.toISOString());
  if (payload.extensionVersion) await setSetting("saleshub.extensionVersion", payload.extensionVersion);

  if (payload.loggedOut) {
    await setSetting("saleshub.status", "loggedout");
    await notifyAdmins({
      type: "SALESHUB_MESSAGE",
      title: "【セールスハブ連携】ログインが切れています",
      body: "Chrome でセールスハブにログインし直してください。ログインすると自動で再開します。",
      linkUrl: "/settings/saleshub",
      dedupeKey: `saleshub:loggedout:${format(now, "yyyyMMddHH")}`,
    });
    return { ok: true, needDetails: [], threads: 0, newMessages: 0 };
  }
  await setSetting("saleshub.status", "ok");

  const firstRun = (await prisma.saleshubMessage.count()) === 0;
  const needDetails: string[] = [];
  const needFeeOnly: string[] = []; // 協力金だけ取り直したいスレッド（優先度は低い）
  let threadsCount = 0;
  let newMessages = 0;

  // ---- 一覧 ----
  if (payload.listHtml) {
    const threads = parseThreadList(payload.listHtml);
    threadsCount = threads.length;
    // 初回同期：拡張は1回に最大15スレッドずつ詳細を送るので、スレッドが多いと過去分の取り込みが複数回に分かれる。
    // 最初の一覧に載っていたスレッドを覚えておき、その過去分は後の回でも「初回分（通知なし）」として扱う。
    if (threads.length > 0 && (await prisma.saleshubThread.count()) === 0) {
      await setSetting("saleshub.backfill", JSON.stringify(threads.map((t) => t.proposalId)));
    }
    const vendors = await prisma.vendor.findMany({ where: { isActive: true } });
    // 既存スレッドとメッセージ件数はまとめて取得する（スレッドごとの問い合わせをしない）
    const existingRows = await prisma.saleshubThread.findMany({ where: { proposalId: { in: threads.map((t) => t.proposalId) } } });
    const existingBy = new Map(existingRows.map((r) => [r.proposalId, r]));
    const counts = existingRows.length
      ? await prisma.saleshubMessage.groupBy({ by: ["threadId"], where: { threadId: { in: existingRows.map((r) => r.id) } }, _count: { _all: true } })
      : [];
    const countBy = new Map(counts.map((c) => [c.threadId, c._count._all]));
    for (const t of threads) {
      const existing = existingBy.get(t.proposalId) ?? null;
      const vendorMatch = existing?.vendorId ?? vendors.find((v) => normalizeCompanyName(v.name) === normalizeCompanyName(t.vendorName))?.id ?? null;
      await prisma.saleshubThread.upsert({
        where: { proposalId: t.proposalId },
        update: {
          vendorName: t.vendorName,
          requestTitle: t.requestTitle,
          lastSnippet: t.lastSnippet,
          vendorId: vendorMatch,
          // 提示会社の抽出はベンダー名（除外対象）に依存するので、名前が変わったら作り直す
          ...(existing && existing.vendorName !== t.vendorName ? { proposedCache: Prisma.DbNull } : {}),
        },
        create: { proposalId: t.proposalId, vendorName: t.vendorName, requestTitle: t.requestTitle, lastSnippet: t.lastSnippet, vendorId: vendorMatch },
      });
      const msgCount = existing ? (countBy.get(existing.id) ?? 0) : 0;
      if (!existing || existing.lastSnippet !== t.lastSnippet || msgCount === 0) needDetails.push(t.proposalId);
      else if (existing.fee === null) needFeeOnly.push(t.proposalId);
    }
    // 新着の可能性があるスレッドを先に（拡張は先頭から15件だけ取りに行く）
    needDetails.push(...needFeeOnly);
  }

  // ---- 詳細 ----
  const users = await prisma.user.findMany({ where: { isActive: true } });
  let backfillIds: Set<string> | null = null;
  if (payload.details?.length) {
    try {
      backfillIds = new Set(JSON.parse((await getSettingRaw("saleshub.backfill")) ?? "[]") as string[]);
    } catch {
      backfillIds = new Set();
    }
  }
  const backfillBefore = backfillIds?.size ?? 0;
  for (const d of payload.details ?? []) {
    const thread = await prisma.saleshubThread.findUnique({ where: { proposalId: d.proposalId } });
    if (!thread) continue;
    // 初回同期の過去分（通知を出さない）か。最初の一覧に載っていて、まだ1件も取り込んでいないスレッドも含む
    const backfill = firstRun || (!!backfillIds?.has(d.proposalId) && (await prisma.saleshubMessage.count({ where: { threadId: thread.id } })) === 0);
    backfillIds?.delete(d.proposalId);
    const parsed = parseThreadMessages(d.html);
    // 依頼ページの協力金（紹介単価）
    const fee = parseProposalFee(d.html);
    if (fee !== null && thread.fee !== fee) {
      await prisma.saleshubThread.update({ where: { id: thread.id }, data: { fee } });
      if (thread.importedMeetingId) {
        const m = await prisma.vendorMeeting.findUnique({ where: { id: thread.importedMeetingId } });
        if (m && m.fee === null) await prisma.vendorMeeting.update({ where: { id: m.id }, data: { fee } });
      }
      if (thread.vendorId) {
        const v = await prisma.vendor.findUnique({ where: { id: thread.vendorId } });
        if (v && v.referralFee === 0) await prisma.vendor.update({ where: { id: v.id }, data: { referralFee: fee } });
      }
    }
    const created = [];
    let lastAt = thread.lastMessageAt;
    const keys = parsed.map((m) => messageKey(d.proposalId, m));
    const existingKeys = new Set(
      (await prisma.saleshubMessage.findMany({ where: { externalKey: { in: keys } }, select: { externalKey: true } })).map((x) => x.externalKey),
    );
    for (const m of parsed) {
      const key = messageKey(d.proposalId, m);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      let row;
      try {
        row = await prisma.saleshubMessage.create({
          data: {
            threadId: thread.id,
            externalKey: key,
            senderName: m.senderName,
            isMine: m.isMine,
            sentAt: m.sentAt,
            body: m.body,
            notifiedAt: backfill || m.isMine ? now : null,
          },
        });
      } catch (e) {
        // 複数の拡張から同時に届いた場合など、同じメッセージが先に登録されていたら飛ばす
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
      created.push(row);
      newMessages++;
      if (!lastAt || m.sentAt > lastAt) lastAt = m.sentAt;
    }
    if (lastAt && (!thread.lastMessageAt || lastAt > thread.lastMessageAt)) {
      await prisma.saleshubThread.update({ where: { id: thread.id }, data: { lastMessageAt: lastAt } });
    }
    // こちら側の発言が増えたら「提示した会社」キャッシュを更新（自動化ルールより先に）
    if (created.some((r) => r.isMine) || (created.length && !thread.proposedCache)) {
      await refreshThreadProposed(thread.id);
    }
    // 通知（初回同期の過去分は通知しない）
    for (const row of created.filter((r) => !r.notifiedAt)) {
      for (const u of users) {
        await notify({
          userId: u.id,
          type: "SALESHUB_MESSAGE",
          title: `【セールスハブ】${thread.vendorName} から新着（${format(row.sentAt, "M/d HH:mm")}）`,
          body: row.body.slice(0, 200),
          linkUrl: `/saleshub/${thread.id}`,
          dedupeKey: `saleshub:msg:${row.id}:u${u.id}`,
        });
      }
      await prisma.saleshubMessage.update({ where: { id: row.id }, data: { notifiedAt: now } });
    }
    // 自動化ルール。初回同期（過去分の取り込み）でも適用して、過去のやりとりからMTGを登録する。
    // 初回は LINE を送らずツール内通知のみ。
    if (created.length) {
      const all = await prisma.saleshubMessage.findMany({ where: { threadId: thread.id }, orderBy: { sentAt: "asc" } });
      const fresh = await prisma.saleshubThread.findUniqueOrThrow({ where: { id: thread.id } });
      try {
        await applyRules(fresh, backfill ? all : created, all, { quiet: backfill });
      } catch (e) {
        console.error("[saleshub] rules error", e);
      }
    }
  }
  if (backfillIds && backfillIds.size !== backfillBefore) await setSetting("saleshub.backfill", JSON.stringify([...backfillIds]));
  return { ok: true, needDetails, threads: threadsCount, newMessages };
}

export async function threadAsText(threadId: number) {
  const t = await prisma.saleshubThread.findUnique({ where: { id: threadId }, include: { messages: { orderBy: { sentAt: "asc" } } } });
  if (!t) return null;
  return { thread: t, text: formatThreadAsText(t.vendorName, t.requestTitle, t.messages) };
}
