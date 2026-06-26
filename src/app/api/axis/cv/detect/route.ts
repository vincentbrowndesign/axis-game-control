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
const MAX_FRAMES = 30;
const TIMEOUT_MS = 8000;

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
  timestampSeconds: number;
};

export type CvDetectResponse = {
  frameResults: CvDetectFrameResult[];
  provider: string;
  status: CvDetectStatus;
  summary: {
    avgPeopleCount: number;
    ballDetected: boolean;
    framesWithDetections: number;
    framesWithPeople: number;
    maxPeopleCount: number;
    provider: string;
    status: CvDetectStatus;
    totalDetections: number;
    totalFrames: number;
  };
};

// ─── Request types ────────────────────────────────────────────────────────────

type FrameInput = {
  imageDataUrl: string;
  timestampSeconds: number;
};

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  let body: { frames?: FrameInput[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const frames = (body.frames ?? []).slice(0, MAX_FRAMES);
  if (frames.length === 0) {
    return NextResponse.json({ error: "No frames provided." }, { status: 400 });
  }

  // Try providers in priority order — return on first connected result
  const yoloResult = await tryYolo(frames);
  if (yoloResult.status === "connected") {
    return NextResponse.json(buildResponse(yoloResult.frameResults, "yolo", "connected"));
  }

  const rfResult = await tryRoboflow(frames);
  if (rfResult.status === "connected") {
    return NextResponse.json(buildResponse(rfResult.frameResults, "roboflow", "connected"));
  }

  // Both failed or not configured — return whichever had a real failure
  if (yoloResult.status === "failed" || rfResult.status === "failed") {
    const failedProvider = yoloResult.status === "failed" ? "yolo" : "roboflow";
    return NextResponse.json(buildResponse([], failedProvider, "failed"));
  }

  // Neither is configured
  return NextResponse.json(buildResponse([], "none", "not_configured"));
}

// ─── Provider: YOLO ──────────────────────────────────────────────────────────

async function tryYolo(
  frames: FrameInput[],
): Promise<{ frameResults: CvDetectFrameResult[]; status: CvDetectStatus }> {
  if (!DETECTOR_URL) {
    console.log("[CV] yolo: not_configured — AXIS_VISION_DETECTOR_URL not set");
    return { frameResults: [], status: "not_configured" };
  }

  console.log(`[CV_CALL_START] provider=yolo frames=${frames.length} endpoint=${DETECTOR_URL}/detect`);

  let successCount = 0;
  let errorCount = 0;
  const frameResults: CvDetectFrameResult[] = [];

  for (let i = 0; i < frames.length; i += BATCH_SIZE) {
    const batch = frames.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (frame) => {
        try {
          const result = await callYoloFrame(frame);
          successCount++;
          return result;
        } catch (err) {
          errorCount++;
          const msg = err instanceof Error ? err.message : String(err);
          return emptyFrame(frame.timestampSeconds, msg);
        }
      }),
    );
    frameResults.push(...batchResults);
  }

  const totalDetections = frameResults.reduce((s, f) => s + f.detections.length, 0);

  if (successCount > 0) {
    console.log(
      `[CV_CALL_SUCCESS] provider=yolo frames=${frames.length} success=${successCount} detections=${totalDetections}`,
    );
    return { frameResults, status: "connected" };
  }

  console.log(
    `[CV_CALL_FAILED] provider=yolo frames=${frames.length} errors=${errorCount}`,
  );
  return { frameResults: [], status: "failed" };
}

async function callYoloFrame(frame: FrameInput): Promise<CvDetectFrameResult> {
  // Try full data URL first; some servers accept this format.
  // Strip the prefix and retry if we get a 400 (bad request).
  const bodyVariants = [
    { base64: frame.imageDataUrl },          // full data:image/jpeg;base64,... string
    { base64: frame.imageDataUrl.replace(/^data:[^;]+;base64,/, "") }, // raw base64
  ];

  let lastError: Error | null = null;
  for (const bodyObj of bodyVariants) {
    let response: Response;
    try {
      response = await fetch(`${DETECTOR_URL}/detect`, {
        body: JSON.stringify(bodyObj),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      break; // Network error — don't retry other body variants
    }

    if (response.status === 400) {
      lastError = new Error(`YOLO HTTP 400`);
      continue; // Try next body variant
    }

    if (!response.ok) {
      throw new Error(`YOLO HTTP ${response.status}`);
    }

    const raw = (await response.json()) as unknown;
    return { ...parseYoloResponse(raw, frame.timestampSeconds), timestampSeconds: frame.timestampSeconds };
  }

  throw lastError ?? new Error("YOLO: all body variants exhausted");
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
      const bbox = d["bbox"] as [number, number, number, number] | undefined;
      if (!bbox) return [];
      const [x, y, bw, bh] = bbox;
      const kind = classToKind(String(d["kind"] ?? d["label"] ?? "object"));
      return [{
        bbox: [x / imgW, y / imgH, (x + bw) / imgW, (y + bh) / imgH] as [number, number, number, number],
        class: String(d["label"] ?? d["kind"] ?? "object"),
        confidence: Number(d["score"] ?? 0),
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
      const cls = String(p["class"] ?? "object");
      const kind = classToKind(cls);
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
      const cls = String(item["class"] ?? item["label"] ?? "object");
      const kind = classToKind(cls);
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
): Promise<{ frameResults: CvDetectFrameResult[]; status: CvDetectStatus }> {
  if (!ROBOFLOW_API_KEY) {
    console.log("[CV] roboflow: not_configured — ROBOFLOW_API_KEY not set");
    return { frameResults: [], status: "not_configured" };
  }

  console.log(
    `[CV_CALL_START] provider=roboflow frames=${frames.length} project=${ROBOFLOW_PROJECT}/${ROBOFLOW_VERSION}`,
  );

  let successCount = 0;
  let errorCount = 0;
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
          return emptyFrame(frame.timestampSeconds, msg);
        }
      }),
    );
    frameResults.push(...batchResults);
  }

  const totalDetections = frameResults.reduce((s, f) => s + f.detections.length, 0);

  if (successCount > 0) {
    console.log(
      `[CV_CALL_SUCCESS] provider=roboflow frames=${frames.length} success=${successCount} detections=${totalDetections}`,
    );
    return { frameResults, status: "connected" };
  }

  console.log(
    `[CV_CALL_FAILED] provider=roboflow frames=${frames.length} errors=${errorCount}`,
  );
  return { frameResults: [], status: "failed" };
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

  return {
    frameResults,
    provider,
    status,
    summary: {
      avgPeopleCount,
      ballDetected,
      framesWithDetections,
      framesWithPeople,
      maxPeopleCount,
      provider,
      status,
      totalDetections,
      totalFrames: frameResults.length,
    },
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function classToKind(cls: string): CvDetectKind {
  const lower = cls.toLowerCase();
  if (lower === "person" || lower === "player" || lower === "human") return "person";
  if (lower === "ball" || lower === "basketball" || lower === "sports ball") return "ball";
  if (lower === "rim" || lower === "basket" || lower === "hoop") return "rim";
  return "object";
}

function emptyFrame(timestampSeconds: number, error?: string): CvDetectFrameResult {
  return { detections: [], error, peopleCount: 0, timestampSeconds };
}
