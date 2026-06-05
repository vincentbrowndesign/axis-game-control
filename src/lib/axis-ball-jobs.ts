import { createClient } from "@supabase/supabase-js";
import type { AxisBallTrackPoint } from "./axis-ball-processing";

export type AxisBallJobStatus = "failed" | "processing" | "ready";

export type AxisBallJobRecord = {
  ball_track: AxisBallTrackPoint[];
  ball_track_count: number;
  created_at?: string;
  detection_count: number;
  error: string | null;
  frame_count: number;
  job_id: string;
  mux_playback_id: string | null;
  mux_upload_id: string | null;
  status: AxisBallJobStatus;
  storage_path: string;
  storage_provider: "mux";
  trigger_run_id: string | null;
  updated_at?: string;
  video_url: string;
};

export function getAxisBallJobClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function createAxisBallJob(record: AxisBallJobRecord) {
  const supabase = getAxisBallJobClient();
  if (!supabase) return { reason: "supabase_not_configured", stored: false as const };

  const { data, error } = await supabase
    .from("axis_ball_jobs")
    .insert({
      ball_track: record.ball_track,
      ball_track_count: record.ball_track_count,
      detection_count: record.detection_count,
      error: record.error,
      frame_count: record.frame_count,
      job_id: record.job_id,
      mux_playback_id: record.mux_playback_id,
      mux_upload_id: record.mux_upload_id,
      status: record.status,
      storage_path: record.storage_path,
      storage_provider: record.storage_provider,
      trigger_run_id: record.trigger_run_id,
      video_url: record.video_url,
    })
    .select()
    .single();

  if (error) return { reason: error.message, stored: false as const };
  return { record: mapAxisBallJobRow(data), stored: true as const };
}

export async function getAxisBallJob(jobId: string) {
  const supabase = getAxisBallJobClient();
  if (!supabase) return { error: "supabase_not_configured", record: null };

  const { data, error } = await supabase
    .from("axis_ball_jobs")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) return { error: error.message, record: null };
  return { error: null, record: data ? mapAxisBallJobRow(data) : null };
}

export async function updateAxisBallJob(jobId: string, patch: Partial<AxisBallJobRecord>) {
  const supabase = getAxisBallJobClient();
  if (!supabase) return { reason: "supabase_not_configured", stored: false as const };

  const { data, error } = await supabase
    .from("axis_ball_jobs")
    .update({
      ...("ball_track" in patch ? { ball_track: patch.ball_track ?? [] } : {}),
      ...("ball_track_count" in patch ? { ball_track_count: patch.ball_track_count ?? 0 } : {}),
      ...("detection_count" in patch ? { detection_count: patch.detection_count ?? 0 } : {}),
      ...("error" in patch ? { error: patch.error ?? null } : {}),
      ...("frame_count" in patch ? { frame_count: patch.frame_count ?? 0 } : {}),
      ...("status" in patch ? { status: patch.status } : {}),
      ...("trigger_run_id" in patch ? { trigger_run_id: patch.trigger_run_id ?? null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .select()
    .single();

  if (error) return { reason: error.message, stored: false as const };
  return { record: mapAxisBallJobRow(data), stored: true as const };
}

function mapAxisBallJobRow(row: unknown): AxisBallJobRecord {
  const record = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
  const ballTrack = Array.isArray(record.ball_track)
    ? record.ball_track.filter(isBallTrackPoint)
    : [];

  return {
    ball_track: ballTrack,
    ball_track_count: getNumber(record.ball_track_count) ?? ballTrack.length,
    created_at: getString(record.created_at),
    detection_count: getNumber(record.detection_count) ?? 0,
    error: getString(record.error) || null,
    frame_count: getNumber(record.frame_count) ?? 0,
    job_id: getString(record.job_id),
    mux_playback_id: getString(record.mux_playback_id) || null,
    mux_upload_id: getString(record.mux_upload_id) || null,
    status: getStatus(record.status),
    storage_path: getString(record.storage_path),
    storage_provider: "mux",
    trigger_run_id: getString(record.trigger_run_id) || null,
    updated_at: getString(record.updated_at),
    video_url: getString(record.video_url),
  };
}

function isBallTrackPoint(value: unknown): value is AxisBallTrackPoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const point = value as Record<string, unknown>;
  return ["confidence", "frame", "time", "x", "y"].every((key) => typeof point[key] === "number");
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getStatus(value: unknown): AxisBallJobStatus {
  if (value === "ready" || value === "failed") return value;
  return "processing";
}
