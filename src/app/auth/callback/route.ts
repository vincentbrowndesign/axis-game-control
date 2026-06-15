import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/auth")) {
    return "/axis";
  }
  return value;
}

function authErrorRedirect(request: NextRequest) {
  const url = new URL("/auth", request.url);
  url.searchParams.set("next", "/axis");
  url.searchParams.set("error", "callback");
  return NextResponse.redirect(url);
}

function redactedCallbackUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  if (url.searchParams.has("code")) {
    url.searchParams.set("code", "[present]");
  }
  return `${url.pathname}${url.search}`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeReturnPath(request.nextUrl.searchParams.get("next"));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("AXIS_AUTH_TRACE callback_start", {
    url: redactedCallbackUrl(request),
    hasCode: Boolean(code),
    next,
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasSupabaseAnonKey: Boolean(supabaseAnonKey),
  });

  if (!code || !supabaseUrl || !supabaseAnonKey) {
    const response = authErrorRedirect(request);
    console.log("AXIS_AUTH_TRACE callback_redirect", {
      reason: "missing_code_or_env",
      destination: response.headers.get("location"),
    });
    return response;
  }

  const redirectUrl = new URL(next, request.url);
  let response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        console.log("AXIS_AUTH_TRACE callback_set_cookies", {
          names: cookiesToSet.map(({ name }) => name),
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.log("AXIS_AUTH_TRACE callback_exchange", {
      ok: false,
      message: error.message,
      status: error.status,
    });
    response = authErrorRedirect(request);
  } else {
    console.log("AXIS_AUTH_TRACE callback_exchange", { ok: true });
  }

  console.log("AXIS_AUTH_TRACE callback_redirect", {
    reason: error ? "exchange_failed" : "exchange_success",
    destination: response.headers.get("location"),
  });

  return response;
}
