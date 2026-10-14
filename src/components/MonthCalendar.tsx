import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isValid, parse, startOfMonth, startOfWeek } from "date-fns";
import { ja } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

/** 月カレンダー：ベンダーMTG（青）と紹介面談（紫）。monthHref は前月・翌月・今月のリンクを作る */
export async function MonthCalendar({ month, monthHref }: { month?: string; monthHref: (month: string | null) => string }) {
  let base = month ? parse(month, "yyyy-MM", new Date()) : new Date();
  if (!isValid(base)) base = new Date();
  const mStart = startOfMonth(base);
  const mEnd = endOfMonth(base);
  const gridStart = startOfWeek(mStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(mEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const [meetings, referrals] = await Promise.all([
    prisma.vendorMeeting.findMany({
      where: { scheduledAt: { gte: gridStart, lte: gridEnd }, executionStatus: { notIn: ["CANCELLED", "NO_MEETING"] } },
      include: { vendor: true, assignee: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.referral.findMany({
      where: { meetingAt: { gte: gridStart, lte: gridEnd }, status: { not: "DECLINED" } },
      include: { vendor: true, contact: true },
      orderBy: { meetingAt: "asc" },
    }),
  ]);
  const today = new Date();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={monthHref(format(addMonths(mStart, -1), "yyyy-MM"))} className="btn-secondary btn-sm">
          ← 前月
        </Link>
        <span className="px-2 text-sm font-medium">{format(mStart, "yyyy年M月", { locale: ja })}</span>
        <Link href={monthHref(format(addMonths(mStart, 1), "yyyy-MM"))} className="btn-secondary btn-sm">
          翌月 →
        </Link>
        <Link href={monthHref(null)} className="btn-secondary btn-sm">
          今月
        </Link>
        <span className="ml-auto flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-200" />
            ベンダーMTG
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-indigo-200" />
            紹介面談
          </span>
        </span>
      </div>
      <div className="card overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
            {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
              <div key={d} className={cn("px-2 py-1.5 text-center", i === 0 && "text-rose-500", i === 6 && "text-blue-500")}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const ms = meetings.filter((m) => m.scheduledAt && isSameDay(m.scheduledAt, day));
              const rs = referrals.filter((r) => r.meetingAt && isSameDay(r.meetingAt, day));
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  className={cn("min-h-24 border-b border-r border-gray-100 p-1", !isSameMonth(day, mStart) && "bg-gray-50 text-gray-400", isToday && "bg-blue-50/60")}
                >
                  <div className={cn("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs", isToday && "bg-blue-600 font-medium text-white")}>{format(day, "d")}</div>
                  <div className="space-y-0.5">
                    {ms.map((m) => (
                      <Link
                        key={`m${m.id}`}
                        href={`/meetings/${m.id}`}
                        className={cn("block truncate rounded bg-sky-100 px-1 py-0.5 text-[11px] text-sky-900 hover:bg-sky-200", m.executionStatus === "DONE" && "opacity-60")}
                        title={`${format(m.scheduledAt!, "HH:mm")} ${m.vendor.name}（${m.assignee.name}）`}
                      >
                        {format(m.scheduledAt!, "HH:mm")} {m.vendor.name}
                      </Link>
                    ))}
                    {rs.map((r) => (
                      <Link
                        key={`r${r.id}`}
                        href={`/referrals/${r.id}`}
                        className={cn("block truncate rounded bg-indigo-100 px-1 py-0.5 text-[11px] text-indigo-900 hover:bg-indigo-200", r.status === "MEETING_DONE" && "opacity-60")}
                        title={`${format(r.meetingAt!, "HH:mm")} ${r.contact.company ?? r.contact.name} × ${r.vendor.name}`}
                      >
                        {format(r.meetingAt!, "HH:mm")} {r.contact.company ?? r.contact.name}×{r.vendor.name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
