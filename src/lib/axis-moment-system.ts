import type { AxisCourtZone, AxisEvent, AxisEventType, AxisReplayFrame } from "./axis-primitives";
import { generateReplayFramesFromEvents } from "./axis-replay-engine";

export type AxisMomentPurpose = "memory" | "comparison" | "teaching" | "archive";

export type AxisMomentEvidence = {
  event_ids: string[];
  track_ids: string[];
  confidence: number;
  gaps: string[];
};

export type AxisMoment = {
  id: string;
  session_id: string;
  start_ms: number;
  end_ms: number;
  frame_start: number;
  frame_end: number;
  event_types: AxisEventType[];
  zones: AxisCourtZone[];
  primary_track_ids: string[];
  purpose: AxisMomentPurpose;
  evidence: AxisMomentEvidence;
  continuity_score: number;
  retrieval_keys: string[];
};

export type AxisMomentIndex = {
  moments: AxisMoment[];
  by_id: Map<string, AxisMoment>;
  by_session: Map<string, AxisMoment[]>;
  by_event_type: Map<AxisEventType, AxisMoment[]>;
  by_zone: Map<AxisCourtZone, AxisMoment[]>;
  by_track: Map<string, AxisMoment[]>;
  by_key: Map<string, AxisMoment[]>;
};

export type AxisMomentQuery = {
  session_id?: string;
  event_types?: AxisEventType[];
  zones?: AxisCourtZone[];
  track_ids?: string[];
  keys?: string[];
  min_confidence?: number;
  min_continuity?: number;
  limit?: number;
};

export type AxisMomentRetrievalResult = {
  moment: AxisMoment;
  score: number;
  matched_keys: string[];
};

export type AxisStitchedMoment = {
  id: string;
  moments: AxisMoment[];
  replay_frames: AxisReplayFrame[];
  start_ms: number;
  end_ms: number;
  evidence_quality: number;
  continuity_score: number;
  stitch_gaps_ms: number[];
};

export type AxisMomentComparison = {
  base_moment_id: string;
  compared_moment_id: string;
  shared_event_types: AxisEventType[];
  shared_zones: AxisCourtZone[];
  shared_track_ids: string[];
  timing_delta_ms: number;
  evidence_delta: number;
  continuity_delta: number;
  similarity_score: number;
};

export type AxisTeachingMoment = {
  id: string;
  moment: AxisMoment;
  teaching_value: number;
  evidence_quality: number;
  continuity_score: number;
  reason: string;
  replay_frames: AxisReplayFrame[];
};

export type AxisMomentCaptureOptions = {
  window_before_ms?: number;
  window_after_ms?: number;
  min_event_confidence?: number;
};

const DEFAULT_WINDOW_BEFORE_MS = 900;
const DEFAULT_WINDOW_AFTER_MS = 1300;

export function captureAxisMoments(events: AxisEvent[], options: AxisMomentCaptureOptions = {}): AxisMoment[] {
  const sortedEvents = [...events].sort((a, b) => a.started_at - b.started_at || a.frame_start - b.frame_start);
  const minConfidence = options.min_event_confidence ?? 0.35;
  const moments: AxisMoment[] = [];

  for (const event of sortedEvents) {
    if (event.confidence < minConfidence) continue;
    const nearbyEvents = collectNearbyEvents(sortedEvents, event, options);
    moments.push(buildMomentFromEvents(nearbyEvents, event));
  }

  return uniqueMoments(moments).sort((a, b) => a.start_ms - b.start_ms || a.id.localeCompare(b.id));
}

export function buildAxisMomentIndex(moments: AxisMoment[]): AxisMomentIndex {
  const byId = new Map<string, AxisMoment>();
  const bySession = new Map<string, AxisMoment[]>();
  const byEventType = new Map<AxisEventType, AxisMoment[]>();
  const byZone = new Map<AxisCourtZone, AxisMoment[]>();
  const byTrack = new Map<string, AxisMoment[]>();
  const byKey = new Map<string, AxisMoment[]>();

  for (const moment of moments) {
    byId.set(moment.id, moment);
    pushIndex(bySession, moment.session_id, moment);
    for (const eventType of moment.event_types) pushIndex(byEventType, eventType, moment);
    for (const zone of moment.zones) pushIndex(byZone, zone, moment);
    for (const trackId of moment.primary_track_ids) pushIndex(byTrack, trackId, moment);
    for (const key of moment.retrieval_keys) pushIndex(byKey, key, moment);
  }

  return {
    moments,
    by_id: byId,
    by_session: bySession,
    by_event_type: byEventType,
    by_zone: byZone,
    by_track: byTrack,
    by_key: byKey,
  };
}

export function retrieveAxisMoments(index: AxisMomentIndex, query: AxisMomentQuery): AxisMomentRetrievalResult[] {
  const candidates = seedCandidates(index, query);
  const minConfidence = query.min_confidence ?? 0;
  const minContinuity = query.min_continuity ?? 0;
  const results: AxisMomentRetrievalResult[] = [];

  for (const moment of candidates) {
    if (query.session_id && moment.session_id !== query.session_id) continue;
    if (moment.evidence.confidence < minConfidence) continue;
    if (moment.continuity_score < minContinuity) continue;

    const matchedKeys = matchedMomentKeys(moment, query);
    const score = scoreMomentRetrieval(moment, query, matchedKeys);
    if (score <= 0) continue;
    results.push({ moment, score, matched_keys: matchedKeys });
  }

  return results
    .sort((a, b) => b.score - a.score || b.moment.evidence.confidence - a.moment.evidence.confidence)
    .slice(0, query.limit ?? 20);
}

export function stitchAxisMoments(moments: AxisMoment[], events: AxisEvent[]): AxisStitchedMoment {
  const sortedMoments = [...moments].sort((a, b) => a.start_ms - b.start_ms);
  const startMs = sortedMoments.length ? Math.min(...sortedMoments.map((moment) => moment.start_ms)) : 0;
  const endMs = sortedMoments.length ? Math.max(...sortedMoments.map((moment) => moment.end_ms)) : 0;
  const eventIds = new Set(sortedMoments.flatMap((moment) => moment.evidence.event_ids));
  const momentEvents = events.filter((event) => eventIds.has(event.id));
  const replayFrames = generateReplayFramesFromEvents(momentEvents, { startMs, endMs, stepMs: 100 });
  const stitchGaps = computeStitchGaps(sortedMoments);

  return {
    id: `stitch:${sortedMoments.map((moment) => moment.id).join("+")}`,
    moments: sortedMoments,
    replay_frames: replayFrames,
    start_ms: startMs,
    end_ms: endMs,
    evidence_quality: average(sortedMoments.map((moment) => moment.evidence.confidence)),
    continuity_score: clamp(average(sortedMoments.map((moment) => moment.continuity_score)) - gapPenalty(stitchGaps)),
    stitch_gaps_ms: stitchGaps,
  };
}

export function compareAxisMoments(base: AxisMoment, others: AxisMoment[]): AxisMomentComparison[] {
  return others
    .filter((moment) => moment.id !== base.id)
    .map((moment) => {
      const sharedEventTypes = intersect(base.event_types, moment.event_types);
      const sharedZones = intersect(base.zones, moment.zones);
      const sharedTrackIds = intersect(base.primary_track_ids, moment.primary_track_ids);
      const timingDelta = Math.abs(durationMs(base) - durationMs(moment));
      const evidenceDelta = moment.evidence.confidence - base.evidence.confidence;
      const continuityDelta = moment.continuity_score - base.continuity_score;
      const similarity = scoreMomentSimilarity({
        sharedEventTypes: sharedEventTypes.length,
        sharedZones: sharedZones.length,
        sharedTrackIds: sharedTrackIds.length,
        timingDelta,
        evidenceDelta,
        continuityDelta,
      });

      return {
        base_moment_id: base.id,
        compared_moment_id: moment.id,
        shared_event_types: sharedEventTypes,
        shared_zones: sharedZones,
        shared_track_ids: sharedTrackIds,
        timing_delta_ms: timingDelta,
        evidence_delta: evidenceDelta,
        continuity_delta: continuityDelta,
        similarity_score: similarity,
      };
    })
    .sort((a, b) => b.similarity_score - a.similarity_score);
}

export function generateTeachingMoments(moments: AxisMoment[], events: AxisEvent[]): AxisTeachingMoment[] {
  return moments
    .map((moment) => {
      const relevantEvents = events.filter((event) => moment.evidence.event_ids.includes(event.id));
      const teachingValue = scoreTeachingValue(moment);
      return {
        id: `teaching:${moment.id}`,
        moment,
        teaching_value: teachingValue,
        evidence_quality: moment.evidence.confidence,
        continuity_score: moment.continuity_score,
        reason: describeTeachingValue(moment),
        replay_frames: generateReplayFramesFromEvents(relevantEvents, {
          startMs: moment.start_ms,
          endMs: moment.end_ms,
          stepMs: 100,
        }),
      };
    })
    .filter((moment) => moment.teaching_value >= 0.55)
    .sort((a, b) => b.teaching_value - a.teaching_value);
}

function collectNearbyEvents(events: AxisEvent[], anchor: AxisEvent, options: AxisMomentCaptureOptions) {
  const beforeMs = options.window_before_ms ?? DEFAULT_WINDOW_BEFORE_MS;
  const afterMs = options.window_after_ms ?? DEFAULT_WINDOW_AFTER_MS;
  const start = anchor.started_at - beforeMs;
  const end = anchor.ended_at + afterMs;

  return events.filter((event) => event.ended_at >= start && event.started_at <= end);
}

function buildMomentFromEvents(events: AxisEvent[], anchor: AxisEvent): AxisMoment {
  const sortedEvents = [...events].sort((a, b) => a.started_at - b.started_at);
  const eventTypes = unique(sortedEvents.map((event) => event.type));
  const zones = unique(sortedEvents.map((event) => event.zone));
  const primaryTrackIds = unique(sortedEvents.map((event) => event.primary_track_id));
  const confidence = average(sortedEvents.map((event) => event.confidence));
  const gaps = collectEvidenceGaps(sortedEvents);
  const continuityScore = scoreContinuity(sortedEvents, gaps);

  return {
    id: `moment:${anchor.session_id}:${anchor.id}`,
    session_id: anchor.session_id,
    start_ms: Math.min(...sortedEvents.map((event) => event.started_at)),
    end_ms: Math.max(...sortedEvents.map((event) => event.ended_at)),
    frame_start: Math.min(...sortedEvents.map((event) => event.frame_start)),
    frame_end: Math.max(...sortedEvents.map((event) => event.frame_end)),
    event_types: eventTypes,
    zones,
    primary_track_ids: primaryTrackIds,
    purpose: classifyMomentPurpose(anchor),
    evidence: {
      event_ids: sortedEvents.map((event) => event.id),
      track_ids: unique(sortedEvents.flatMap((event) => [event.primary_track_id, ...event.participant_track_ids])),
      confidence,
      gaps,
    },
    continuity_score: continuityScore,
    retrieval_keys: buildRetrievalKeys(anchor, eventTypes, zones, primaryTrackIds),
  };
}

function classifyMomentPurpose(anchor: AxisEvent): AxisMomentPurpose {
  if (anchor.type === "shot_made" || anchor.type === "shot_missed" || anchor.type === "shot_attempt") return "teaching";
  if (anchor.type === "drive" || anchor.type === "pass" || anchor.type === "rebound") return "comparison";
  return "memory";
}

function buildRetrievalKeys(
  anchor: AxisEvent,
  eventTypes: AxisEventType[],
  zones: AxisCourtZone[],
  trackIds: string[],
) {
  return unique([
    `session:${anchor.session_id}`,
    `anchor:${anchor.type}`,
    ...eventTypes.map((type) => `event:${type}`),
    ...zones.map((zone) => `zone:${zone}`),
    ...trackIds.map((trackId) => `track:${trackId}`),
    `purpose:${classifyMomentPurpose(anchor)}`,
  ]);
}

function seedCandidates(index: AxisMomentIndex, query: AxisMomentQuery) {
  const seeded = new Set<AxisMoment>();
  const add = (moments?: AxisMoment[]) => moments?.forEach((moment) => seeded.add(moment));

  if (query.session_id) add(index.by_session.get(query.session_id));
  for (const eventType of query.event_types ?? []) add(index.by_event_type.get(eventType));
  for (const zone of query.zones ?? []) add(index.by_zone.get(zone));
  for (const trackId of query.track_ids ?? []) add(index.by_track.get(trackId));
  for (const key of query.keys ?? []) add(index.by_key.get(key));

  return seeded.size > 0 ? [...seeded] : index.moments;
}

function matchedMomentKeys(moment: AxisMoment, query: AxisMomentQuery) {
  const matches: string[] = [];
  if (query.session_id === moment.session_id) matches.push(`session:${query.session_id}`);
  for (const eventType of query.event_types ?? []) {
    if (moment.event_types.includes(eventType)) matches.push(`event:${eventType}`);
  }
  for (const zone of query.zones ?? []) {
    if (moment.zones.includes(zone)) matches.push(`zone:${zone}`);
  }
  for (const trackId of query.track_ids ?? []) {
    if (moment.primary_track_ids.includes(trackId)) matches.push(`track:${trackId}`);
  }
  for (const key of query.keys ?? []) {
    if (moment.retrieval_keys.includes(key)) matches.push(key);
  }
  return unique(matches);
}

function scoreMomentRetrieval(moment: AxisMoment, query: AxisMomentQuery, matchedKeys: string[]) {
  const hasFilters =
    Boolean(query.session_id) ||
    Boolean(query.event_types?.length) ||
    Boolean(query.zones?.length) ||
    Boolean(query.track_ids?.length) ||
    Boolean(query.keys?.length);
  const matchScore = hasFilters ? Math.min(1, matchedKeys.length / 3) : 0.5;
  return clamp(matchScore * 0.45 + moment.evidence.confidence * 0.35 + moment.continuity_score * 0.2);
}

function scoreContinuity(events: AxisEvent[], gaps: string[]) {
  if (!events.length) return 0;
  const confidence = average(events.map((event) => event.confidence));
  const snapshotCoverage = events.filter((event) => event.position_snapshot.length > 0).length / events.length;
  const gapScore = clamp(1 - gaps.length * 0.12);
  return clamp(confidence * 0.45 + snapshotCoverage * 0.35 + gapScore * 0.2);
}

function collectEvidenceGaps(events: AxisEvent[]) {
  const gaps: string[] = [];
  for (const event of events) {
    if (event.position_snapshot.length === 0) gaps.push(`missing_position_snapshot:${event.id}`);
    if (event.confidence < 0.5) gaps.push(`low_confidence:${event.id}`);
  }

  for (let index = 1; index < events.length; index += 1) {
    const gapMs = events[index].started_at - events[index - 1].ended_at;
    if (gapMs > 1500) gaps.push(`temporal_gap:${events[index - 1].id}:${events[index].id}:${gapMs}`);
  }

  return gaps;
}

function computeStitchGaps(moments: AxisMoment[]) {
  const gaps: number[] = [];
  for (let index = 1; index < moments.length; index += 1) {
    gaps.push(Math.max(0, moments[index].start_ms - moments[index - 1].end_ms));
  }
  return gaps;
}

function gapPenalty(gaps: number[]) {
  return clamp(gaps.reduce((sum, gap) => sum + Math.min(0.2, gap / 10000), 0));
}

function scoreMomentSimilarity(input: {
  sharedEventTypes: number;
  sharedZones: number;
  sharedTrackIds: number;
  timingDelta: number;
  evidenceDelta: number;
  continuityDelta: number;
}) {
  const eventScore = Math.min(1, input.sharedEventTypes / 2) * 0.35;
  const zoneScore = Math.min(1, input.sharedZones / 2) * 0.2;
  const trackScore = Math.min(1, input.sharedTrackIds / 2) * 0.2;
  const timingScore = clamp(1 - input.timingDelta / 5000) * 0.15;
  const qualityScore = clamp(1 - Math.abs(input.evidenceDelta) - Math.abs(input.continuityDelta)) * 0.1;
  return clamp(eventScore + zoneScore + trackScore + timingScore + qualityScore);
}

function scoreTeachingValue(moment: AxisMoment) {
  const meaningfulEventScore = moment.event_types.some((type) =>
    ["shot_attempt", "shot_made", "shot_missed", "drive", "pass", "rebound"].includes(type),
  )
    ? 0.3
    : 0.12;
  const evidenceScore = moment.evidence.confidence * 0.3;
  const continuityScore = moment.continuity_score * 0.25;
  const gapScore = clamp(1 - moment.evidence.gaps.length * 0.08) * 0.15;
  return clamp(meaningfulEventScore + evidenceScore + continuityScore + gapScore);
}

function describeTeachingValue(moment: AxisMoment) {
  if (moment.evidence.gaps.length > 0) {
    return "Useful moment with evidence gaps that should stay visible during review.";
  }
  if (moment.event_types.includes("shot_made") || moment.event_types.includes("shot_missed")) {
    return "Shot outcome moment with enough event context to replay and compare.";
  }
  if (moment.event_types.includes("drive") || moment.event_types.includes("pass")) {
    return "Movement moment with continuity value across the session history.";
  }
  return "Replay memory with enough evidence quality to support learning.";
}

function durationMs(moment: AxisMoment) {
  return Math.max(0, moment.end_ms - moment.start_ms);
}

function pushIndex<K>(map: Map<K, AxisMoment[]>, key: K, moment: AxisMoment) {
  const existing = map.get(key);
  if (existing) existing.push(moment);
  else map.set(key, [moment]);
}

function uniqueMoments(moments: AxisMoment[]) {
  const seen = new Set<string>();
  return moments.filter((moment) => {
    if (seen.has(moment.id)) return false;
    seen.add(moment.id);
    return true;
  });
}

function intersect<T>(a: T[], b: T[]) {
  const bSet = new Set(b);
  return unique(a.filter((value) => bSet.has(value)));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
