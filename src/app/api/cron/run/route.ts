import { NextResponse } from "next/server";
import { runReminders } from "@/lib/cron/reminders";

/** 外部 cron から叩く用。Authorization: Bearer <CRON_SECRET> */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const provided = auth.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret") || "";
  if (!secret || provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runReminders();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
