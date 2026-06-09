"use client";

import { getSupabaseBrowserClient } from "./supabase-browser";

export async function getAxisAccessToken() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    console.info("AXIS_AUTH_STATE", { hasSession: false, provider: "supabase", reason: "not_configured" });
    console.info("AXIS_ACCESS_TOKEN_PRESENT", false);
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  console.info("AXIS_AUTH_STATE", {
    error: error?.message ?? null,
    hasSession: Boolean(data.session),
    provider: "supabase",
    userId: data.session?.user?.id ?? null,
  });
  console.info("AXIS_ACCESS_TOKEN_PRESENT", Boolean(token));
  return token;
}

export async function createAxisAuthHeaders(base?: HeadersInit, accessToken?: string | null) {
  const headers = new Headers(base);
  const token = accessToken === undefined ? await getAxisAccessToken() : accessToken;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  console.info("AXIS_UPLOAD_AUTH_HEADER_ATTACHED", {
    attached: headers.has("Authorization"),
  });
  return headers;
}

export async function axisAuthenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    headers: await createAxisAuthHeaders(init.headers),
  });
}

export async function axisFetchWithAccessToken(accessToken: string | null, input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    headers: await createAxisAuthHeaders(init.headers, accessToken),
  });
}
