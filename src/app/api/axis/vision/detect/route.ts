import type { AxisLiveDetection } from "../../../../../lib/axis/axis-vision-types";
import type { VisionObject } from "../../../../../lib/axis/axis-object-lock-types";

export const runtime = "nodejs";
export const maxDuration = 60;

type DetectBody = {
  base64?: unknown;
  frameId?: unknown;
  imageDataUrl?: unknown;
  timestamp?: unknown;
};

type DetectorDetection = {
  bbox?: {
    height?: unknown;
    width?: unknown;
    x?: unknown;
    y?: unknown;
  };
  classId?: unknown;
  className?: unknown;
  confidence?: unknown;
  mappedType?: unknown;
};

type DetectorResult = {
  detections?: unknown;
  error?: unknown;
  frameId?: unknown;
  image?: {
    height?: unknown;
    width?: unknown;
  };
  model?: unknown;
  ok?: unknown;
  timestamp?: unknown;
};

const defaultDetectorUrl = "http://127.0.0.1:8011";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DetectBody | null;
  const imageDataUrl = normalizeImageDataUrl(body);
  if (!imageDataUrl) {
    return Response.json({ ok: false, error: "imageDataUrl or base64 is required.", detections: [], objects: [] }, { status: 400 });
  }

  const frameId = getString(body?.frameId) || `frame-${Date.now().toString(36)}`;
  const timestamp = getNumber(body?.timestamp) ?? Date.now();
  const detectorUrl = getDetectorUrl();

  try {
    const response = await fetch(`${detectorUrl}/detect`, {
      body: JSON.stringify({ frameId, imageDataUrl, timestamp }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(20_000),
    });

    const detectorResult = (await response.json().catch(() => null)) as DetectorResult | null;
    if (!response.ok || !detectorResult?.ok) {
      return Response.json({
        ok: false,
        detectorUrl,
        error: getDetectorError(detectorResult, response.status),
        detections: [],
        frameId,
        objects: [],
        timestamp,
      }, { status: 502 });
    }

    const detections = normalizeDetections(detectorResult);
    const objects = detections.map((detection, index) => detectionToVisionObject(detection, index, timestamp));

    return Response.json({
      ok: true,
      detectorUrl,
      detections,
      frameId,
      image: {
        height: getNumber(detectorResult.image?.height),
        width: getNumber(detectorResult.image?.width),
      },
      model: getString(detectorResult.model) || "yolo11n.pt",
      objects,
      timestamp,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, detectorUrl, error: reason, detections: [], frameId, objects: [], timestamp }, { status: 502 });
  }
}

function getDetectorUrl() {
  return (process.env.AXIS_VISION_DETECTOR_URL || defaultDetectorUrl).replace(/\/+$/, "");
}

function normalizeImageDataUrl(body: DetectBody | null) {
  const imageDataUrl = getString(body?.imageDataUrl);
  if (imageDataUrl) return imageDataUrl;

  const base64 = getString(body?.base64);
  if (!base64) return "";
  return base64.startsWith("data:image/") ? base64 : `data:image/jpeg;base64,${base64}`;
}

function getDetectorError(result: DetectorResult | null, status: number) {
  const error = getString(result?.error);
  if (error) return error;
  return `Axis Vision detector returned ${status}.`;
}

function normalizeDetections(result: DetectorResult): AxisLiveDetection[] {
  if (!Array.isArray(result.detections)) return [];

  return result.detections
    .map((detection, index) => normalizeDetection(detection, index))
    .filter((detection): detection is AxisLiveDetection => Boolean(detection));
}

function normalizeDetection(value: unknown, index: number): AxisLiveDetection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const detection = value as DetectorDetection;
  const mappedType = getString(detection.mappedType);
  if (mappedType !== "player" && mappedType !== "ball") return null;

  const bbox = detection.bbox;
  const x = getNumber(bbox?.x);
  const y = getNumber(bbox?.y);
  const width = getNumber(bbox?.width);
  const height = getNumber(bbox?.height);
  const score = getNumber(detection.confidence);
  if (x === undefined || y === undefined || width === undefined || height === undefined || score === undefined) return null;

  const kind = mappedType === "player" ? "person" : "ball";
  return {
    bbox: [x, y, width, height],
    classId: getNumber(detection.classId),
    className: getString(detection.className) || undefined,
    id: `${kind}-${index}-${Math.round(x)}-${Math.round(y)}`,
    kind,
    label: mappedType === "player" ? "Person" : "Ball",
    mappedType,
    score,
  };
}

function detectionToVisionObject(detection: AxisLiveDetection, index: number, timestamp: number): VisionObject {
  const type = detection.kind === "ball" ? "ball" : "player";
  return {
    bbox: {
      height: detection.bbox[3],
      width: detection.bbox[2],
      x: detection.bbox[0],
      y: detection.bbox[1],
    },
    confidence: detection.score,
    id: `${type}-detection-${index + 1}`,
    label: type === "ball" ? "Ball" : `P${index + 1}`,
    lastSeenAt: timestamp,
    manuallyLocked: false,
    selected: false,
    state: detection.score > 0.48 ? "locked" : "candidate",
    trackId: detection.id,
    type,
  };
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
