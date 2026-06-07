import { createClient } from "@supabase/supabase-js";
import type { AxisEvent } from "./axis-primitives";
import { axisServerSupabaseOptions, getAxisSupabaseServerEnv, logAxisSupabaseClientEnv } from "./axis-supabase-server";

export type AxisEventPersistContext = {
  organizationId?: string | null;
  sessionId?: string | null;
  sourceJobId: string;
  userId?: string | null;
  videoId?: string | null;
};

export type AxisEventPersistResult =
  | { eventCount: number; stored: true }
  | { code: "SUPABASE_SERVICE_ROLE_MISSING" | "SUPABASE_WRITE_FAILED"; reason: string; stored: false };

export function getAxisEventsClient() {
  const env = logAxisSupabaseClientEnv("axis_events");
  if (!env) return null;

  return createClient(env.url, env.key, axisServerSupabaseOptions);
}

export async function storeAxisEvents(events: AxisEvent[], context: AxisEventPersistContext): Promise<AxisEventPersistResult> {
  const supabase = getAxisEventsClient();
  if (!supabase) {
    return {
      code: "SUPABASE_SERVICE_ROLE_MISSING",
      reason: "SUPABASE_SERVICE_ROLE_KEY is required for Axis event writes.",
      stored: false,
    };
  }

  if (!events.length) return { eventCount: 0, stored: true };

  const rows = events.map((event) => ({
    confidence: event.confidence,
    detection_count: getNumber(event.metadata?.detection_count) ?? 0,
    ended_at: event.ended_at,
    frame_end: event.frame_end,
    frame_start: event.frame_start,
    id: event.id,
    label: event.type,
    metadata: event.metadata ?? {},
    note: `${event.type} event generated from ${context.sourceJobId}`,
    organization_id: getUuid(context.organizationId),
    origin_x: event.origin.x,
    origin_y: event.origin.y,
    participant_track_ids: event.participant_track_ids,
    position_snapshot: event.position_snapshot,
    primary_track_id: event.primary_track_id,
    session_id: getUuid(context.sessionId),
    source_job_id: context.sourceJobId,
    started_at: event.started_at,
    tallies: event.tallies,
    terminus_x: event.terminus?.x ?? null,
    terminus_y: event.terminus?.y ?? null,
    time_seconds: event.started_at / 1000,
    track_count: getNumber(event.metadata?.track_count) ?? 0,
    type: event.type,
    user_id: getUuid(context.userId),
    video_id: context.videoId ?? null,
    zone: event.zone,
  }));

  const { error } = await supabase.from("axis_events").upsert(rows, { onConflict: "id" });
  if (error) {
    const env = getAxisSupabaseServerEnv();
    console.error("AXIS_SUPABASE_WRITE_ERROR", {
      client: "axis_events",
      diagnostics: env.diagnostics,
      error: error.message,
      operation: "upsert",
      table: "axis_events",
    });
    return { code: "SUPABASE_WRITE_FAILED", reason: error.message, stored: false };
  }

  return { eventCount: rows.length, stored: true };
}

function getUuid(value?: string | null) {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
