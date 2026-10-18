import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap first gate: visitors with no session cookie are sent to the matching login page.
 * Real authorisation (valid session, role, institute) happens in each layout and route.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has("cg_session")) return NextResponse.next();
  const area = request.nextUrl.pathname.split("/")[1];
  return NextResponse.redirect(new URL(`/login/${area}`, request.url));
}

export const config = { matcher: ["/student/:path*", "/alumni/:path*", "/admin/:path*"] };
