// DIAGNOSTIC BYPASS — middleware enforcement temporarily disabled.
// Auth logic removed to isolate whether middleware is the blocker.
// Restore full enforcement after test results are confirmed.
import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

// Matcher unchanged — routes still flow through middleware, just unenforced.
export const config = {
  matcher: ["/", "/axis", "/axis/:path*"],
};
