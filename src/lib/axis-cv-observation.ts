import type { AxisBallTrackPoint } from "./axis-ball-processing";
import type { AxisMovementPrimitive } from "./axis-movement-language";
import { updateUnderstandingFromObservation } from "./axis-observation-engine";
import type { AxisObservation, AxisPattern, AxisUnderstanding } from "./axis-server";
import type { AxisTrack } from "./axis-primitives";

export interface AxisCvSensorInput {
  ballTrack?: AxisBallTrackPoint[];
  tracks?: AxisTrack[];
}

export interface AxisCvUnderstandingUpdate {
  observation: AxisObservation;
  understanding: AxisUnderstanding;
}

type MotionSummary = {
  direction: string;
  distance: number;
  pointCount: number;
};

export function observationFromCvSensor(input: AxisCvSensorInput): AxisObservation {
  const ballMotion = summarizeBallPath(input.ballTrack ?? []);
  const playerMotion = summarizePrimaryPlayer(input.tracks ?? []);
  const relevantSignals = buildRelevantSignals(ballMotion, playerMotion);

  if (!ballMotion && !playerMotion) {
    return {
      source: "video",
      summary: "Video sensor found no stable movement track to update the current understanding.",
      relevantSignals: [],
      ignoredNoise: ["background", "lighting", "jerseys", "camera framing"],
      updates: {},
    };
  }

  const currentPattern = buildCurrentPattern(ballMotion, playerMotion);

  return {
    source: "video",
    summary: buildSummary(ballMotion, playerMotion),
    relevantSignals,
    ignoredNoise: ["background", "lighting", "jerseys", "camera framing"],
    updates: {
      concept: ballMotion ? "ball path" : "movement path",
      confidenceDelta: confidenceDeltaFor(ballMotion, playerMotion),
      currentPattern,
    },
  };
}

export function updateUnderstandingFromCvSensor(
  prior: AxisUnderstanding,
  input: AxisCvSensorInput,
): AxisCvUnderstandingUpdate {
  const observation = observationFromCvSensor(input);
  return {
    observation,
    understanding: updateUnderstandingFromObservation(prior, observation).understanding,
  };
}

function summarizeBallPath(points: AxisBallTrackPoint[]): MotionSummary | null {
  const usable = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((a, b) => a.time - b.time || a.frame - b.frame);

  if (usable.length < 2) return null;

  const first = usable[0];
  const last = usable[usable.length - 1];

  return {
    direction: directionFromDelta(last.x - first.x, last.y - first.y),
    distance: pathDistance(usable.map((point) => ({ x: point.x, y: point.y }))),
    pointCount: usable.length,
  };
}

function summarizePrimaryPlayer(tracks: AxisTrack[]): MotionSummary | null {
  const primary = tracks
    .filter((track) => track.entity_type === "player" && track.positions.length >= 2)
    .sort((a, b) => b.positions.length - a.positions.length || b.mean_confidence - a.mean_confidence)[0];

  if (!primary) return null;

  const first = primary.positions[0];
  const last = primary.positions[primary.positions.length - 1];

  return {
    direction: directionFromDelta(last.x - first.x, last.y - first.y),
    distance: pathDistance(primary.positions.map((point) => ({ x: point.x, y: point.y }))),
    pointCount: primary.positions.length,
  };
}

function buildRelevantSignals(
  ballMotion: MotionSummary | null,
  playerMotion: MotionSummary | null,
): AxisMovementPrimitive[] {
  const signals = new Set<AxisMovementPrimitive>();
  if (ballMotion) {
    signals.add("ball_path");
    signals.add("direction");
    signals.add("distance");
  }
  if (playerMotion) {
    signals.add("position");
    signals.add("direction");
    signals.add("distance");
  }
  return [...signals];
}

function buildCurrentPattern(
  ballMotion: MotionSummary | null,
  playerMotion: MotionSummary | null,
): Partial<AxisPattern> {
  const objects: string[] = [];
  const relationships: string[] = [];
  const motion: string[] = [];

  if (ballMotion) {
    objects.push("ball");
    relationships.push(`ball path moved ${ballMotion.direction}`);
    motion.push(`ball_${ballMotion.direction}`);
    motion.push(ballMotion.distance > 0.35 ? "long_ball_path" : "short_ball_path");
  }

  if (playerMotion) {
    objects.push("player");
    relationships.push(`primary player moved ${playerMotion.direction}`);
    motion.push(`player_${playerMotion.direction}`);
    motion.push(playerMotion.distance > 0.2 ? "player_relocated" : "player_held_position");
  }

  return {
    label: ballMotion ? "cv ball path" : "cv movement path",
    objects,
    relationships,
    motion,
  };
}

function buildSummary(
  ballMotion: MotionSummary | null,
  playerMotion: MotionSummary | null,
): string {
  if (ballMotion && playerMotion) {
    return `CV observed ball path moving ${ballMotion.direction} and player movement moving ${playerMotion.direction}.`;
  }
  if (ballMotion) return `CV observed ball path moving ${ballMotion.direction}.`;
  return `CV observed player movement moving ${playerMotion?.direction ?? "unknown"}.`;
}

function confidenceDeltaFor(
  ballMotion: MotionSummary | null,
  playerMotion: MotionSummary | null,
): number {
  const signalCount = Number(Boolean(ballMotion)) + Number(Boolean(playerMotion));
  const pointCount = (ballMotion?.pointCount ?? 0) + (playerMotion?.pointCount ?? 0);
  if (signalCount === 0) return 0;
  return Math.min(0.18, 0.04 * signalCount + Math.min(0.1, pointCount / 200));
}

function pathDistance(points: Array<{ x: number; y: number }>): number {
  let distance = 0;
  for (let i = 1; i < points.length; i += 1) {
    distance += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return distance;
}

function directionFromDelta(dx: number, dy: number): string {
  if (Math.abs(dx) < 0.03 && Math.abs(dy) < 0.03) return "held_position";

  const horizontal = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : "";
  const vertical = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? "down" : "up") : "";
  return horizontal || vertical;
}
