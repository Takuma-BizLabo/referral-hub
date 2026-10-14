import { redirect } from "next/navigation";

/** 旧カレンダーページ：ベンダーMTG一覧のカレンダー表示へ */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const { month } = await searchParams;
  const m = typeof month === "string" && /^\d{4}-\d{2}$/.test(month) ? month : null;
  redirect(`/meetings?view=calendar${m ? `&month=${m}` : ""}`);
}
