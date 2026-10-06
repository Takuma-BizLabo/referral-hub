import { addDays, format, startOfDay, subHours } from "date-fns";
import { prisma } from "../db";
import { notify, notifyAdmins } from "../notifications";
import { getSettingNumber, getSettingRaw } from "../settings";
import { fmtDate, fmtDateTime } from "../utils";

/**
 * リマインド判定。5分おきに呼ばれても dedupeKey で二重送信しない。
 * - 前日（日次時刻）・1時間前：ベンダーMTG／紹介面談
 * - 実施後 N 時間 議事メモ未入力
 * - 次アクション期限当日・超過（日次時刻）
 * - 紹介案件の停滞（日次時刻）
 * - 入金予定日超過（日次時刻）
 */
export async function runReminders(now = new Date()): Promise<{ created: number }> {
  let created = 0;
  const count = async (p: Promise<boolean | void>) => {
    if ((await p) === true) created++;
  };
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true } });
  const adminNotify = async (input: Parameters<typeof notifyAdmins>[0]) => {
    for (const a of admins) {
      await count(notify({ ...input, userId: a.id, dedupeKey: input.dedupeKey ? `${input.dedupeKey}:u${a.id}` : null }));
    }
  };

  const digestHour = await getSettingNumber("dailyDigestHour");
  const stagnationDays = await getSettingNumber("stagnationDays");
  const minutesHours = await getSettingNumber("minutesMissingHours");
  const today = startOfDay(now);
  const todayKey = format(today, "yyyyMMdd");
  const isDigestTime = now.getHours() >= digestHour; // 日次判定はその日の指定時刻以降に1回（dedupe で担保）

  // ---- 1時間前（55〜65分前のウィンドウ）----
  const in1hStart = new Date(now.getTime() + 55 * 60 * 1000);
  const in1hEnd = new Date(now.getTime() + 65 * 60 * 1000);
  const soonMeetings = await prisma.vendorMeeting.findMany({
    where: { scheduledAt: { gte: in1hStart, lte: in1hEnd }, executionStatus: { in: ["SCHEDULING", "CONFIRMED", "RESCHEDULE"] } },
    include: { vendor: true },
  });
  for (const m of soonMeetings) {
    await count(
      notify({
        userId: m.assigneeId,
        type: "MEETING_1HOUR",
        title: `【1時間前】${m.vendor.name} のベンダーMTG ${fmtDateTime(m.scheduledAt)}`,
        body: m.place ?? undefined,
        linkUrl: `/meetings/${m.id}`,
        dedupeKey: `meeting:${m.id}:1h`,
      }),
    );
  }
  const soonReferrals = await prisma.referral.findMany({
    where: { meetingAt: { gte: in1hStart, lte: in1hEnd }, status: { in: ["SCHEDULING", "MEETING_CONFIRMED"] } },
    include: { vendor: true, contact: true },
  });
  for (const r of soonReferrals) {
    await adminNotify({
      type: "MEETING_1HOUR",
      title: `【1時間前】${r.contact.name} × ${r.vendor.name} の面談 ${fmtDateTime(r.meetingAt)}`,
      body: r.meetingPlace ?? undefined,
      linkUrl: `/referrals/${r.id}`,
      dedupeKey: `referral:${r.id}:1h`,
    });
  }

  // ---- 議事メモ未入力 ----
  const minutesDeadline = subHours(now, minutesHours);
  const missing = await prisma.vendorMeeting.findMany({
    where: { executionStatus: "DONE", minutes: null, doneAt: { lte: minutesDeadline } },
    include: { vendor: true },
  });
  for (const m of missing) {
    await count(
      notify({
        userId: m.assigneeId,
        type: "MINUTES_MISSING",
        title: `【議事メモ未入力】${m.vendor.name} のベンダーMTG`,
        body: `実施から${minutesHours}時間経過しました。議事メモを入力してください。`,
        linkUrl: `/meetings/${m.id}`,
        dedupeKey: `meeting:${m.id}:minutes`,
      }),
    );
  }
  const missingRef = await prisma.referral.findMany({
    where: { status: "MEETING_DONE", meetingResult: null, meetingDoneAt: { lte: minutesDeadline } },
    include: { vendor: true, contact: true },
  });
  for (const r of missingRef) {
    await adminNotify({
      type: "MINUTES_MISSING",
      title: `【面談結果未入力】${r.contact.name} × ${r.vendor.name}`,
      body: `面談実施から${minutesHours}時間経過しました。面談結果メモを入力してください。`,
      linkUrl: `/referrals/${r.id}`,
      dedupeKey: `referral:${r.id}:minutes`,
    });
  }

  // ---- セールスハブ連携の途絶（拡張からの受信が一定時間ない） ----
  if ((await getSettingRaw("saleshub.enabled")) === "1") {
    const last = await getSettingRaw("saleshub.lastIngestAt");
    const staleMin = await getSettingNumber("saleshubStaleMinutes");
    const lastAt = last ? new Date(last) : null;
    if (!lastAt || now.getTime() - lastAt.getTime() > staleMin * 60_000) {
      await adminNotify({
        type: "SALESHUB_MESSAGE",
        title: "【セールスハブ連携】拡張からの受信が止まっています",
        body: lastAt ? `最終受信 ${fmtDateTime(lastAt)}。セールスハブにログインした Chrome が開いているか、拡張が有効か確認してください。` : "まだ一度も受信していません。Chrome 拡張の設定を確認してください。",
        linkUrl: "/settings/saleshub",
        dedupeKey: `saleshub:stale:${format(now, "yyyyMMdd")}-${Math.floor(now.getHours() / 6)}`,
      });
    }
  }

  if (!isDigestTime) return { created };

  // ---- 前日 ----
  const tomorrowStart = addDays(today, 1);
  const tomorrowEnd = addDays(today, 2);
  const tomorrowMeetings = await prisma.vendorMeeting.findMany({
    where: { scheduledAt: { gte: tomorrowStart, lt: tomorrowEnd }, executionStatus: { in: ["SCHEDULING", "CONFIRMED", "RESCHEDULE"] } },
    include: { vendor: true },
  });
  for (const m of tomorrowMeetings) {
    await count(
      notify({
        userId: m.assigneeId,
        type: "MEETING_1DAY",
        title: `【明日】${m.vendor.name} のベンダーMTG ${fmtDateTime(m.scheduledAt)}`,
        body: m.place ?? undefined,
        linkUrl: `/meetings/${m.id}`,
        dedupeKey: `meeting:${m.id}:1d:${format(m.scheduledAt!, "yyyyMMdd")}`,
      }),
    );
  }
  const tomorrowReferrals = await prisma.referral.findMany({
    where: { meetingAt: { gte: tomorrowStart, lt: tomorrowEnd }, status: { in: ["SCHEDULING", "MEETING_CONFIRMED"] } },
    include: { vendor: true, contact: true },
  });
  for (const r of tomorrowReferrals) {
    await adminNotify({
      type: "MEETING_1DAY",
      title: `【明日】${r.contact.name} × ${r.vendor.name} の面談 ${fmtDateTime(r.meetingAt)}`,
      body: r.meetingPlace ?? undefined,
      linkUrl: `/referrals/${r.id}`,
      dedupeKey: `referral:${r.id}:1d:${format(r.meetingAt!, "yyyyMMdd")}`,
    });
  }

  // ---- 次アクション期限：当日・超過 ----
  const dueMeetings = await prisma.vendorMeeting.findMany({
    where: { nextActionDue: { lt: tomorrowStart }, nextAction: { not: null }, executionStatus: { not: "CANCELLED" } },
    include: { vendor: true },
  });
  for (const m of dueMeetings) {
    const isToday = m.nextActionDue! >= today;
    await count(
      notify({
        userId: m.assigneeId,
        type: isToday ? "DUE_TODAY" : "OVERDUE",
        title: isToday ? `【期限当日】${m.vendor.name}：${m.nextAction}` : `【期限超過】${m.vendor.name}：${m.nextAction}（${fmtDate(m.nextActionDue)}）`,
        linkUrl: `/meetings/${m.id}`,
        dedupeKey: `meeting:${m.id}:due:${todayKey}`,
      }),
    );
  }
  const dueReferrals = await prisma.referral.findMany({
    where: { nextActionDue: { lt: tomorrowStart }, nextAction: { not: null }, status: { notIn: ["MEETING_DONE", "DECLINED"] } },
    include: { vendor: true, contact: true },
  });
  for (const r of dueReferrals) {
    const isToday = r.nextActionDue! >= today;
    await adminNotify({
      type: isToday ? "DUE_TODAY" : "OVERDUE",
      title: isToday
        ? `【期限当日】${r.contact.name} × ${r.vendor.name}：${r.nextAction}`
        : `【期限超過】${r.contact.name} × ${r.vendor.name}：${r.nextAction}（${fmtDate(r.nextActionDue)}）`,
      linkUrl: `/referrals/${r.id}`,
      dedupeKey: `referral:${r.id}:due:${todayKey}`,
    });
  }

  // ---- 停滞 ----
  const stagnantSince = new Date(now.getTime() - stagnationDays * 86400000);
  const stagnant = await prisma.referral.findMany({
    where: { status: { notIn: ["MEETING_DONE", "DECLINED"] }, statusChangedAt: { lt: stagnantSince } },
    include: { vendor: true, contact: true },
  });
  for (const r of stagnant) {
    const days = Math.floor((now.getTime() - r.statusChangedAt.getTime()) / 86400000);
    // 停滞日数到達時と、その後7日ごとに通知
    const bucket = Math.floor((days - stagnationDays) / 7);
    await adminNotify({
      type: "STAGNANT",
      title: `【停滞${days}日】${r.contact.name} × ${r.vendor.name}`,
      body: "ステータスが長期間変わっていません。",
      linkUrl: `/referrals/${r.id}`,
      dedupeKey: `referral:${r.id}:stagnant:${r.statusChangedAt.getTime()}:${bucket}`,
    });
  }

  // ---- 入金遅延 ----
  const late = await prisma.referral.findMany({
    where: { rewardStatus: { in: ["APPROVED", "INVOICED"] }, paymentDueAt: { lt: today } },
    include: { vendor: true, contact: true },
  });
  for (const r of late) {
    await adminNotify({
      type: "PAYMENT_LATE",
      title: `【入金遅延】${r.vendor.name}：${r.contact.name} の紹介報酬 ¥${r.rewardAmount.toLocaleString()}`,
      body: `入金予定日 ${fmtDate(r.paymentDueAt)} を過ぎています。`,
      linkUrl: `/referrals/${r.id}`,
      dedupeKey: `referral:${r.id}:late:${todayKey}`,
    });
  }

  return { created };
}
