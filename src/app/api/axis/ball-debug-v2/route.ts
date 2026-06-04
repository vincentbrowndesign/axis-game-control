import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

export const runtime = "nodejs";
export const maxDuration = 300;

type BallTrackPoint = {
  confidence: number;
  frame: number;
  time: number;
  x: number;
  y: number;
};

type FrameFile = {
  frame: number;
  path: string;
};

type RoboflowPrediction = {
  class?: unknown;
  class_name?: unknown;
  confidence?: unknown;
  label?: unknown;
  name?: unknown;
  x?: unknown;
  y?: unknown;
};

const frameIntervalSeconds = 0.1;
const roboflowProject = "axis-kenetic-observer";
const roboflowVersion = "1";

export async function POST(request: Request) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "axis-ball-debug-v2-"));
  const framesDir = path.join(workDir, "frames");
  const videoPath = path.join(workDir, "upload.mp4");

  try {
    const form = await request.formData();
    const video = form.get("video");
    if (!(video instanceof Blob)) {
      return Response.json({ error: "video is required" }, { status: 400 });
    }

    await fs.mkdir(framesDir, { recursive: true });
    await fs.writeFile(videoPath, Buffer.from(await video.arrayBuffer()));

    const ffmpegPath = await getFfmpegPath();
    ffmpeg.setFfmpegPath(ffmpegPath);
    await extractFrames(videoPath, framesDir);

    const frames = await listFrames(framesDir);
    const { ballTrack, detectionCount } = await detectBasketballs(frames);

    return Response.json({
      ballTrack,
      detectionCount,
      frameCount: frames.length,
      videoUrl: "local-upload",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("BALL_DEBUG_V2_FAILED", { reason });
    return Response.json(
      {
        ballTrack: [],
        detectionCount: 0,
        error: reason,
        frameCount: 0,
        videoUrl: "local-upload",
      },
      { status: 500 },
    );
  } finally {
    await fs.rm(workDir, { force: true, recursive: true }).catch(() => null);
  }
}

async function extractFrames(videoPath: string, framesDir: string) {
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .outputOptions(["-vf", `fps=${1 / frameIntervalSeconds}`, "-q:v", "2"])
      .output(path.join(framesDir, "frame_%04d.jpg"))
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .run();
  });
}

async function listFrames(framesDir: string): Promise<FrameFile[]> {
  const entries = await fs.readdir(framesDir);
  return entries
    .filter((entry) => /^frame_\d+\.jpg$/i.test(entry))
    .sort()
    .map((entry, index) => ({
      frame: index + 1,
      path: path.join(framesDir, entry),
    }));
}

async function detectBasketballs(frames: FrameFile[]) {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  if (!apiKey) throw new Error("ROBOFLOW_API_KEY is required.");

  const endpoint = `https://detect.roboflow.com/${roboflowProject}/${roboflowVersion}?api_key=${encodeURIComponent(
    apiKey,
  )}&confidence=35&overlap=30`;
  const ballTrack: BallTrackPoint[] = [];
  let detectionCount = 0;

  for (const frame of frames) {
    const image = await fs.readFile(frame.path);
    const response = await fetch(endpoint, {
      body: image.toString("base64"),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as { predictions?: RoboflowPrediction[] } | null;
    if (!response.ok || !Array.isArray(result?.predictions)) {
      console.error("BALL_DEBUG_V2_ROBOFLOW_FRAME_FAILED", {
        frame: frame.frame,
        status: response.status,
      });
      continue;
    }

    const basketballs = result.predictions
      .map((prediction) => normalizePrediction(prediction))
      .filter((prediction) => prediction.className === "basketball");
    detectionCount += basketballs.length;

    const best = basketballs
      .filter((prediction) => isFiniteNumber(prediction.x) && isFiniteNumber(prediction.y))
      .sort((a, b) => b.confidence - a.confidence)[0];

    if (!best || !isFiniteNumber(best.x) || !isFiniteNumber(best.y)) continue;
    ballTrack.push({
      confidence: best.confidence,
      frame: frame.frame,
      time: roundTime((frame.frame - 1) * frameIntervalSeconds),
      x: best.x,
      y: best.y,
    });
  }

  return {
    ballTrack,
    detectionCount,
  };
}

function normalizePrediction(prediction: RoboflowPrediction) {
  return {
    className: String(prediction.class ?? prediction.class_name ?? prediction.label ?? prediction.name ?? "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    confidence: getNumber(prediction.confidence) ?? 0,
    x: getNumber(prediction.x),
    y: getNumber(prediction.y),
  };
}

async function getFfmpegPath() {
  const candidates = [
    typeof ffmpegStatic === "string" ? ffmpegStatic : "",
    path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next path
    }
  }

  throw new Error(`ffmpeg binary not found. Checked: ${candidates.join(", ")}`);
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}
