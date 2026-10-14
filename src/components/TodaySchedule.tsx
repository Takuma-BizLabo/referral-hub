import Link from "next/link";
import { addDays, format, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/utils";

type Item = { key: string; at: Date; kind: "MTG" | "面談"; title: string; sub: string; href: string; url: string | null; done: boolean };

/** 今日の商談（ベンダーMTGと紹介面談）。なければ次の予定を出す */
export async function TodaySchedule() {
  const start = startOfDay(new Date());
  const end = addDays(start, 1);
  const horizon = addDays(start, 60);
  const [meetings, referrals] = await Promise.all([
    prisma.vendorMeeting.findMany({
      where: { scheduledAt: { gte: start, lt: horizon }, executionStatus: { notIn: ["CANCELLED", "NO_MEETING"] } },
      include: { vendor: true, assignee: true },
      orderBy: { scheduledAt: "asc" },
      take: 50,
    }),
    prisma.referral.findMany({
      where: { meetingAt: { gte: start, lt: horizon }, status: { not: "DECLINED" } },
      include: { vendor: true, contact: true },
      orderBy: { meetingAt: "asc" },
      take: 50,
    }),
  ]);
  const items: Item[] = [
    ...meetings.map((m) => ({
      key: `m${m.id}`,
      at: m.scheduledAt!,
      kind: "MTG" as const,
      title: m.vendor.name,
      sub: `ベンダーMTG ・ ${m.assignee.name}`,
      href: `/meetings/${m.id}`,
      url: m.place && /^https?:\/\//.test(m.place) ? m.place : null,
      done: m.executionStatus === "DONE",
    })),
    ...referrals.map((r) => ({
      key: `r${r.id}`,
      at: r.meetingAt!,
      kind: "面談" as const,
      title: `${r.contact.company ?? r.contact.name}${r.contact.company ? `（${r.contact.name}）` : ""}`,
      sub: `紹介面談 ・ ${r.vendor.name}`,
      href: `/referrals/${r.id}`,
      url: r.meetingPlace && /^https?:\/\//.test(r.meetingPlace) ? r.meetingPlace : null,
      done: r.status === "MEETING_DONE",
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const todays = items.filter((i) => i.at < end);
  const tomorrow = items.filter((i) => i.at >= end && i.at < addDays(end, 1)).length;
  const next = items.find((i) => i.at >= end);

  return (
    <div className="card mb-3 border-blue-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
        <div className="font-semibold text-gray-900">
          今日の商談<span className="ml-1.5 text-sm font-normal text-gray-500">{format(start, "M/d(E)", { locale: ja })}</span>
          <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">{todays.length}件</span>
        </div>
        <div className="text-xs text-gray-500">
          明日 {tomorrow}件{next && todays.length === 0 ? ` ・ 次の商談 ${fmtDateTime(next.at)} ${next.title}` : ""}
        </div>
      </div>
      {todays.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">今日の商談はありません。</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {todays.map((i) => (
            <li key={i.key} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm ${i.done ? "opacity-60" : ""}`}>
              <span className="w-12 font-semibold tabular-nums text-gray-900">{format(i.at, "HH:mm")}</span>
              <span className={`badge ${i.kind === "MTG" ? "bg-sky-100 text-sky-900 border-sky-200" : "bg-indigo-100 text-indigo-900 border-indigo-200"}`}>{i.kind === "MTG" ? "ベンダーMTG" : "紹介面談"}</span>
              <Link href={i.href} className="min-w-0 font-medium text-blue-700 hover:underline">
                {i.title}
              </Link>
              <span className="text-xs text-gray-500">{i.sub}</span>
              {i.done && <span className="badge bg-pink-50 text-pink-800 border-pink-200">実施済</span>}
              {i.url && (
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="ml-auto btn-secondary btn-sm">
                  参加URLを開く ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
