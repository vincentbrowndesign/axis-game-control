import { createWriteStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { extractAxisFrames } from "./axis-ffmpeg";

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
  const localVideoPath = path.join(workDir, "video.mp4");

  try {
    await fs.mkdir(framesDir, { recursive: true });
    logAxisBallProcessingMemory("PROCESSING_START", { workDir });
    console.log("AXIS_BALL_DOWNLOAD_VIDEO_START", { videoUrl });
    const extractionInputPath = isRemoteUrl(videoUrl) ? await downloadVideoToLocalFile(videoUrl, localVideoPath) : videoUrl;
    await onStage?.("extracting_frames");
    logAxisBallProcessingMemory("BEFORE_FRAME_EXTRACTION", { outputDir: framesDir });
    console.log("FRAME_EXTRACTION_INPUT_TRACE", {
      downloadedLocalPath: isRemoteUrl(videoUrl) ? extractionInputPath : null,
      extractionInputPath,
      inputIsRemoteUrl: isRemoteUrl(extractionInputPath),
      inputIsLocalFile: !isRemoteUrl(extractionInputPath),
      outputDir: framesDir,
    });
    console.log("FRAME_EXTRACTION_START", { videoUrl });
    await extractAxisFrames({
      fps: 1 / frameIntervalSeconds,
      inputPath: extractionInputPath,
      operationName: "AXIS_BALL_FRAME_EXTRACTION",
      outputDir: framesDir,
    });
    logAxisBallProcessingMemory("AFTER_FRAME_EXTRACTION", { outputDir: framesDir });
    console.log("FRAME_EXTRACTION_COMPLETE", { videoUrl });

    const frames = await listFrames(framesDir);
    logAxisBallProcessingMemory("AFTER_FRAME_LIST", { frameCount: frames.length });
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
    logAxisBallProcessingMemory("BEFORE_ROBOFLOW", { frameCount: frames.length });
    console.log("ROBOFLOW_START", {
      project: roboflowProject,
      version: roboflowVersion,
    });
    const detectionResult = await detectBasketballs(frames);
    logAxisBallProcessingMemory("AFTER_ROBOFLOW", {
      ballTrackCount: detectionResult.ballTrack.length,
      detectionCount: detectionResult.detectionCount,
    });
    await onStage?.("building_track");
    console.log("DETECTIONS_RETURNED", { count: detectionResult.detectionCount });
    console.log("BASKETBALL_DETECTIONS", { count: detectionResult.detectionCount });
    console.log("BALL_TRACK_COUNT", { count: detectionResult.ballTrack.length });

    await onStage?.("rendering_replay");
    logAxisBallProcessingMemory("BEFORE_REPLAY_GENERATION", {
      ballTrackCount: detectionResult.ballTrack.length,
      frameCount: frames.length,
    });
    return {
      ballTrack: detectionResult.ballTrack,
      detectionCount: detectionResult.detectionCount,
      frameCount: frames.length,
    };
  } finally {
    await fs.rm(workDir, { force: true, recursive: true }).catch(() => null);
  }
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

    if (frame.frame % 100 === 0) {
      logAxisBallProcessingMemory("ROBOFLOW_FRAME_BATCH", {
        ballTrackCount: ballTrack.length,
        detectionCount,
        frame: frame.frame,
        totalFrames: frames.length,
      });
    }

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

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}

async function downloadVideoToLocalFile(videoUrl: string, localPath: string) {
  const response = await fetch(videoUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download video for local processing with HTTP ${response.status}.`);
  }

  await fs.mkdir(path.dirname(localPath), { recursive: true });
  const stream = Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
  await pipeline(stream, createWriteStream(localPath));
  const stats = await fs.stat(localPath);
  console.log("LOCAL_MP4_DOWNLOADED", {
    fileSizeMb: bytesToMb(stats.size),
    localPath,
  });
  return localPath;
}

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function logAxisBallProcessingMemory(stage: string, details: Record<string, unknown> = {}) {
  const memory = process.memoryUsage();
  console.log("AXIS_BALL_PROCESSING_MEMORY", {
    ...details,
    external: memory.external,
    heap_total: memory.heapTotal,
    heap_used: memory.heapUsed,
    rss: memory.rss,
    stage,
  });
}

function bytesToMb(value: number) {
  return Math.round((value / 1024 / 1024) * 100) / 100;
}
