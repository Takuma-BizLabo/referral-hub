import { NextResponse } from "next/server";
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

/** Chrome 拡張からの受信口。Authorization: Bearer <接続トークン> */
export async function POST(req: Request) {
  const token = await getSettingRaw("saleshub.ingestToken");
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || !provided || provided !== token) {
    return cors(NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  }
  let payload: IngestPayload;
  try {
    payload = (await req.json()) as IngestPayload;
  } catch {
    return cors(NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }));
  }
  const size = (payload.listHtml?.length ?? 0) + (payload.details ?? []).reduce((a, d) => a + (d.html?.length ?? 0), 0);
  if (size > 6_000_000) return cors(NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 }));
  try {
    const result = await ingestFromExtension(payload);
    return cors(NextResponse.json(result));
  } catch (e) {
    console.error("[saleshub] ingest error", e);
    return cors(NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 }));
  }
}
