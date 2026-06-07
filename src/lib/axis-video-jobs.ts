import { createClient } from "@supabase/supabase-js";
import type { AxisBallProcessingStageUpdate, AxisBallTrackPoint, AxisPlayerTrackPoint } from "./axis-ball-processing";
import { axisServerSupabaseOptions, getAxisSupabaseServerEnv, logAxisSupabaseClientEnv } from "./axis-supabase-server";

export type AxisVideoJobStatus =
  | "axis_processing"
  | "failed"
  | "ready_for_axis_processing"
  | "replay_ready"
  | "stream_processing"
  | "uploaded"
  | "uploading";
export type AxisVideoProcessingStage = AxisBallProcessingStageUpdate | "complete" | "failed" | "queued" | "uploading";
export type AxisSupabaseErrorCode =
  | "SUPABASE_OWNERSHIP_MISSING"
  | "SUPABASE_READ_FORBIDDEN"
  | "SUPABASE_RLS_BLOCKED"
  | "SUPABASE_SERVICE_ROLE_MISSING"
  | "SUPABASE_WRITE_FAILED";

export type AxisVideoJobRecord = {
  asset_id: string;
  ball_track: AxisBallTrackPoint[];
  ball_track_count: number;
  cloudflare_uid: string;
  created_at?: string;
  detection_count: number;
  error: string | null;
  file_size: number;
  filename: string;
  frame_count: number;
  id?: string;
  job_id: string;
  mp4_ready_at: string | null;
  mux_playback_id: string | null;
  mux_upload_id: string | null;
  organization_id: string | null;
  processing_stage: AxisVideoProcessingStage;
  progress: number;
  player_track: AxisPlayerTrackPoint[];
  player_track_count: number;
  replay_cloudflare_uid: string | null;
  replay_export_height: number | null;
  replay_export_path: string | null;
  replay_export_size_bytes: number | null;
  replay_export_width: number | null;
  replay_mp4_url: string | null;
  replay_video_url: string | null;
  session_id: string | null;
  status: AxisVideoJobStatus;
  storage_path: string;
  storage_provider: "cloudflare" | "mux" | "supabase";
  trigger_run_id: string | null;
  upload_url_created_at: string | null;
  updated_at?: string;
  user_id: string | null;
  video_ready_at: string | null;
  video_id: string | null;
  video_url: string;
};

type AxisSupabaseFailure = {
  code: AxisSupabaseErrorCode;
  reason: string;
  stored: false;
};

export function getAxisVideoJobClient() {
  const env = logAxisSupabaseClientEnv("axis_video_jobs");
  if (!env) return null;

  return createClient(env.url, env.key, axisServerSupabaseOptions);
}

export async function createAxisVideoJob(record: AxisVideoJobRecord) {
  const supabase = getAxisVideoJobClient();
  if (!supabase) return supabaseFailure("SUPABASE_SERVICE_ROLE_MISSING", "SUPABASE_SERVICE_ROLE_KEY is required for Axis video job writes.");
  if (!record.user_id) return supabaseFailure("SUPABASE_OWNERSHIP_MISSING", "Axis video jobs require user_id before creation.");

  const { data, error } = await supabase
    .from("axis_video_jobs")
    .insert({
      asset_id: record.asset_id,
      ball_track: record.ball_track,
      ball_track_count: record.ball_track_count,
      cloudflare_uid: record.cloudflare_uid,
      detection_count: record.detection_count,
      error: record.error,
      file_size: record.file_size,
      filename: record.filename,
      frame_count: record.frame_count,
      job_id: record.job_id,
      mp4_ready_at: record.mp4_ready_at,
      mux_playback_id: record.mux_playback_id,
      mux_upload_id: record.mux_upload_id,
      organization_id: record.organization_id,
      processing_stage: record.processing_stage,
      progress: record.progress,
      player_track: record.player_track,
      player_track_count: record.player_track_count,
      replay_cloudflare_uid: record.replay_cloudflare_uid,
      replay_export_height: record.replay_export_height,
      replay_export_path: record.replay_export_path,
      replay_export_size_bytes: record.replay_export_size_bytes,
      replay_export_width: record.replay_export_width,
      replay_mp4_url: record.replay_mp4_url,
      replay_video_url: record.replay_video_url,
      session_id: record.session_id,
      status: record.status,
      storage_path: record.storage_path,
      storage_provider: record.storage_provider,
      trigger_run_id: record.trigger_run_id,
      upload_url_created_at: record.upload_url_created_at,
      user_id: record.user_id,
      video_ready_at: record.video_ready_at,
      video_id: record.video_id,
      video_url: record.video_url,
    })
    .select()
    .single();

  if (error) {
    logSupabaseWriteError("insert", error.message);
    return supabaseFailure(getWriteErrorCode(error.message), error.message);
  }
  return { record: mapAxisVideoJobRow(data), stored: true as const };
}

export async function getAxisVideoJob(jobId: string) {
  const supabase = getAxisVideoJobClient();
  if (!supabase) return { code: "SUPABASE_SERVICE_ROLE_MISSING" as const, error: "SUPABASE_SERVICE_ROLE_KEY is required for Axis video job reads.", record: null };

  const { data, error } = await supabase.from("axis_video_jobs").select("*").eq("job_id", jobId).maybeSingle();

  if (error) return { code: getReadErrorCode(error.message), error: error.message, record: null };
  return { code: null, error: null, record: data ? mapAxisVideoJobRow(data) : null };
}

export async function getAxisVideoJobByCloudflareUid(cloudflareUid: string) {
  const supabase = getAxisVideoJobClient();
  if (!supabase) return { code: "SUPABASE_SERVICE_ROLE_MISSING" as const, error: "SUPABASE_SERVICE_ROLE_KEY is required for Axis video job reads.", record: null };

  const { data, error } = await supabase
    .from("axis_video_jobs")
    .select("*")
    .eq("cloudflare_uid", cloudflareUid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { code: getReadErrorCode(error.message), error: error.message, record: null };
  return { code: null, error: null, record: data ? mapAxisVideoJobRow(data) : null };
}

export async function updateAxisVideoJob(jobId: string, patch: Partial<AxisVideoJobRecord>) {
  const supabase = getAxisVideoJobClient();
  if (!supabase) return supabaseFailure("SUPABASE_SERVICE_ROLE_MISSING", "SUPABASE_SERVICE_ROLE_KEY is required for Axis video job updates.");

  const { data, error } = await supabase
    .from("axis_video_jobs")
    .update({
      ...("ball_track" in patch ? { ball_track: patch.ball_track ?? [] } : {}),
      ...("ball_track_count" in patch ? { ball_track_count: patch.ball_track_count ?? 0 } : {}),
      ...("cloudflare_uid" in patch ? { cloudflare_uid: patch.cloudflare_uid ?? "" } : {}),
      ...("detection_count" in patch ? { detection_count: patch.detection_count ?? 0 } : {}),
      ...("error" in patch ? { error: patch.error ?? null } : {}),
      ...("file_size" in patch ? { file_size: patch.file_size ?? 0 } : {}),
      ...("filename" in patch ? { filename: patch.filename ?? "" } : {}),
      ...("frame_count" in patch ? { frame_count: patch.frame_count ?? 0 } : {}),
      ...("mp4_ready_at" in patch ? { mp4_ready_at: patch.mp4_ready_at ?? null } : {}),
      ...("organization_id" in patch ? { organization_id: patch.organization_id ?? null } : {}),
      ...("processing_stage" in patch ? { processing_stage: patch.processing_stage ?? "queued" } : {}),
      ...("progress" in patch ? { progress: clampProgress(patch.progress) } : {}),
      ...("player_track" in patch ? { player_track: patch.player_track ?? [] } : {}),
      ...("player_track_count" in patch ? { player_track_count: patch.player_track_count ?? 0 } : {}),
      ...("replay_cloudflare_uid" in patch ? { replay_cloudflare_uid: patch.replay_cloudflare_uid ?? null } : {}),
      ...("replay_export_height" in patch ? { replay_export_height: patch.replay_export_height ?? null } : {}),
      ...("replay_export_path" in patch ? { replay_export_path: patch.replay_export_path ?? null } : {}),
      ...("replay_export_size_bytes" in patch ? { replay_export_size_bytes: patch.replay_export_size_bytes ?? null } : {}),
      ...("replay_export_width" in patch ? { replay_export_width: patch.replay_export_width ?? null } : {}),
      ...("replay_mp4_url" in patch ? { replay_mp4_url: patch.replay_mp4_url ?? null } : {}),
      ...("replay_video_url" in patch ? { replay_video_url: patch.replay_video_url ?? null } : {}),
      ...("session_id" in patch ? { session_id: patch.session_id ?? null } : {}),
      ...("status" in patch ? { status: patch.status } : {}),
      ...("trigger_run_id" in patch ? { trigger_run_id: patch.trigger_run_id ?? null } : {}),
      ...("upload_url_created_at" in patch ? { upload_url_created_at: patch.upload_url_created_at ?? null } : {}),
      ...("user_id" in patch ? { user_id: patch.user_id ?? null } : {}),
      ...("video_ready_at" in patch ? { video_ready_at: patch.video_ready_at ?? null } : {}),
      ...("video_id" in patch ? { video_id: patch.video_id ?? null } : {}),
      ...("video_url" in patch ? { video_url: patch.video_url ?? "" } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .select()
    .single();

  if (error) {
    logSupabaseWriteError("update", error.message);
    return supabaseFailure(getWriteErrorCode(error.message), error.message);
  }
  return { record: mapAxisVideoJobRow(data), stored: true as const };
}

function mapAxisVideoJobRow(row: unknown): AxisVideoJobRecord {
  const record = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
  const ballTrack = Array.isArray(record.ball_track) ? record.ball_track.filter(isBallTrackPoint) : [];

  return {
    asset_id: getString(record.asset_id),
    ball_track: ballTrack,
    ball_track_count: getNumber(record.ball_track_count) ?? ballTrack.length,
    cloudflare_uid: getString(record.cloudflare_uid),
    created_at: getString(record.created_at),
    detection_count: getNumber(record.detection_count) ?? 0,
    error: getString(record.error) || null,
    file_size: getNumber(record.file_size) ?? 0,
    filename: getString(record.filename),
    frame_count: getNumber(record.frame_count) ?? 0,
    id: getString(record.id),
    job_id: getString(record.job_id),
    mp4_ready_at: getString(record.mp4_ready_at) || null,
    mux_playback_id: getString(record.mux_playback_id) || null,
    mux_upload_id: getString(record.mux_upload_id) || null,
    organization_id: getString(record.organization_id) || null,
    processing_stage: getStage(record.processing_stage),
    progress: clampProgress(getNumber(record.progress) ?? 0),
    player_track: Array.isArray(record.player_track) ? record.player_track.filter(isPlayerTrackPoint) : [],
    player_track_count: getNumber(record.player_track_count) ?? (Array.isArray(record.player_track) ? record.player_track.length : 0),
    replay_cloudflare_uid: getString(record.replay_cloudflare_uid) || null,
    replay_export_height: getNumber(record.replay_export_height) ?? null,
    replay_export_path: getString(record.replay_export_path) || null,
    replay_export_size_bytes: getNumber(record.replay_export_size_bytes) ?? null,
    replay_export_width: getNumber(record.replay_export_width) ?? null,
    replay_mp4_url: getString(record.replay_mp4_url) || null,
    replay_video_url: getString(record.replay_video_url) || null,
    session_id: getString(record.session_id) || null,
    status: getStatus(record.status),
    storage_path: getString(record.storage_path),
    storage_provider: getStorageProvider(record.storage_provider),
    trigger_run_id: getString(record.trigger_run_id) || null,
    upload_url_created_at: getString(record.upload_url_created_at) || null,
    updated_at: getString(record.updated_at),
    user_id: getString(record.user_id) || null,
    video_ready_at: getString(record.video_ready_at) || null,
    video_id: getString(record.video_id) || null,
    video_url: getString(record.video_url),
  };
}

function isBallTrackPoint(value: unknown): value is AxisBallTrackPoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const point = value as Record<string, unknown>;
  return ["confidence", "frame", "time", "x", "y"].every((key) => typeof point[key] === "number");
}

function isPlayerTrackPoint(value: unknown): value is AxisPlayerTrackPoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.id === "string" &&
    ["confidence", "frame", "time", "x", "y"].every((key) => typeof point[key] === "number")
  );
}

function clampProgress(value: unknown) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getStatus(value: unknown): AxisVideoJobStatus {
  if (
    value === "axis_processing" ||
    value === "failed" ||
    value === "ready_for_axis_processing" ||
    value === "replay_ready" ||
    value === "stream_processing" ||
    value === "uploaded" ||
    value === "uploading"
  ) {
    return value;
  }
  return "uploading";
}

function getStorageProvider(value: unknown): "cloudflare" | "mux" | "supabase" {
  if (value === "cloudflare") return "cloudflare";
  return value === "mux" ? "mux" : "supabase";
}

function getStage(value: unknown): AxisVideoProcessingStage {
  if (
    value === "queued" ||
    value === "building_track" ||
    value === "complete" ||
    value === "detecting_basketball" ||
    value === "extracting_frames" ||
    value === "failed" ||
    value === "rendering_replay" ||
    value === "uploading"
  ) {
    return value;
  }

  return "queued";
}

function supabaseFailure(code: AxisSupabaseErrorCode, reason: string): AxisSupabaseFailure {
  return { code, reason, stored: false };
}

function getWriteErrorCode(message: string): AxisSupabaseErrorCode {
  return /row-level security|rls/i.test(message) ? "SUPABASE_RLS_BLOCKED" : "SUPABASE_WRITE_FAILED";
}

function getReadErrorCode(message: string): AxisSupabaseErrorCode {
  return /permission|forbidden|row-level security|rls/i.test(message) ? "SUPABASE_READ_FORBIDDEN" : "SUPABASE_WRITE_FAILED";
}

function logSupabaseWriteError(operation: string, error: string) {
  const env = getAxisSupabaseServerEnv();
  console.error("AXIS_SUPABASE_WRITE_ERROR", {
    client: "axis_video_jobs",
    diagnostics: env.diagnostics,
    error,
    operation,
    table: "axis_video_jobs",
  });
}
