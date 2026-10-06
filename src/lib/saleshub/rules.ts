import { addDays } from "date-fns";
import { prisma } from "../db";
import { recordHistory } from "../history";
import { notify, notifyAdmins } from "../notifications";
import { getSettingRaw } from "../settings";
import { fmtDateTime } from "../utils";
import { extractCompanies, extractMeetingDateTime, looksLikeMeetingRequest, normalizeCompanyName, URL_RE } from "./parse";
import type { SaleshubMessage, SaleshubThread } from "@prisma/client";

type Thread = SaleshubThread;
type Msg = SaleshubMessage;

/** 自動タスクの担当者（設定 saleshub.schedulerUserId、未設定なら「松田」を含む名前、なければ最初の有効ユーザー） */
export async function getSchedulerUserId(): Promise<number | null> {
  const raw = await getSettingRaw("saleshub.schedulerUserId");
  if (raw && Number(raw)) {
    const u = await prisma.user.findFirst({ where: { id: Number(raw), isActive: true } });
    if (u) return u.id;
  }
  const byName = await prisma.user.findFirst({ where: { isActive: true, name: { contains: "松田" } } });
  if (byName) return byName.id;
  const any = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
  return any?.id ?? null;
}

/** ベンダーを名前で探し、なければ単価0で自動作成 */
export async function ensureVendor(thread: Thread): Promise<number> {
  if (thread.vendorId) return thread.vendorId;
  const n = normalizeCompanyName(thread.vendorName);
  const vendors = await prisma.vendor.findMany({ where: { isActive: true } });
  let v = vendors.find((x) => normalizeCompanyName(x.name) === n) ?? vendors.find((x) => normalizeCompanyName(x.name).includes(n) || n.includes(normalizeCompanyName(x.name)));
  if (!v) {
    v = await prisma.vendor.create({
      data: {
        name: thread.vendorName,
        serviceSummary: thread.requestTitle,
        referralFee: 0,
        saleshubUrl: `https://saleshub.jp/proposals/${thread.proposalId}`,
        memo: "セールスハブ連携により自動作成。紹介報酬単価を入力してください。",
      },
    });
    await notifyAdmins({
      type: "SALESHUB_MESSAGE",
      title: `【ベンダー自動作成】${v.name}`,
      body: "紹介報酬単価が未入力です。ベンダー詳細で入力してください。",
      linkUrl: `/vendors/${v.id}/edit`,
      dedupeKey: `saleshub:vendor:${v.id}`,
    });
  } else if (!v.saleshubUrl) {
    await prisma.vendor.update({ where: { id: v.id }, data: { saleshubUrl: `https://saleshub.jp/proposals/${thread.proposalId}` } });
  }
  await prisma.saleshubThread.update({ where: { id: thread.id }, data: { vendorId: v.id } });
  return v.id;
}

/** 会社名候補を繋がりリストと突き合わせ、紹介候補（ピックアップ受付）を作る。該当なしは候補メモとして返す */
export async function registerCandidates(
  vendorId: number,
  candidates: { company: string; dept: string | null }[],
  note: string,
): Promise<{ created: number; unmatched: string[] }> {
  if (candidates.length === 0) return { created: 0, unmatched: [] };
  const contacts = await prisma.contact.findMany({ where: { isActive: true, company: { not: null } } });
  let created = 0;
  const unmatched: string[] = [];
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId } });
  for (const c of candidates) {
    const n = normalizeCompanyName(c.company);
    const hits = contacts.filter((x) => {
      const cn = normalizeCompanyName(x.company ?? "");
      return cn && (cn === n || cn.includes(n) || n.includes(cn));
    });
    if (hits.length === 0) {
      unmatched.push(c.company + (c.dept ? ` / ${c.dept}` : ""));
      continue;
    }
    for (const h of hits) {
      const exists = await prisma.referral.findFirst({ where: { vendorId, contactId: h.id } });
      if (exists) continue;
      const r = await prisma.referral.create({
        data: {
          vendorId,
          contactId: h.id,
          rewardAmount: vendor.referralFee,
          pickupNote: `${c.company}${c.dept ? " / " + c.dept : ""}（${note}）`,
          memo: "セールスハブ連携により自動登録",
        },
      });
      await recordHistory(prisma, { entityType: "REFERRAL", entityId: r.id, field: "status", fromValue: null, toValue: "RECEIVED", note: "セールスハブ連携", changedById: null });
      created++;
    }
  }
  return { created, unmatched };
}

/**
 * 新着メッセージごとの自動化。
 * - ベンダー発言で打ち合わせ依頼 → 松田へ承認なしのMTGタスク（スレッドに1件）
 * - いずれかの発言に日時 → MTGを「確定」にして日時をセット
 * - 会社名の言及 → 紹介候補として登録
 */
export async function applyRules(thread: Thread, newMessages: Msg[], allMessages: Msg[], opts: { quiet?: boolean } = {}) {
  if (newMessages.length === 0) return;
  const line = opts.quiet ? false : undefined;
  const schedulerId = await getSchedulerUserId();
  const vendorMessages = newMessages.filter((m) => !m.isMine);
  const mine = allMessages.filter((m) => m.isMine);

  // --- 1. 打ち合わせ依頼の検知 → MTGタスク ---
  let meetingId = thread.importedMeetingId;
  const requestMsg = vendorMessages.find((m) => looksLikeMeetingRequest(m.body));
  if (!meetingId && requestMsg && schedulerId) {
    const vendorId = await ensureVendor(thread);
    const urls = requestMsg.body.match(URL_RE) ?? [];
    const firstMine = mine[0];
    const candidates = firstMine ? extractCompanies(firstMine.body, [thread.vendorName]) : [];
    const meeting = await prisma.vendorMeeting.create({
      data: {
        vendorId,
        assigneeId: schedulerId,
        format: "ONLINE",
        place: urls[0] ?? null,
        approvalStatus: "APPROVED",
        executionStatus: "SCHEDULING",
        nextAction: urls.length ? "日程調整URLから候補日を予約し、チャットで日時を返信する" : "ベンダーと日程調整して日時を返信する",
        nextActionDue: addDays(new Date(), 2),
        requestNote: [
          thread.requestTitle ? `依頼: ${thread.requestTitle}` : "",
          candidates.length ? `ピックアップ: ${candidates.map((c) => c.company + (c.dept ? " / " + c.dept : "")).join("、")}` : "",
          `ベンダーからの連絡（${fmtDateTime(requestMsg.sentAt)}）:\n${requestMsg.body}`,
          `セールスハブ: https://saleshub.jp/proposals/${thread.proposalId}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    });
    meetingId = meeting.id;
    await recordHistory(prisma, { entityType: "VENDOR_MEETING", entityId: meeting.id, field: "approvalStatus", fromValue: null, toValue: "APPROVED", note: "セールスハブ連携により自動作成（承認不要）", changedById: null });
    await prisma.saleshubThread.update({ where: { id: thread.id }, data: { importedMeetingId: meeting.id } });
    const { created, unmatched } = await registerCandidates(vendorId, candidates, "松田の初回メッセージ");
    await notify({
      userId: schedulerId,
      type: "TASK_ASSIGNED",
      title: `【日程調整タスク】${thread.vendorName} との事前MTG`,
      body: [urls[0] ? `日程調整URL: ${urls[0]}` : requestMsg.body.slice(0, 120), created ? `紹介候補 ${created} 件を登録` : "", unmatched.length ? `繋がり未登録: ${unmatched.join("、")}` : ""].filter(Boolean).join("\n"),
      linkUrl: `/meetings/${meeting.id}`,
      dedupeKey: `saleshub:task:${thread.id}`,
      line,
    });
  }

  // --- 2. 日時の読み取り → 確定 ---
  if (meetingId) {
    const meeting = await prisma.vendorMeeting.findUnique({ where: { id: meetingId } });
    if (meeting && meeting.executionStatus !== "DONE" && meeting.executionStatus !== "CANCELLED") {
      // 新着のうち日時を含む最後の発言を採用
      let found: { at: Date; msg: Msg } | null = null;
      for (const m of newMessages) {
        const at = extractMeetingDateTime(m.body, m.sentAt);
        if (at && at.getTime() > m.sentAt.getTime() - 3600_000) found = { at, msg: m };
      }
      if (found && (!meeting.scheduledAt || meeting.scheduledAt.getTime() !== found.at.getTime())) {
        const url = (found.msg.body.match(URL_RE) ?? [])[0];
        await prisma.vendorMeeting.update({
          where: { id: meeting.id },
          data: {
            scheduledAt: found.at,
            executionStatus: "CONFIRMED",
            ...(url && !meeting.place ? { place: url } : {}),
            // 日程が決まったので次アクションを「実施→議事メモ入力」に進める
            nextAction: "MTGを実施し、議事メモと結果（繋げる人物の確認）を入力する",
            nextActionDue: new Date(Date.UTC(found.at.getUTCFullYear(), found.at.getUTCMonth(), found.at.getUTCDate() + 1, -9, 0)),
          },
        });
        await recordHistory(prisma, {
          entityType: "VENDOR_MEETING",
          entityId: meeting.id,
          field: "executionStatus",
          fromValue: meeting.executionStatus,
          toValue: "CONFIRMED",
          note: `チャットの「${found.msg.body.slice(0, 40).replace(/\n/g, " ")}」から日時を読み取り`,
          changedById: null,
        });
        const title = `【MTG確定】${thread.vendorName} ${fmtDateTime(found.at)}`;
        await notify({ userId: meeting.assigneeId, type: "TASK_ASSIGNED", title, body: "チャットの日時を読み取って確定にしました。違っていればMTG詳細で修正してください。", linkUrl: `/meetings/${meeting.id}`, dedupeKey: `saleshub:confirm:${meeting.id}:${found.at.getTime()}`, line });
        await notifyAdmins({ type: "APPROVED", title, linkUrl: `/meetings/${meeting.id}`, dedupeKey: `saleshub:confirm-admin:${meeting.id}:${found.at.getTime()}`, line });
      }
    }
  }

  // --- 3. ベンダーが途中で挙げた会社名 → 紹介候補 ---
  const vendorId = thread.vendorId ?? (meetingId ? (await prisma.vendorMeeting.findUnique({ where: { id: meetingId } }))?.vendorId ?? null : null);
  if (vendorId) {
    for (const m of vendorMessages) {
      const companies = extractCompanies(m.body, [thread.vendorName]);
      if (companies.length === 0) continue;
      const { created, unmatched } = await registerCandidates(vendorId, companies, `ベンダーがチャットで言及 ${fmtDateTime(m.sentAt)}`);
      if (created || unmatched.length) {
        await notifyAdmins({
          type: "SALESHUB_MESSAGE",
          title: `【紹介候補】${thread.vendorName} が ${companies.map((c) => c.company).join("、")} に関心`,
          body: [created ? `紹介候補 ${created} 件を登録しました` : "", unmatched.length ? `繋がりリストに未登録: ${unmatched.join("、")}` : ""].filter(Boolean).join("\n"),
          linkUrl: `/saleshub/${thread.id}`,
          dedupeKey: `saleshub:cand:${m.id}`,
          line,
        });
      }
    }
  }
}
