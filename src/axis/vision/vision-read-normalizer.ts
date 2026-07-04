import type { AxisDetectedObject, AxisEvidence, AxisMotionHint, AxisRimBox, AxisVisionRead } from "../core/types";

export function createAxisVisionRead(input: {
  confidence?: number;
  detectorOk?: boolean;
  frameId?: string;
  motionHints: AxisMotionHint[];
  objects: AxisDetectedObject[];
  rimBox?: AxisRimBox | null;
  sessionId: string;
  source: AxisVisionRead["source"];
  timestampMs: number;
}): AxisVisionRead {
  const confidence = input.confidence ?? confidenceFromObjects(input.objects);
  return {
    confidence,
    frameId: input.frameId,
    id: `axis-vision-read-${crypto.randomUUID()}`,
    lockState: lockStateFromObjects(input.objects, confidence, input.detectorOk ?? true),
    motionHints: input.motionHints,
    objects: input.objects,
    rimBox: input.rimBox ?? undefined,
    reviewState: reviewStateFromObjects(input.objects, confidence, input.detectorOk ?? true),
    sessionId: input.sessionId,
    source: input.source,
    timestampMs: input.timestampMs,
  };
}

export function axisVisionReadToEvidence(read: AxisVisionRead): AxisEvidence {
  return {
    capabilityId: read.source === "huggingface" ? "objects.huggingface" : "vision.local",
    capturedAt: new Date(read.timestampMs).toISOString(),
    id: `axis-evidence-${read.id}`,
    kind: "vision_read" as const,
    metadata: { read },
    observations: read.objects.map((object) => ({
      label: object.label,
      unit: "state" as const,
      value: object.kind,
    })),
    sessionId: read.sessionId,
    summary: read.objects.length || read.rimBox
      ? [...read.objects.map((object) => object.label), read.rimBox ? "rim calibrated" : ""].filter(Boolean).join(", ")
      : "No supported objects detected",
    trust: read.source === "huggingface" ? "server_computed" as const : "local_computed" as const,
  };
}

function confidenceFromObjects(objects: AxisDetectedObject[]) {
  if (!objects.length) return 0;
  return objects.reduce((sum, object) => sum + object.confidence, 0) / objects.length;
}

function reviewStateFromObjects(objects: AxisDetectedObject[], confidence: number, detectorOk: boolean): AxisVisionRead["reviewState"] {
  if (!objects.length) return "uncertain";
  const kinds = new Set(objects.map((object) => object.kind));
  if (kinds.has("player") && kinds.has("ball") && kinds.has("rim") && confidence >= 0.75) return "ready";
  if (kinds.has("player") || kinds.has("ball") || kinds.has("rim")) return "needs_review";
  if (!detectorOk) return "uncertain";
  return "uncertain";
}

function lockStateFromObjects(objects: AxisDetectedObject[], confidence: number, detectorOk: boolean): AxisVisionRead["lockState"] {
  if (!detectorOk) return "error";
  if (objects.some((object) => object.kind === "player") && confidence >= 0.65) return "locked";
  if (objects.some((object) => object.kind === "player")) return "review";
  return "lost";
}
