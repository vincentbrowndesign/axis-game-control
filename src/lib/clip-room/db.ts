import { createClient } from "@supabase/supabase-js";
import { axisServerSupabaseOptions, getAxisSupabaseServerEnv } from "../axis-supabase-server";
import type {
  ClipEvent,
  ClipEventStatus,
  ClipEventType,
  ClipPlay,
  ClipPressPack,
  ClipProof,
  ClipSetup,
  ClipShotZone,
  ClipSource,
  ClipSourceStatus,
  ClipStatLines,
} from "./types";

function getDb() {
  const env = getAxisSupabaseServerEnv();
  if (!env.ok) return null;
  return createClient(env.url, env.key, axisServerSupabaseOptions);
}

// ─── clip_sources ─────────────────────────────────────────────────────────────

function rowToClipSource(row: Record<string, unknown>): ClipSource {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    origin: row.origin as ClipSource["origin"],
    status: row.status as ClipSourceStatus,
    cloudflareUid: (row.cloudflare_uid as string | null) ?? null,
    uploadUrl: (row.upload_url as string | null) ?? null,
    videoUrl: (row.video_url as string | null) ?? null,
    filename: (row.filename as string | null) ?? null,
    fileSize: (row.file_size as number | null) ?? null,
    durationSeconds: (row.duration_seconds as number | null) ?? null,
    processingStage: (row.processing_stage as string | null) ?? null,
    processingProgress: (row.processing_progress as number) ?? 0,
    error: (row.error as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function createClipSource(record: {
  ownerId: string;
  origin: ClipSource["origin"];
  filename: string;
  fileSize: number;
  cloudflareUid: string;
  uploadUrl: string;
}) {
  const db = getDb();
  if (!db) return { error: "DB not configured", record: null };

  const { data, error } = await db
    .from("clip_sources")
    .insert({
      owner_id: record.ownerId,
      origin: record.origin,
      filename: record.filename,
      file_size: record.fileSize,
      cloudflare_uid: record.cloudflareUid,
      upload_url: record.uploadUrl,
      status: "uploading",
      processing_progress: 0,
    })
    .select()
    .single();

  if (error || !data) return { error: error?.message ?? "insert failed", record: null };
  return { error: null, record: rowToClipSource(data as Record<string, unknown>) };
}

export async function getClipSource(clipId: string) {
  const db = getDb();
  if (!db) return { error: "DB not configured", record: null };

  const { data, error } = await db
    .from("clip_sources")
    .select()
    .eq("id", clipId)
    .single();

  if (error || !data) return { error: error?.message ?? "not found", record: null };
  return { error: null, record: rowToClipSource(data as Record<string, unknown>) };
}

export async function updateClipSource(clipId: string, update: Partial<{
  status: ClipSourceStatus;
  videoUrl: string | null;
  durationSeconds: number | null;
  processingStage: string | null;
  processingProgress: number;
  error: string | null;
}>) {
  const db = getDb();
  if (!db) return { error: "DB not configured" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.status !== undefined) patch.status = update.status;
  if (update.videoUrl !== undefined) patch.video_url = update.videoUrl;
  if (update.durationSeconds !== undefined) patch.duration_seconds = update.durationSeconds;
  if (update.processingStage !== undefined) patch.processing_stage = update.processingStage;
  if (update.processingProgress !== undefined) patch.processing_progress = update.processingProgress;
  if (update.error !== undefined) patch.error = update.error;

  const { error } = await db.from("clip_sources").update(patch).eq("id", clipId);
  return { error: error?.message ?? null };
}

export async function listClipSources(ownerId: string) {
  const db = getDb();
  if (!db) return { error: "DB not configured", records: [] };

  const { data, error } = await db
    .from("clip_sources")
    .select()
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { error: error.message, records: [] };
  return { error: null, records: (data ?? []).map((r) => rowToClipSource(r as Record<string, unknown>)) };
}

// ─── clip_setups ──────────────────────────────────────────────────────────────

function rowToClipSetup(row: Record<string, unknown>): ClipSetup {
  return {
    id: row.id as string,
    clipId: row.clip_id as string,
    ownerId: row.owner_id as string,
    subjectType: row.subject_type as ClipSetup["subjectType"],
    subjectName: (row.subject_name as string | null) ?? null,
    sessionType: row.session_type as ClipSetup["sessionType"],
    jerseyColor: (row.jersey_color as string | null) ?? null,
    scoreboardVisible: (row.scoreboard_visible as ClipSetup["scoreboardVisible"]) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function upsertClipSetup(record: {
  clipId: string;
  ownerId: string;
  subjectType: ClipSetup["subjectType"];
  subjectName: string | null;
  sessionType: ClipSetup["sessionType"];
  jerseyColor: string | null;
  scoreboardVisible: ClipSetup["scoreboardVisible"] | null;
}) {
  const db = getDb();
  if (!db) return { error: "DB not configured", record: null };

  const { data, error } = await db
    .from("clip_setups")
    .upsert({
      clip_id: record.clipId,
      owner_id: record.ownerId,
      subject_type: record.subjectType,
      subject_name: record.subjectName,
      session_type: record.sessionType,
      jersey_color: record.jerseyColor,
      scoreboard_visible: record.scoreboardVisible,
    }, { onConflict: "clip_id" })
    .select()
    .single();

  if (error || !data) return { error: error?.message ?? "upsert failed", record: null };
  return { error: null, record: rowToClipSetup(data as Record<string, unknown>) };
}

export async function getClipSetup(clipId: string) {
  const db = getDb();
  if (!db) return { error: "DB not configured", record: null };

  const { data, error } = await db
    .from("clip_setups")
    .select()
    .eq("clip_id", clipId)
    .maybeSingle();

  if (error) return { error: error.message, record: null };
  if (!data) return { error: null, record: null };
  return { error: null, record: rowToClipSetup(data as Record<string, unknown>) };
}

// ─── clip_events ─────────────────────────────────────────────────────────────

function rowToClipEvent(row: Record<string, unknown>): ClipEvent {
  return {
    id: row.id as string,
    clipId: row.clip_id as string,
    ownerId: row.owner_id as string,
    eventType: row.event_type as ClipEventType,
    status: row.status as ClipEventStatus,
    timestampSeconds: (row.timestamp_seconds as number | null) ?? null,
    playerLabel: (row.player_label as string | null) ?? null,
    points: (row.points as number) ?? 0,
    shotZone: (row.shot_zone as ClipShotZone | null) ?? null,
    proof: (row.proof as ClipProof | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    sortOrder: (row.sort_order as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function insertClipEvents(events: Array<{
  clipId: string;
  ownerId: string;
  eventType: ClipEventType;
  status: ClipEventStatus;
  timestampSeconds: number | null;
  playerLabel: string | null;
  points: number;
  shotZone: ClipShotZone | null;
  proof: ClipProof | null;
  metadata: Record<string, unknown>;
  sortOrder: number;
}>) {
  const db = getDb();
  if (!db) return { error: "DB not configured" };

  const rows = events.map((e) => ({
    clip_id: e.clipId,
    owner_id: e.ownerId,
    event_type: e.eventType,
    status: e.status,
    timestamp_seconds: e.timestampSeconds,
    player_label: e.playerLabel,
    points: e.points,
    shot_zone: e.shotZone,
    proof: e.proof,
    metadata: e.metadata,
    sort_order: e.sortOrder,
  }));

  const { error } = await db.from("clip_events").insert(rows);
  return { error: error?.message ?? null };
}

export async function getClipEvents(clipId: string) {
  const db = getDb();
  if (!db) return { error: "DB not configured", records: [] };

  const { data, error } = await db
    .from("clip_events")
    .select()
    .eq("clip_id", clipId)
    .order("sort_order", { ascending: true });

  if (error) return { error: error.message, records: [] };
  return { error: null, records: (data ?? []).map((r) => rowToClipEvent(r as Record<string, unknown>)) };
}

export async function updateClipEvent(eventId: string, update: {
  status: ClipEventStatus;
}) {
  const db = getDb();
  if (!db) return { error: "DB not configured" };

  const { error } = await db
    .from("clip_events")
    .update({ status: update.status, updated_at: new Date().toISOString() })
    .eq("id", eventId);

  return { error: error?.message ?? null };
}

// ─── clip_plays ───────────────────────────────────────────────────────────────

function rowToClipPlay(row: Record<string, unknown>): ClipPlay {
  return {
    id: row.id as string,
    clipId: row.clip_id as string,
    eventId: (row.event_id as string | null) ?? null,
    ownerId: row.owner_id as string,
    question: row.question as string,
    context: (row.context as string | null) ?? null,
    timestampSeconds: (row.timestamp_seconds as number | null) ?? null,
    status: row.status as ClipPlayStatus,
    resolution: (row.resolution as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

type ClipPlayStatus = "pending" | "resolved";

export async function insertClipPlays(plays: Array<{
  clipId: string;
  eventId: string | null;
  ownerId: string;
  question: string;
  context: string | null;
  timestampSeconds: number | null;
}>) {
  const db = getDb();
  if (!db) return { error: "DB not configured" };

  const rows = plays.map((p) => ({
    clip_id: p.clipId,
    event_id: p.eventId,
    owner_id: p.ownerId,
    question: p.question,
    context: p.context,
    timestamp_seconds: p.timestampSeconds,
    status: "pending",
  }));

  const { error } = await db.from("clip_plays").insert(rows);
  return { error: error?.message ?? null };
}

export async function getClipPlays(clipId: string) {
  const db = getDb();
  if (!db) return { error: "DB not configured", records: [] };

  const { data, error } = await db
    .from("clip_plays")
    .select()
    .eq("clip_id", clipId)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message, records: [] };
  return { error: null, records: (data ?? []).map((r) => rowToClipPlay(r as Record<string, unknown>)) };
}

export async function resolveClipPlay(playId: string, resolution: string) {
  const db = getDb();
  if (!db) return { error: "DB not configured", record: null };

  const { data, error } = await db
    .from("clip_plays")
    .update({
      status: "resolved",
      resolution,
      updated_at: new Date().toISOString(),
    })
    .eq("id", playId)
    .select()
    .single();

  if (error || !data) return { error: error?.message ?? "update failed", record: null };
  return { error: null, record: rowToClipPlay(data as Record<string, unknown>) };
}

// ─── clip_press_packs ────────────────────────────────────────────────────────

function rowToClipPressPack(row: Record<string, unknown>): ClipPressPack {
  return {
    id: row.id as string,
    clipId: row.clip_id as string,
    ownerId: row.owner_id as string,
    headline: (row.headline as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    keyMoments: (row.key_moments as ClipPressPack["keyMoments"]) ?? [],
    statLines: (row.stat_lines as ClipStatLines) ?? emptyStats(),
    generatedAt: row.generated_at as string,
  };
}

export async function upsertClipPressPack(record: {
  clipId: string;
  ownerId: string;
  headline: string | null;
  summary: string | null;
  keyMoments: ClipPressPack["keyMoments"];
  statLines: ClipStatLines;
}) {
  const db = getDb();
  if (!db) return { error: "DB not configured" };

  const { error } = await db
    .from("clip_press_packs")
    .upsert({
      clip_id: record.clipId,
      owner_id: record.ownerId,
      headline: record.headline,
      summary: record.summary,
      key_moments: record.keyMoments,
      stat_lines: record.statLines,
      generated_at: new Date().toISOString(),
    }, { onConflict: "clip_id" });

  return { error: error?.message ?? null };
}

export async function getClipPressPack(clipId: string) {
  const db = getDb();
  if (!db) return { error: "DB not configured", record: null };

  const { data, error } = await db
    .from("clip_press_packs")
    .select()
    .eq("clip_id", clipId)
    .maybeSingle();

  if (error) return { error: error.message, record: null };
  if (!data) return { error: null, record: null };
  return { error: null, record: rowToClipPressPack(data as Record<string, unknown>) };
}

// ─── Stats computation (from events) ─────────────────────────────────────────

export function computeClipStats(events: ClipEvent[]): ClipStatLines {
  const counted = events.filter((e) => e.status === "counted");

  const fgm = counted.filter((e) => e.eventType === "make" && e.shotZone !== "free_throw").length;
  const fga = counted.filter((e) => (e.eventType === "make" || e.eventType === "miss") && e.shotZone !== "free_throw").length;
  const tpm = counted.filter((e) => e.eventType === "make" && e.shotZone === "three_point").length;
  const tpa = counted.filter((e) => (e.eventType === "make" || e.eventType === "miss") && e.shotZone === "three_point").length;
  const ftm = counted.filter((e) => e.eventType === "make" && e.shotZone === "free_throw").length;
  const fta = counted.filter((e) => e.eventType === "free_throw" || (e.eventType === "make" && e.shotZone === "free_throw")).length;
  const pts = counted.reduce((sum, e) => sum + (e.points ?? 0), 0);
  const reb = counted.filter((e) => e.eventType === "rebound").length;
  const ast = counted.filter((e) => e.eventType === "assist").length;
  const stl = counted.filter((e) => e.eventType === "steal").length;
  const blk = counted.filter((e) => e.eventType === "block").length;
  const to = counted.filter((e) => e.eventType === "turnover").length;
  const pf = counted.filter((e) => e.eventType === "foul").length;

  return {
    pts,
    fgm,
    fga,
    fg_pct: fga > 0 ? Math.round((fgm / fga) * 1000) / 10 : null,
    tpm,
    tpa,
    tp_pct: tpa > 0 ? Math.round((tpm / tpa) * 1000) / 10 : null,
    ftm,
    fta,
    ft_pct: fta > 0 ? Math.round((ftm / fta) * 1000) / 10 : null,
    reb,
    ast,
    stl,
    blk,
    to,
    pf,
  };
}

export function emptyStats(): ClipStatLines {
  return {
    pts: 0, fgm: 0, fga: 0, fg_pct: null,
    tpm: 0, tpa: 0, tp_pct: null,
    ftm: 0, fta: 0, ft_pct: null,
    reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0,
  };
}
