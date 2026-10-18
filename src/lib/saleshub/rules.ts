import { addDays } from "date-fns";
import { prisma } from "../db";
import { recordHistory, reopenVendorMeetingStatus } from "../history";
import { notify, notifyAdmins } from "../notifications";
import { getSettingRaw } from "../settings";
import { fmtDateTime } from "../utils";
import { evaluateThreadSchedule, extractCompanies, findDeclinedCompanies, isMeetingRoomUrl, isSchedulingToolUrl, looksLikeMeetingRequest, normalizeCompanyName, URL_RE } from "./parse";
import { isProposed, proposedCompaniesForVendor } from "./proposed";
import type { SaleshubMessage, SaleshubThread } from "@prisma/client";
import { parseFeeTable, rewardFor } from "../fee-table";

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
  // 完全一致を優先。部分一致は、短い名前（2文字以下）が別のベンダー名に含まれて誤って紐付かないよう3文字以上に限る
  const partial = (a: string, b: string) => a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a));
  let v = vendors.find((x) => normalizeCompanyName(x.name) === n) ?? vendors.find((x) => partial(normalizeCompanyName(x.name), n));
  if (!v) {
    v = await prisma.vendor.create({
      data: {
        name: thread.vendorName,
        serviceSummary: thread.requestTitle,
        referralFee: thread.fee ?? 0,
        saleshubUrl: `https://saleshub.jp/proposals/${thread.proposalId}`,
        memo: "セールスハブ連携により自動作成。紹介報酬単価を入力してください。",
      },
    });
    await notifyAdmins({
      type: "SALESHUB_MESSAGE",
      title: `【ベンダー自動作成】${v.name}`,
      body: thread.fee ? `セールスハブの協力金 ¥${thread.fee.toLocaleString()} を単価として設定しました。` : "紹介報酬単価が未入力です。ベンダー詳細で入力してください。",
      linkUrl: `/vendors/${v.id}/edit`,
      dedupeKey: `saleshub:vendor:${v.id}`,
    });
  } else {
    const patch: { saleshubUrl?: string; referralFee?: number } = {};
    if (!v.saleshubUrl) patch.saleshubUrl = `https://saleshub.jp/proposals/${thread.proposalId}`;
    if (v.referralFee === 0 && thread.fee) patch.referralFee = thread.fee;
    if (Object.keys(patch).length) await prisma.vendor.update({ where: { id: v.id }, data: patch });
  }
  await prisma.saleshubThread.update({ where: { id: thread.id }, data: { vendorId: v.id } });
  return v.id;
}

/** 会社名候補を繋がりリストと突き合わせ、紹介候補（ピックアップ受付）を作る。該当なしは候補メモとして返す */
export async function registerCandidates(
  vendorId: number,
  candidates: { company: string; dept: string | null }[],
  note: string,
  /** 紹介単価。null のときは「未定」として登録（途中でベンダーが挙げた会社など） */
  fee: number | null,
): Promise<{ created: number; unmatched: string[] }> {
  if (candidates.length === 0) return { created: 0, unmatched: [] };
  const contacts = await prisma.contact.findMany({ where: { isActive: true, company: { not: null } } });
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { referralFee: true, feeTable: true } });
  let created = 0;
  const unmatched: string[] = [];
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
      // 単価表のあるベンダーは繋がりの規模・役職で決める（決まらなければ単価未定）
      const byTable = fee === null ? null : rewardFor(vendor, h);
      const rewardAmount = byTable && parseFeeTable(vendor.feeTable).length ? byTable.rewardAmount : fee ?? 0;
      const rewardUndetermined = fee === null || (byTable?.rewardUndetermined ?? false);
      const r = await prisma.referral.create({
        data: {
          vendorId,
          contactId: h.id,
          rewardAmount,
          rewardUndetermined,
          pickupNote: `${c.company}${c.dept ? " / " + c.dept : ""}（${note}）${rewardUndetermined ? "／単価未定" : ""}`,
          memo: byTable?.reason ? `セールスハブ連携により自動登録／${byTable.reason}` : "セールスハブ連携により自動登録",
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
/**
 * ベンダーが紹介を見送った会社の紹介案件を「紹介見送り」にする。
 * 人が進めた案件（日程調整中以降）は変更しない。
 */
export async function applyDeclines(vendorId: number, vendorName: string, messages: Msg[], opts: { line?: false } = {}): Promise<string[]> {
  const fromVendor = messages.filter((m) => !m.isMine);
  if (fromVendor.length === 0) return [];
  const referrals = await prisma.referral.findMany({
    where: { vendorId, status: { in: ["RECEIVED", "CONTACTING"] } },
    include: { contact: { select: { company: true, name: true } } },
  });
  const declined: string[] = [];
  const done = new Set<number>();
  for (const m of fromVendor) {
    for (const r of referrals) {
      if (done.has(r.id) || !r.contact.company) continue;
      if (findDeclinedCompanies(m.body, [r.contact.company]).length === 0) continue;
      await prisma.referral.update({ where: { id: r.id }, data: { status: "DECLINED", vendorApproval: "NG" } });
      await recordHistory(prisma, { entityType: "REFERRAL", entityId: r.id, field: "status", fromValue: r.status, toValue: "DECLINED", note: `ベンダーが紹介見送りと連絡（${fmtDateTime(m.sentAt)}）`, changedById: null });
      done.add(r.id);
      declined.push(`${r.contact.company}（${r.contact.name}）`);
    }
  }
  if (declined.length) {
    await notifyAdmins({
      type: "SALESHUB_MESSAGE",
      title: `【紹介見送り】${vendorName}：${declined.join("、")}`,
      body: "ベンダーからの連絡を読み取り、紹介案件を「紹介見送り」にしました。違っていれば紹介案件でステータスを戻してください。",
      linkUrl: "/referrals",
      dedupeKey: `saleshub:decline:${vendorId}:${[...done].join(",")}`,
      line: opts.line,
    });
  }
  return declined;
}

/** チャットで決まった日時でMTGを「確定」にし、担当者と管理者に知らせる */
async function confirmMeetingFromChat(
  meeting: { id: number; assigneeId: number; executionStatus: string; place: string | null },
  at: Date,
  sourceBody: string,
  vendorName: string,
  line?: false,
) {
  const msgUrls = sourceBody.match(URL_RE) ?? [];
  const roomUrl = msgUrls.find(isMeetingRoomUrl);
  const updated = await prisma.vendorMeeting.update({
    where: { id: meeting.id },
    data: {
      scheduledAt: at,
      executionStatus: "CONFIRMED",
      ...(roomUrl && !meeting.place ? { place: roomUrl } : {}),
      // 日程が決まったので次アクションを「実施→議事メモ入力」に進める
      nextAction: "MTGを実施し、議事メモと結果（繋げる人物の確認）を入力する",
      nextActionDue: new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1, -9, 0)),
    },
  });
  await recordHistory(prisma, {
    entityType: "VENDOR_MEETING",
    entityId: meeting.id,
    field: "executionStatus",
    fromValue: meeting.executionStatus,
    toValue: "CONFIRMED",
    note: `チャットの「${sourceBody.slice(0, 40).replace(/\n/g, " ")}」から日時を読み取り`,
    changedById: null,
  });
  await reopenVendorMeetingStatus(prisma, updated.vendorId, meeting.id, null);
  const title = `【MTG確定】${vendorName} ${fmtDateTime(at)}`;
  await notify({ userId: meeting.assigneeId, type: "TASK_ASSIGNED", title, body: "チャットの日時を読み取って確定にしました。違っていればMTG詳細で修正してください。", linkUrl: `/meetings/${meeting.id}`, dedupeKey: `saleshub:confirm:${meeting.id}:${at.getTime()}`, line });
  await notifyAdmins({ type: "APPROVED", title, linkUrl: `/meetings/${meeting.id}`, dedupeKey: `saleshub:confirm-admin:${meeting.id}:${at.getTime()}`, line });
}

/**
 * 日程調整中のMTGを、取り込み済みのやりとり全体で判定し直し、チャットで日時が決まっていれば確定にする。
 * 判定ルールを改善したときや、決め手のメッセージが既に取り込まれていた場合のため（定期実行）。
 * 決め手のメッセージが最後のステータス変更より新しいときだけ確定にする（人が日程調整中へ戻した判断は尊重）。
 */
export async function confirmPendingFromChats(): Promise<string[]> {
  const threads = await prisma.saleshubThread.findMany({
    where: { importedMeetingId: { not: null } },
    include: { messages: { orderBy: { sentAt: "asc" } } },
  });
  const confirmed: string[] = [];
  const done = new Set<number>();
  for (const t of threads) {
    const meetingId = t.importedMeetingId!;
    if (done.has(meetingId)) continue;
    done.add(meetingId);
    const meeting = await prisma.vendorMeeting.findUnique({ where: { id: meetingId } });
    if (!meeting || meeting.executionStatus !== "SCHEDULING") continue;
    const sameVendor = threads.filter((x) => x.importedMeetingId === meetingId || (x.vendorId && x.vendorId === t.vendorId));
    const msgs = sameVendor.flatMap((x) => x.messages).sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
    const sched = evaluateThreadSchedule(msgs);
    if (!sched.confirmedAt || !sched.sourceAt) continue;
    const lastChange = await prisma.statusHistory.findFirst({
      where: { entityType: "VENDOR_MEETING", entityId: meetingId, field: "executionStatus" },
      orderBy: { changedAt: "desc" },
    });
    if (sched.sourceAt <= (lastChange?.changedAt ?? meeting.createdAt)) continue;
    await confirmMeetingFromChat(meeting, sched.confirmedAt, sched.source ?? "", t.vendorName);
    confirmed.push(`${t.vendorName}（${fmtDateTime(sched.confirmedAt)}）`);
  }
  return confirmed;
}

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
    // 指名された繋ぎ先：このスレッドと、同じベンダーの他スレッドで松田が提示した会社
    const own = mine.flatMap((m) => extractCompanies(m.body, [thread.vendorName]));
    const others = await proposedCompaniesForVendor(vendorId);
    const candidates = [...own, ...others].filter((c, i, arr) => arr.findIndex((x) => normalizeCompanyName(x.company) === normalizeCompanyName(c.company)) === i);
    // 同じベンダーにまだ終わっていないMTGがあれば、新しく作らずそこにまとめる（別の依頼でも事前MTGは1回のことが多い）
    const open = await prisma.vendorMeeting.findFirst({
      where: { vendorId, executionStatus: { in: ["SCHEDULING", "CONFIRMED", "RESCHEDULE"] } },
      orderBy: { id: "asc" },
    });
    if (open) {
      const fee = thread.fee ?? ((await prisma.vendor.findUnique({ where: { id: vendorId } }))?.referralFee || null);
      await prisma.vendorMeeting.update({
        where: { id: open.id },
        data: {
          requestNote: [
            open.requestNote,
            [
              `―― 同じベンダーの別の依頼（${fmtDateTime(requestMsg.sentAt)}）――`,
              thread.requestTitle ? `依頼: ${thread.requestTitle}` : "",
              thread.fee ? `紹介単価（協力金）: ¥${thread.fee.toLocaleString()}` : "",
              own.length ? `ピックアップ: ${own.map((c) => c.company + (c.dept ? " / " + c.dept : "")).join("、")}` : "",
              `ベンダーからの連絡:\n${requestMsg.body}`,
              `セールスハブ: https://saleshub.jp/proposals/${thread.proposalId}`,
            ]
              .filter(Boolean)
              .join("\n"),
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      });
      await prisma.saleshubThread.update({ where: { id: thread.id }, data: { importedMeetingId: open.id } });
      meetingId = open.id;
      const { created } = await registerCandidates(vendorId, own, "松田の初回メッセージ（別の依頼）", fee);
      await notify({
        userId: open.assigneeId,
        type: "TASK_ASSIGNED",
        title: `【同じMTGにまとめました】${thread.vendorName} の別の依頼`,
        body: [thread.requestTitle ?? "", created ? `紹介候補 ${created} 件を登録` : "", "事前MTGは今のMTGにまとめています。別に行う場合はMTGを登録してください。"].filter(Boolean).join("\n"),
        linkUrl: `/meetings/${open.id}`,
        dedupeKey: `saleshub:task:${thread.id}`,
        line,
      });
    } else {
    const meeting = await prisma.vendorMeeting.create({
      data: {
        vendorId,
        assigneeId: schedulerId,
        format: "ONLINE",
        // 会議室URL（Zoom等）は打ち合わせURL、日程調整ツールのURLは日程調整URLへ
        place: urls.find(isMeetingRoomUrl) ?? null,
        schedulingUrl: urls.find(isSchedulingToolUrl) ?? urls.find((u) => !isMeetingRoomUrl(u)) ?? null,
        approvalStatus: "APPROVED",
        executionStatus: "SCHEDULING",
        fee: thread.fee,
        nextAction: urls.length ? "日程調整URLから候補日を予約し、チャットで日時を返信する" : "ベンダーと日程調整して日時を返信する",
        nextActionDue: addDays(new Date(), 2),
        requestNote: [
          thread.requestTitle ? `依頼: ${thread.requestTitle}` : "",
          thread.fee ? `紹介単価（協力金）: ¥${thread.fee.toLocaleString()}` : "紹介単価（協力金）: 未取得",
          candidates.length ? `ピックアップ（単価 ${thread.fee ? "¥" + thread.fee.toLocaleString() : "未取得"}）: ${candidates.map((c) => c.company + (c.dept ? " / " + c.dept : "")).join("、")}` : "",
          `ベンダーからの連絡（${fmtDateTime(requestMsg.sentAt)}）:\n${requestMsg.body}`,
          `セールスハブ: https://saleshub.jp/proposals/${thread.proposalId}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    });
    meetingId = meeting.id;
    await reopenVendorMeetingStatus(prisma, vendorId, meeting.id, null);
    await recordHistory(prisma, { entityType: "VENDOR_MEETING", entityId: meeting.id, field: "approvalStatus", fromValue: null, toValue: "APPROVED", note: "セールスハブ連携により自動作成（承認不要）", changedById: null });
    await prisma.saleshubThread.update({ where: { id: thread.id }, data: { importedMeetingId: meeting.id } });
    const { created, unmatched } = await registerCandidates(vendorId, candidates, "松田の初回メッセージ", thread.fee ?? ((await prisma.vendor.findUnique({ where: { id: vendorId } }))?.referralFee || null));
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
  }

  // --- 2. 日時の読み取り → 確定 ---
  if (meetingId) {
    const meeting = await prisma.vendorMeeting.findUnique({ where: { id: meetingId } });
    if (meeting && meeting.executionStatus !== "DONE" && meeting.executionStatus !== "CANCELLED" && meeting.executionStatus !== "NO_MEETING") {
      // スレッド全体から「確定している日時」を求める（候補日を出しただけでは確定にしない）
      const sched = evaluateThreadSchedule(allMessages);
      const found = sched.confirmedAt && meeting.executionStatus !== "RESCHEDULE" ? { at: sched.confirmedAt, msg: { body: sched.source ?? "" } } : null;
      // 日程調整中なら確定にする。確定済みで日時が違う場合は、手で直した後より新しいメッセージで決まったときだけ更新する
      const newer = !!sched.sourceAt && sched.sourceAt > meeting.updatedAt;
      if (
        found &&
        (meeting.executionStatus === "SCHEDULING" || (meeting.executionStatus === "CONFIRMED" && newer && (!meeting.scheduledAt || meeting.scheduledAt.getTime() !== found.at.getTime())))
      ) {
        await confirmMeetingFromChat(meeting, found.at, found.msg.body, thread.vendorName, line);
      }
    }
  }

  // --- 3. ベンダーが途中で挙げた会社名 → 紹介候補 ---
  const vendorId = thread.vendorId ?? (meetingId ? (await prisma.vendorMeeting.findUnique({ where: { id: meetingId } }))?.vendorId ?? null : null);
  if (vendorId) {
    for (const m of vendorMessages) {
      const companies = extractCompanies(m.body, [thread.vendorName]);
      if (companies.length === 0) continue;
      // 松田が提示済みの会社（指名された繋ぎ先）は依頼の単価、それ以外の新顔は単価未定
      const proposed = await proposedCompaniesForVendor(vendorId);
      const known = companies.filter((c) => isProposed(c.company, proposed));
      const fresh = companies.filter((c) => !isProposed(c.company, proposed));
      const vendorFee = thread.fee ?? ((await prisma.vendor.findUnique({ where: { id: vendorId } }))?.referralFee || null);
      const r1 = known.length ? await registerCandidates(vendorId, known, `ベンダーが指名 ${fmtDateTime(m.sentAt)}`, vendorFee) : { created: 0, unmatched: [] as string[] };
      const r2 = fresh.length ? await registerCandidates(vendorId, fresh, `ベンダーがチャットで言及 ${fmtDateTime(m.sentAt)}`, null) : { created: 0, unmatched: [] as string[] };
      const created = r1.created + r2.created;
      const unmatched = [...r1.unmatched, ...r2.unmatched];
      if (created || unmatched.length) {
        await notifyAdmins({
          type: "SALESHUB_MESSAGE",
          title: `【紹介候補】${thread.vendorName} が ${companies.map((c) => c.company).join("、")} に関心`,
          body: [r1.created ? `指名された繋ぎ先 ${r1.created} 件を登録（単価 ${vendorFee ? "¥" + vendorFee.toLocaleString() : "未取得"}）` : "", r2.created ? `新たに挙がった会社 ${r2.created} 件を単価未定で登録（紹介案件で単価を入力してください）` : "", unmatched.length ? `繋がりリストに未登録: ${unmatched.join("、")}` : ""].filter(Boolean).join("\n"),
          linkUrl: `/saleshub/${thread.id}`,
          dedupeKey: `saleshub:cand:${m.id}`,
          line,
        });
      }
    }
    // 候補登録のあとで判定する（同じメッセージで挙がって断られた会社も見送りにする）
    await applyDeclines(vendorId, thread.vendorName, vendorMessages, { line });
  }
}

/**
 * 取り込み済みの全スレッドを見直して紹介候補を再抽出する。
 * 繋がりリストを後から取り込んだ場合（過去メッセージの会社名が未照合）に使う。
 */
export async function rebuildCandidates(): Promise<{ threads: number; created: number; unmatched: string[] }> {
  // 確定済みなのに「日程調整」の次アクションが残っているMTGを直す
  const stale = await prisma.vendorMeeting.findMany({ where: { executionStatus: "CONFIRMED", scheduledAt: { not: null }, nextAction: { contains: "日程調整" } } });
  for (const m of stale) {
    const at = m.scheduledAt!;
    await prisma.vendorMeeting.update({
      where: { id: m.id },
      data: { nextAction: "MTGを実施し、議事メモと結果（繋げる人物の確認）を入力する", nextActionDue: new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1, -9, 0)) },
    });
  }
  const threads = await prisma.saleshubThread.findMany({ include: { messages: { orderBy: { sentAt: "asc" } } } });
  let created = 0;
  const unmatched = new Set<string>();
  for (const t of threads) {
    if (t.messages.length === 0) continue;
    const vendorId = t.vendorId ?? (await ensureVendor(t));
    const sources: { body: string; note: string; fee: number | null }[] = [];
    const proposed = await proposedCompaniesForVendor(vendorId);
    const fee = t.fee ?? ((await prisma.vendor.findUnique({ where: { id: vendorId } }))?.referralFee || null);
    for (const m of t.messages.filter((m) => m.isMine)) sources.push({ body: m.body, note: "松田が提示", fee });
    for (const m of t.messages.filter((m) => !m.isMine)) sources.push({ body: m.body, note: `ベンダーがチャットで言及 ${fmtDateTime(m.sentAt)}`, fee: null });
    for (const s of sources) {
      const companies = extractCompanies(s.body, [t.vendorName]);
      if (!companies.length) continue;
      const known = companies.filter((c) => s.fee !== null || isProposed(c.company, proposed));
      const fresh = companies.filter((c) => s.fee === null && !isProposed(c.company, proposed));
      if (known.length) {
        const r = await registerCandidates(vendorId, known, s.fee !== null ? s.note : `ベンダーが指名 ${s.note.replace("ベンダーがチャットで言及 ", "")}`, fee);
        created += r.created;
        r.unmatched.forEach((u) => unmatched.add(u));
      }
      if (fresh.length) {
        const r = await registerCandidates(vendorId, fresh, s.note, null);
        created += r.created;
        r.unmatched.forEach((u) => unmatched.add(u));
      }
    }
  }
  // ベンダーが見送りと連絡した会社は「紹介見送り」へ
  for (const t of threads) {
    const vendorId = t.vendorId ?? (await prisma.saleshubThread.findUnique({ where: { id: t.id } }))?.vendorId;
    if (vendorId) await applyDeclines(vendorId, t.vendorName, t.messages, { line: false });
  }
  return { threads: threads.length, created, unmatched: [...unmatched] };
}

/**
 * これまでにツールが自動で「確定」にしたベンダーMTGを、新しい判定で見直す。
 * - 人が手で確定にしたもの、実施済・キャンセル・初回MTGなしは触らない
 * - 候補日を出しただけで確定していないもの → 日程調整中に戻し、日時を未定にする
 * - 確定日時が違っていたもの → 正しい日時に直す
 */
export async function reviewAutoConfirmations(changedById: number | null): Promise<{ reverted: string[]; corrected: string[]; kept: string[] }> {
  const reverted: string[] = [];
  const corrected: string[] = [];
  const kept: string[] = [];
  const threads = await prisma.saleshubThread.findMany({
    where: { importedMeetingId: { not: null } },
    include: { messages: { orderBy: { sentAt: "asc" } } },
  });
  for (const t of threads) {
    const meeting = await prisma.vendorMeeting.findUnique({ where: { id: t.importedMeetingId! } });
    if (!meeting || meeting.executionStatus !== "CONFIRMED") continue;
    const lastStatusChange = await prisma.statusHistory.findFirst({
      where: { entityType: "VENDOR_MEETING", entityId: meeting.id, field: "executionStatus" },
      orderBy: { changedAt: "desc" },
    });
    // 人が確定にした（changedById あり）ものは尊重する
    if (!lastStatusChange || lastStatusChange.changedById !== null || lastStatusChange.toValue !== "CONFIRMED") continue;
    // 同じベンダーの全スレッドのやりとりで判定（スレッドが分かれている場合があるため）
    const sameVendor = threads.filter((x) => x.importedMeetingId === meeting.id || (x.vendorId && x.vendorId === t.vendorId));
    const msgs = sameVendor.flatMap((x) => x.messages).sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
    const sched = evaluateThreadSchedule(msgs);
    const label = `${t.vendorName}（${meeting.scheduledAt ? fmtDateTime(meeting.scheduledAt) : "日時なし"}）`;
    if (!sched.confirmedAt) {
      await prisma.vendorMeeting.update({
        where: { id: meeting.id },
        data: { executionStatus: "SCHEDULING", scheduledAt: null, nextAction: "候補日を提示済み：ベンダーの返答を待って日時を確定する", nextActionDue: null },
      });
      await recordHistory(prisma, {
        entityType: "VENDOR_MEETING",
        entityId: meeting.id,
        field: "executionStatus",
        fromValue: "CONFIRMED",
        toValue: "SCHEDULING",
        note: `自動確定の見直し：候補日の提示だけで、まだ確定していないため戻しました（元の日時 ${meeting.scheduledAt ? fmtDateTime(meeting.scheduledAt) : "なし"}）`,
        changedById,
      });
      reverted.push(label);
    } else if (!meeting.scheduledAt || meeting.scheduledAt.getTime() !== sched.confirmedAt.getTime()) {
      await prisma.vendorMeeting.update({ where: { id: meeting.id }, data: { scheduledAt: sched.confirmedAt } });
      await recordHistory(prisma, {
        entityType: "VENDOR_MEETING",
        entityId: meeting.id,
        field: "scheduledAt",
        fromValue: meeting.scheduledAt ? fmtDateTime(meeting.scheduledAt) : null,
        toValue: fmtDateTime(sched.confirmedAt),
        note: "自動確定の見直し：チャットで確定した日時に修正",
        changedById,
      });
      corrected.push(`${t.vendorName}（${meeting.scheduledAt ? fmtDateTime(meeting.scheduledAt) : "なし"} → ${fmtDateTime(sched.confirmedAt)}）`);
    } else {
      kept.push(label);
    }
  }
  return { reverted, corrected, kept };
}
