import type { AxisPoseFrame } from "../../lib/axis/axis-pose-detector";
import type { AxisDetectedObject, AxisEvidence, AxisVisionRead } from "../core/types";

export type AxisPlayerCandidate = {
  box?: AxisDetectedObject["box"];
  confidence: number;
  id: string;
  point?: AxisDetectedObject["point"];
  source: "mediapipe" | "tensorflow-coco-ssd" | "manual";
};

export function poseFrameToPlayerCandidate(
  pose: AxisPoseFrame | null,
  input: { timestampMs: number; videoHeight: number; videoWidth: number },
): AxisPlayerCandidate | null {
  if (!pose || pose.confidence < 0.2 || !pose.landmarks.length || !input.videoWidth || !input.videoHeight) return null;

  const visibleLandmarks = pose.landmarks.filter((landmark) =>
    Number.isFinite(landmark.x)
    && Number.isFinite(landmark.y)
    && (landmark.visibility ?? 0.75) > 0.25,
  );
  const xs = visibleLandmarks.map((landmark) => landmark.x).filter(Number.isFinite);
  const ys = visibleLandmarks.map((landmark) => landmark.y).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;

  const rawMinX = Math.min(...xs);
  const rawMinY = Math.min(...ys);
  const rawMaxX = Math.max(...xs);
  const rawMaxY = Math.max(...ys);
  const rawWidth = Math.max(0.01, rawMaxX - rawMinX);
  const rawHeight = Math.max(0.01, rawMaxY - rawMinY);
  const paddingX = rawWidth * 0.1;
  const paddingY = rawHeight * 0.12;
  const minX = clamp01(rawMinX - paddingX);
  const minY = clamp01(rawMinY - paddingY);
  const maxX = clamp01(rawMaxX + paddingX);
  const maxY = clamp01(rawMaxY + paddingY);
  const width = clamp01(maxX - minX);
  const height = clamp01(maxY - minY);

  return {
    box: { height, width, x: minX, y: minY },
    confidence: pose.confidence,
    id: `axis-player-mediapipe-${input.timestampMs}`,
    point: { x: minX + width / 2, y: minY + height / 2 },
    source: "mediapipe",
  };
}

export function createPlayerVisionRead(input: {
  cameraFacingMode?: AxisVisionRead["cameraFacingMode"];
  candidates: Array<AxisPlayerCandidate | null | undefined>;
  command?: string;
  detectorError?: boolean;
  note?: string;
  sessionId: string;
  timestampMs: number;
}): AxisVisionRead {
  const candidate = chooseBestPlayerCandidate(input.candidates);
  const objects = candidate ? [playerCandidateToObject(candidate)] : [];
  const confidence = candidate?.confidence ?? 0;
  const reviewState = input.detectorError ? "error" : reviewStateFromConfidence(confidence);

  return {
    cameraFacingMode: input.cameraFacingMode,
    command: input.command,
    confidence,
    id: `axis-player-read-${crypto.randomUUID()}`,
    lockState: lockStateFromReviewState(reviewState),
    motionHints: [],
    note: input.note,
    objects,
    reviewState,
    sessionId: input.sessionId,
    source: candidate ? "local" : "manual",
    timestampMs: input.timestampMs,
  };
}

export function playerVisionReadToEvidence(read: AxisVisionRead): AxisEvidence {
  const player = read.objects.find((object) => object.label === "player");
  return {
    capabilityId: "player.lock",
    capturedAt: new Date(read.timestampMs).toISOString(),
    id: `axis-evidence-${read.id}`,
    kind: "vision_read",
    metadata: {
      read: {
        command: read.command,
        cameraFacingMode: read.cameraFacingMode,
        confidence: read.confidence,
        id: read.id,
        lockState: read.lockState,
        note: read.note,
        objects: player ? [player] : [],
        reviewState: read.reviewState,
        sessionId: read.sessionId,
        source: read.source,
        timestampMs: read.timestampMs,
      },
    },
    observations: player
      ? [
          { label: "player", unit: "state", value: player.source },
          { label: "player confidence", unit: "state", value: Math.round(player.confidence * 100) },
        ]
      : [{ label: "player", unit: "state", value: "not_locked" }],
    sessionId: read.sessionId,
    summary: player ? "Player read saved" : "No player",
    trust: "local_computed",
  };
}

function chooseBestPlayerCandidate(candidates: Array<AxisPlayerCandidate | null | undefined>) {
  const valid = candidates.filter((candidate): candidate is AxisPlayerCandidate => Boolean(candidate));
  return valid.sort((a, b) => sourceRank(a.source) - sourceRank(b.source) || b.confidence - a.confidence).at(0) ?? null;
}

function playerCandidateToObject(candidate: AxisPlayerCandidate): AxisDetectedObject {
  return {
    box: candidate.box ? normalizeBox(candidate.box) : undefined,
    confidence: candidate.confidence,
    id: candidate.id,
    kind: "player",
    label: "player",
    point: candidate.point,
    source: candidate.source,
  };
}

function normalizeBox(box: NonNullable<AxisDetectedObject["box"]>) {
  return {
    height: clamp01(box.height),
    width: clamp01(box.width),
    x: clamp01(box.x),
    y: clamp01(box.y),
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function sourceRank(source: AxisPlayerCandidate["source"]) {
  if (source === "mediapipe") return 0;
  if (source === "tensorflow-coco-ssd") return 1;
  return 2;
}

function reviewStateFromConfidence(confidence: number): AxisVisionRead["reviewState"] {
  if (confidence >= 0.65) return "ready";
  if (confidence >= 0.25) return "needs_review";
  return "uncertain";
}

function lockStateFromReviewState(reviewState: AxisVisionRead["reviewState"]): AxisVisionRead["lockState"] {
  if (reviewState === "ready") return "locked";
  if (reviewState === "needs_review") return "review";
  if (reviewState === "error") return "error";
  return "searching";
}
