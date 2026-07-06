// Axis Event Container v0.1 (Trophy Labs).
// Table is axis_event_containers because axis_events is already owned by the
// CV movement-event schema. This module is shared browser/server; the service
// role client lives in axis-event-container-server.ts.

export const AXIS_EVENT_TYPES = [
  "game",
  "practice",
  "training",
  "small_group",
  "private",
  "film_review",
  "calibrate",
  "clinic",
  "other",
] as const;

export const AXIS_SOURCE_MODES = ["record_now", "attach_video", "attach_stream"] as const;

export const AXIS_EVENT_STATUSES = [
  "draft",
  "recording",
  "live",
  "review",
  "processing",
  "ready",
  "archived",
] as const;

export const AXIS_MEDIA_KINDS = [
  "recording",
  "upload",
  "stream",
  "replay",
  "clip",
  "thumbnail",
  "frame",
] as const;

export const AXIS_LENS_TAGS = [
  "footwork",
  "balance",
  "spacing",
  "shot",
  "handle",
  "pass",
  "defense",
  "landing",
  "body",
  "effort",
  "decision",
  "signal",
  "broadcast",
  "sponsor",
] as const;

export const AXIS_OUTPUT_TARGETS = [
  "clip",
  "report",
  "parent",
  "player_history",
  "calibrate",
  "platform",
  "sponsor",
  "practice_plan",
] as const;

export const AXIS_ACCESS_TARGET_TYPES = [
  "event",
  "replay",
  "clip_pack",
  "report",
  "media_pass",
  "sponsor",
  "training_offer",
] as const;

export const AXIS_ACCESS_LEVELS = ["free", "paid", "private", "team", "player", "sponsor"] as const;

export type AxisEventType = (typeof AXIS_EVENT_TYPES)[number];
export type AxisSourceMode = (typeof AXIS_SOURCE_MODES)[number];
export type AxisEventStatus = (typeof AXIS_EVENT_STATUSES)[number];
export type AxisMomentIntent = "asset" | "coaching";
export type AxisMomentLabel = "KEEP" | "FIX";

export type AxisEventContainer = {
  id: string;
  title: string;
  event_type: AxisEventType;
  source_mode: AxisSourceMode;
  status: AxisEventStatus;
  location: string | null;
  team_name: string | null;
  opponent_name: string | null;
  created_by: string | null;
  notes: string | null;
  recording_started_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AxisEventMedia = {
  id: string;
  event_id: string;
  kind: (typeof AXIS_MEDIA_KINDS)[number];
  provider: string | null;
  url: string | null;
  storage_path: string | null;
  upload_status: "pending" | "uploading" | "processing" | "ready" | "failed";
  duration_seconds: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AxisEventPlayer = {
  id: string;
  event_id: string;
  player_id: string | null;
  display_name: string;
  team_name: string | null;
  jersey_number: string | null;
  notes: string | null;
  created_at: string;
};

export type AxisMoment = {
  id: string;
  event_id: string;
  player_id: string | null;
  event_player_id: string | null;
  timestamp_seconds: number;
  intent: AxisMomentIntent;
  ui_label: AxisMomentLabel;
  note: string | null;
  voice_note_url: string | null;
  lens_tags: string[];
  outcome_tags: string[];
  output_targets: string[];
  source: string;
  created_at: string;
};

export type AxisReport = {
  id: string;
  event_id: string;
  player_id: string | null;
  report_type: "summary" | "player" | "team" | "calibrate" | "sponsor" | "parent";
  title: string | null;
  summary: string | null;
  evidence: Array<{ moment_id: string }>;
  strengths: string[];
  corrections: string[];
  next_focus: string | null;
  status: "draft" | "ready" | "sent" | "archived";
  created_at: string;
  updated_at: string;
};

export type AxisAccessLink = {
  id: string;
  event_id: string | null;
  player_id: string | null;
  report_id: string | null;
  label: string;
  target_type: (typeof AXIS_ACCESS_TARGET_TYPES)[number];
  provider: string | null;
  url: string;
  price_cents: number | null;
  access_level: (typeof AXIS_ACCESS_LEVELS)[number];
  status: "active" | "inactive" | "archived";
  created_at: string;
};

export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is string => typeof item === "string").map((item) => item.trim());
  return items.filter(Boolean);
}
