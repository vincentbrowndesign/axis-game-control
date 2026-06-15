import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function redirectToAuth(request: NextRequest) {
  const dest = request.nextUrl.clone();
  const returnPath = request.nextUrl.pathname === "/"
    ? "/axis"
    : `${request.nextUrl.pathname}${request.nextUrl.search}`;
  dest.pathname = "/auth";
  dest.search = "";
  dest.searchParams.set("next", returnPath);
  console.log("AXIS_AUTH_TRACE middleware_redirect", {
    path: request.nextUrl.pathname,
    destination: `${dest.pathname}${dest.search}`,
  });
  return NextResponse.redirect(dest);
}

export async function middleware(request: NextRequest) {
  console.log("AXIS_AUTH_TRACE middleware_start", {
    path: request.nextUrl.pathname,
  });

  // Pass request headers through so cookies set during this request are visible
  // to the page handler that runs after middleware.
  let response = NextResponse.next({ request: { headers: request.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, block access rather than silently allow it.
  if (!url || !key) {
    console.log("AXIS_AUTH_TRACE middleware_get_user", {
      ok: false,
      reason: "missing_supabase_env",
    });
    return redirectToAuth(request);
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

  const { data: { user }, error } = await supabase.auth.getUser();

  console.log("AXIS_AUTH_TRACE middleware_get_user", {
    ok: Boolean(user) && !error,
    hasUser: Boolean(user),
    error: error?.message ?? null,
  });

  if (error || !user) {
    return redirectToAuth(request);
  }

  return response;
}

// Protect the Axis surfaces. Auth routes are left unmatched.
export const config = {
  matcher: ["/", "/axis", "/axis/:path*"],
};
