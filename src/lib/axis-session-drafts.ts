import { createClient } from "@supabase/supabase-js";
import type { AxisNextSessionCard, AxisSession, AxisSessionDraftCreateRequest, AxisSessionMoment } from "./axis/types";
import {
  axisServerSupabaseOptions,
  getAxisSupabaseServerEnv,
} from "./axis-supabase-server";

type AxisSessionDraftResult<T> =
  | { ok: true; value: T }
  | { error: string; ok: false };

type AxisSessionDraftRow = {
  created_at: string;
  duration_seconds: number | null;
  ended_at: string | null;
  focus: string | null;
  id: string;
  moments: unknown;
  next_session_card: unknown;
  player_id: string | null;
  player_name: string | null;
  searchable_text: string | null;
  session_type: AxisSession["sessionType"];
  source: string | null;
  status: AxisSession["status"];
  started_at: string | null;
  summary: string | null;
  title: string;
  updated_at: string;
};

const sessionDraftSelect = [
  "id",
  "title",
  "focus",
  "player_name",
  "player_id",
  "session_type",
  "status",
  "started_at",
  "ended_at",
  "duration_seconds",
  "moments",
  "summary",
  "next_session_card",
  "searchable_text",
  "source",
  "created_at",
  "updated_at",
].join(",");

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
      duration_seconds: session.durationSeconds ?? null,
      ended_at: session.endedAt ?? null,
      focus: session.focus?.trim() || null,
      moments: session.moments ?? [],
      next_session_card: session.nextSessionCard ?? null,
      owner_id: ownerId,
      player_id: session.playerId ?? null,
      player_name: session.playerName?.trim() || null,
      searchable_text: session.searchableText?.trim() || null,
      session_type: session.sessionType,
      source: session.source ?? "mixed",
      started_at: session.startedAt ?? session.createdAt,
      status: session.status,
      summary: session.summary?.trim() || null,
      title,
      updated_at: new Date().toISOString(),
    })
    .select(sessionDraftSelect)
    .single();

  if (error || !data) {
    return { error: "Session memory could not be saved.", ok: false };
  }

  return { ok: true, value: mapSessionDraftRow(data as unknown as AxisSessionDraftRow) };
}

export async function listAxisSessionDrafts(
  ownerId: string,
): Promise<AxisSessionDraftResult<AxisSession[]>> {
  const supabase = getAxisSessionDraftClient();
  if (!supabase) return { error: "Supabase is not configured.", ok: false };

  const { data, error } = await supabase
    .from("axis_session_drafts")
    .select(sessionDraftSelect)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) return { error: "Session memory could not be loaded.", ok: false };

  return {
    ok: true,
    value: ((data ?? []) as unknown as AxisSessionDraftRow[]).map(mapSessionDraftRow),
  };
}

function mapSessionDraftRow(row: AxisSessionDraftRow): AxisSession {
  return {
    createdAt: row.created_at,
    ...(typeof row.duration_seconds === "number" ? { durationSeconds: row.duration_seconds } : {}),
    ...(row.ended_at ? { endedAt: row.ended_at } : {}),
    ...(row.focus ? { focus: row.focus } : {}),
    id: row.id,
    moments: parseStoredMoments(row.moments),
    ...(parseStoredNextSessionCard(row.next_session_card) ? { nextSessionCard: parseStoredNextSessionCard(row.next_session_card) } : {}),
    ...(row.player_id ? { playerId: row.player_id } : {}),
    ...(row.player_name ? { playerName: row.player_name } : {}),
    persisted: true,
    ...(row.searchable_text ? { searchableText: row.searchable_text } : {}),
    sessionType: row.session_type,
    source: isSessionMemorySource(row.source) ? row.source : "mixed",
    status: row.status,
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.summary ? { summary: row.summary } : {}),
    title: row.title,
  };
}

function parseStoredMoments(value: unknown): AxisSession["moments"] {
  return Array.isArray(value)
    ? value.map(parseStoredMoment).filter(isPresent)
    : [];
}

function parseStoredNextSessionCard(value: unknown): AxisSession["nextSessionCard"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Partial<AxisNextSessionCard>;
  if (typeof record.title !== "string" || typeof record.nextFocus !== "string") return undefined;

  return {
    title: record.title,
    nextFocus: record.nextFocus,
    carryover: typeof record.carryover === "string" ? record.carryover : record.nextFocus,
    reminders: Array.isArray(record.reminders)
      ? record.reminders.filter((reminder): reminder is string => typeof reminder === "string").slice(0, 8)
      : [],
  };
}

function isSessionMemorySource(value: unknown): value is NonNullable<AxisSession["source"]> {
  return value === "typed" || value === "tap" || value === "mixed" || value === "voice" || value === "video" || value === "ai";
}

function parseStoredMoment(value: unknown): AxisSessionMoment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<AxisSessionMoment>;
  if (
    typeof record.id !== "string" ||
    typeof record.content !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.elapsedSeconds !== "number" ||
    typeof record.interpretedTitle !== "string" ||
    !isMomentReviewState(record.reviewState) ||
    !isMomentSource(record.source) ||
    !isMomentStructure(record.structure)
  ) {
    return null;
  }

  return {
    id: record.id,
    content: record.content,
    createdAt: record.createdAt,
    elapsedSeconds: record.elapsedSeconds,
    interpretedTitle: record.interpretedTitle,
    reviewState: record.reviewState,
    source: record.source,
    structure: record.structure,
  };
}

function isMomentReviewState(value: unknown): value is AxisSessionMoment["reviewState"] {
  return value === "correct" || value === "needs_review" || value === "not_right" || value === "refine";
}

function isMomentSource(value: unknown): value is AxisSessionMoment["source"] {
  return value === "tap" || value === "typed";
}

function isMomentStructure(value: unknown): value is AxisSessionMoment["structure"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<AxisSessionMoment["structure"]>;
  return (
    typeof record.situation === "string" &&
    typeof record.actor === "string" &&
    typeof record.action === "string" &&
    typeof record.outcome === "string" &&
    typeof record.cause === "string" &&
    typeof record.correction === "string" &&
    typeof record.evidence === "string"
  );
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
