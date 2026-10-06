import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSettingRaw } from "@/lib/settings";
import { ingestFromExtension, type IngestPayload } from "@/lib/saleshub/ingest";

export const maxDuration = 60;

function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

function tokenMatches(provided: string, token: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

const MAX_BODY_BYTES = 8_000_000;

/** Chrome 拡張からの受信口。Authorization: Bearer <接続トークン> */
export async function POST(req: Request) {
  const token = await getSettingRaw("saleshub.ingestToken");
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || !provided || !tokenMatches(provided, token)) {
    return cors(NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  }
  // 巨大な本文は読み込む前に断る
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return cors(NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 }));
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return cors(NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }));
  }
  // 形の検証（想定外の形でも 500 にしない）
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return cors(NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 }));
  const r = raw as Record<string, unknown>;
  if ((r.listHtml !== undefined && typeof r.listHtml !== "string") || (r.details !== undefined && !Array.isArray(r.details))) {
    return cors(NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 }));
  }
  const details = ((r.details as unknown[] | undefined) ?? []).filter(
    (d): d is { proposalId: string; html: string } =>
      !!d && typeof d === "object" && typeof (d as { proposalId?: unknown }).proposalId === "string" && typeof (d as { html?: unknown }).html === "string" && /^\d{1,12}$/.test((d as { proposalId: string }).proposalId),
  );
  const payload: IngestPayload = {
    listHtml: typeof r.listHtml === "string" ? r.listHtml : undefined,
    details,
    loggedOut: r.loggedOut === true,
    extensionVersion: typeof r.extensionVersion === "string" ? r.extensionVersion.slice(0, 40) : undefined,
  };
  const size = (payload.listHtml?.length ?? 0) + details.reduce((a, d) => a + d.html.length, 0);
  if (size > 6_000_000) return cors(NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 }));
  try {
    const result = await ingestFromExtension(payload);
    return cors(NextResponse.json(result));
  } catch (e) {
    console.error("[saleshub] ingest error", e);
    return cors(NextResponse.json({ ok: false, error: "internal error" }, { status: 500 }));
  }
}
