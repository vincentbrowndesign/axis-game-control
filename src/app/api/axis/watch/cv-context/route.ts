// CV Context v0 — samples frames from an uploaded clip, runs detections via
// AXIS_VISION_DETECTOR_URL (YOLO11n) or Roboflow, and returns per-frame evidence.
// Called client-side before Deep Watch so CV summary can be injected into the prompt.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const DETECTOR_URL = (process.env.AXIS_VISION_DETECTOR_URL ?? "http://127.0.0.1:8011").replace(/\/$/, "");
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const ROBOFLOW_PROJECT = process.env.ROBOFLOW_PROJECT ?? "axis-kinetic-observer";
const ROBOFLOW_VERSION = process.env.ROBOFLOW_VERSION ?? "1";
const BATCH_SIZE = 4;
const MAX_FRAMES = 30;

export type CvDetection = {
  bbox: [number, number, number, number]; // normalized [x1, y1, x2, y2] 0–1
  confidence: number;
  kind: "ball" | "person";
  label: string;
};

export type CvFrameResult = {
  detections: CvDetection[];
  needsReview: boolean;
  peopleCount: number;
  timestampSeconds: number;
};

export type CvContextSummary = {
  avgPeopleCount: number;
  framesWithPeople: number;
  maxPeopleCount: number;
  provider: "fallback" | "roboflow" | "yolo";
  totalFrames: number;
};

export type CvContextResponse = {
  frameResults: CvFrameResult[];
  summary: CvContextSummary;
};

type FrameInput = {
  imageDataUrl: string;
  timestampSeconds: number;
};

export async function POST(request: Request): Promise<Response> {
  let body: { clipName?: string; frames?: FrameInput[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const frames = (body.frames ?? []).slice(0, MAX_FRAMES);
  if (frames.length === 0) {
    return NextResponse.json({ error: "No frames provided." }, { status: 400 });
  }

  const preferredProvider: "roboflow" | "yolo" = ROBOFLOW_API_KEY ? "roboflow" : "yolo";
  const frameResults = await processFramesBatched(frames, preferredProvider);

  const peopleCounts = frameResults.map((f) => f.peopleCount);
  const maxPeopleCount = Math.max(0, ...peopleCounts);
  const framesWithPeople = peopleCounts.filter((n) => n > 0).length;
  const avgPeopleCount = Number(
    (peopleCounts.length > 0 ? peopleCounts.reduce((s, n) => s + n, 0) / peopleCounts.length : 0).toFixed(1),
  );

  // If every frame returned empty detections the detector is offline — label it "fallback"
  const allEmpty = frameResults.every((f) => f.detections.length === 0);
  const provider: CvContextSummary["provider"] = allEmpty ? "fallback" : preferredProvider;

  const summary: CvContextSummary = {
    avgPeopleCount,
    framesWithPeople,
    maxPeopleCount,
    provider,
    totalFrames: frameResults.length,
  };

  return NextResponse.json({ frameResults, summary } satisfies CvContextResponse);
}

async function processFramesBatched(
  frames: FrameInput[],
  provider: "roboflow" | "yolo",
): Promise<CvFrameResult[]> {
  const results: CvFrameResult[] = [];

  for (let i = 0; i < frames.length; i += BATCH_SIZE) {
    const batch = frames.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((f) => detectFrame(f, provider)));
    results.push(...batchResults);
  }

  return results;
}

async function detectFrame(frame: FrameInput, provider: "roboflow" | "yolo"): Promise<CvFrameResult> {
  try {
    if (provider === "roboflow" && ROBOFLOW_API_KEY) {
      return await detectWithRoboflow(frame.imageDataUrl, frame.timestampSeconds);
    }
    return await detectWithYolo(frame.imageDataUrl, frame.timestampSeconds);
  } catch {
    return { detections: [], needsReview: true, peopleCount: 0, timestampSeconds: frame.timestampSeconds };
  }
}

async function detectWithYolo(imageDataUrl: string, timestampSeconds: number): Promise<CvFrameResult> {
  const response = await fetch(`${DETECTOR_URL}/detect`, {
    body: JSON.stringify({ base64: imageDataUrl }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error(`YOLO ${response.status}`);

  const data = (await response.json()) as {
    detections?: Array<{ bbox: [number, number, number, number]; kind?: string; label?: string; score?: number }>;
    image?: { height?: number; width?: number };
  };

  const imgW = data.image?.width ?? 480;
  const imgH = data.image?.height ?? 270;

  const detections: CvDetection[] = (data.detections ?? []).map((d) => {
    const [x, y, bw, bh] = d.bbox;
    return {
      bbox: [x / imgW, y / imgH, (x + bw) / imgW, (y + bh) / imgH],
      confidence: Number((d.score ?? 0).toFixed(3)),
      kind: d.kind === "ball" ? "ball" : "person",
      label: d.label ?? (d.kind === "ball" ? "ball" : "person"),
    };
  });

  const peopleCount = detections.filter((d) => d.kind === "person").length;
  return { detections, needsReview: peopleCount === 0, peopleCount, timestampSeconds };
}

async function detectWithRoboflow(imageDataUrl: string, timestampSeconds: number): Promise<CvFrameResult> {
  const base64 = imageDataUrl.replace(/^data:[^;]+;base64,/, "");
  const url = `https://detect.roboflow.com/${ROBOFLOW_PROJECT}/${ROBOFLOW_VERSION}?api_key=${ROBOFLOW_API_KEY}&confidence=35&overlap=30`;

  const response = await fetch(url, {
    body: base64,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error(`Roboflow ${response.status}`);

  const data = (await response.json()) as {
    image?: { height: number; width: number };
    predictions?: Array<{ confidence?: number; height?: number; width?: number; x?: number; y?: number }>;
  };

  const imgW = data.image?.width ?? 480;
  const imgH = data.image?.height ?? 270;

  const detections: CvDetection[] = (data.predictions ?? []).map((p) => {
    const cx = p.x ?? 0;
    const cy = p.y ?? 0;
    const pw = p.width ?? 0;
    const ph = p.height ?? 0;
    return {
      bbox: [(cx - pw / 2) / imgW, (cy - ph / 2) / imgH, (cx + pw / 2) / imgW, (cy + ph / 2) / imgH],
      confidence: Number((p.confidence ?? 0).toFixed(3)),
      kind: "person" as const,
      label: "person",
    };
  });

  const peopleCount = detections.length;
  return { detections, needsReview: peopleCount === 0, peopleCount, timestampSeconds };
}
