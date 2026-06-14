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
  return NextResponse.redirect(dest);
}

export async function middleware(request: NextRequest) {
  // Pass request headers through so cookies set during this request are visible
  // to the page handler that runs after middleware.
  let response = NextResponse.next({ request: { headers: request.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, block access rather than silently allow it.
  if (!url || !key) {
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

  if (error || !user) {
    return redirectToAuth(request);
  }

  return response;
}

// Protect the Axis surfaces. Auth routes are left unmatched.
export const config = {
  matcher: ["/", "/axis", "/axis/:path*"],
};
