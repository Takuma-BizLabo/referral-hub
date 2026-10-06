import { prisma } from "../db";
import { notify, notifyAdmins } from "../notifications";
import { setSetting } from "../settings";
import { applyRules } from "./rules";
import { formatThreadAsText, messageKey, normalizeCompanyName, parseThreadList, parseThreadMessages } from "./parse";
import { format } from "date-fns";

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
  let threadsCount = 0;
  let newMessages = 0;

  // ---- 一覧 ----
  if (payload.listHtml) {
    const threads = parseThreadList(payload.listHtml);
    threadsCount = threads.length;
    const vendors = await prisma.vendor.findMany({ where: { isActive: true } });
    for (const t of threads) {
      const existing = await prisma.saleshubThread.findUnique({ where: { proposalId: t.proposalId } });
      const vendorMatch = existing?.vendorId ?? vendors.find((v) => normalizeCompanyName(v.name) === normalizeCompanyName(t.vendorName))?.id ?? null;
      await prisma.saleshubThread.upsert({
        where: { proposalId: t.proposalId },
        update: { vendorName: t.vendorName, requestTitle: t.requestTitle, lastSnippet: t.lastSnippet, vendorId: vendorMatch },
        create: { proposalId: t.proposalId, vendorName: t.vendorName, requestTitle: t.requestTitle, lastSnippet: t.lastSnippet, vendorId: vendorMatch },
      });
      const msgCount = existing ? await prisma.saleshubMessage.count({ where: { threadId: existing.id } }) : 0;
      if (!existing || existing.lastSnippet !== t.lastSnippet || msgCount === 0) needDetails.push(t.proposalId);
    }
  }

  // ---- 詳細 ----
  const users = await prisma.user.findMany({ where: { isActive: true } });
  for (const d of payload.details ?? []) {
    const thread = await prisma.saleshubThread.findUnique({ where: { proposalId: d.proposalId } });
    if (!thread) continue;
    const parsed = parseThreadMessages(d.html);
    const created = [];
    let lastAt = thread.lastMessageAt;
    for (const m of parsed) {
      const key = messageKey(d.proposalId, m);
      const exists = await prisma.saleshubMessage.findUnique({ where: { externalKey: key } });
      if (exists) continue;
      const row = await prisma.saleshubMessage.create({
        data: {
          threadId: thread.id,
          externalKey: key,
          senderName: m.senderName,
          isMine: m.isMine,
          sentAt: m.sentAt,
          body: m.body,
          notifiedAt: firstRun || m.isMine ? now : null,
        },
      });
      created.push(row);
      newMessages++;
      if (!lastAt || m.sentAt > lastAt) lastAt = m.sentAt;
    }
    if (lastAt && (!thread.lastMessageAt || lastAt > thread.lastMessageAt)) {
      await prisma.saleshubThread.update({ where: { id: thread.id }, data: { lastMessageAt: lastAt } });
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
        await applyRules(fresh, firstRun ? all : created, all, { quiet: firstRun });
      } catch (e) {
        console.error("[saleshub] rules error", e);
      }
    }
  }
  return { ok: true, needDetails, threads: threadsCount, newMessages };
}

export async function threadAsText(threadId: number) {
  const t = await prisma.saleshubThread.findUnique({ where: { id: threadId }, include: { messages: { orderBy: { sentAt: "asc" } } } });
  if (!t) return null;
  return { thread: t, text: formatThreadAsText(t.vendorName, t.requestTitle, t.messages) };
}
