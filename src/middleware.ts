import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/line/webhook", "/api/cron"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  // Cookie の有無だけを確認する。実際のセッション検証はサーバー側 (requireUser) で行う。
  const hasSession = req.cookies.has("rh_session");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
