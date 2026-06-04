import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

export type AxisFrameDebugInput = {
  frameIntervalSeconds?: number;
  muxPlaybackId?: string;
  videoUrl?: string;
};

export type AxisBallTrackPoint = {
  confidence: number;
  frame: number;
  time: number;
  x: number;
  y: number;
};

type RawFrameDetection = {
  className: string;
  confidence: number;
  frame: number;
  height?: number;
  width?: number;
  x?: number;
  y?: number;
};

type RoboflowPrediction = {
  class?: unknown;
  class_name?: unknown;
  confidence?: unknown;
  height?: unknown;
  label?: unknown;
  name?: unknown;
  width?: unknown;
  x?: unknown;
  y?: unknown;
};

export type AxisFrameDebugResult = {
  BALL_DETECTIONS: number;
  BALL_TRACK_COUNT: number;
  BALL_TRACK_CREATED: boolean;
  BALL_TRACK_FILE_EXISTS: boolean;
  DEBUG_MP4_CREATED: boolean;
  FIRST_BALL_FRAME: number | null;
  LAST_BALL_FRAME: number | null;
  TOTAL_DETECTIONS: number;
  TOTAL_FRAMES: number;
  ball_track_path: string;
  debug_mp4_path: string;
  exact_failing_step: string;
  first_20_detections: RawFrameDetection[];
  frames_dir: string;
  raw_class_names: string[];
};

const defaultFrameIntervalSeconds = 0.1;
const roboflowConfidence = 35;
const roboflowOverlap = 30;

export function getMuxPlaybackUrl(playbackId?: string) {
  return playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : undefined;
}

export async function runAxisFrameDebugPass(input: AxisFrameDebugInput): Promise<AxisFrameDebugResult> {
  const videoUrl = cleanString(input.videoUrl) || getMuxPlaybackUrl(cleanString(input.muxPlaybackId));
  if (!videoUrl) throw new Error("videoUrl or muxPlaybackId is required.");
  const ffmpegPath = await getFfmpegPath();

  ffmpeg.setFfmpegPath(ffmpegPath);

  const frameIntervalSeconds = clampFrameInterval(input.frameIntervalSeconds);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "axis-frame-debug-"));
  const framesDir = path.join(workDir, "frames");
  const ballTrackPath = path.join(workDir, "ball_track.json");
  const debugMp4Path = path.join(workDir, "debug-ball-track.mp4");
  await fs.mkdir(framesDir, { recursive: true });

  await extractFrames({ frameIntervalSeconds, framesDir, videoUrl });
  const frames = await listExtractedFrames(framesDir);
  const { ballTrack, first20Detections, rawClassNames, totalBallDetections, totalDetections } =
    await detectFramesWithRoboflow({
      frameIntervalSeconds,
      frames,
    });

  await fs.writeFile(ballTrackPath, JSON.stringify(ballTrack, null, 2), "utf8");
  const debugMp4Created = await createDebugMp4({
    ballTrack,
    debugMp4Path,
    frameIntervalSeconds,
    videoUrl,
  });
  const trackFileExists = await fileExists(ballTrackPath);
  const firstBallFrame = ballTrack[0]?.frame ?? null;
  const lastBallFrame = ballTrack.at(-1)?.frame ?? null;

  const output: AxisFrameDebugResult = {
    BALL_DETECTIONS: totalBallDetections,
    BALL_TRACK_COUNT: ballTrack.length,
    BALL_TRACK_CREATED: ballTrack.length > 0,
    BALL_TRACK_FILE_EXISTS: trackFileExists,
    DEBUG_MP4_CREATED: debugMp4Created,
    FIRST_BALL_FRAME: firstBallFrame,
    LAST_BALL_FRAME: lastBallFrame,
    TOTAL_DETECTIONS: totalDetections,
    TOTAL_FRAMES: frames.length,
    ball_track_path: ballTrackPath,
    debug_mp4_path: debugMp4Path,
    exact_failing_step: getFailingStep({
      ballTrackCount: ballTrack.length,
      debugMp4Created,
      totalBallDetections,
      totalDetections,
      totalFrames: frames.length,
    }),
    first_20_detections: first20Detections,
    frames_dir: framesDir,
    raw_class_names: rawClassNames,
  };

  logFrameDebugOutput(output);
  return output;
}

async function getFfmpegPath() {
  const candidates = [
    typeof ffmpegStatic === "string" ? ffmpegStatic : "",
    path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }

  throw new Error(`ffmpeg binary not found. Checked: ${candidates.join(", ")}`);
}

async function extractFrames({
  frameIntervalSeconds,
  framesDir,
  videoUrl,
}: {
  frameIntervalSeconds: number;
  framesDir: string;
  videoUrl: string;
}) {
  const fps = 1 / frameIntervalSeconds;
  await runFfmpeg((command) => {
    command
      .input(videoUrl)
      .outputOptions(["-vf", `fps=${fps}`, "-q:v", "2"])
      .output(path.join(framesDir, "frame_%04d.jpg"));
  });
}

async function listExtractedFrames(framesDir: string) {
  const entries = await fs.readdir(framesDir);
  return entries
    .filter((entry) => /^frame_\d+\.jpg$/i.test(entry))
    .sort()
    .map((entry, index) => ({
      frame: index + 1,
      path: path.join(framesDir, entry),
    }));
}

async function detectFramesWithRoboflow({
  frameIntervalSeconds,
  frames,
}: {
  frameIntervalSeconds: number;
  frames: Array<{ frame: number; path: string }>;
}) {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const workspace = process.env.ROBOFLOW_WORKSPACE;
  const project = process.env.ROBOFLOW_PROJECT;
  const version = process.env.ROBOFLOW_VERSION;
  if (!apiKey || !workspace || !project || !version) {
    throw new Error("Roboflow env is incomplete.");
  }

  const endpoint = `https://detect.roboflow.com/${encodeURIComponent(project)}/${encodeURIComponent(
    version,
  )}?api_key=${encodeURIComponent(apiKey)}&confidence=${roboflowConfidence}&overlap=${roboflowOverlap}`;
  const rawClassNames = new Set<string>();
  const first20Detections: RawFrameDetection[] = [];
  const ballTrack: AxisBallTrackPoint[] = [];
  let totalBallDetections = 0;
  let totalDetections = 0;

  for (const frame of frames) {
    const image = await fs.readFile(frame.path);
    const response = await fetch(endpoint, {
      body: image.toString("base64"),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as { predictions?: RoboflowPrediction[] } | null;
    if (!response.ok || !Array.isArray(result?.predictions)) {
      console.error("FRAME_DEBUG_ROBOFLOW_FRAME_FAILED", {
        frame: frame.frame,
        reason: !response.ok ? `HTTP ${response.status}` : "invalid_predictions",
      });
      continue;
    }

    totalDetections += result.predictions.length;
    const normalized = result.predictions.map((prediction) => normalizePrediction(prediction, frame.frame));
    for (const detection of normalized) {
      rawClassNames.add(detection.className);
      if (first20Detections.length < 20) first20Detections.push(detection);
    }

    const ballDetections = normalized.filter((detection) => isBallClass(detection.className));
    totalBallDetections += ballDetections.length;
    const bestBall = ballDetections
      .filter((detection) => isNumber(detection.x) && isNumber(detection.y))
      .sort((a, b) => b.confidence - a.confidence)[0];

    if (bestBall && isNumber(bestBall.x) && isNumber(bestBall.y)) {
      ballTrack.push({
        confidence: bestBall.confidence,
        frame: frame.frame,
        time: roundTime((frame.frame - 1) * frameIntervalSeconds),
        x: bestBall.x,
        y: bestBall.y,
      });
    }
  }

  return {
    ballTrack: ballTrack.sort((a, b) => a.time - b.time),
    first20Detections,
    rawClassNames: Array.from(rawClassNames).sort(),
    totalBallDetections,
    totalDetections,
  };
}

async function createDebugMp4({
  ballTrack,
  debugMp4Path,
  frameIntervalSeconds,
  videoUrl,
}: {
  ballTrack: AxisBallTrackPoint[];
  debugMp4Path: string;
  frameIntervalSeconds: number;
  videoUrl: string;
}) {
  try {
    await runFfmpeg((command) => {
      command.input(videoUrl).outputOptions(["-an", "-movflags", "+faststart"]);
      if (ballTrack.length) {
        command.videoFilters(ballTrack.map((point) => markerFilter(point, frameIntervalSeconds)).join(","));
      }
      command.output(debugMp4Path);
    });
    return fileExists(debugMp4Path);
  } catch (error) {
    console.error("FRAME_DEBUG_MP4_FAILED", error);
    return false;
  }
}

function markerFilter(point: AxisBallTrackPoint, frameIntervalSeconds: number) {
  const size = 24;
  const x = Math.max(0, Math.round(point.x - size / 2));
  const y = Math.max(0, Math.round(point.y - size / 2));
  const start = point.time.toFixed(3);
  const end = (point.time + frameIntervalSeconds).toFixed(3);
  return `drawtext=text=O:x=${x}:y=${y}:fontsize=${size}:fontcolor=red:enable='between(t\\,${start}\\,${end})'`;
}

async function runFfmpeg(configure: (command: ffmpeg.FfmpegCommand) => void) {
  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg();
    configure(command);
    command.on("end", () => resolve());
    command.on("error", (error) => reject(error));
    command.run();
  });
}

function normalizePrediction(prediction: RoboflowPrediction, frame: number): RawFrameDetection {
  return {
    className: String(prediction.class ?? prediction.class_name ?? prediction.label ?? prediction.name ?? "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    confidence: getOptionalNumber(prediction.confidence) ?? 0,
    frame,
    height: getOptionalNumber(prediction.height),
    width: getOptionalNumber(prediction.width),
    x: getOptionalNumber(prediction.x),
    y: getOptionalNumber(prediction.y),
  };
}

function isBallClass(className: string) {
  return className === "ball" || className === "basketball" || className === "sports ball";
}

function getFailingStep({
  ballTrackCount,
  debugMp4Created,
  totalBallDetections,
  totalDetections,
  totalFrames,
}: {
  ballTrackCount: number;
  debugMp4Created: boolean;
  totalBallDetections: number;
  totalDetections: number;
  totalFrames: number;
}) {
  if (totalFrames === 0) return "FRAME_EXTRACTION_FAILED";
  if (totalDetections === 0) return "ROBOFLOW_RETURNED_NO_DETECTIONS";
  if (totalBallDetections === 0) return "ROBOFLOW_RETURNED_NO_BASKETBALL_DETECTIONS";
  if (ballTrackCount === 0) return "BALL_TRACK_CREATION_FAILED";
  if (!debugMp4Created) return "DEBUG_MP4_CREATION_FAILED";
  return "TRACKING_WORKS_IN_FRAME_DEBUG";
}

function logFrameDebugOutput(output: AxisFrameDebugResult) {
  console.log("TOTAL_FRAMES", output.TOTAL_FRAMES);
  console.log("ROBOFLOW_CLASSES", output.raw_class_names);
  console.log("ROBOFLOW_DETECTION_COUNT", output.TOTAL_DETECTIONS);
  console.log("ROBOFLOW_BALL_COUNT", output.BALL_DETECTIONS);
  console.log("ROBOFLOW_FIRST_20_DETECTIONS", output.first_20_detections);
  console.log("BALL_TRACK_COUNT", output.BALL_TRACK_COUNT);
  console.log("BALL_TRACK_CREATED", output.BALL_TRACK_CREATED);
  console.log("BALL_TRACK_FILE_EXISTS", output.BALL_TRACK_FILE_EXISTS);
  console.log("DEBUG_MP4_CREATED", output.DEBUG_MP4_CREATED);
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function clampFrameInterval(value: unknown) {
  if (!isNumber(value)) return defaultFrameIntervalSeconds;
  return Math.max(0.05, Math.min(1, value));
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}
