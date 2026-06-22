import { createClient } from "@supabase/supabase-js";
import type { AxisSession, AxisSessionDraftCreateRequest } from "./axis/types";
import {
  axisServerSupabaseOptions,
  getAxisSupabaseServerEnv,
} from "./axis-supabase-server";

type AxisSessionDraftResult<T> =
  | { ok: true; value: T }
  | { error: string; ok: false };

type AxisSessionDraftRow = {
  created_at: string;
  id: string;
  player_id: string | null;
  player_name: string | null;
  session_type: AxisSession["sessionType"];
  status: AxisSession["status"];
  title: string;
  updated_at: string;
};

function getAxisSessionDraftClient() {
  const env = getAxisSupabaseServerEnv();
  if (!env.ok) return null;
  return createClient(env.url, env.key, axisServerSupabaseOptions);
}

export async function createAxisSessionDraft({
  ownerId,
  session,
}: {
  ownerId: string;
  session: AxisSessionDraftCreateRequest;
}): Promise<AxisSessionDraftResult<AxisSession>> {
  const supabase = getAxisSessionDraftClient();
  if (!supabase) return { error: "Supabase is not configured.", ok: false };

  const title = session.title.trim();
  if (!title) return { error: "Session title is required.", ok: false };

  const { data, error } = await supabase
    .from("axis_session_drafts")
    .insert({
      created_at: session.createdAt,
      owner_id: ownerId,
      player_id: session.playerId ?? null,
      player_name: session.playerName?.trim() || null,
      session_type: session.sessionType,
      status: "draft",
      title,
      updated_at: new Date().toISOString(),
    })
    .select("id,title,player_name,player_id,session_type,status,created_at,updated_at")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Session draft could not be created.", ok: false };
  }

  return { ok: true, value: mapSessionDraftRow(data as AxisSessionDraftRow) };
}

export async function listAxisSessionDrafts(
  ownerId: string,
): Promise<AxisSessionDraftResult<AxisSession[]>> {
  const supabase = getAxisSessionDraftClient();
  if (!supabase) return { error: "Supabase is not configured.", ok: false };

  const { data, error } = await supabase
    .from("axis_session_drafts")
    .select("id,title,player_name,player_id,session_type,status,created_at,updated_at")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) return { error: error.message, ok: false };

  return {
    ok: true,
    value: ((data ?? []) as AxisSessionDraftRow[]).map(mapSessionDraftRow),
  };
}

function mapSessionDraftRow(row: AxisSessionDraftRow): AxisSession {
  return {
    createdAt: row.created_at,
    id: row.id,
    ...(row.player_id ? { playerId: row.player_id } : {}),
    ...(row.player_name ? { playerName: row.player_name } : {}),
    persisted: true,
    sessionType: row.session_type,
    source: "backend",
    status: row.status,
    title: row.title,
  };
}
