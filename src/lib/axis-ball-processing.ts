import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

export type AxisBallTrackPoint = {
  confidence: number;
  frame: number;
  time: number;
  x: number;
  y: number;
};

export type AxisBallProcessingResult = {
  ballTrack: AxisBallTrackPoint[];
  detectionCount: number;
  frameCount: number;
};

export type AxisBallProcessingStageUpdate =
  | "building_track"
  | "detecting_basketball"
  | "extracting_frames"
  | "rendering_replay";

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

export function getMuxPlaybackUrl(playbackId?: string | null) {
  return playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : "";
}

export async function runAxisBallProcessing(
  videoUrl: string,
  onStage?: (stage: AxisBallProcessingStageUpdate) => Promise<void> | void,
): Promise<AxisBallProcessingResult> {
  if (!videoUrl) throw new Error("videoUrl is required.");

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "axis-ball-processing-"));
  const framesDir = path.join(workDir, "frames");

  try {
    await fs.mkdir(framesDir, { recursive: true });
    const ffmpegPath = await getFfmpegPath();
    ffmpeg.setFfmpegPath(ffmpegPath);

    console.log("AXIS_BALL_DOWNLOAD_VIDEO_START", { videoUrl });
    await onStage?.("extracting_frames");
    console.log("FRAME_EXTRACTION_START", { videoUrl });
    await extractFrames(videoUrl, framesDir);
    console.log("FRAME_EXTRACTION_COMPLETE", { videoUrl });

    const frames = await listFrames(framesDir);
    console.log("FRAMES_EXTRACTED", { count: frames.length });
    console.log("FRAMES_SENT_TO_ROBOFLOW", { count: frames.length });

    if (!frames.length) {
      return {
        ballTrack: [],
        detectionCount: 0,
        frameCount: 0,
      };
    }

    await onStage?.("detecting_basketball");
    console.log("ROBOFLOW_START", {
      project: roboflowProject,
      version: roboflowVersion,
    });
    const detectionResult = await detectBasketballs(frames);
    await onStage?.("building_track");
    console.log("DETECTIONS_RETURNED", { count: detectionResult.detectionCount });
    console.log("BASKETBALL_DETECTIONS", { count: detectionResult.detectionCount });
    console.log("BALL_TRACK_COUNT", { count: detectionResult.ballTrack.length });

    await onStage?.("rendering_replay");
    return {
      ballTrack: detectionResult.ballTrack,
      detectionCount: detectionResult.detectionCount,
      frameCount: frames.length,
    };
  } finally {
    await fs.rm(workDir, { force: true, recursive: true }).catch(() => null);
  }
}

async function extractFrames(videoUrl: string, framesDir: string) {
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(videoUrl)
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
  const ballTrack: AxisBallTrackPoint[] = [];
  let detectionCount = 0;

  for (const frame of frames) {
    const image = await fs.readFile(frame.path);
    const response = await fetch(endpoint, {
      body: image.toString("base64"),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as { predictions?: RoboflowPrediction[] } | null;
    console.log("ROBOFLOW_RESPONSE", {
      frame: frame.frame,
      predictionCount: Array.isArray(result?.predictions) ? result.predictions.length : 0,
      status: response.status,
    });
    if (!response.ok || !Array.isArray(result?.predictions)) {
      throw new Error(`Roboflow failed at frame ${frame.frame} with HTTP ${response.status}.`);
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
  if (typeof ffmpegStatic === "string") {
    await fs.access(ffmpegStatic);
    return ffmpegStatic;
  }

  throw new Error("ffmpeg binary not found.");
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
