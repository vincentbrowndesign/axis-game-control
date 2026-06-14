import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Pass request headers through so cookies set during this request are visible
  // to the page handler that runs after middleware.
  let response = NextResponse.next({ request: { headers: request.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, block access rather than silently allow it.
  if (!url || !key) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/auth";
    return NextResponse.redirect(dest);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Write cookies onto the request so downstream handlers can read them.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // Rebuild the response with updated cookies so the browser receives them.
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getSession reads from the cookie. For /axis this is sufficient —
  // full token verification happens on the Supabase server for sensitive operations.
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/auth";
    return NextResponse.redirect(dest);
  }

  return response;
}

// Protect /axis and all sub-paths. Auth routes are left unmatched.
export const config = {
  matcher: ["/axis", "/axis/:path*"],
};
