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
  // ── Cookie inventory ────────────────────────────────────────────────────────
  // Logged before anything else — this is the ground truth of what the edge
  // runtime actually received. If a cookie visible in Chrome DevTools is absent
  // here, the mismatch is domain, path, or sameSite, not the Supabase client.
  const allCookies = request.cookies.getAll();
  const sbCookies = allCookies.filter((c) => c.name.startsWith("sb-"));

  console.log("AXIS_AUTH_TRACE middleware_start", {
    path: request.nextUrl.pathname,
    hostname: request.nextUrl.hostname,
    protocol: request.nextUrl.protocol,
    // Total cookies the edge runtime received for this request
    cookieCount: allCookies.length,
    // All cookie names (no values — values may contain tokens)
    cookieNames: allCookies.map((c) => c.name),
    // Supabase-specific cookies only
    sbCookieCount: sbCookies.length,
    sbCookieNames: sbCookies.map((c) => c.name),
    // First 40 chars of each sb- cookie value — enough to confirm presence
    // and format (should start with "base64-" or a URL-encoded JSON chunk)
    // without exposing the full JWT.
    sbCookiePreviews: sbCookies.map((c) => ({
      name: c.name,
      valueLength: c.value.length,
      valueHead: c.value.slice(0, 40),
    })),
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

  // ── getSession: reads from cookie only, no network call ───────────────────
  // If this has a session but getUser() does not, the JWT is present but
  // the Supabase server rejected it (expired, wrong project, wrong secret).
  // If this has no session, the cookie reading is broken (domain, path, name).
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  console.log("AXIS_AUTH_TRACE middleware_get_session", {
    hasSession: Boolean(sessionData.session),
    sessionUserId: sessionData.session?.user?.id?.slice(0, 8) ?? null,
    sessionExpiresAt: sessionData.session?.expires_at ?? null,
    sessionError: sessionError?.message ?? null,
    // Which provider was used — helps identify anonymous vs Google vs email
    sessionProvider: sessionData.session?.user?.app_metadata?.provider ?? null,
    sessionIsAnonymous: (sessionData.session?.user as { is_anonymous?: boolean } | undefined)?.is_anonymous ?? null,
  });

  // ── getUser: verifies the JWT with the Supabase server ─────────────────────
  // This makes a network round-trip. Failure here after getSession() succeeds
  // means the token is present but the Supabase project rejected it.
  const { data: { user }, error } = await supabase.auth.getUser();

  console.log("AXIS_AUTH_TRACE middleware_get_user", {
    ok: Boolean(user) && !error,
    hasUser: Boolean(user),
    userId: user?.id?.slice(0, 8) ?? null,
    error: error?.message ?? null,
    // Surface the full error code if present — "invalid_token" vs "session_not_found"
    // are different failure modes with different fixes.
    errorCode: (error as { code?: string } | null)?.code ?? null,
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
