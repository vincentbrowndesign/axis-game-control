import crypto from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { exportAxisReplayMp4, extractAxisFrames } from "./axis-ffmpeg";
import { classifyZone, type AxisDetection, type AxisEvent, type AxisTrack } from "./axis-primitives";

export type AxisBallTrackPoint = {
  confidence: number;
  frame: number;
  sourceHeight?: number;
  sourceWidth?: number;
  time: number;
  x: number;
  y: number;
};

export type AxisPlayerTrackPoint = {
  confidence: number;
  frame: number;
  id: string;
  label?: string;
  sourceHeight?: number;
  sourceWidth?: number;
  time: number;
  x: number;
  y: number;
};

export type AxisBallProcessingResult = {
  ballTrack: AxisBallTrackPoint[];
  detectionCount: number;
  detections: AxisDetection[];
  events: AxisEvent[];
  frameCount: number;
  playerTrack: AxisPlayerTrackPoint[];
  replayExport?: {
    height: number | null;
    path: string;
    sizeBytes: number;
    width: number | null;
  };
  tracks: AxisTrack[];
  workDir?: string;
};

export type AxisBallProcessingStageUpdate =
  | "building_track"
  | "detecting_basketball"
  | "extracting_frames"
  | "rendering_replay";

export type AxisBallProcessingOptions = {
  exportReplay?: boolean;
  keepWorkDir?: boolean;
  sessionId?: string;
  sourceJobId?: string;
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
  height?: unknown;
  width?: unknown;
  x?: unknown;
  y?: unknown;
};

type RoboflowImage = {
  height?: unknown;
  width?: unknown;
};

const frameIntervalSeconds = 0.1;
const overlayPreviewDurationSeconds = 10;
const roboflowProject = "axis-kenetic-observer";
const roboflowVersion = "1";
const playerClasses = new Set(["athlete", "person", "player"]);

export function getMuxPlaybackUrl(playbackId?: string | null) {
  return playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : "";
}

export async function runAxisBallProcessing(
  videoUrl: string,
  onStage?: (stage: AxisBallProcessingStageUpdate) => Promise<void> | void,
  options: AxisBallProcessingOptions = {},
): Promise<AxisBallProcessingResult> {
  if (!videoUrl) throw new Error("videoUrl is required.");

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "axis-ball-processing-"));
  const framesDir = path.join(workDir, "frames");
  const localVideoPath = path.join(workDir, "video.mp4");
  let completed = false;

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
        detections: [],
        events: [],
        frameCount: 0,
        playerTrack: [],
        tracks: [],
      };
    }

    await onStage?.("detecting_basketball");
    logAxisBallProcessingMemory("BEFORE_ROBOFLOW", { frameCount: frames.length });
    console.log("ROBOFLOW_START", {
      project: roboflowProject,
      version: roboflowVersion,
    });
    const detectionResult = await detectBasketballs(frames, {
      sessionId: options.sessionId ?? options.sourceJobId ?? "axis-video-processing",
      sourceJobId: options.sourceJobId ?? options.sessionId ?? "axis-video-processing",
    });
    logAxisBallProcessingMemory("AFTER_ROBOFLOW", {
      ballTrackCount: detectionResult.ballTrack.length,
      detectionCount: detectionResult.detectionCount,
    });
    await onStage?.("building_track");
    console.log("DETECTIONS_RETURNED", { count: detectionResult.detectionCount });
    console.log("BASKETBALL_DETECTIONS", { count: detectionResult.detectionCount });
    console.log("BALL_TRACK_COUNT", { count: detectionResult.ballTrack.length });
    console.log("AXIS_EVENTS_CREATED", {
      detectionCount: detectionResult.detections.length,
      eventCount: detectionResult.events.length,
      trackCount: detectionResult.tracks.length,
    });

    await onStage?.("rendering_replay");
    logAxisBallProcessingMemory("BEFORE_REPLAY_GENERATION", {
      ballTrackCount: detectionResult.ballTrack.length,
      frameCount: frames.length,
      playerTrackCount: detectionResult.playerTrack.length,
    });
    const replayExportPath = path.join(workDir, "axis-replay.mp4");
    const replayExport = options.exportReplay
      ? await exportAxisReplayMp4({
          createFilters: (metadata) =>
            createReplayOverlayFilters({
              ballTrack: detectionResult.ballTrack,
              playerTrack: detectionResult.playerTrack,
              sourceHeight: metadata.height ?? undefined,
              sourceWidth: metadata.width ?? undefined,
            }),
          inputPath: extractionInputPath,
          maxDurationSeconds: 10,
          maxWidth: 960,
          outputFps: 15,
          outputPath: replayExportPath,
        })
      : null;
    completed = true;
    return {
      ballTrack: detectionResult.ballTrack,
      detectionCount: detectionResult.detectionCount,
      detections: detectionResult.detections,
      events: detectionResult.events,
      frameCount: frames.length,
      playerTrack: detectionResult.playerTrack,
      replayExport: replayExport
        ? {
            height: replayExport.height,
            path: replayExport.export_path,
            sizeBytes: replayExport.size_bytes,
            width: replayExport.width,
          }
        : undefined,
      tracks: detectionResult.tracks,
      workDir: options.keepWorkDir ? workDir : undefined,
    };
  } finally {
    if (!options.keepWorkDir || !completed) await fs.rm(workDir, { force: true, recursive: true }).catch(() => null);
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

async function detectBasketballs(frames: FrameFile[], options: { sessionId: string; sourceJobId: string }) {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  if (!apiKey) throw new Error("ROBOFLOW_API_KEY is required.");

  const endpoint = `https://detect.roboflow.com/${roboflowProject}/${roboflowVersion}?api_key=${encodeURIComponent(
    apiKey,
  )}&confidence=35&overlap=30`;
  const ballTrack: AxisBallTrackPoint[] = [];
  const playerTrack: AxisPlayerTrackPoint[] = [];
  const detections: AxisDetection[] = [];
  let detectionCount = 0;

  for (const frame of frames) {
    const image = await fs.readFile(frame.path);
    const response = await fetch(endpoint, {
      body: image.toString("base64"),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as { image?: RoboflowImage; predictions?: RoboflowPrediction[] } | null;
    console.log("ROBOFLOW_RESPONSE", {
      frame: frame.frame,
      predictionCount: Array.isArray(result?.predictions) ? result.predictions.length : 0,
      status: response.status,
    });
    if (!response.ok || !Array.isArray(result?.predictions)) {
      throw new Error(`Roboflow failed at frame ${frame.frame} with HTTP ${response.status}.`);
    }

    const frameWidth = getNumber(result.image?.width);
    const frameHeight = getNumber(result.image?.height);
    const normalizedPredictions = result.predictions.map((prediction) => normalizePrediction(prediction, { ...options, frame, frameHeight, frameWidth }));
    const basketballs = normalizedPredictions.filter((prediction) => prediction.className === "basketball");
    const players = normalizedPredictions
      .filter((prediction) => playerClasses.has(prediction.className))
      .filter((prediction) => isFiniteNumber(prediction.x) && isFiniteNumber(prediction.y))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
    detectionCount += basketballs.length;
    detections.push(...basketballs.map((prediction) => prediction.detection));

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
      ...(frameHeight ? { sourceHeight: frameHeight } : {}),
      ...(frameWidth ? { sourceWidth: frameWidth } : {}),
      time: roundTime((frame.frame - 1) * frameIntervalSeconds),
      x: best.x,
      y: best.y,
    });
    playerTrack.push(
      ...players.map((player, index) => ({
        confidence: player.confidence,
        frame: frame.frame,
        id: `player_${index + 1}`,
        label: String(index + 1),
        ...(frameHeight ? { sourceHeight: frameHeight } : {}),
        ...(frameWidth ? { sourceWidth: frameWidth } : {}),
        time: roundTime((frame.frame - 1) * frameIntervalSeconds),
        x: player.x ?? 0,
        y: player.y ?? 0,
      })),
    );
  }

  const tracks = buildAxisTracksFromBallTrack(ballTrack, options.sessionId);
  const events = buildAxisEventsFromTracks({ detectionCount: detections.length, sessionId: options.sessionId, tracks });

  return {
    ballTrack,
    detectionCount,
    detections,
    events,
    playerTrack,
    tracks,
  };
}

function normalizePrediction(
  prediction: RoboflowPrediction,
  {
    frame,
    frameHeight,
    frameWidth,
    sessionId,
    sourceJobId,
  }: {
    frame: FrameFile;
    frameHeight?: number;
    frameWidth?: number;
    sessionId: string;
    sourceJobId: string;
  },
) {
  const x = getNumber(prediction.x);
  const y = getNumber(prediction.y);
  const width = getNumber(prediction.width);
  const height = getNumber(prediction.height);
  const normalized = normalizeFramePoint({ frameHeight, frameWidth, x, y });
  const confidence = getNumber(prediction.confidence) ?? 0;
  return {
    className: String(prediction.class ?? prediction.class_name ?? prediction.label ?? prediction.name ?? "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    confidence,
    detection: {
      bbox: {
        h: frameHeight && height ? height / frameHeight : 0,
        w: frameWidth && width ? width / frameWidth : 0,
        x: frameWidth && width && x !== undefined ? (x - width / 2) / frameWidth : normalized.x,
        y: frameHeight && height && y !== undefined ? (y - height / 2) / frameHeight : normalized.y,
      },
      confidence,
      court: normalized,
      entity_type: "ball",
      frame: frame.frame,
      id: crypto.randomUUID(),
      session_id: sessionId,
      source_job_id: sourceJobId,
      timestamp_ms: Math.round((frame.frame - 1) * frameIntervalSeconds * 1000),
      track_id: "ball",
    } satisfies AxisDetection,
    x,
    y,
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

function buildAxisTracksFromBallTrack(ballTrack: AxisBallTrackPoint[], sessionId: string): AxisTrack[] {
  if (!ballTrack.length) return [];
  const normalizedPoints = normalizeBallTrackPoints(ballTrack);
  const first = normalizedPoints[0];
  const last = normalizedPoints[normalizedPoints.length - 1];
  const confidences = normalizedPoints.map((point) => point.confidence);
  const meanConfidence = confidences.reduce((sum, confidence) => sum + confidence, 0) / Math.max(1, confidences.length);
  let gapCount = 0;
  for (let index = 1; index < normalizedPoints.length; index += 1) {
    if (normalizedPoints[index].frame - normalizedPoints[index - 1].frame > 1) gapCount += 1;
  }

  return [
    {
      detection_count: normalizedPoints.length,
      ended_at: Math.round(last.time * 1000),
      entity_type: "ball",
      frame_end: last.frame,
      frame_start: first.frame,
      gap_count: gapCount,
      id: "ball",
      label: "basketball",
      mean_confidence: meanConfidence,
      positions: normalizedPoints.map((point) => ({
        confidence: point.confidence,
        frame: point.frame,
        timestamp_ms: Math.round(point.time * 1000),
        x: point.normalizedX,
        y: point.normalizedY,
      })),
      session_id: sessionId,
      started_at: Math.round(first.time * 1000),
    },
  ];
}

function buildAxisEventsFromTracks({
  detectionCount,
  sessionId,
  tracks,
}: {
  detectionCount: number;
  sessionId: string;
  tracks: AxisTrack[];
}): AxisEvent[] {
  const ball = tracks.find((track) => track.entity_type === "ball");
  if (!ball?.positions.length) return [];
  const first = ball.positions[0];
  const last = ball.positions[ball.positions.length - 1];
  const movement = Math.hypot(last.x - first.x, last.y - first.y);
  const type: AxisEvent["type"] = movement > 0.03 ? "dribble" : "stationary";

  return [
    {
      confidence: ball.mean_confidence,
      ended_at: ball.ended_at,
      frame_end: ball.frame_end,
      frame_start: ball.frame_start,
      id: crypto.randomUUID(),
      metadata: {
        detection_count: detectionCount,
        movement,
        source: "roboflow_basketball_track",
        track_count: tracks.length,
      },
      origin: { x: first.x, y: first.y },
      participant_track_ids: [ball.id],
      position_snapshot: [
        {
          entity_type: "ball",
          frame: first.frame,
          track_id: ball.id,
          x: first.x,
          y: first.y,
        },
      ],
      primary_track_id: ball.id,
      session_id: sessionId,
      started_at: ball.started_at,
      tallies: [{ key: "basketball_tracks", value: 1 }],
      terminus: { x: last.x, y: last.y },
      type,
      zone: classifyZone(first.x, first.y),
    },
  ];
}

function normalizeBallTrackPoints(points: AxisBallTrackPoint[]) {
  const maxX = Math.max(...points.map((point) => point.x), 1);
  const maxY = Math.max(...points.map((point) => point.y), 1);
  return points.map((point) => ({
    ...point,
    normalizedX: clamp01(point.x / maxX),
    normalizedY: clamp01(point.y / maxY),
  }));
}

function normalizeFramePoint({
  frameHeight,
  frameWidth,
  x,
  y,
}: {
  frameHeight?: number;
  frameWidth?: number;
  x?: number;
  y?: number;
}) {
  return {
    x: frameWidth && x !== undefined ? clamp01(x / frameWidth) : 0,
    y: frameHeight && y !== undefined ? clamp01(y / frameHeight) : 0,
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function createReplayOverlayFilters({
  ballTrack,
  playerTrack,
  sourceHeight,
  sourceWidth,
}: {
  ballTrack: AxisBallTrackPoint[];
  playerTrack: AxisPlayerTrackPoint[];
  sourceHeight?: number;
  sourceWidth?: number;
}) {
  const filters: string[] = [];
  const safeSourceWidth = sourceWidth ?? firstSourceSize(ballTrack, playerTrack).width;
  const safeSourceHeight = sourceHeight ?? firstSourceSize(ballTrack, playerTrack).height;
  const filteredBallTrack = ballTrack.filter((point) => point.time <= overlayPreviewDurationSeconds);
  const filteredPlayerTrack = playerTrack.filter((point) => point.time <= overlayPreviewDurationSeconds);

  for (const [index, point] of filteredBallTrack.entries()) {
    const mapped = mapExportPoint(point, safeSourceWidth, safeSourceHeight);
    const start = Math.max(0, point.time - 0.08);
    const end = point.time + 0.22;
    const alpha = Math.max(0.28, Math.min(0.92, point.confidence > 1 ? point.confidence / 100 : point.confidence));
    filters.push(
      `drawbox=x=${Math.round(mapped.x - 9)}:y=${Math.round(mapped.y - 9)}:w=18:h=18:color=0xAEFF4E@${alpha.toFixed(
        2,
      )}:t=fill:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`,
    );
    if (index > 0) {
      const previous = mapExportPoint(filteredBallTrack[index - 1], safeSourceWidth, safeSourceHeight);
      const trailStart = Math.max(0, point.time - 0.2);
      filters.push(
        `drawbox=x=${Math.round((previous.x + mapped.x) / 2 - 5)}:y=${Math.round((previous.y + mapped.y) / 2 - 5)}:w=10:h=10:color=0xAEFF4E@0.38:t=fill:enable='between(t,${trailStart.toFixed(
          3,
        )},${end.toFixed(3)})'`,
      );
    }
  }

  for (const point of filteredPlayerTrack) {
    const mapped = mapExportPoint(point, safeSourceWidth, safeSourceHeight);
    const start = Math.max(0, point.time - 0.08);
    const end = point.time + 0.18;
    filters.push(
      `drawbox=x=${Math.round(mapped.x - 24)}:y=${Math.round(mapped.y - 8)}:w=48:h=16:color=white@0.72:t=3:enable='between(t,${start.toFixed(
        3,
      )},${end.toFixed(3)})'`,
    );
    if (point.label) {
      filters.push(
        `drawtext=text='${escapeDrawText(point.label)}':x=${Math.round(mapped.x - 5)}:y=${Math.round(
          mapped.y - 42,
        )}:fontsize=24:fontcolor=white@0.92:box=1:boxcolor=black@0.45:boxborderw=6:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`,
      );
    }
  }

  console.log("AXIS_REPLAY_EXPORT_FILTERS_CREATED", {
    ballFilterCount: filteredBallTrack.length,
    filterCount: filters.length,
    playerFilterCount: filteredPlayerTrack.length,
    previewDurationSeconds: overlayPreviewDurationSeconds,
    sourceBallTrackCount: ballTrack.length,
    sourcePlayerTrackCount: playerTrack.length,
  });
  return filters;
}

function firstSourceSize(ballTrack: AxisBallTrackPoint[], playerTrack: AxisPlayerTrackPoint[]) {
  const point = [...ballTrack, ...playerTrack].find((item) => item.sourceWidth && item.sourceHeight);
  return {
    height: point?.sourceHeight ?? 540,
    width: point?.sourceWidth ?? 960,
  };
}

function mapExportPoint(point: AxisBallTrackPoint | AxisPlayerTrackPoint, targetWidth: number, targetHeight: number) {
  const sourceWidth = point.sourceWidth || targetWidth || 1;
  const sourceHeight = point.sourceHeight || targetHeight || 1;
  return {
    x: (point.x / sourceWidth) * targetWidth,
    y: (point.y / sourceHeight) * targetHeight,
  };
}

function escapeDrawText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
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
