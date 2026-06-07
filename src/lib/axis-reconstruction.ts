import type { AxisEvent, AxisTrack } from "./axis-primitives";

export type AxisEvidenceKind =
  | "video"
  | "tag"
  | "note"
  | "event"
  | "voice_annotation"
  | "track"
  | "timeline";

export type AxisReconstructionConfidence = "low" | "medium" | "high";

export type AxisEvidenceRecord = {
  id: string;
  kind: AxisEvidenceKind;
  source: string;
  observed_at_ms?: number;
  frame?: number;
  summary: string;
  confidence: number;
  payload?: Record<string, unknown>;
};

export type AxisVideoEvidence = {
  id?: string;
  url?: string;
  duration_ms?: number;
  width?: number;
  height?: number;
  fps?: number;
};

export type AxisTimelineEvidence = {
  id?: string;
  timestamp_ms: number;
  frame?: number;
  label: string;
  confidence?: number;
  payload?: Record<string, unknown>;
};

export type AxisTextEvidence = {
  id?: string;
  text: string;
  timestamp_ms?: number;
  confidence?: number;
  author_id?: string;
};

export type AxisReconstructionInput = {
  session_id?: string;
  video?: AxisVideoEvidence;
  tags?: string[];
  notes?: AxisTextEvidence[];
  events?: AxisEvent[];
  voice_annotations?: AxisTextEvidence[];
  player_tracks?: AxisTrack[];
  ball_tracks?: AxisTrack[];
  tracks?: AxisTrack[];
  timeline?: AxisTimelineEvidence[];
};

export type AxisConclusionStatus = "definite" | "probable";

export type AxisInferenceRecord = {
  rule: string;
  evidence_ids: string[];
  rationale: string;
};

export type AxisReconstructionConclusion = {
  id: string;
  status: AxisConclusionStatus;
  statement: string;
  evidence_ids: string[];
  confidence: number;
  confidence_level: AxisReconstructionConfidence;
  inference?: AxisInferenceRecord;
  missing_evidence_ids?: string[];
};

export type AxisMissingEvidence = {
  id: string;
  label: string;
  reason: string;
  blocks?: string[];
};

export type AxisReconstructionModel = {
  session_id?: string;
  evidence: AxisEvidenceRecord[];
  definitely_happened: AxisReconstructionConclusion[];
  probably_happened: AxisReconstructionConclusion[];
  missing_evidence: AxisMissingEvidence[];
  confidence: {
    score: number;
    level: AxisReconstructionConfidence;
  };
};

type EvidenceIndex = {
  events: AxisEvidenceRecord[];
  tracks: AxisEvidenceRecord[];
  timeline: AxisEvidenceRecord[];
  video?: AxisEvidenceRecord;
};

const HIGH_CONFIDENCE = 0.82;
const DEFINITE_EVENT_CONFIDENCE = 0.75;

export function buildAxisReconstruction(input: AxisReconstructionInput): AxisReconstructionModel {
  const evidence = normalizeReconstructionEvidence(input);
  const index = indexEvidence(evidence);
  const missingEvidence = identifyMissingEvidence(input, index);
  const definitelyHappened = buildDefiniteConclusions(input, index);
  const probablyHappened = buildProbableConclusions(input, index);
  const confidenceScore = scoreReconstructionConfidence(evidence, missingEvidence, definitelyHappened, probablyHappened);

  return {
    session_id: input.session_id,
    evidence,
    definitely_happened: definitelyHappened,
    probably_happened: probablyHappened,
    missing_evidence: missingEvidence,
    confidence: {
      score: confidenceScore,
      level: confidenceLevel(confidenceScore),
    },
  };
}

export function normalizeReconstructionEvidence(input: AxisReconstructionInput): AxisEvidenceRecord[] {
  const evidence: AxisEvidenceRecord[] = [];

  if (input.video) {
    evidence.push({
      id: `video:${input.video.id ?? "source"}`,
      kind: "video",
      source: "video",
      summary: describeVideo(input.video),
      confidence: 1,
      payload: compactPayload(input.video),
    });
  }

  for (const [index, tag] of (input.tags ?? []).entries()) {
    evidence.push({
      id: `tag:${index}:${slug(tag)}`,
      kind: "tag",
      source: "tag",
      summary: `Tag recorded: ${tag}`,
      confidence: 1,
      payload: { tag },
    });
  }

  for (const [index, note] of (input.notes ?? []).entries()) {
    evidence.push({
      id: `note:${note.id ?? index}`,
      kind: "note",
      source: "note",
      observed_at_ms: note.timestamp_ms,
      summary: `Note recorded: ${note.text}`,
      confidence: clampConfidence(note.confidence ?? 0.7),
      payload: compactPayload(note),
    });
  }

  for (const [index, voice] of (input.voice_annotations ?? []).entries()) {
    evidence.push({
      id: `voice:${voice.id ?? index}`,
      kind: "voice_annotation",
      source: "voice_annotation",
      observed_at_ms: voice.timestamp_ms,
      summary: `Voice annotation recorded: ${voice.text}`,
      confidence: clampConfidence(voice.confidence ?? 0.7),
      payload: compactPayload(voice),
    });
  }

  for (const event of input.events ?? []) {
    evidence.push({
      id: `event:${event.id}`,
      kind: "event",
      source: "axis_event",
      observed_at_ms: event.started_at,
      frame: event.frame_start,
      summary: `Axis event observed: ${event.type} in ${event.zone}`,
      confidence: clampConfidence(event.confidence),
      payload: compactPayload({
        type: event.type,
        started_at: event.started_at,
        ended_at: event.ended_at,
        frame_start: event.frame_start,
        frame_end: event.frame_end,
        origin: event.origin,
        terminus: event.terminus,
        zone: event.zone,
        primary_track_id: event.primary_track_id,
        participant_track_ids: event.participant_track_ids,
      }),
    });
  }

  const tracks = collectTracks(input);
  for (const track of tracks) {
    evidence.push({
      id: `track:${track.id}`,
      kind: "track",
      source: "axis_track",
      observed_at_ms: track.started_at,
      frame: track.frame_start,
      summary: `${track.entity_type} track observed from frame ${track.frame_start} to ${track.frame_end}`,
      confidence: clampConfidence(track.mean_confidence),
      payload: compactPayload({
        entity_type: track.entity_type,
        label: track.label,
        frame_start: track.frame_start,
        frame_end: track.frame_end,
        started_at: track.started_at,
        ended_at: track.ended_at,
        detection_count: track.detection_count,
        gap_count: track.gap_count,
        position_count: track.positions.length,
      }),
    });
  }

  for (const [index, item] of (input.timeline ?? []).entries()) {
    evidence.push({
      id: `timeline:${item.id ?? index}`,
      kind: "timeline",
      source: "timeline",
      observed_at_ms: item.timestamp_ms,
      frame: item.frame,
      summary: `Timeline marker recorded: ${item.label}`,
      confidence: clampConfidence(item.confidence ?? 0.75),
      payload: compactPayload(item.payload ?? {}),
    });
  }

  return evidence.sort(compareEvidence);
}

function buildDefiniteConclusions(input: AxisReconstructionInput, index: EvidenceIndex): AxisReconstructionConclusion[] {
  const conclusions: AxisReconstructionConclusion[] = [];

  for (const event of input.events ?? []) {
    const evidenceId = `event:${event.id}`;
    if (event.confidence < DEFINITE_EVENT_CONFIDENCE) continue;

    conclusions.push({
      id: `definite:event:${event.id}`,
      status: "definite",
      statement: `${event.type} happened in ${event.zone}`,
      evidence_ids: [evidenceId],
      confidence: clampConfidence(event.confidence),
      confidence_level: confidenceLevel(event.confidence),
    });
  }

  for (const track of collectTracks(input)) {
    const hasPositions = track.positions.length > 0;
    if (!hasPositions || track.mean_confidence < DEFINITE_EVENT_CONFIDENCE) continue;

    conclusions.push({
      id: `definite:track:${track.id}`,
      status: "definite",
      statement: `${track.entity_type} movement was observed across ${track.positions.length} positions`,
      evidence_ids: [`track:${track.id}`],
      confidence: clampConfidence(track.mean_confidence),
      confidence_level: confidenceLevel(track.mean_confidence),
    });
  }

  for (const item of index.timeline) {
    if (item.confidence < HIGH_CONFIDENCE) continue;
    conclusions.push({
      id: `definite:${item.id}`,
      status: "definite",
      statement: item.summary,
      evidence_ids: [item.id],
      confidence: item.confidence,
      confidence_level: confidenceLevel(item.confidence),
    });
  }

  return conclusions.sort(compareConclusions);
}

function buildProbableConclusions(input: AxisReconstructionInput, index: EvidenceIndex): AxisReconstructionConclusion[] {
  const conclusions: AxisReconstructionConclusion[] = [];
  const events = [...(input.events ?? [])].sort((a, b) => a.started_at - b.started_at);
  const tracksById = new Map(collectTracks(input).map((track) => [track.id, track]));

  for (const event of events) {
    if (event.confidence >= DEFINITE_EVENT_CONFIDENCE) continue;

    conclusions.push({
      id: `probable:event:${event.id}`,
      status: "probable",
      statement: `${event.type} probably happened in ${event.zone}`,
      evidence_ids: [`event:${event.id}`],
      confidence: clampConfidence(event.confidence),
      confidence_level: confidenceLevel(event.confidence),
      inference: {
        rule: "low_confidence_axis_event",
        evidence_ids: [`event:${event.id}`],
        rationale: "AxisEvent exists, but confidence is below the definite threshold.",
      },
    });
  }

  for (const event of events) {
    if (!event.terminus) continue;
    const distance = distanceBetween(event.origin, event.terminus);
    if (distance < 0.03) continue;

    const evidenceIds = [`event:${event.id}`];
    const track = tracksById.get(event.primary_track_id);
    if (track) evidenceIds.push(`track:${track.id}`);

    const confidence = clampConfidence((event.confidence + (track?.mean_confidence ?? event.confidence)) / 2);
    conclusions.push({
      id: `probable:movement:${event.id}`,
      status: "probable",
      statement: `${event.primary_track_id} probably moved from ${formatCoord(event.origin)} to ${formatCoord(event.terminus)}`,
      evidence_ids: evidenceIds,
      confidence,
      confidence_level: confidenceLevel(confidence),
      inference: {
        rule: "event_origin_to_terminus",
        evidence_ids: evidenceIds,
        rationale: "A recorded event has both origin and terminus coordinates with measurable displacement.",
      },
    });
  }

  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1];
    const current = events[index];
    const gapMs = current.started_at - previous.ended_at;
    if (gapMs < 0 || gapMs > 2500) continue;

    const sharedTrackIds = current.participant_track_ids.filter((trackId) =>
      previous.participant_track_ids.includes(trackId),
    );
    if (previous.primary_track_id === current.primary_track_id) sharedTrackIds.push(current.primary_track_id);
    if (sharedTrackIds.length === 0) continue;

    const evidenceIds = [`event:${previous.id}`, `event:${current.id}`];
    const confidence = clampConfidence((previous.confidence + current.confidence) / 2 - 0.08);
    conclusions.push({
      id: `probable:sequence:${previous.id}:${current.id}`,
      status: "probable",
      statement: `${previous.type} probably led into ${current.type}`,
      evidence_ids: evidenceIds,
      confidence,
      confidence_level: confidenceLevel(confidence),
      inference: {
        rule: "nearby_events_shared_track",
        evidence_ids: evidenceIds,
        rationale: "Two recorded events are close in time and share a participating track.",
      },
    });
  }

  for (const item of [...index.timeline, ...index.tracks]) {
    if (item.confidence >= HIGH_CONFIDENCE) continue;
    conclusions.push({
      id: `probable:${item.id}`,
      status: "probable",
      statement: item.summary,
      evidence_ids: [item.id],
      confidence: item.confidence,
      confidence_level: confidenceLevel(item.confidence),
      inference: {
        rule: "recorded_evidence_below_definite_threshold",
        evidence_ids: [item.id],
        rationale: "The evidence was recorded, but confidence is below the definite threshold.",
      },
    });
  }

  return uniqueConclusions(conclusions).sort(compareConclusions);
}

function identifyMissingEvidence(input: AxisReconstructionInput, index: EvidenceIndex): AxisMissingEvidence[] {
  const missing: AxisMissingEvidence[] = [];

  if (!index.video) {
    missing.push({
      id: "missing:video",
      label: "Video evidence",
      reason: "No video metadata or source was provided.",
      blocks: ["visual verification", "frame-level confirmation"],
    });
  }

  if ((input.events ?? []).length === 0) {
    missing.push({
      id: "missing:events",
      label: "Axis events",
      reason: "No semantic events were provided.",
      blocks: ["event-level reconstruction", "definite happened list"],
    });
  }

  if (collectTracks(input).length === 0) {
    missing.push({
      id: "missing:tracks",
      label: "Entity tracks",
      reason: "No ball or player tracks were provided.",
      blocks: ["identity continuity", "movement continuity"],
    });
  }

  for (const event of input.events ?? []) {
    if (event.position_snapshot.length > 0) continue;
    missing.push({
      id: `missing:event:${event.id}:position_snapshot`,
      label: "Event position snapshot",
      reason: `Event ${event.id} does not include a position snapshot.`,
      blocks: [`reconstruct:${event.id}`],
    });
  }

  for (const track of collectTracks(input)) {
    if (track.gap_count <= 0) continue;
    missing.push({
      id: `missing:track:${track.id}:gaps`,
      label: "Track continuity",
      reason: `Track ${track.id} has ${track.gap_count} gap(s).`,
      blocks: [`continuous_identity:${track.id}`],
    });
  }

  if ((input.voice_annotations ?? []).length === 0 && (input.notes ?? []).length === 0) {
    missing.push({
      id: "missing:human_context",
      label: "Human context",
      reason: "No notes or voice annotations were provided.",
      blocks: ["intent", "ambiguous event explanation"],
    });
  }

  return missing;
}

function scoreReconstructionConfidence(
  evidence: AxisEvidenceRecord[],
  missingEvidence: AxisMissingEvidence[],
  definite: AxisReconstructionConclusion[],
  probable: AxisReconstructionConclusion[],
) {
  if (evidence.length === 0) return 0;

  const evidenceMean = evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length;
  const conclusionMean =
    definite.length + probable.length === 0
      ? 0
      : [...definite, ...probable].reduce((sum, item) => sum + item.confidence, 0) /
        (definite.length + probable.length);
  const missingPenalty = Math.min(0.35, missingEvidence.length * 0.04);

  return clampConfidence(evidenceMean * 0.55 + conclusionMean * 0.45 - missingPenalty);
}

function indexEvidence(evidence: AxisEvidenceRecord[]): EvidenceIndex {
  const events = evidence.filter((item) => item.kind === "event");
  const tracks = evidence.filter((item) => item.kind === "track");
  const timeline = evidence.filter((item) => item.kind === "timeline");
  const video = evidence.find((item) => item.kind === "video");

  return { events, tracks, timeline, video };
}

function collectTracks(input: AxisReconstructionInput): AxisTrack[] {
  const tracks = [...(input.tracks ?? []), ...(input.player_tracks ?? []), ...(input.ball_tracks ?? [])];
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}

function compareEvidence(a: AxisEvidenceRecord, b: AxisEvidenceRecord) {
  return (a.observed_at_ms ?? Number.MAX_SAFE_INTEGER) - (b.observed_at_ms ?? Number.MAX_SAFE_INTEGER);
}

function compareConclusions(a: AxisReconstructionConclusion, b: AxisReconstructionConclusion) {
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  return a.id.localeCompare(b.id);
}

function uniqueConclusions(conclusions: AxisReconstructionConclusion[]) {
  const seen = new Set<string>();
  return conclusions.filter((conclusion) => {
    if (seen.has(conclusion.id)) return false;
    seen.add(conclusion.id);
    return true;
  });
}

function confidenceLevel(confidence: number): AxisReconstructionConfidence {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.55) return "medium";
  return "low";
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function formatCoord(coord: { x: number; y: number }) {
  return `(${coord.x.toFixed(3)}, ${coord.y.toFixed(3)})`;
}

function describeVideo(video: AxisVideoEvidence) {
  const parts = ["Video source available"];
  if (video.duration_ms !== undefined) parts.push(`${Math.round(video.duration_ms)}ms`);
  if (video.width !== undefined && video.height !== undefined) parts.push(`${video.width}x${video.height}`);
  if (video.fps !== undefined) parts.push(`${video.fps}fps`);
  return parts.join(" | ");
}

function slug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function compactPayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T;
}
