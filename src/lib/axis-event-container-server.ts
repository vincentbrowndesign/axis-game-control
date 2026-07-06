import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { axisServerSupabaseOptions, getAxisSupabaseServerEnv } from "./axis-supabase-server";

// Server-only service role access for the Axis Event Container tables.
// RLS is enabled with no policies, so every read/write goes through here.

export type AxisContainerClientResult =
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; code: string; reason: string };

export function getAxisContainerClient(): AxisContainerClientResult {
  const env = getAxisSupabaseServerEnv();
  if (!env.ok) return { ok: false, code: env.code, reason: env.reason };
  return { ok: true, supabase: createClient(env.url, env.key, axisServerSupabaseOptions) };
}
