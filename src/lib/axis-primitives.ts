// ─── Coordinate system ────────────────────────────────────────────────────────
// All positions use normalized court coordinates: x ∈ [0,1], y ∈ [0,1]
// Origin: top-left of half-court. Basket at approximately (0.5, 0.12).
// Court pixel conversion lives in axis-replay-renderer.ts.

export type AxisCourtCoord = { x: number; y: number };

export type AxisBbox = {
  x: number; // top-left, normalized to frame width
  y: number; // top-left, normalized to frame height
  w: number;
  h: number;
};

// ─── Primitives ───────────────────────────────────────────────────────────────

export type AxisTally = {
  key: string;
  value: number;
  unit?: string;
};

export type AxisEntityType = "ball" | "player" | "rim";

export type AxisCourtZone =
  | "paint"
  | "mid_range_left"
  | "mid_range_right"
  | "mid_range_center"
  | "corner_left"
  | "corner_right"
  | "wing_left"
  | "wing_right"
  | "top_key"
  | "transition"
  | "backcourt"
  | "unknown";

// ─── AxisDetection ────────────────────────────────────────────────────────────
// Raw CV model output: one record per detected object per frame.
// Converted to AxisTrack by the tracker after association.

export type AxisDetection = {
  id: string;
  session_id: string;
  source_job_id: string;
  frame: number;
  timestamp_ms: number;
  entity_type: AxisEntityType;
  // Frame-space bounding box (normalized 0–1)
  bbox: AxisBbox;
  confidence: number;
  // Court-space position after homography projection (optional — set post-homography)
  court?: AxisCourtCoord;
  // Assigned by tracker after multi-object association
  track_id?: string;
};

// ─── AxisTrack ────────────────────────────────────────────────────────────────
// Continuous object identity across frames.
// One track per object per session. Ball → one track. Players → one each.

export type AxisTrackPosition = {
  frame: number;
  timestamp_ms: number;
  x: number; // court coord
  y: number; // court coord
  confidence: number;
  interpolated?: boolean;
};

export type AxisTrack = {
  id: string;
  session_id: string;
  entity_type: AxisEntityType;
  label?: string; // e.g. "player_0", "player_1"
  frame_start: number;
  frame_end: number;
  started_at: number; // ms
  ended_at: number; // ms
  positions: AxisTrackPosition[]; // sorted ascending by frame
  detection_count: number;
  gap_count: number;
  mean_confidence: number;
};

// ─── AxisEvent ────────────────────────────────────────────────────────────────
// Semantic event derived from track behavior.
// Encodes enough spatial + temporal context to reconstruct replay without video.

export type AxisEventType =
  | "drive"
  | "kick"
  | "cut"
  | "relocate"
  | "closeout"
  | "rotation"
  | "transition"
  | "post_entry"
  | "hand_off"
  | "screen"
  | "shot_attempt"
  | "shot_made"
  | "shot_missed"
  | "pass"
  | "rebound"
  | "possession_change"
  | "dribble"
  | "stationary";

export type AxisEvent = {
  id: string;
  session_id: string;
  type: AxisEventType;
  // Temporal
  started_at: number; // ms
  ended_at: number; // ms
  frame_start: number;
  frame_end: number;
  // Spatial (court coords)
  origin: AxisCourtCoord;
  terminus?: AxisCourtCoord; // for movement events
  zone: AxisCourtZone;
  // Track participants
  primary_track_id: string; // ball track for shot events; acting player for movement
  participant_track_ids: string[];
  // Full position snapshot at event start — enables video-free replay reconstruction
  position_snapshot: Array<{
    track_id: string;
    entity_type: AxisEntityType;
    x: number;
    y: number;
    frame: number;
  }>;
  tallies: AxisTally[];
  confidence: number;
  metadata?: Record<string, unknown>;
};

// ─── AxisReplayFrame ──────────────────────────────────────────────────────────
// A synthesized frame produced entirely from track + event data.
// No video bytes required. Renderable by axis-replay-renderer.ts.

export type AxisReplayObject = {
  track_id: string;
  entity_type: AxisEntityType;
  label?: string;
  x: number; // court coord, interpolated
  y: number;
  interpolated: boolean;
  confidence: number;
};

export type AxisPossessionState = {
  track_id: string | null; // player track holding ball; null if loose
  confidence: number;
};

export type AxisPressureState = {
  distance: number; // normalized court distance (0=contact, 1=full court)
  defender_track_id: string | null;
};

export type AxisSpacingState = {
  convex_hull_area: number; // normalized 0–1 (1 = full court area)
  nearest_neighbor_mean: number; // mean nearest-neighbor distance, normalized
};

export type AxisReplayFrame = {
  timestamp_ms: number;
  frame_index: number; // 0-based position in replay sequence
  objects: AxisReplayObject[];
  active_events: Pick<AxisEvent, "id" | "type" | "zone" | "primary_track_id">[];
  possession: AxisPossessionState;
  pressure: AxisPressureState;
  spacing: AxisSpacingState;
  tallies: AxisTally[];
};

// ─── Court zone classifier ────────────────────────────────────────────────────
// Maps a normalized court coordinate to the nearest named zone.
// Basket at (0.5, 0.10). Paint extends to y ≈ 0.40.

export function classifyZone(x: number, y: number): AxisCourtZone {
  if (y < 0 || y > 1 || x < 0 || x > 1) return "unknown";
  if (y > 0.85) return "backcourt";
  if (y > 0.65) return "transition";
  // Paint: center ±0.18 wide, y < 0.42
  if (y < 0.42 && x > 0.32 && x < 0.68) return "paint";
  // Corner: very near sideline, y < 0.28
  if (y < 0.28 && x < 0.15) return "corner_left";
  if (y < 0.28 && x > 0.85) return "corner_right";
  // Wing: sideline area, y 0.28–0.55
  if (x < 0.22 && y < 0.55) return "wing_left";
  if (x > 0.78 && y < 0.55) return "wing_right";
  // Top key: center, above mid-range
  if (x > 0.35 && x < 0.65 && y > 0.35 && y < 0.58) return "top_key";
  // Mid-range
  if (x < 0.40) return "mid_range_left";
  if (x > 0.60) return "mid_range_right";
  return "mid_range_center";
}
