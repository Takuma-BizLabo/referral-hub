import Link from "next/link";
import { addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parse, startOfMonth, startOfWeek, eachDayOfInterval, isValid } from "date-fns";
import { ja } from "date-fns/locale";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { cleanParams } from "@/lib/params";
import { cn } from "@/lib/utils";

export const metadata = { title: "カレンダー" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireUser();
  const { month } = cleanParams(await searchParams);
  let base = month ? parse(month, "yyyy-MM", new Date()) : new Date();
  if (!isValid(base)) base = new Date();
  const mStart = startOfMonth(base);
  const mEnd = endOfMonth(base);
  const gridStart = startOfWeek(mStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(mEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const [meetings, referrals] = await Promise.all([
    prisma.vendorMeeting.findMany({
      where: { scheduledAt: { gte: gridStart, lte: gridEnd }, executionStatus: { not: "CANCELLED" } },
      include: { vendor: true, assignee: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.referral.findMany({
      where: { meetingAt: { gte: gridStart, lte: gridEnd }, status: { in: ["SCHEDULING", "MEETING_CONFIRMED", "MEETING_DONE"] } },
      include: { vendor: true, contact: true },
      orderBy: { meetingAt: "asc" },
    }),
  ]);
  const today = new Date();
  const prev = format(addMonths(mStart, -1), "yyyy-MM");
  const next = format(addMonths(mStart, 1), "yyyy-MM");

  return (
    <div>
      <PageHeader
        title="カレンダー"
        description="ベンダーMTG（青）と紹介面談（紫）"
        actions={
          <>
            <Link href={`/meetings/calendar?month=${prev}`} className="btn-secondary">
              ← 前月
            </Link>
            <span className="text-sm font-medium px-2">{format(mStart, "yyyy年M月", { locale: ja })}</span>
            <Link href={`/meetings/calendar?month=${next}`} className="btn-secondary">
              翌月 →
            </Link>
            <Link href="/meetings/calendar" className="btn-secondary">
              今月
            </Link>
            <Link href="/meetings" className="btn-secondary">
              リストへ
            </Link>
          </>
        }
      />
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
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-24 border-b border-r border-gray-100 p-1",
                    !isSameMonth(day, mStart) && "bg-gray-50 text-gray-400",
                  )}
                >
                  <div
                    className={cn(
                      "text-xs mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                      isSameDay(day, today) && "bg-blue-600 text-white font-medium",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {ms.map((m) => (
                      <Link
                        key={`m${m.id}`}
                        href={`/meetings/${m.id}`}
                        className="block truncate rounded bg-sky-100 text-sky-900 px-1 py-0.5 text-[11px] hover:bg-sky-200"
                        title={`${format(m.scheduledAt!, "HH:mm")} ${m.vendor.name}（${m.assignee.name}）`}
                      >
                        {format(m.scheduledAt!, "HH:mm")} {m.vendor.name}
                      </Link>
                    ))}
                    {rs.map((r) => (
                      <Link
                        key={`r${r.id}`}
                        href={`/referrals/${r.id}`}
                        className="block truncate rounded bg-indigo-100 text-indigo-900 px-1 py-0.5 text-[11px] hover:bg-indigo-200"
                        title={`${format(r.meetingAt!, "HH:mm")} ${r.contact.name} × ${r.vendor.name}`}
                      >
                        {format(r.meetingAt!, "HH:mm")} {r.contact.name}×{r.vendor.name}
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
