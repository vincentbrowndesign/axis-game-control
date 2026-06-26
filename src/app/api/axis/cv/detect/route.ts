// POST /api/axis/cv/detect
//
// Runs sampled frames through a CV provider and returns normalized detections.
// Provider priority:
//   1. AXIS_VISION_DETECTOR_URL — user-hosted YOLO server
//   2. Roboflow hosted inference — ROBOFLOW_API_KEY + project
//
// Status meanings:
//   connected     — provider responded (HTTP 2xx); detections may be empty
//   failed        — provider is configured but unreachable or returned HTTP error
//   not_configured — no credentials/URL set for this provider

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── Config ──────────────────────────────────────────────────────────────────

const DETECTOR_URL = (process.env.AXIS_VISION_DETECTOR_URL ?? "").replace(/\/$/, "");
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY ?? "";
const ROBOFLOW_PROJECT = process.env.ROBOFLOW_PROJECT ?? "axis-kinetic-observer";
const ROBOFLOW_VERSION = process.env.ROBOFLOW_VERSION ?? "1";
const BATCH_SIZE = 4;
const MAX_FRAMES = 60;
const MIN_USABLE_FRAMES_FOR_ZERO_PEOPLE = 12;
const TIMEOUT_MS = 8000;
const YOLO_DEFAULT_CONFIDENCE = 0.25;
const YOLO_RETRY_CONFIDENCE = 0.12;

// ─── Public types ─────────────────────────────────────────────────────────────

export type CvDetectStatus = "connected" | "failed" | "not_configured";

export type CvDetectKind = "ball" | "object" | "person" | "rim";

export type CvDetectDetection = {
  bbox: [number, number, number, number]; // normalized [x1, y1, x2, y2] 0–1
  class: string;
  confidence: number;
  kind: CvDetectKind;
};

export type CvDetectFrameResult = {
  detections: CvDetectDetection[];
  error?: string;
  peopleCount: number;
  retryUsed?: boolean;
  timestampSeconds: number;
};

export type CvDetectResponse = {
  failReason?: string;
  frameResults: CvDetectFrameResult[];
  provider: string;
  status: CvDetectStatus;
  summary: {
    avgPeopleCount: number;
    ballDetected: boolean;
    classCounts: Record<string, number>;
    failReason?: string;
    framesWithDetections: number;
    framesWithPeople: number;
    maxPeopleCount: number;
    reason?: string;
    provider: string;
    status: CvDetectStatus;
    totalDetections: number;
    totalFrames: number;
    usableFrameCount: number;
  };
};

// ─── Request types ────────────────────────────────────────────────────────────

type FrameInput = {
  imageDataUrl: string;
  timestampSeconds: number;
};

type SamplingStats = {
  frameCount?: number;
  skippedFrameCount?: number;
  usableFrameCount?: number;
};

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  let body: { frames?: FrameInput[]; sampling?: SamplingStats };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const frames = (body.frames ?? []).slice(0, MAX_FRAMES);
  const sampling = normalizeSamplingStats(body.sampling, frames.length);
  if (frames.length === 0) {
    return NextResponse.json({ error: "No frames provided." }, { status: 400 });
  }

  console.log(
    `[CV_SAMPLING] frameCount=${sampling.frameCount} usableFrameCount=${sampling.usableFrameCount} skippedFrameCount=${sampling.skippedFrameCount}`,
  );
  console.log("[CV_CLASS_MAP] person/player=0 sports_ball=32");

  // Try providers in priority order — return on first connected result
  const yoloResult = await tryYolo(frames);
  if (yoloResult.status === "connected") {
    return NextResponse.json(buildResponse(yoloResult.frameResults, "yolo", "connected", undefined, sampling));
  }

  const rfResult = await tryRoboflow(frames);
  if (rfResult.status === "connected") {
    return NextResponse.json(buildResponse(rfResult.frameResults, "roboflow", "connected", undefined, sampling));
  }

  // Both failed or not configured — surface the most actionable reason
  if (yoloResult.status === "failed" || rfResult.status === "failed") {
    const failedProvider = yoloResult.status === "failed" ? "yolo" : "roboflow";
    const failReason = yoloResult.failReason ?? rfResult.failReason;
    return NextResponse.json(buildResponse([], failedProvider, "failed", failReason, sampling));
  }

  // Both not_configured (or one not_configured + one not reachable before the failed check above)
  const failReason = yoloResult.failReason ?? rfResult.failReason
    ?? "No provider configured — set AXIS_VISION_DETECTOR_URL or ROBOFLOW_API_KEY";
  return NextResponse.json(buildResponse([], "none", "not_configured", failReason, sampling));
}

// ─── Provider: YOLO ──────────────────────────────────────────────────────────

async function tryYolo(
  frames: FrameInput[],
): Promise<{ failReason?: string; frameResults: CvDetectFrameResult[]; status: CvDetectStatus }> {
  if (!DETECTOR_URL) {
    console.log("[CV] yolo: not_configured — AXIS_VISION_DETECTOR_URL not set");
    return { frameResults: [], status: "not_configured" };
  }

  console.log(`[CV_CALL_START] provider=yolo frames=${frames.length} endpoint=${DETECTOR_URL}/detect`);

  let successCount = 0;
  let errorCount = 0;
  let lastError = "";
  const frameResults: CvDetectFrameResult[] = [];

  for (let i = 0; i < frames.length; i += BATCH_SIZE) {
    const batch = frames.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (frame) => {
        try {
          const result = await callYoloFrameWithRetry(frame);
          successCount++;
          return result;
        } catch (err) {
          errorCount++;
          const msg = err instanceof Error ? err.message : String(err);
          lastError = msg;
          return emptyFrame(frame.timestampSeconds, msg);
        }
      }),
    );
    frameResults.push(...batchResults);
  }

  const totalDetections = frameResults.reduce((s, f) => s + f.detections.length, 0);
  const classCounts = countDetectionsByClass(frameResults);

  if (successCount > 0) {
    console.log(
      `[CV_CALL_SUCCESS] provider=yolo frames=${frames.length} success=${successCount} detections=${totalDetections} classCounts=${JSON.stringify(classCounts)}`,
    );
    return { frameResults, status: "connected" };
  }

  const failReason = `yolo: ${lastError || "no frames succeeded"} (${DETECTOR_URL}/detect)`;
  console.log(`[CV_CALL_FAILED] provider=yolo frames=${frames.length} errors=${errorCount} reason=${failReason}`);
  return { failReason, frameResults: [], status: "failed" };
}

async function callYoloFrameWithRetry(frame: FrameInput): Promise<CvDetectFrameResult> {
  const first = await callYoloFrame(frame, YOLO_DEFAULT_CONFIDENCE);
  if (first.detections.length > 0) return first;

  console.log(
    `[CV_YOLO_RETRY] timestamp=${frame.timestampSeconds.toFixed(2)} reason=zero_detections confidence=${YOLO_RETRY_CONFIDENCE} crop=none frame=full`,
  );
  const retry = await callYoloFrame(frame, YOLO_RETRY_CONFIDENCE);
  return { ...retry, retryUsed: true };
}

async function callYoloFrame(frame: FrameInput, confidenceThreshold: number): Promise<CvDetectFrameResult> {
  // axismeasure.com/detector expects { imageDataUrl: "data:image/jpeg;base64,..." }
  // Verified from /health response schema — "imageDataUrl" is the required field name.
  if (typeof frame.imageDataUrl !== "string" || !frame.imageDataUrl) {
    throw new Error(`frame.imageDataUrl is ${typeof frame.imageDataUrl} — expected string`);
  }

  const response = await fetch(`${DETECTOR_URL}/detect`, {
    body: JSON.stringify({
      confidenceThreshold,
      imageDataUrl: frame.imageDataUrl,
      resizeMode: "full_frame",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    // Capture response body for diagnostics (422 from schema mismatch, etc.)
    const errText = await response.text().catch(() => "");
    throw new Error(`YOLO HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const raw = (await response.json()) as unknown;
  return { ...parseYoloResponse(raw, frame.timestampSeconds), timestampSeconds: frame.timestampSeconds };
}

// Parse multiple YOLO/detector response shapes
function parseYoloResponse(raw: unknown, timestampSeconds: number): Omit<CvDetectFrameResult, "timestampSeconds"> {
  if (raw === null || typeof raw !== "object") return emptyFrame(timestampSeconds);

  const obj = raw as Record<string, unknown>;

  // Shape A: custom axis-detector format { detections: [{bbox, kind, label, score}], image: {width, height} }
  if (Array.isArray(obj["detections"])) {
    const imgW = (obj["image"] as Record<string, number> | undefined)?.["width"] ?? 480;
    const imgH = (obj["image"] as Record<string, number> | undefined)?.["height"] ?? 270;
    const detections = (obj["detections"] as Array<Record<string, unknown>>).flatMap((d) => {
      const bbox = normalizeDetectorBbox(d["bbox"], imgW, imgH);
      if (!bbox) return [];
      const classId = getNumber(d["classId"]);
      const cls = String(d["className"] ?? d["label"] ?? d["kind"] ?? d["mappedType"] ?? "object");
      const kind = classToKind(cls, classId);
      return [{
        bbox,
        class: cls,
        confidence: Number(d["confidence"] ?? d["score"] ?? 0),
        kind,
      }] satisfies CvDetectDetection[];
    });
    const peopleCount = detections.filter((d) => d.kind === "person").length;
    return { detections, peopleCount };
  }

  // Shape B: Roboflow-style { predictions: [{x, y, width, height, confidence, class}], image: {width, height} }
  if (Array.isArray(obj["predictions"])) {
    const imgW = (obj["image"] as Record<string, number> | undefined)?.["width"] ?? 480;
    const imgH = (obj["image"] as Record<string, number> | undefined)?.["height"] ?? 270;
    const detections = (obj["predictions"] as Array<Record<string, unknown>>).flatMap((p) => {
      const cx = Number(p["x"] ?? 0);
      const cy = Number(p["y"] ?? 0);
      const pw = Number(p["width"] ?? 0);
      const ph = Number(p["height"] ?? 0);
      const classId = getNumber(p["classId"] ?? p["class_id"]);
      const cls = String(p["class"] ?? p["className"] ?? p["class_name"] ?? "object");
      const kind = classToKind(cls, classId);
      return [{
        bbox: [
          (cx - pw / 2) / imgW,
          (cy - ph / 2) / imgH,
          (cx + pw / 2) / imgW,
          (cy + ph / 2) / imgH,
        ] as [number, number, number, number],
        class: cls,
        confidence: Number(p["confidence"] ?? 0),
        kind,
      }] satisfies CvDetectDetection[];
    });
    const peopleCount = detections.filter((d) => d.kind === "person").length;
    return { detections, peopleCount };
  }

  // Shape C: normalized array [{ x1, y1, x2, y2, confidence, class }]
  if (Array.isArray(raw)) {
    const detections = (raw as Array<Record<string, unknown>>).flatMap((item) => {
      const x1 = Number(item["x1"] ?? 0);
      const y1 = Number(item["y1"] ?? 0);
      const x2 = Number(item["x2"] ?? 0);
      const y2 = Number(item["y2"] ?? 0);
      const classId = getNumber(item["classId"] ?? item["class_id"]);
      const cls = String(item["class"] ?? item["className"] ?? item["label"] ?? "object");
      const kind = classToKind(cls, classId);
      return [{
        bbox: [x1, y1, x2, y2] as [number, number, number, number],
        class: cls,
        confidence: Number(item["confidence"] ?? item["score"] ?? 0),
        kind,
      }] satisfies CvDetectDetection[];
    });
    const peopleCount = detections.filter((d) => d.kind === "person").length;
    return { detections, peopleCount };
  }

  return emptyFrame(timestampSeconds);
}

// ─── Provider: Roboflow ───────────────────────────────────────────────────────

async function tryRoboflow(
  frames: FrameInput[],
): Promise<{ failReason?: string; frameResults: CvDetectFrameResult[]; status: CvDetectStatus }> {
  if (!ROBOFLOW_API_KEY) {
    console.log("[CV] roboflow: not_configured — ROBOFLOW_API_KEY not set");
    return { frameResults: [], status: "not_configured" };
  }

  console.log(
    `[CV_CALL_START] provider=roboflow frames=${frames.length} project=${ROBOFLOW_PROJECT}/${ROBOFLOW_VERSION}`,
  );

  let successCount = 0;
  let errorCount = 0;
  let lastError = "";
  let projectNotFound = false;
  const frameResults: CvDetectFrameResult[] = [];

  for (let i = 0; i < frames.length; i += BATCH_SIZE) {
    const batch = frames.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (frame) => {
        try {
          const result = await callRoboflowFrame(frame);
          successCount++;
          return result;
        } catch (err) {
          errorCount++;
          const msg = err instanceof Error ? err.message : String(err);
          lastError = msg;
          if (msg.includes("HTTP 404")) projectNotFound = true;
          return emptyFrame(frame.timestampSeconds, msg);
        }
      }),
    );
    frameResults.push(...batchResults);
    // If all frames in the first batch hit 404, the project doesn't exist — stop trying
    if (projectNotFound && i === 0 && successCount === 0) break;
  }

  const totalDetections = frameResults.reduce((s, f) => s + f.detections.length, 0);
  const classCounts = countDetectionsByClass(frameResults);

  if (successCount > 0) {
    console.log(
      `[CV_CALL_SUCCESS] provider=roboflow frames=${frames.length} success=${successCount} detections=${totalDetections} classCounts=${JSON.stringify(classCounts)}`,
    );
    return { frameResults, status: "connected" };
  }

  const failReason = projectNotFound
    ? `roboflow: project "${ROBOFLOW_PROJECT}/${ROBOFLOW_VERSION}" not found — model not deployed`
    : `roboflow: ${lastError || "no frames succeeded"}`;
  const status: CvDetectStatus = projectNotFound ? "not_configured" : "failed";

  console.log(`[CV_CALL_FAILED] provider=roboflow frames=${frames.length} errors=${errorCount} reason=${failReason}`);
  return { failReason, frameResults: [], status };
}

async function callRoboflowFrame(frame: FrameInput): Promise<CvDetectFrameResult> {
  const base64 = frame.imageDataUrl.replace(/^data:[^;]+;base64,/, "");
  const url = `https://detect.roboflow.com/${ROBOFLOW_PROJECT}/${ROBOFLOW_VERSION}?api_key=${ROBOFLOW_API_KEY}&confidence=35&overlap=30`;

  const response = await fetch(url, {
    body: base64,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Roboflow HTTP ${response.status}: ${errText.slice(0, 80)}`);
  }

  const raw = (await response.json()) as unknown;
  return { ...parseYoloResponse(raw, frame.timestampSeconds), timestampSeconds: frame.timestampSeconds };
}

// ─── Response builder ─────────────────────────────────────────────────────────

function buildResponse(
  frameResults: CvDetectFrameResult[],
  provider: string,
  status: CvDetectStatus,
  failReason?: string,
  sampling?: SamplingStats,
): CvDetectResponse {
  const peopleCounts = frameResults.map((f) => f.peopleCount);
  const maxPeopleCount = peopleCounts.length > 0 ? Math.max(...peopleCounts) : 0;
  const framesWithPeople = peopleCounts.filter((n) => n > 0).length;
  const avgPeopleCount = Number(
    (peopleCounts.length > 0
      ? peopleCounts.reduce((s, n) => s + n, 0) / peopleCounts.length
      : 0
    ).toFixed(1),
  );
  const allDetections = frameResults.flatMap((f) => f.detections);
  const totalDetections = allDetections.length;
  const framesWithDetections = frameResults.filter((f) => f.detections.length > 0).length;
  const ballDetected = allDetections.some((d) => d.kind === "ball");
  const classCounts = countDetectionsByClass(frameResults);
  const usableFrameCount = sampling?.usableFrameCount ?? frameResults.length;
  const reason = maxPeopleCount === 0 && usableFrameCount < MIN_USABLE_FRAMES_FOR_ZERO_PEOPLE
    ? "CV needs better frames"
    : failReason;

  console.log(
    `[CV_DETECTION_SUMMARY] provider=${provider} status=${status} totalFrames=${frameResults.length} usableFrameCount=${usableFrameCount} totalDetections=${totalDetections} framesWithPeople=${framesWithPeople} ballDetected=${ballDetected} classCounts=${JSON.stringify(classCounts)} reason=${reason ?? "none"}`,
  );

  return {
    failReason: reason ?? failReason,
    frameResults,
    provider,
    status,
    summary: {
      avgPeopleCount,
      ballDetected,
      classCounts,
      failReason: reason ?? failReason,
      framesWithDetections,
      framesWithPeople,
      maxPeopleCount,
      reason,
      provider,
      status,
      totalDetections,
      totalFrames: frameResults.length,
      usableFrameCount,
    },
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function classToKind(cls: string, classId?: number): CvDetectKind {
  if (classId === 0) return "person";
  if (classId === 32) return "ball";
  const lower = cls.toLowerCase();
  if (lower === "person" || lower === "player" || lower === "human") return "person";
  if (lower === "ball" || lower === "basketball" || lower === "sports ball") return "ball";
  if (lower === "rim" || lower === "basket" || lower === "hoop") return "rim";
  return "object";
}

function emptyFrame(timestampSeconds: number, error?: string): CvDetectFrameResult {
  return { detections: [], error, peopleCount: 0, timestampSeconds };
}

function countDetectionsByClass(frameResults: CvDetectFrameResult[]) {
  const counts: Record<string, number> = {};
  for (const detection of frameResults.flatMap((frame) => frame.detections)) {
    counts[detection.class] = (counts[detection.class] ?? 0) + 1;
  }
  return counts;
}

function getNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeDetectorBbox(value: unknown, imgW: number, imgH: number): [number, number, number, number] | null {
  if (Array.isArray(value) && value.length >= 4) {
    const [rawX, rawY, rawW, rawH] = value.map(Number);
    if (![rawX, rawY, rawW, rawH].every(Number.isFinite)) return null;
    return normalizeXywh(rawX, rawY, rawW, rawH, imgW, imgH);
  }

  if (value && typeof value === "object") {
    const box = value as Record<string, unknown>;
    const x = Number(box["x"] ?? box["left"] ?? box["x1"]);
    const y = Number(box["y"] ?? box["top"] ?? box["y1"]);
    const width = Number(box["width"] ?? box["w"]);
    const height = Number(box["height"] ?? box["h"]);
    if ([x, y, width, height].every(Number.isFinite)) {
      return normalizeXywh(x, y, width, height, imgW, imgH);
    }

    const x2 = Number(box["x2"]);
    const y2 = Number(box["y2"]);
    if ([x, y, x2, y2].every(Number.isFinite)) {
      return clampBbox([x / imgW, y / imgH, x2 / imgW, y2 / imgH]);
    }
  }

  return null;
}

function normalizeXywh(x: number, y: number, width: number, height: number, imgW: number, imgH: number) {
  return clampBbox([x / imgW, y / imgH, (x + width) / imgW, (y + height) / imgH]);
}

function clampBbox(bbox: [number, number, number, number]): [number, number, number, number] {
  return bbox.map((value) => Math.max(0, Math.min(1, value))) as [number, number, number, number];
}

function normalizeSamplingStats(sampling: SamplingStats | undefined, fallbackUsableFrameCount: number): Required<SamplingStats> {
  const usableFrameCount = Math.max(0, Math.round(sampling?.usableFrameCount ?? fallbackUsableFrameCount));
  const frameCount = Math.max(usableFrameCount, Math.round(sampling?.frameCount ?? usableFrameCount));
  const skippedFrameCount = Math.max(0, Math.round(sampling?.skippedFrameCount ?? frameCount - usableFrameCount));
  return { frameCount, skippedFrameCount, usableFrameCount };
}
