import type { AxisSurface } from "../surface";
import type { VisionObject, VisionRelationship } from "../axis-object-lock-types";

export const axisMeasureEvidenceStorageKey = "axis.measure.evidence.frames.v0";
export const axisMeasureEvidenceStorageEvent = "axis-measure-evidence-frames-changed";

export const axisMeasureEvidenceQualityLabels = [
  "good_player_lock",
  "bad_player_lock",
  "false_player",
  "missed_player",
  "good_ball_lock",
  "missed_ball",
  "good_rim_anchor",
  "bad_rim_anchor",
] as const;

export type AxisMeasureEvidenceQualityLabel = typeof axisMeasureEvidenceQualityLabels[number];

export type AxisMeasureEvidenceReviewStatus = "unreviewed" | "accepted" | "rejected";

export type AxisMeasureEvidenceFrame = {
  id: string;
  createdAt: string;
  imageDataUrl: string;
  frameWidth: number;
  frameHeight: number;
  objects: VisionObject[];
  relationships: VisionRelationship[];
  qualityLabels: AxisMeasureEvidenceQualityLabel[];
  notes?: string;
  detectorLatencyMs?: number;
  route: string;
  surface: AxisSurface;
  timestamp: number;
  reviewStatus?: AxisMeasureEvidenceReviewStatus;
};

let cachedRawFrames = "";
let cachedFrames: AxisMeasureEvidenceFrame[] = [];

export function readAxisMeasureEvidenceFrames(): AxisMeasureEvidenceFrame[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(axisMeasureEvidenceStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAxisMeasureEvidenceFrame);
  } catch {
    return [];
  }
}

export function getAxisMeasureEvidenceFrameSnapshot(): AxisMeasureEvidenceFrame[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(axisMeasureEvidenceStorageKey) || "";
  if (raw === cachedRawFrames) return cachedFrames;

  cachedRawFrames = raw;
  cachedFrames = readAxisMeasureEvidenceFrames();
  return cachedFrames;
}

export function writeAxisMeasureEvidenceFrames(frames: AxisMeasureEvidenceFrame[]) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(frames);
  cachedRawFrames = raw;
  cachedFrames = frames;
  window.localStorage.setItem(axisMeasureEvidenceStorageKey, raw);
  window.dispatchEvent(new Event(axisMeasureEvidenceStorageEvent));
}

export function saveAxisMeasureEvidenceFrame(frame: AxisMeasureEvidenceFrame) {
  const frames = readAxisMeasureEvidenceFrames();
  writeAxisMeasureEvidenceFrames([frame, ...frames]);
  return frame;
}

export function updateAxisMeasureEvidenceFrame(
  id: string,
  patch: Partial<Pick<AxisMeasureEvidenceFrame, "notes" | "qualityLabels" | "reviewStatus">>,
) {
  const frames = readAxisMeasureEvidenceFrames().map((frame) => (frame.id === id ? { ...frame, ...patch } : frame));
  writeAxisMeasureEvidenceFrames(frames);
  return frames;
}

export function deleteAxisMeasureEvidenceFrame(id: string) {
  const frames = readAxisMeasureEvidenceFrames().filter((frame) => frame.id !== id);
  writeAxisMeasureEvidenceFrames(frames);
  return frames;
}

function isAxisMeasureEvidenceFrame(value: unknown): value is AxisMeasureEvidenceFrame {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const frame = value as Partial<AxisMeasureEvidenceFrame>;
  return Boolean(
    typeof frame.id === "string" &&
      typeof frame.createdAt === "string" &&
      typeof frame.imageDataUrl === "string" &&
      typeof frame.frameWidth === "number" &&
      typeof frame.frameHeight === "number" &&
      Array.isArray(frame.objects) &&
      Array.isArray(frame.relationships) &&
      Array.isArray(frame.qualityLabels) &&
      typeof frame.route === "string" &&
      (frame.surface === "axis" || frame.surface === "measure") &&
      typeof frame.timestamp === "number",
  );
}
