import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import crypto from "node:crypto";

export type AxisSupabaseServerEnvDiagnostics = {
  anonKeyExists: boolean;
  anonKeyLength: number;
  serviceKeyExists: boolean;
  serviceKeyHasWhitespace: boolean;
  serviceKeyLength: number;
  serviceKeyRole: string | null;
  serviceKeyWasQuoted: boolean;
  serviceKeyFormat: "jwt" | "sb_secret" | "unknown";
  serviceKeyHashFirst8: string | null;
  serviceKeyHashLast8: string | null;
  serviceKeySource: "SUPABASE_SERVICE_ROLE_KEY";
  urlExists: boolean;
  urlHost: string | null;
  urlValid: boolean;
  urlWasQuoted: boolean;
};

export type AxisSupabaseServerEnv =
  | {
      diagnostics: AxisSupabaseServerEnvDiagnostics;
      key: string;
      ok: true;
      url: string;
    }
  | {
      code: "SUPABASE_SERVICE_ROLE_MISSING" | "SUPABASE_SERVICE_ROLE_INVALID" | "SUPABASE_URL_MISSING" | "SUPABASE_URL_INVALID";
      diagnostics: AxisSupabaseServerEnvDiagnostics;
      ok: false;
      reason: string;
    };

class AxisDisabledRealtimeTransport {
  readonly CLOSED = 3;
  readonly CLOSING = 2;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  binaryType = "arraybuffer";
  bufferedAmount = 0;
  extensions = "";
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: unknown) => void) | null = null;
  onopen: ((event: unknown) => void) | null = null;
  protocol = "";
  readyState = 3;
  url: string;

  constructor(url: string | URL) {
    this.url = String(url);
  }

  close() {
    this.readyState = 3;
  }

  addEventListener() {
    return undefined;
  }

  dispatchEvent() {
    return false;
  }

  removeEventListener() {
    return undefined;
  }

  send() {
    throw new Error("SUPABASE_REALTIME_DISABLED");
  }
}

export const axisServerSupabaseOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: AxisDisabledRealtimeTransport,
  },
} satisfies SupabaseClientOptions<"public">;

export function getAxisSupabaseServerEnv(): AxisSupabaseServerEnv {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const rawAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const urlValue = normalizeEnvValue(rawUrl);
  const keyValue = normalizeEnvValue(rawServiceKey);
  const parsedUrl = parseUrl(urlValue.value);
  const serviceKeyRole = getJwtRole(keyValue.value);
  const serviceKeyFormat = keyValue.value.startsWith("sb_secret_")
    ? "sb_secret"
    : keyValue.value.split(".").length === 3
      ? "jwt"
      : "unknown";
  const diagnostics: AxisSupabaseServerEnvDiagnostics = {
    anonKeyExists: Boolean(normalizeEnvValue(rawAnonKey).value),
    anonKeyLength: normalizeEnvValue(rawAnonKey).value.length,
    serviceKeyExists: Boolean(keyValue.value),
    serviceKeyHasWhitespace: rawServiceKey !== rawServiceKey.trim(),
    serviceKeyLength: keyValue.value.length,
    serviceKeyRole,
    serviceKeyWasQuoted: keyValue.wasQuoted,
    serviceKeyFormat,
    serviceKeyHashFirst8: getKeyHashPart(keyValue.value, "first"),
    serviceKeyHashLast8: getKeyHashPart(keyValue.value, "last"),
    serviceKeySource: "SUPABASE_SERVICE_ROLE_KEY",
    urlExists: Boolean(urlValue.value),
    urlHost: parsedUrl?.host ?? null,
    urlValid: Boolean(parsedUrl),
    urlWasQuoted: urlValue.wasQuoted,
  };

  if (!urlValue.value) {
    return {
      code: "SUPABASE_URL_MISSING",
      diagnostics,
      ok: false,
      reason: "NEXT_PUBLIC_SUPABASE_URL is required for server-side Supabase writes.",
    };
  }
  if (!parsedUrl) {
    return {
      code: "SUPABASE_URL_INVALID",
      diagnostics,
      ok: false,
      reason: "NEXT_PUBLIC_SUPABASE_URL is not a valid URL.",
    };
  }
  if (!keyValue.value) {
    return {
      code: "SUPABASE_SERVICE_ROLE_MISSING",
      diagnostics,
      ok: false,
      reason: "SUPABASE_SERVICE_ROLE_KEY is required for server-side Supabase writes.",
    };
  }
  if (serviceKeyFormat === "jwt" && serviceKeyRole !== "service_role") {
    return {
      code: "SUPABASE_SERVICE_ROLE_INVALID",
      diagnostics,
      ok: false,
      reason: `SUPABASE_SERVICE_ROLE_KEY must be a service_role key; current JWT role is ${serviceKeyRole ?? "missing"}.`,
    };
  }
  if (serviceKeyFormat === "unknown") {
    return {
      code: "SUPABASE_SERVICE_ROLE_INVALID",
      diagnostics,
      ok: false,
      reason: "SUPABASE_SERVICE_ROLE_KEY does not look like a Supabase service role key.",
    };
  }

  return {
    diagnostics,
    key: keyValue.value,
    ok: true,
    url: urlValue.value,
  };
}

export function assertAxisSupabaseServerEnv(stage: string) {
  const env = getAxisSupabaseServerEnv();
  console.log("AXIS_SUPABASE_ENV_CHECK", {
    ...env.diagnostics,
    createClientUrl: env.ok ? env.url : null,
    keyHashFirst8: env.diagnostics.serviceKeyHashFirst8,
    keyHashLast8: env.diagnostics.serviceKeyHashLast8,
    keySourceName: env.diagnostics.serviceKeySource,
    ok: env.ok,
    stage,
    ...(env.ok ? {} : { code: env.code, reason: env.reason }),
  });
  if (!env.ok) {
    throw new Error(`${env.code}: ${env.reason}`);
  }
  return env;
}

export function logAxisSupabaseClientEnv(client: string) {
  const env = getAxisSupabaseServerEnv();
  if (!env.ok) {
    console.error("AXIS_SUPABASE_CLIENT_ENV_INVALID", {
      ...env.diagnostics,
      client,
      code: env.code,
      reason: env.reason,
    });
    return null;
  }
  console.log("AXIS_SUPABASE_CREATE_CLIENT", {
    client,
    createClientUrl: env.url,
    keyHashFirst8: env.diagnostics.serviceKeyHashFirst8,
    keyHashLast8: env.diagnostics.serviceKeyHashLast8,
    keySourceName: env.diagnostics.serviceKeySource,
  });
  return env;
}

export async function verifyAxisSupabaseServiceRoleConnectivity(stage: string) {
  const env = assertAxisSupabaseServerEnv(`${stage}:connectivity`);
  const supabase = createClient(env.url, env.key, axisServerSupabaseOptions);

  const authResponse = await supabase.auth.getUser().catch((error: unknown) => ({
    data: null,
    error,
  }));
  const authError = normalizeSupabaseError(authResponse.error);
  console.log("AXIS_SUPABASE_SERVICE_ROLE_AUTH_CHECK", {
    authResponse: {
      hasUser: Boolean(authResponse.data?.user),
      userId: authResponse.data?.user?.id ?? null,
    },
    error: authError,
    keyHashFirst8: env.diagnostics.serviceKeyHashFirst8,
    keyHashLast8: env.diagnostics.serviceKeyHashLast8,
    keySourceName: env.diagnostics.serviceKeySource,
    stage,
    url: env.url,
  });

  const selectUrl = `${env.url.replace(/\/+$/, "")}/rest/v1/axis_events?select=id&limit=1`;
  const selectResponse = await fetch(selectUrl, {
    headers: {
      Authorization: `Bearer ${env.key}`,
      apikey: env.key,
    },
  });
  const selectBody = await selectResponse.text().catch(() => "");
  const parsedBody = parseJson(selectBody);
  console.log("AXIS_SUPABASE_SERVICE_ROLE_SELECT_CHECK", {
    body: parsedBody ?? selectBody.slice(0, 500),
    error: selectResponse.ok ? null : getResponseError(parsedBody, selectBody),
    keyHashFirst8: env.diagnostics.serviceKeyHashFirst8,
    keyHashLast8: env.diagnostics.serviceKeyHashLast8,
    keySourceName: env.diagnostics.serviceKeySource,
    request: {
      table: "axis_events",
      url: selectUrl,
    },
    stage,
    status: selectResponse.status,
    statusText: selectResponse.statusText,
  });
}

function normalizeEnvValue(value: string) {
  const trimmed = value.trim();
  const quote = trimmed[0];
  const wasQuoted =
    trimmed.length >= 2 &&
    (quote === "\"" || quote === "'") &&
    trimmed[trimmed.length - 1] === quote;
  return {
    value: wasQuoted ? trimmed.slice(1, -1).trim() : trimmed,
    wasQuoted,
  };
}

function parseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function getJwtRole(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(toBase64(parts[1]), "base64").toString("utf8")) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function toBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
}

function getKeyHashPart(value: string, part: "first" | "last") {
  if (!value) return null;
  const hash = crypto.createHash("sha256").update(value).digest("hex");
  return part === "first" ? hash.slice(0, 8) : hash.slice(-8);
}

function normalizeSupabaseError(error: unknown) {
  if (!error) return null;
  if (typeof error === "object" && !Array.isArray(error)) {
    const record = error as Record<string, unknown>;
    return {
      code: typeof record.code === "string" ? record.code : null,
      message: typeof record.message === "string" ? record.message : String(error),
      name: typeof record.name === "string" ? record.name : null,
      status: typeof record.status === "number" ? record.status : null,
    };
  }
  return { code: null, message: String(error), name: null, status: null };
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function getResponseError(parsedBody: unknown, rawBody: string) {
  if (parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)) {
    const record = parsedBody as Record<string, unknown>;
    return {
      code: typeof record.code === "string" ? record.code : null,
      details: typeof record.details === "string" ? record.details : null,
      hint: typeof record.hint === "string" ? record.hint : null,
      message: typeof record.message === "string" ? record.message : rawBody.slice(0, 500),
    };
  }
  return { code: null, details: null, hint: null, message: rawBody.slice(0, 500) };
}
