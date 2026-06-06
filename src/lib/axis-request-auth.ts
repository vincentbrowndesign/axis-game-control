import { createClient } from "@supabase/supabase-js";

export type AxisRequestAuthResult =
  | {
      code: null;
      userId: string;
    }
  | {
      code: "SUPABASE_OWNERSHIP_MISSING" | "SUPABASE_READ_FORBIDDEN";
      reason: string;
      userId: null;
    };

export async function getAxisRequestUser(request: Request): Promise<AxisRequestAuthResult> {
  const token = getBearerToken(request);
  if (!token) {
    return {
      code: "SUPABASE_OWNERSHIP_MISSING",
      reason: "Authenticated Supabase bearer token is required.",
      userId: null,
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return {
      code: "SUPABASE_READ_FORBIDDEN",
      reason: "Supabase auth client is not configured.",
      userId: null,
    };
  }

  const supabase = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) {
    return {
      code: "SUPABASE_READ_FORBIDDEN",
      reason: error?.message ?? "Authenticated Supabase user could not be verified.",
      userId: null,
    };
  }

  return {
    code: null,
    userId: data.user.id,
  };
}

export function assertAxisJobOwner({
  requestUserId,
  recordUserId,
}: {
  requestUserId: string;
  recordUserId: string | null;
}) {
  if (!recordUserId) {
    return {
      code: "SUPABASE_OWNERSHIP_MISSING" as const,
      reason: "Axis job ownership is missing; legacy rows require backfill before user reads.",
    };
  }

  if (recordUserId !== requestUserId) {
    return {
      code: "SUPABASE_READ_FORBIDDEN" as const,
      reason: "Axis job belongs to a different user.",
    };
  }

  return null;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}
