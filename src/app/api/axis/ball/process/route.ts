import { createWriteStream } from "node:fs";
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
  frameIndex?: unknown;
  label?: unknown;
  name?: unknown;
  x?: unknown;
  y?: unknown;
};

const frameIntervalSeconds = 0.1;
const maxUploadBytes = 150 * 1024 * 1024;
const roboflowProject = "axis-kenetic-observer";
const roboflowVersion = "1";

export async function POST(request: Request) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "axis-ball-engine-"));
  const framesDir = path.join(workDir, "frames");
  const uploadedFileName = getSafeFileName(request.headers.get("x-axis-file-name"));
  const uploadedFileSize = getHeaderNumber(request.headers.get("x-axis-file-size"));
  const videoPath = path.join(workDir, uploadedFileName);

  console.log("AXIS_BALL_UPLOAD_START", {
    temp_video_path: videoPath,
    uploaded_file_name: uploadedFileName,
    uploaded_file_size: uploadedFileSize,
  });

  try {
    if (uploadedFileSize !== null && uploadedFileSize > maxUploadBytes) {
      return Response.json(
        createFailurePayload(`Video is too large. Limit is ${Math.round(maxUploadBytes / 1024 / 1024)}MB.`),
        { status: 413 },
      );
    }

    await fs.mkdir(framesDir, { recursive: true });
    const writtenBytes = await writeRequestBodyToFile(request, videoPath, maxUploadBytes);
    console.log("AXIS_BALL_UPLOAD_STORED", {
      temp_video_path: videoPath,
      uploaded_file_name: uploadedFileName,
      uploaded_file_size: writtenBytes,
    });

    const ffmpegPath = await getFfmpegPath();
    ffmpeg.setFfmpegPath(ffmpegPath);
    console.log("FRAME_EXTRACTION_START", {
      temp_video_path: videoPath,
    });
    await extractFrames(videoPath, framesDir);

    const frames = await listFrames(framesDir);
    console.log("FRAMES_EXTRACTED", frames.length);
    console.log("FRAMES_SENT_TO_ROBOFLOW", frames.length);
    console.log("ROBOFLOW_START", {
      project: roboflowProject,
      version: roboflowVersion,
    });

    const detectionResult = await detectBasketballs(frames);
    console.log("DETECTIONS_RETURNED", detectionResult.detectionsReturned);
    console.log("BASKETBALL_DETECTIONS", detectionResult.basketballDetections);
    console.log("BALL_TRACK_COUNT", detectionResult.ballTrack.length);

    return Response.json({
      ball_track: detectionResult.ballTrack,
      debug: {
        BASKETBALL_DETECTIONS: detectionResult.basketballDetections,
        BALL_TRACK_COUNT: detectionResult.ballTrack.length,
        DETECTIONS_RETURNED: detectionResult.detectionsReturned,
        FRAMES_EXTRACTED: frames.length,
        FRAMES_SENT_TO_ROBOFLOW: frames.length,
      },
      videoUrl: "local-upload",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("AXIS_BALL_PROCESS_FAILED", { reason });
    return Response.json(createFailurePayload(reason), { status: error instanceof UploadTooLargeError ? 413 : 500 });
  } finally {
    await fs.rm(workDir, { force: true, recursive: true }).catch(() => null);
  }
}

class UploadTooLargeError extends Error {
  constructor(limitBytes: number) {
    super(`Video is too large. Limit is ${Math.round(limitBytes / 1024 / 1024)}MB.`);
    this.name = "UploadTooLargeError";
  }
}

async function writeRequestBodyToFile(request: Request, videoPath: string, limitBytes: number) {
  if (!request.body) throw new Error("video upload body is required");

  let writtenBytes = 0;
  const reader = request.body.getReader();
  const writer = createWriteStream(videoPath);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      writtenBytes += chunk.byteLength;
      if (writtenBytes > limitBytes) throw new UploadTooLargeError(limitBytes);
      await writeChunk(writer, chunk);
    }
  } finally {
    reader.releaseLock();
    await closeWriter(writer);
  }

  return writtenBytes;
}

function writeChunk(writer: ReturnType<typeof createWriteStream>, chunk: Buffer) {
  return new Promise<void>((resolve, reject) => {
    writer.write(chunk, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function closeWriter(writer: ReturnType<typeof createWriteStream>) {
  return new Promise<void>((resolve, reject) => {
    writer.end((error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
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
  let basketballDetections = 0;
  let detectionsReturned = 0;

  for (const frame of frames) {
    const image = await fs.readFile(frame.path);
    const response = await fetch(endpoint, {
      body: image.toString("base64"),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as { predictions?: RoboflowPrediction[] } | null;
    if (!response.ok || !Array.isArray(result?.predictions)) {
      console.error("AXIS_BALL_ROBOFLOW_FRAME_FAILED", {
        frame: frame.frame,
        status: response.status,
      });
      continue;
    }

    detectionsReturned += result.predictions.length;
    const basketballs = result.predictions
      .map((prediction) => normalizePrediction(prediction, frame.frame))
      .filter((prediction) => prediction.className === "basketball");
    basketballDetections += basketballs.length;

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
    basketballDetections,
    detectionsReturned,
  };
}

function normalizePrediction(prediction: RoboflowPrediction, frame: number) {
  return {
    className: String(prediction.class ?? prediction.class_name ?? prediction.label ?? prediction.name ?? "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    confidence: getNumber(prediction.confidence) ?? 0,
    frameIndex: getNumber(prediction.frameIndex) ?? frame,
    x: getNumber(prediction.x),
    y: getNumber(prediction.y),
  };
}

function createFailurePayload(error: string) {
  return {
    ball_track: [],
    debug: {
      BASKETBALL_DETECTIONS: 0,
      BALL_TRACK_COUNT: 0,
      DETECTIONS_RETURNED: 0,
      FRAMES_EXTRACTED: 0,
      FRAMES_SENT_TO_ROBOFLOW: 0,
    },
    error,
    videoUrl: "local-upload",
  };
}

function getHeaderNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getSafeFileName(value: string | null) {
  const fallback = "upload.mp4";
  if (!value) return fallback;
  const clean = decodeURIComponent(value)
    .replace(/[\\/]/g, "")
    .replace(/[^\w .-]/g, "")
    .trim();
  return clean || fallback;
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
