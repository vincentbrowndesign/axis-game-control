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
  label?: unknown;
  name?: unknown;
  x?: unknown;
  y?: unknown;
};

type FailureStage =
  | "upload"
  | "temp_file_creation"
  | "frame_extraction"
  | "roboflow"
  | "ball_track_generation";

const frameIntervalSeconds = 0.1;
const maxUploadBytes = 150 * 1024 * 1024;
const roboflowProject = "axis-kenetic-observer";
const roboflowVersion = "1";

export async function POST(request: Request) {
  console.log("BALL_DEBUG_START");
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "axis-ball-debug-v2-"));
  const framesDir = path.join(workDir, "frames");
  const uploadedFileName = getSafeFileName(request.headers.get("x-axis-file-name"));
  const uploadedFileSize = getHeaderNumber(request.headers.get("x-axis-file-size"));
  const videoPath = path.join(workDir, uploadedFileName);
  let frameCount = 0;
  let detectionCount = 0;
  let ballTrackCount = 0;

  console.log("BALL_DEBUG_UPLOAD_START", {
    temp_video_path: videoPath,
    uploaded_file_name: uploadedFileName,
    uploaded_file_size: uploadedFileSize,
  });

  try {
    if (uploadedFileSize !== null && uploadedFileSize > maxUploadBytes) {
      return failureResponse(
        "upload",
        `Video is too large. Limit is ${Math.round(maxUploadBytes / 1024 / 1024)}MB.`,
        {
          maxUploadMb: Math.round(maxUploadBytes / 1024 / 1024),
          uploaded_file_name: uploadedFileName,
          uploaded_file_size: uploadedFileSize,
        },
        413,
      );
    }
    console.log("VIDEO_RECEIVED", {
      uploaded_file_name: uploadedFileName,
      uploaded_file_size: uploadedFileSize,
    });
    console.log("VIDEO_SIZE_MB", {
      value: uploadedFileSize === null ? null : roundMetric(uploadedFileSize / 1024 / 1024),
    });

    let writtenBytes = 0;
    try {
      await fs.mkdir(framesDir, { recursive: true });
      writtenBytes = await writeRequestBodyToFile(request, videoPath, maxUploadBytes);
      await fs.access(videoPath);
      console.log("TEMP_FILE_CREATED", {
        temp_video_path: videoPath,
        uploaded_file_name: uploadedFileName,
        uploaded_file_size: writtenBytes,
      });
    } catch (error) {
      return failureResponse(
        error instanceof UploadTooLargeError ? "upload" : "temp_file_creation",
        getErrorMessage(error),
        {
          temp_video_path: videoPath,
          uploaded_file_name: uploadedFileName,
          uploaded_file_size: writtenBytes || uploadedFileSize,
        },
        error instanceof UploadTooLargeError ? 413 : 500,
      );
    }

    let frames: FrameFile[] = [];
    try {
      const ffmpegPath = await getFfmpegPath();
      ffmpeg.setFfmpegPath(ffmpegPath);
      console.log("FRAME_EXTRACTION_START", {
        temp_video_path: videoPath,
      });
      await extractFrames(videoPath, framesDir);
      console.log("FRAME_EXTRACTION_COMPLETE", {
        temp_video_path: videoPath,
      });
      frames = await listFrames(framesDir);
      frameCount = frames.length;
      console.log("FRAMES_EXTRACTED", {
        count: frameCount,
      });
      if (frameCount === 0) {
        return failureResponse(
          "frame_extraction",
          "Frame extraction completed but produced zero frames.",
          { framesDir, temp_video_path: videoPath },
        );
      }
    } catch (error) {
      return failureResponse("frame_extraction", getErrorMessage(error), {
        framesDir,
        temp_video_path: videoPath,
      });
    }

    let ballTrack: BallTrackPoint[] = [];
    try {
      console.log("ROBOFLOW_START", {
        frameCount,
        project: roboflowProject,
        version: roboflowVersion,
      });
      const result = await detectBasketballs(frames);
      ballTrack = result.ballTrack;
      detectionCount = result.detectionCount;
      ballTrackCount = ballTrack.length;
      console.log("BASKETBALL_DETECTIONS", {
        count: detectionCount,
      });
    } catch (error) {
      return failureResponse("roboflow", getErrorMessage(error), {
        frameCount,
        project: roboflowProject,
        version: roboflowVersion,
      });
    }

    if (!ballTrack.length) {
      console.log("BALL_TRACK_CREATED", {
        created: false,
      });
      return failureResponse("ball_track_generation", "No ball_track points were created.", {
        BASKETBALL_DETECTIONS: detectionCount,
        BALL_TRACK_COUNT: ballTrackCount,
        FRAMES_EXTRACTED: frameCount,
      });
    }

    console.log("BALL_TRACK_CREATED", {
      created: true,
    });
    console.log("BALL_TRACK_COUNT", {
      count: ballTrack.length,
    });
    console.log("BALL_DEBUG_COMPLETE", {
      BALL_TRACK_COUNT: ballTrack.length,
      BASKETBALL_DETECTIONS: detectionCount,
      FRAMES_EXTRACTED: frameCount,
    });

    return Response.json({
      ballTrack,
      detectionCount,
      failure: null,
      frameCount,
      videoUrl: "local-upload",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("BALL_DEBUG_V2_FAILED", { reason });
    const isTooLarge = error instanceof UploadTooLargeError;
    return failureResponse(
      isTooLarge ? "upload" : "temp_file_creation",
      reason,
      {
        BALL_TRACK_COUNT: ballTrackCount,
        BASKETBALL_DETECTIONS: detectionCount,
        FRAMES_EXTRACTED: frameCount,
        temp_video_path: videoPath,
      },
      isTooLarge ? 413 : 500,
    );
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
      if (writtenBytes > limitBytes) {
        throw new UploadTooLargeError(limitBytes);
      }
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

function failureResponse(stage: FailureStage, error: string, details: Record<string, unknown>, status = 500) {
  console.error("BALL_DEBUG_FAILED_STAGE", {
    details,
    error,
    stage,
  });
  return Response.json(
    {
      ballTrack: [],
      detectionCount: getDetailNumber(details.BASKETBALL_DETECTIONS),
      error,
      failure: {
        details,
        error,
        stage,
      },
      frameCount: getDetailNumber(details.FRAMES_EXTRACTED),
      videoUrl: "local-upload",
    },
    { status },
  );
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

function getHeaderNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getDetailNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}
