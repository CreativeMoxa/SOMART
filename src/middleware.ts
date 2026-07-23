import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Edge middleware: cheap gate + it forwards the pathname so the admin layout
// can run the real, database-backed permission check. Deep validation
// (suspended employee, revoked session, single-device) happens server-side in
// the layout/API routes — this only avoids rendering for signed-out visitors.
const SESSION_COOKIE = "somart_session";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/register", "/admin/forgot"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  const isAdminArea = pathname.startsWith("/admin");
  const isPublicAdmin = PUBLIC_ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isAdminArea && !isPublicAdmin) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    let valid = false;
    if (token && process.env.AUTH_SECRET) {
      try {
        await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
        valid = true;
      } catch {
        valid = false;
      }
    }
    if (!valid) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/admin/:path*"],
};
