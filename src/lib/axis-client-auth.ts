"use client";

import { getSupabaseBrowserClient } from "./supabase-browser";

export async function getAxisAccessToken() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  return token;
}

export async function createAxisAuthHeaders(base?: HeadersInit, accessToken?: string | null) {
  const headers = new Headers(base);
  const token = accessToken === undefined ? await getAxisAccessToken() : accessToken;
  if (token) headers.set("Authorization", `Bearer ${token}`);
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
