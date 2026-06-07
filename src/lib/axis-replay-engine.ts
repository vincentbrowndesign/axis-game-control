import {
  classifyZone,
  type AxisEvent,
  type AxisPossessionState,
  type AxisPressureState,
  type AxisReplayFrame,
  type AxisReplayObject,
  type AxisSpacingState,
  type AxisTally,
  type AxisTrack,
  type AxisTrackPosition,
} from "./axis-primitives";

// ─── Constants ────────────────────────────────────────────────────────────────

// Max gap between track positions before marking interpolation as unreliable
const MAX_INTERPOLATION_GAP_MS = 500;

// Normalized court distance: ball within this radius → player in possession
const POSSESSION_RADIUS = 0.06;

export type AxisEventReplayOptions = {
  endMs?: number;
  startMs?: number;
  stepMs?: number;
};

// ─── Interpolation ────────────────────────────────────────────────────────────

function interpolateTrack(
  track: AxisTrack,
  t: number,
): { x: number; y: number; confidence: number; interpolated: boolean } | null {
  const positions = track.positions;
  if (!positions.length) return null;

  const first = positions[0];
  const last = positions[positions.length - 1];

  if (t < first.timestamp_ms || t > last.timestamp_ms) return null;

  // Binary search for surrounding positions
  let lo = 0;
  let hi = positions.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (positions[mid].timestamp_ms <= t) lo = mid;
    else hi = mid;
  }

  const before: AxisTrackPosition = positions[lo];
  const after: AxisTrackPosition = positions[hi];

  const gapMs = after.timestamp_ms - before.timestamp_ms;
  const alpha = gapMs === 0 ? 0 : (t - before.timestamp_ms) / gapMs;

  return {
    x: before.x + (after.x - before.x) * alpha,
    y: before.y + (after.y - before.y) * alpha,
    confidence: before.confidence + (after.confidence - before.confidence) * alpha,
    interpolated: gapMs > MAX_INTERPOLATION_GAP_MS,
  };
}

// ─── Possession ───────────────────────────────────────────────────────────────

function inferPossession(
  ballX: number,
  ballY: number,
  players: AxisReplayObject[],
  activeEvents: AxisEvent[],
): AxisPossessionState {
  // Explicit possession_change event takes priority
  const change = activeEvents.find((e) => e.type === "possession_change");
  if (change) {
    return { track_id: change.primary_track_id, confidence: 0.92 };
  }

  let closestId: string | null = null;
  let minDist = POSSESSION_RADIUS;

  for (const p of players) {
    const d = Math.hypot(p.x - ballX, p.y - ballY);
    if (d < minDist) {
      minDist = d;
      closestId = p.track_id;
    }
  }

  const confidence = closestId
    ? Math.max(0, 1 - minDist / POSSESSION_RADIUS)
    : 0;

  return { track_id: closestId, confidence };
}

// ─── Pressure ─────────────────────────────────────────────────────────────────
// Distance from ball handler to nearest other player (proxy for defender).
// Without team labels we use proximity — closest non-possessor.

function computePressure(
  ballHandlerX: number,
  ballHandlerY: number,
  possessorId: string | null,
  players: AxisReplayObject[],
): AxisPressureState {
  if (!possessorId) return { distance: 1, defender_track_id: null };

  let minDist = Infinity;
  let defenderId: string | null = null;

  for (const p of players) {
    if (p.track_id === possessorId) continue;
    const d = Math.hypot(p.x - ballHandlerX, p.y - ballHandlerY);
    if (d < minDist) {
      minDist = d;
      defenderId = p.track_id;
    }
  }

  // Normalize: court diagonal ≈ 1.41 in normalized coords
  return {
    distance: Math.min(1, minDist / 1.41),
    defender_track_id: defenderId,
  };
}

// ─── Spacing ──────────────────────────────────────────────────────────────────

function convexHullArea(pts: Array<{ x: number; y: number }>): number {
  if (pts.length < 3) return 0;

  // Find bottom-most then left-most pivot
  let pi = 0;
  for (let i = 1; i < pts.length; i++) {
    if (
      pts[i].y > pts[pi].y ||
      (pts[i].y === pts[pi].y && pts[i].x < pts[pi].x)
    )
      pi = i;
  }

  const pivot = pts[pi];
  const rest = pts.filter((_, i) => i !== pi).sort((a, b) => {
    const da = Math.atan2(a.y - pivot.y, a.x - pivot.x);
    const db = Math.atan2(b.y - pivot.y, b.x - pivot.x);
    return da !== db ? da - db : Math.hypot(a.x - pivot.x, a.y - pivot.y) - Math.hypot(b.x - pivot.x, b.y - pivot.y);
  });

  const hull = [pivot, rest[0]];
  for (let i = 1; i < rest.length; i++) {
    while (hull.length > 1) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const c = rest[i];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross <= 0) hull.pop();
      else break;
    }
    hull.push(rest[i]);
  }

  // Shoelace
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    area += hull[i].x * hull[j].y - hull[j].x * hull[i].y;
  }
  return Math.abs(area) / 2;
}

function computeSpacing(players: AxisReplayObject[]): AxisSpacingState {
  if (players.length < 2) {
    return { convex_hull_area: 0, nearest_neighbor_mean: 0 };
  }

  const hull = convexHullArea(players);

  let nnSum = 0;
  for (const a of players) {
    let minD = Infinity;
    for (const b of players) {
      if (a === b) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < minD) minD = d;
    }
    nnSum += minD;
  }

  return {
    convex_hull_area: Math.min(1, hull), // full court = 1×1 = 1.0
    nearest_neighbor_mean: nnSum / players.length,
  };
}

// ─── Tally accumulator ────────────────────────────────────────────────────────

function accumulateTallies(events: AxisEvent[], upToMs: number): AxisTally[] {
  const map = new Map<string, { value: number; unit?: string }>();

  for (const e of events) {
    if (e.ended_at > upToMs) continue;
    for (const t of e.tallies) {
      const existing = map.get(t.key);
      if (existing) existing.value += t.value;
      else map.set(t.key, { value: t.value, unit: t.unit });
    }
  }

  return Array.from(map.entries()).map(([key, { value, unit }]) => ({
    key,
    value,
    unit,
  }));
}

// ─── AxisReplayEngine ─────────────────────────────────────────────────────────

export class AxisReplayEngine {
  private readonly tracks: AxisTrack[];
  private readonly events: AxisEvent[];
  // Sorted event list for fast range queries
  private readonly sortedEvents: AxisEvent[];

  constructor(tracks: AxisTrack[], events: AxisEvent[]) {
    this.tracks = tracks;
    this.events = events;
    this.sortedEvents = [...events].sort((a, b) => a.started_at - b.started_at);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  frameAt(timestampMs: number): AxisReplayFrame {
    return this.buildFrame(timestampMs, 0);
  }

  generate(startMs: number, endMs: number, stepMs: number): AxisReplayFrame[] {
    const frames: AxisReplayFrame[] = [];
    let t = startMs;
    let idx = 0;
    while (t <= endMs) {
      frames.push(this.buildFrame(t, idx));
      t += stepMs;
      idx++;
    }
    return frames;
  }

  // Returns wall-clock duration of the session in ms
  get durationMs(): number {
    if (!this.tracks.length) return 0;
    const start = Math.min(...this.tracks.map((t) => t.started_at));
    const end = Math.max(...this.tracks.map((t) => t.ended_at));
    return end - start;
  }

  get startMs(): number {
    if (!this.tracks.length) return 0;
    return Math.min(...this.tracks.map((t) => t.started_at));
  }

  // ── Timeline: ordered unique event sequence ──────────────────────────────
  timeline(): Array<{ type: AxisEvent["type"]; at: number; zone: string }> {
    return this.sortedEvents.map((e) => ({
      type: e.type,
      at: e.started_at,
      zone: e.zone,
    }));
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private eventsAt(t: number): AxisEvent[] {
    return this.sortedEvents.filter(
      (e) => e.started_at <= t && e.ended_at >= t,
    );
  }

  private buildFrame(t: number, frameIndex: number): AxisReplayFrame {
    const activeEvents = this.eventsAt(t);

    // Interpolate all tracks
    const objects: AxisReplayObject[] = [];
    let ballPos: { x: number; y: number } | null = null;

    for (const track of this.tracks) {
      const pos = interpolateTrack(track, t);
      if (!pos) continue;

      const obj: AxisReplayObject = {
        track_id: track.id,
        entity_type: track.entity_type,
        label: track.label,
        x: pos.x,
        y: pos.y,
        interpolated: pos.interpolated,
        confidence: pos.confidence,
      };
      objects.push(obj);

      if (track.entity_type === "ball") {
        ballPos = { x: pos.x, y: pos.y };
      }
    }

    const players = objects.filter((o) => o.entity_type === "player");

    // Possession
    const possession = ballPos
      ? inferPossession(ballPos.x, ballPos.y, players, activeEvents)
      : { track_id: null, confidence: 0 };

    // Pressure
    let pressure: AxisPressureState = { distance: 1, defender_track_id: null };
    if (ballPos && possession.track_id) {
      const handler = players.find((p) => p.track_id === possession.track_id);
      if (handler) {
        pressure = computePressure(handler.x, handler.y, possession.track_id, players);
      }
    }

    // Spacing
    const spacing = computeSpacing(players);

    // Cumulative tallies up to this frame
    const tallies = accumulateTallies(this.events, t);

    // Active event summary (lightweight — no position_snapshot)
    const active = activeEvents.map((e) => ({
      id: e.id,
      type: e.type,
      zone: e.zone,
      primary_track_id: e.primary_track_id,
    }));

    return {
      timestamp_ms: t,
      frame_index: frameIndex,
      objects,
      active_events: active,
      possession,
      pressure,
      spacing,
      tallies,
    };
  }
}

// ─── Helpers for consumers ────────────────────────────────────────────────────

// Generate replay frames directly from semantic AxisEvents.
// This path does not require source video bytes or prebuilt AxisTrack[] input.
export function generateReplayFramesFromEvents(
  events: AxisEvent[],
  options: AxisEventReplayOptions = {},
): AxisReplayFrame[] {
  const sortedEvents = [...events].sort((a, b) => a.started_at - b.started_at || a.frame_start - b.frame_start);
  if (!sortedEvents.length) return [];

  const startMs = options.startMs ?? Math.min(...sortedEvents.map((event) => event.started_at));
  const endMs = options.endMs ?? Math.max(...sortedEvents.map((event) => event.ended_at));
  const stepMs = Math.max(1, options.stepMs ?? 100);
  const frames: AxisReplayFrame[] = [];

  let timestampMs = startMs;
  let frameIndex = 0;
  while (timestampMs <= endMs) {
    frames.push(buildReplayFrameFromEvents(sortedEvents, timestampMs, frameIndex));
    timestampMs += stepMs;
    frameIndex += 1;
  }

  if (!frames.length || frames[frames.length - 1].timestamp_ms < endMs) {
    frames.push(buildReplayFrameFromEvents(sortedEvents, endMs, frameIndex));
  }

  return frames;
}

function buildReplayFrameFromEvents(events: AxisEvent[], timestampMs: number, frameIndex: number): AxisReplayFrame {
  const activeEvents = events.filter((event) => event.started_at <= timestampMs && event.ended_at >= timestampMs);
  const objects = buildReplayObjectsFromEvents(events, activeEvents, timestampMs);
  const players = objects.filter((object) => object.entity_type === "player");
  const ball = objects.find((object) => object.entity_type === "ball");
  const possession = ball ? inferPossession(ball.x, ball.y, players, activeEvents) : { track_id: null, confidence: 0 };

  let pressure: AxisPressureState = { defender_track_id: null, distance: 1 };
  if (possession.track_id) {
    const handler = players.find((player) => player.track_id === possession.track_id);
    if (handler) pressure = computePressure(handler.x, handler.y, possession.track_id, players);
  }

  return {
    active_events: activeEvents.map((event) => ({
      id: event.id,
      primary_track_id: event.primary_track_id,
      type: event.type,
      zone: event.zone,
    })),
    frame_index: frameIndex,
    objects,
    possession,
    pressure,
    spacing: computeSpacing(players),
    tallies: accumulateTallies(events, timestampMs),
    timestamp_ms: timestampMs,
  };
}

function buildReplayObjectsFromEvents(events: AxisEvent[], activeEvents: AxisEvent[], timestampMs: number) {
  const objectMap = new Map<string, AxisReplayObject>();
  const elapsedEvents = events.filter((event) => event.started_at <= timestampMs);

  for (const event of elapsedEvents) {
    for (const snapshot of event.position_snapshot) {
      objectMap.set(snapshot.track_id, {
        confidence: event.confidence,
        entity_type: snapshot.entity_type,
        interpolated: false,
        label: snapshot.entity_type === "ball" ? "basketball" : snapshot.track_id,
        track_id: snapshot.track_id,
        x: snapshot.x,
        y: snapshot.y,
      });
    }
  }

  for (const event of activeEvents) {
    const existing = objectMap.get(event.primary_track_id);
    if (!existing) continue;
    const duration = Math.max(1, event.ended_at - event.started_at);
    const alpha = Math.max(0, Math.min(1, (timestampMs - event.started_at) / duration));
    const target = event.terminus ?? event.origin;
    objectMap.set(event.primary_track_id, {
      ...existing,
      confidence: event.confidence,
      interpolated: true,
      x: event.origin.x + (target.x - event.origin.x) * alpha,
      y: event.origin.y + (target.y - event.origin.y) * alpha,
    });
  }

  return [...objectMap.values()].sort((a, b) => a.track_id.localeCompare(b.track_id));
}

// Convert existing AxisEntityTrack[] (from axis-reality-decoder) into AxisTrack[]
export function entityTracksToAxisTracks(
  rawTracks: Array<{
    entity_id: string;
    entity_type: "ball" | "hoop" | "player";
    frame: number;
    time?: number;
    x: number;
    y: number;
    confidence?: number;
  }>,
  sessionId: string,
): AxisTrack[] {
  // Group by entity_id
  const groups = new Map<string, typeof rawTracks>();
  for (const t of rawTracks) {
    if (!groups.has(t.entity_id)) groups.set(t.entity_id, []);
    groups.get(t.entity_id)!.push(t);
  }

  const tracks: AxisTrack[] = [];
  for (const [entityId, pts] of groups) {
    const sorted = pts.sort((a, b) => a.frame - b.frame);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const confs = sorted.map((p) => p.confidence ?? 1);
    const meanConf = confs.reduce((s, c) => s + c, 0) / confs.length;

    // Count gaps > 10 frames
    let gaps = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].frame - sorted[i - 1].frame > 10) gaps++;
    }

    // entity_type: map "hoop" → "rim"
    const entityType =
      first.entity_type === "hoop"
        ? "rim"
        : (first.entity_type as "ball" | "player");

    tracks.push({
      id: entityId,
      session_id: sessionId,
      entity_type: entityType,
      label: `${entityType}_${entityId.slice(0, 4)}`,
      frame_start: first.frame,
      frame_end: last.frame,
      started_at: (first.time ?? first.frame * 33),
      ended_at: (last.time ?? last.frame * 33),
      positions: sorted.map((p) => ({
        frame: p.frame,
        timestamp_ms: p.time ?? p.frame * 33,
        x: p.x,
        y: p.y,
        confidence: p.confidence ?? 1,
      })),
      detection_count: sorted.length,
      gap_count: gaps,
      mean_confidence: meanConf,
    });
  }

  return tracks;
}

// Infer events from raw track data when no explicit event ledger exists.
// Produces approximate events usable for replay.
export function inferEventsFromTracks(
  tracks: AxisTrack[],
  sessionId: string,
): AxisEvent[] {
  const events: AxisEvent[] = [];
  const ball = tracks.find((t) => t.entity_type === "ball");
  if (!ball) return events;

  // Generate a unique id
  let seq = 0;
  const nextId = () => `inferred_${sessionId}_${++seq}`;

  // Detect drive: ball moves > 0.3 court units toward basket (y decreasing) in < 2s
  const DRIVE_DIST = 0.3;
  const DRIVE_MAX_MS = 2000;

  for (let i = 0; i < ball.positions.length - 1; i++) {
    const a = ball.positions[i];
    const b = ball.positions[i + 1];
    const dy = a.y - b.y; // positive = moving toward basket
    const dx = Math.abs(b.x - a.x);
    const dt = b.timestamp_ms - a.timestamp_ms;

    if (dy > DRIVE_DIST && dx < 0.25 && dt < DRIVE_MAX_MS) {
      const snapshot = tracks
        .map((tr) => {
          const pos = tr.positions.find((p) => p.frame === a.frame);
          return pos
            ? { track_id: tr.id, entity_type: tr.entity_type, x: pos.x, y: pos.y, frame: pos.frame }
            : null;
        })
        .filter(Boolean) as AxisEvent["position_snapshot"];

      events.push({
        id: nextId(),
        session_id: sessionId,
        type: "drive",
        started_at: a.timestamp_ms,
        ended_at: b.timestamp_ms,
        frame_start: a.frame,
        frame_end: b.frame,
        origin: { x: a.x, y: a.y },
        terminus: { x: b.x, y: b.y },
        zone: classifyZone(a.x, a.y),
        primary_track_id: ball.id,
        participant_track_ids: [],
        position_snapshot: snapshot,
        tallies: [{ key: "drives", value: 1 }],
        confidence: 0.7,
      });
    }
  }

  return events;
}
