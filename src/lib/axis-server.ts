import { createServerClient } from "@supabase/ssr";

export interface AxisThread {
  id: string;
  user_id: string | null;
  title: string | null;
  goal: string | null;
  focus: string | null;
  current_bottleneck: string | null;
  created_at: string;
  updated_at: string;
}

export interface AxisBelief {
  id: string;
  thread_id: string;
  belief_id: string | null;
  statement: string;
  status: "active" | "confirmed" | "rejected";
  confidence: number;
  created_at: string;
}

export interface AxisEvent {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: Record<string, unknown>;
  created_at: string;
}

export interface AxisCard {
  type:
    | "insight"
    | "question"
    | "experiment"
    | "evidence_request"
    | "breakthrough"
    | "next_action";
  content: string;
  secondary?: string;
  cue?: string;
}

export interface SidebarThread {
  id: string;
  title: string | null;
  focus: string | null;
  current_bottleneck: string | null;
  updated_at: string;
}

export function createSupabaseFromRequest(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const parsed = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .flatMap((c) => {
      const eqIdx = c.indexOf("=");
      if (eqIdx < 0) return [];
      return [{ name: c.slice(0, eqIdx).trim(), value: c.slice(eqIdx + 1).trim() }];
    });

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => parsed, setAll: () => {} } },
  );
}
