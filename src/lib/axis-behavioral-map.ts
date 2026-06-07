import type { AxisCourtCoord, AxisCourtZone, AxisEntityType, AxisEvent, AxisEventType, AxisTrack } from "./axis-primitives";
import { classifyZone } from "./axis-primitives";

export type AxisBehavioralMapSubject = {
  id: string;
  entity_type: AxisEntityType | "decision";
  label: string;
};

export type AxisBehavioralPathway = {
  id: string;
  subject: AxisBehavioralMapSubject;
  start_ms: number;
  end_ms: number;
  origin: AxisCourtCoord;
  terminus: AxisCourtCoord;
  origin_zone: AxisCourtZone;
  terminus_zone: AxisCourtZone;
  via_zones: AxisCourtZone[];
  evidence_event_ids: string[];
  evidence_track_ids: string[];
  confidence: number;
  reading: string;
};

export type AxisBehavioralPressurePoint = {
  id: string;
  zone: AxisCourtZone;
  timestamp_ms: number;
  event_ids: string[];
  track_ids: string[];
  pressure_type: "crowding" | "decision_cluster" | "low_confidence" | "track_gap";
  confidence: number;
  reading: string;
};

export type AxisBehavioralBottleneck = {
  id: string;
  zone: AxisCourtZone;
  start_ms: number;
  end_ms: number;
  subject_ids: string[];
  cause: "repeated_entry" | "stationary_hold" | "track_congestion" | "missing_continuity";
  evidence_ids: string[];
  confidence: number;
  reading: string;
};

export type AxisBehavioralRecurringPattern = {
  id: string;
  sequence: AxisEventType[];
  zones: AxisCourtZone[];
  occurrences: Array<{
    event_ids: string[];
    start_ms: number;
    end_ms: number;
  }>;
  confidence: number;
  reading: string;
};

export type AxisBehavioralOpportunity = {
  id: string;
  opportunity_type: "space" | "timing" | "continuity" | "teaching" | "memory";
  zone?: AxisCourtZone;
  evidence_ids: string[];
  confidence: number;
  reading: string;
  suggested_next_observation: string;
};

export type AxisBehavioralMap = {
  session_id?: string;
  subjects: AxisBehavioralMapSubject[];
  pathways: AxisBehavioralPathway[];
  pressure_points: AxisBehavioralPressurePoint[];
  bottlenecks: AxisBehavioralBottleneck[];
  recurring_patterns: AxisBehavioralRecurringPattern[];
  opportunities: AxisBehavioralOpportunity[];
  continuity_score: number;
};

export type AxisBehavioralMapOptions = {
  min_pathway_confidence?: number;
  pressure_window_ms?: number;
  recurring_gap_ms?: number;
};

const DEFAULT_PRESSURE_WINDOW_MS = 900;
const DEFAULT_RECURRING_GAP_MS = 2200;

export function buildAxisBehavioralMap(
  input: {
    session_id?: string;
    events?: AxisEvent[];
    tracks?: AxisTrack[];
  },
  options: AxisBehavioralMapOptions = {},
): AxisBehavioralMap {
  const events = [...(input.events ?? [])].sort((a, b) => a.started_at - b.started_at || a.frame_start - b.frame_start);
  const tracks = [...(input.tracks ?? [])].sort((a, b) => a.started_at - b.started_at || a.id.localeCompare(b.id));
  const subjects = buildSubjects(events, tracks);
  const pathways = buildPathways(events, tracks, options);
  const pressurePoints = buildPressurePoints(events, tracks, options);
  const bottlenecks = buildBottlenecks(events, tracks, pressurePoints);
  const recurringPatterns = buildRecurringPatterns(events, options);
  const opportunities = buildOpportunities(pathways, pressurePoints, bottlenecks, recurringPatterns, events, tracks);
  const continuityScore = scoreMapContinuity(pathways, pressurePoints, bottlenecks, recurringPatterns);

  return {
    session_id: input.session_id,
    subjects,
    pathways,
    pressure_points: pressurePoints,
    bottlenecks,
    recurring_patterns: recurringPatterns,
    opportunities,
    continuity_score: continuityScore,
  };
}

function buildSubjects(events: AxisEvent[], tracks: AxisTrack[]): AxisBehavioralMapSubject[] {
  const subjects = new Map<string, AxisBehavioralMapSubject>();

  for (const track of tracks) {
    subjects.set(track.id, {
      entity_type: track.entity_type,
      id: track.id,
      label: track.label ?? `${track.entity_type}:${track.id}`,
    });
  }

  for (const event of events) {
    if (!subjects.has(event.primary_track_id)) {
      subjects.set(event.primary_track_id, {
        entity_type: "decision",
        id: event.primary_track_id,
        label: `decision:${event.primary_track_id}`,
      });
    }
  }

  return [...subjects.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function buildPathways(events: AxisEvent[], tracks: AxisTrack[], options: AxisBehavioralMapOptions): AxisBehavioralPathway[] {
  const pathways: AxisBehavioralPathway[] = [];
  const minConfidence = options.min_pathway_confidence ?? 0.35;

  for (const event of events) {
    const terminus = event.terminus ?? event.origin;
    if (event.confidence < minConfidence) continue;
    pathways.push({
      confidence: clamp(event.confidence),
      end_ms: event.ended_at,
      evidence_event_ids: [event.id],
      evidence_track_ids: [event.primary_track_id, ...event.participant_track_ids],
      id: `pathway:event:${event.id}`,
      origin: event.origin,
      origin_zone: event.zone,
      reading: `${event.type} carried movement from ${event.zone} to ${classifyZone(terminus.x, terminus.y)}.`,
      subject: {
        entity_type: "decision",
        id: event.primary_track_id,
        label: event.type,
      },
      start_ms: event.started_at,
      terminus,
      terminus_zone: classifyZone(terminus.x, terminus.y),
      via_zones: uniqueZones([event.zone, classifyZone(terminus.x, terminus.y)]),
    });
  }

  for (const track of tracks) {
    if (track.positions.length < 2 || track.mean_confidence < minConfidence) continue;
    const first = track.positions[0];
    const last = track.positions[track.positions.length - 1];
    const zones = uniqueZones(track.positions.map((position) => classifyZone(position.x, position.y)));
    pathways.push({
      confidence: clamp(track.mean_confidence),
      end_ms: track.ended_at,
      evidence_event_ids: [],
      evidence_track_ids: [track.id],
      id: `pathway:track:${track.id}`,
      origin: { x: first.x, y: first.y },
      origin_zone: classifyZone(first.x, first.y),
      reading: `${track.entity_type} traveled through ${zones.join(" -> ")}.`,
      subject: {
        entity_type: track.entity_type,
        id: track.id,
        label: track.label ?? `${track.entity_type}:${track.id}`,
      },
      start_ms: track.started_at,
      terminus: { x: last.x, y: last.y },
      terminus_zone: classifyZone(last.x, last.y),
      via_zones: zones,
    });
  }

  return pathways.sort((a, b) => a.start_ms - b.start_ms || b.confidence - a.confidence);
}

function buildPressurePoints(events: AxisEvent[], tracks: AxisTrack[], options: AxisBehavioralMapOptions): AxisBehavioralPressurePoint[] {
  const pressureWindowMs = options.pressure_window_ms ?? DEFAULT_PRESSURE_WINDOW_MS;
  const pressurePoints: AxisBehavioralPressurePoint[] = [];

  for (const event of events) {
    const clusteredEvents = events.filter(
      (candidate) =>
        candidate.id !== event.id &&
        Math.abs(candidate.started_at - event.started_at) <= pressureWindowMs &&
        candidate.zone === event.zone,
    );
    if (clusteredEvents.length > 0) {
      pressurePoints.push({
        confidence: clamp(average([event.confidence, ...clusteredEvents.map((item) => item.confidence)])),
        event_ids: [event.id, ...clusteredEvents.map((item) => item.id)],
        id: `pressure:decision:${event.id}`,
        pressure_type: "decision_cluster",
        reading: `Multiple decisions gathered in ${event.zone} within ${pressureWindowMs}ms.`,
        timestamp_ms: event.started_at,
        track_ids: unique([event.primary_track_id, ...clusteredEvents.map((item) => item.primary_track_id)]),
        zone: event.zone,
      });
    }

    if (event.confidence < 0.5) {
      pressurePoints.push({
        confidence: clamp(1 - event.confidence),
        event_ids: [event.id],
        id: `pressure:low-confidence:${event.id}`,
        pressure_type: "low_confidence",
        reading: `The map weakens around ${event.zone}; the evidence for ${event.type} is low confidence.`,
        timestamp_ms: event.started_at,
        track_ids: [event.primary_track_id],
        zone: event.zone,
      });
    }
  }

  for (const track of tracks) {
    if (track.gap_count <= 0) continue;
    const zone = track.positions.length ? classifyZone(track.positions[0].x, track.positions[0].y) : "unknown";
    pressurePoints.push({
      confidence: clamp(Math.min(1, track.gap_count / Math.max(1, track.positions.length))),
      event_ids: [],
      id: `pressure:track-gap:${track.id}`,
      pressure_type: "track_gap",
      reading: `${track.entity_type} identity has ${track.gap_count} gap(s), so continuity is weaker here.`,
      timestamp_ms: track.started_at,
      track_ids: [track.id],
      zone,
    });
  }

  return dedupeById(pressurePoints).sort((a, b) => a.timestamp_ms - b.timestamp_ms);
}

function buildBottlenecks(
  events: AxisEvent[],
  tracks: AxisTrack[],
  pressurePoints: AxisBehavioralPressurePoint[],
): AxisBehavioralBottleneck[] {
  const bottlenecks: AxisBehavioralBottleneck[] = [];
  const zones = uniqueZones(events.map((event) => event.zone));

  for (const zone of zones) {
    const zoneEvents = events.filter((event) => event.zone === zone);
    if (zoneEvents.length < 3) continue;
    bottlenecks.push({
      cause: "repeated_entry",
      confidence: clamp(average(zoneEvents.map((event) => event.confidence))),
      end_ms: Math.max(...zoneEvents.map((event) => event.ended_at)),
      evidence_ids: zoneEvents.map((event) => event.id),
      id: `bottleneck:zone:${zone}`,
      reading: `${zone} repeatedly absorbed session behavior; movement may be narrowing there.`,
      start_ms: Math.min(...zoneEvents.map((event) => event.started_at)),
      subject_ids: unique(zoneEvents.map((event) => event.primary_track_id)),
      zone,
    });
  }

  for (const track of tracks) {
    if (track.positions.length < 3) continue;
    const movement = distance(track.positions[0], track.positions[track.positions.length - 1]);
    if (movement > 0.04) continue;
    const zone = classifyZone(track.positions[0].x, track.positions[0].y);
    bottlenecks.push({
      cause: "stationary_hold",
      confidence: clamp(track.mean_confidence),
      end_ms: track.ended_at,
      evidence_ids: [track.id],
      id: `bottleneck:stationary:${track.id}`,
      reading: `${track.entity_type} stayed mostly fixed in ${zone}, which may be holding the pathway in place.`,
      start_ms: track.started_at,
      subject_ids: [track.id],
      zone,
    });
  }

  const gapPressure = pressurePoints.filter((point) => point.pressure_type === "track_gap");
  for (const point of gapPressure) {
    bottlenecks.push({
      cause: "missing_continuity",
      confidence: point.confidence,
      end_ms: point.timestamp_ms,
      evidence_ids: [...point.event_ids, ...point.track_ids],
      id: `bottleneck:continuity:${point.id}`,
      reading: `Continuity breaks around ${point.zone}; the map cannot fully connect before and after.`,
      start_ms: point.timestamp_ms,
      subject_ids: point.track_ids,
      zone: point.zone,
    });
  }

  return dedupeById(bottlenecks).sort((a, b) => a.start_ms - b.start_ms);
}

function buildRecurringPatterns(events: AxisEvent[], options: AxisBehavioralMapOptions): AxisBehavioralRecurringPattern[] {
  const gapMs = options.recurring_gap_ms ?? DEFAULT_RECURRING_GAP_MS;
  const patterns = new Map<string, AxisBehavioralRecurringPattern>();

  for (let index = 0; index < events.length - 1; index += 1) {
    const first = events[index];
    const second = events[index + 1];
    if (second.started_at - first.ended_at > gapMs) continue;
    const sequence = [first.type, second.type];
    const zones = uniqueZones([first.zone, second.zone]);
    const key = `${sequence.join(">")}:${zones.join(">")}`;
    const existing = patterns.get(key) ?? {
      confidence: 0,
      id: `pattern:${key}`,
      occurrences: [],
      reading: `${sequence.join(" -> ")} recurs through ${zones.join(" -> ")}.`,
      sequence,
      zones,
    };

    existing.occurrences.push({
      end_ms: second.ended_at,
      event_ids: [first.id, second.id],
      start_ms: first.started_at,
    });
    existing.confidence = average([
      existing.confidence,
      first.confidence,
      second.confidence,
    ].filter((value) => value > 0));
    patterns.set(key, existing);
  }

  return [...patterns.values()]
    .filter((pattern) => pattern.occurrences.length >= 2)
    .sort((a, b) => b.occurrences.length - a.occurrences.length || b.confidence - a.confidence);
}

function buildOpportunities(
  pathways: AxisBehavioralPathway[],
  pressurePoints: AxisBehavioralPressurePoint[],
  bottlenecks: AxisBehavioralBottleneck[],
  recurringPatterns: AxisBehavioralRecurringPattern[],
  events: AxisEvent[],
  tracks: AxisTrack[],
): AxisBehavioralOpportunity[] {
  const opportunities: AxisBehavioralOpportunity[] = [];
  const usedZones = new Set(pathways.flatMap((pathway) => pathway.via_zones));
  const allZones: AxisCourtZone[] = [
    "paint",
    "mid_range_left",
    "mid_range_right",
    "mid_range_center",
    "corner_left",
    "corner_right",
    "wing_left",
    "wing_right",
    "top_key",
    "transition",
  ];

  for (const zone of allZones) {
    if (usedZones.has(zone)) continue;
    opportunities.push({
      confidence: 0.55,
      evidence_ids: pathways.map((pathway) => pathway.id),
      id: `opportunity:space:${zone}`,
      opportunity_type: "space",
      reading: `${zone} appears underused in the behavioral map.`,
      suggested_next_observation: `Watch whether a future session creates a pathway into ${zone}.`,
      zone,
    });
  }

  for (const bottleneck of bottlenecks) {
    opportunities.push({
      confidence: bottleneck.confidence,
      evidence_ids: bottleneck.evidence_ids,
      id: `opportunity:bottleneck:${bottleneck.id}`,
      opportunity_type: "timing",
      reading: `A pathway is narrowing at ${bottleneck.zone}; release timing may be the next useful observation.`,
      suggested_next_observation: "Compare the moment before the bottleneck with the moment immediately after it.",
      zone: bottleneck.zone,
    });
  }

  for (const pressure of pressurePoints.filter((point) => point.pressure_type === "track_gap" || point.pressure_type === "low_confidence")) {
    opportunities.push({
      confidence: pressure.confidence,
      evidence_ids: [...pressure.event_ids, ...pressure.track_ids],
      id: `opportunity:continuity:${pressure.id}`,
      opportunity_type: "continuity",
      reading: "The map shows a weak evidence segment that should be strengthened before teaching from it.",
      suggested_next_observation: "Capture cleaner evidence around this same pathway in the next session.",
      zone: pressure.zone,
    });
  }

  for (const pattern of recurringPatterns) {
    opportunities.push({
      confidence: pattern.confidence,
      evidence_ids: pattern.occurrences.flatMap((occurrence) => occurrence.event_ids),
      id: `opportunity:teaching:${pattern.id}`,
      opportunity_type: "teaching",
      reading: `The repeated ${pattern.sequence.join(" -> ")} pattern is teachable because it appears more than once.`,
      suggested_next_observation: "Save two examples side by side and compare the decision before the second step.",
      zone: pattern.zones[0],
    });
  }

  if (events.length > 0 || tracks.length > 0) {
    opportunities.push({
      confidence: clamp(average([...events.map((event) => event.confidence), ...tracks.map((track) => track.mean_confidence)])),
      evidence_ids: [...events.map((event) => event.id), ...tracks.map((track) => track.id)],
      id: "opportunity:memory:session-map",
      opportunity_type: "memory",
      reading: "This session has enough movement evidence to become a durable replay memory.",
      suggested_next_observation: "Attach the strongest pathway to session history for future comparison.",
    });
  }

  return dedupeById(opportunities).sort((a, b) => b.confidence - a.confidence);
}

function scoreMapContinuity(
  pathways: AxisBehavioralPathway[],
  pressurePoints: AxisBehavioralPressurePoint[],
  bottlenecks: AxisBehavioralBottleneck[],
  recurringPatterns: AxisBehavioralRecurringPattern[],
) {
  const pathwayScore = average(pathways.map((pathway) => pathway.confidence)) * 0.35;
  const patternScore = Math.min(1, recurringPatterns.length / 3) * 0.2;
  const pressurePenalty = Math.min(0.25, pressurePoints.length * 0.03);
  const bottleneckPenalty = Math.min(0.2, bottlenecks.length * 0.025);
  const coverageScore = Math.min(1, uniqueZones(pathways.flatMap((pathway) => pathway.via_zones)).length / 6) * 0.45;
  return clamp(pathwayScore + patternScore + coverageScore - pressurePenalty - bottleneckPenalty);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function uniqueZones(values: AxisCourtZone[]) {
  return unique(values.filter((zone) => zone !== "unknown"));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
