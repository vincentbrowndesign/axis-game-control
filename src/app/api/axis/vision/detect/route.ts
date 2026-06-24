import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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

type PythonDetection = {
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

type PythonResult = {
  detections?: unknown;
  error?: unknown;
  image?: {
    height?: unknown;
    width?: unknown;
  };
  model?: unknown;
  ok?: unknown;
};

const imageLimitBytes = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DetectBody | null;
  const parsedImage = parseImage(body);
  if (!parsedImage.ok) {
    return Response.json({ ok: false, error: parsedImage.error, detections: [], objects: [] }, { status: 400 });
  }

  const frameId = getString(body?.frameId) || `frame-${Date.now().toString(36)}`;
  const timestamp = getNumber(body?.timestamp) ?? Date.now();
  const workingDir = path.join(tmpdir(), "axis-vision-yolo11");
  const imagePath = path.join(workingDir, `${randomUUID()}.${parsedImage.extension}`);

  try {
    await mkdir(workingDir, { recursive: true });
    await writeFile(imagePath, parsedImage.buffer);

    const pythonResult = await runYolo(imagePath);
    if (!pythonResult.ok) {
      return Response.json({
        ok: false,
        error: getString(pythonResult.error) || "YOLO11 detection failed.",
        detections: [],
        frameId,
        objects: [],
        timestamp,
      }, { status: 502 });
    }

    const detections = normalizeDetections(pythonResult);
    const objects = detections.map((detection, index) => detectionToVisionObject(detection, index, timestamp));

    return Response.json({
      ok: true,
      detections,
      frameId,
      image: {
        height: getNumber(pythonResult.image?.height),
        width: getNumber(pythonResult.image?.width),
      },
      model: getString(pythonResult.model) || "yolo11n.pt",
      objects,
      timestamp,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: reason, detections: [], frameId, objects: [], timestamp }, { status: 502 });
  } finally {
    await rm(imagePath, { force: true }).catch(() => undefined);
  }
}

function parseImage(body: DetectBody | null):
  | { buffer: Buffer; extension: "jpg" | "png" | "webp"; ok: true }
  | { error: string; ok: false } {
  const imageDataUrl = getString(body?.imageDataUrl);
  const base64 = getString(body?.base64);
  const match = imageDataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  const extension = match?.[1] === "png" || match?.[1] === "webp" ? match[1] : "jpg";
  const rawBase64 = match?.[2] || base64;

  if (!rawBase64) return { error: "imageDataUrl or base64 is required.", ok: false };

  const buffer = Buffer.from(rawBase64, "base64");
  if (buffer.length === 0) return { error: "Image payload is empty.", ok: false };
  if (buffer.length > imageLimitBytes) return { error: "Image payload is too large.", ok: false };

  return { buffer, extension, ok: true };
}

function runYolo(imagePath: string) {
  return new Promise<PythonResult>((resolve) => {
    const pythonBin = process.env.AXIS_PYTHON_BIN || "python";
    const scriptPath = path.join(process.cwd(), "scripts", "axis_vision_yolo11_detect.py");
    const child = spawn(pythonBin, [scriptPath, imagePath], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ error: "YOLO11 detection timed out.", ok: false });
    }, 45_000);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ error: error.message, ok: false });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      const parsed = parsePythonJson(stdout);
      if (code !== 0) {
        resolve(parsed ?? { error: stderr.trim() || `YOLO11 exited with code ${code}.`, ok: false });
        return;
      }

      resolve(parsed ?? { error: "YOLO11 returned invalid JSON.", ok: false });
    });
  });
}

function parsePythonJson(stdout: string): PythonResult | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as PythonResult;
  } catch {
    const lastLine = trimmed.split(/\r?\n/).at(-1);
    if (!lastLine) return null;
    try {
      return JSON.parse(lastLine) as PythonResult;
    } catch {
      return null;
    }
  }
}

function normalizeDetections(result: PythonResult): AxisLiveDetection[] {
  if (!Array.isArray(result.detections)) return [];

  return result.detections
    .map((detection, index) => normalizeDetection(detection, index))
    .filter((detection): detection is AxisLiveDetection => Boolean(detection));
}

function normalizeDetection(value: unknown, index: number): AxisLiveDetection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const detection = value as PythonDetection;
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
    id: `${kind}-${index}-${Math.round(x)}-${Math.round(y)}`,
    kind,
    label: mappedType === "player" ? "Person" : "Ball",
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
