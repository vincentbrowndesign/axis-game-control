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
  boxHeight?: number;
  boxWidth?: number;
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
const overlayFadeOutSeconds = 0.4;
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
          maxHeight: 720,
          outputFps: 10,
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
        ...(player.height ? { boxHeight: player.height } : {}),
        ...(player.width ? { boxWidth: player.width } : {}),
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
    height,
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
    width,
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
  const ballOverlay = buildBallOverlayPoints(ballTrack, safeSourceWidth, safeSourceHeight);
  const playerOverlay = buildFeaturedPlayerOverlayPoints(playerTrack, safeSourceWidth, safeSourceHeight);

  for (const point of ballOverlay.points) {
    if (point.time < 0.7) continue;
    const start = point.time;
    const end = Math.min(overlayPreviewDurationSeconds - overlayFadeOutSeconds, point.time + 0.58);
    if (end <= start) continue;
    const tailAlpha = Math.min(0.42, point.confidence * 0.34);
    const coreAlpha = Math.min(0.88, point.confidence * 0.82);
    filters.push(
      drawBoxFilter({
        alpha: tailAlpha,
        color: "0xFF7A1A",
        height: 9,
        start,
        thickness: "fill",
        width: 9,
        x: point.x - 4.5,
        y: point.y - 4.5,
        end,
      }),
      drawBoxFilter({
        alpha: coreAlpha,
        color: "0xFF7A1A",
        height: 6,
        start,
        thickness: "fill",
        width: 6,
        x: point.x - 3,
        y: point.y - 3,
        end: Math.min(start + 0.18, end),
      }),
    );
  }

  for (const [index, point] of playerOverlay.points.entries()) {
    const next = playerOverlay.points[index + 1];
    const start = Math.max(0.5, point.time - 0.05);
    const end =
      next && next.frame - point.frame <= 3
        ? Math.min(overlayPreviewDurationSeconds, next.time + 0.12)
        : Math.min(overlayPreviewDurationSeconds, point.time + 0.36);
    const fadeIn = Math.min(1, Math.max(0, (point.time - 0.5) / 0.3));
    const fadeOut = Math.min(1, Math.max(0, (overlayPreviewDurationSeconds - point.time) / overlayFadeOutSeconds));
    const alpha = Math.min(0.86, point.confidence * fadeIn * fadeOut);
    if (alpha < 0.08) continue;
    const ringColor = point.featured ? "0xAEFF4E" : "white";
    const ringWidth = Math.round(Math.max(48, Math.min(118, point.boxWidth * 0.82)));
    const ringHeight = Math.round(Math.max(12, Math.min(30, point.boxHeight * 0.15)));
    const ringX = point.x - ringWidth / 2;
    const ringY = point.bottomY - ringHeight / 2;

    filters.push(
      drawBoxFilter({
        alpha: Math.max(0.05, alpha * 0.12),
        color: ringColor,
        height: ringHeight + 8,
        start,
        thickness: "fill",
        width: ringWidth + 14,
        x: ringX - 7,
        y: ringY - 4,
        end,
      }),
      drawBoxFilter({
        alpha,
        color: ringColor,
        height: ringHeight,
        start,
        thickness: 4,
        width: ringWidth,
        x: ringX,
        y: ringY,
        end,
      }),
    );

    if (point.label && playerOverlay.points.length >= 4 && point.time >= 0.8 && alpha >= 0.42) {
      const labelText = escapeDrawText(point.label);
      const fontSize = 18;
      const labelWidth = Math.max(34, labelText.length * 12 + 18);
      const labelX = point.x - labelWidth / 2;
      const labelY = Math.max(8, point.y - point.boxHeight / 2 - 38);
      filters.push(
        drawBoxFilter({
          alpha: Math.min(0.62, alpha * 0.72),
          color: "black",
          height: 28,
          start,
          thickness: "fill",
          width: labelWidth,
          x: labelX,
          y: labelY,
          end,
        }),
        `drawtext=text='${labelText}':x=${Math.round(labelX + 10)}:y=${Math.round(
          labelY + 5,
        )}:fontsize=${fontSize}:fontcolor=white@${Math.min(0.96, alpha).toFixed(2)}:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`,
      );
    }
  }

  console.log("AXIS_REPLAY_EXPORT_FILTERS_CREATED", {
    ballFilterCount: ballOverlay.points.length,
    ballInterpolatedPoints: ballOverlay.interpolated,
    ballJumpDrops: ballOverlay.jumpDrops,
    filterCount: filters.length,
    overlayPackage: "AXIS_REPLAY_BASIC",
    playerDropoutGaps: playerOverlay.dropoutGaps,
    playerFilterCount: playerOverlay.points.length,
    playerLowConfidenceDrops: playerOverlay.lowConfidenceDrops,
    previewDurationSeconds: overlayPreviewDurationSeconds,
    sourceBallTrackCount: ballTrack.length,
    sourcePlayerTrackCount: playerTrack.length,
  });
  return filters;
}

type BallOverlayPoint = {
  confidence: number;
  frame: number;
  time: number;
  x: number;
  y: number;
};

type PlayerOverlayPoint = BallOverlayPoint & {
  bottomY: number;
  boxHeight: number;
  boxWidth: number;
  featured: boolean;
  label?: string;
};

function buildBallOverlayPoints(ballTrack: AxisBallTrackPoint[], targetWidth: number, targetHeight: number) {
  const points = ballTrack
    .filter((point) => point.time <= overlayPreviewDurationSeconds)
    .filter((point) => toConfidence01(point.confidence) >= 0.25)
    .sort((a, b) => a.time - b.time);
  const smoothed: BallOverlayPoint[] = [];
  let interpolated = 0;
  let jumpDrops = 0;

  for (const point of points) {
    const mapped = mapExportPoint(point, targetWidth, targetHeight);
    const previous = smoothed[smoothed.length - 1];
    if (previous) {
      const gap = point.time - previous.time;
      const distance = Math.hypot(mapped.x - previous.x, mapped.y - previous.y);
      const maxJump = Math.max(64, Math.min(140, Math.max(targetWidth, targetHeight) * Math.max(0.12, gap * 1.25)));
      if (distance > maxJump) {
        jumpDrops += 1;
        continue;
      }
      if (gap > frameIntervalSeconds * 1.5 && gap <= 0.26) {
        const steps = Math.min(2, Math.floor(gap / frameIntervalSeconds) - 1);
        for (let step = 1; step <= steps; step += 1) {
          const t = step / (steps + 1);
          smoothed.push({
            confidence: Math.min(previous.confidence, toConfidence01(point.confidence)) * 0.82,
            frame: previous.frame + step,
            time: roundTime(previous.time + gap * t),
            x: previous.x + (mapped.x - previous.x) * t,
            y: previous.y + (mapped.y - previous.y) * t,
          });
          interpolated += 1;
        }
      }
    }
    smoothed.push({
      confidence: toConfidence01(point.confidence),
      frame: point.frame,
      time: point.time,
      x: previous ? previous.x * 0.55 + mapped.x * 0.45 : mapped.x,
      y: previous ? previous.y * 0.55 + mapped.y * 0.45 : mapped.y,
    });
  }

  console.log("AXIS_REPLAY_BASIC_BALL_SMOOTHING", {
    inputPoints: ballTrack.length,
    interpolated,
    jumpDrops,
    outputPoints: smoothed.length,
  });
  return { interpolated, jumpDrops, points: smoothed };
}

function buildFeaturedPlayerOverlayPoints(playerTrack: AxisPlayerTrackPoint[], targetWidth: number, targetHeight: number) {
  const featuredId = selectFeaturedPlayerId(playerTrack);
  let lowConfidenceDrops = 0;
  let dropoutGaps = 0;
  let previous: PlayerOverlayPoint | null = null;
  const points: PlayerOverlayPoint[] = [];

  for (const point of playerTrack
    .filter((item) => item.id === featuredId && item.time <= overlayPreviewDurationSeconds)
    .sort((a, b) => a.time - b.time)) {
    const confidence = toConfidence01(point.confidence);
    if (confidence < 0.35) {
      lowConfidenceDrops += 1;
      continue;
    }
    const box = mapExportBox(point, targetWidth, targetHeight);
    if (previous && point.frame - previous.frame > 3) {
      dropoutGaps += 1;
      previous = null;
    }
    const x: number = previous ? previous.x * 0.72 + box.x * 0.28 : box.x;
    const y: number = previous ? previous.y * 0.72 + box.y * 0.28 : box.y;
    const boxWidth: number = previous ? previous.boxWidth * 0.78 + box.width * 0.22 : box.width;
    const boxHeight: number = previous ? previous.boxHeight * 0.78 + box.height * 0.22 : box.height;
    const overlayPoint: PlayerOverlayPoint = {
      bottomY: y + boxHeight / 2,
      boxHeight,
      boxWidth,
      confidence,
      featured: true,
      frame: point.frame,
      label: point.label,
      time: point.time,
      x,
      y,
    };
    points.push(overlayPoint);
    previous = overlayPoint;
  }

  console.log("AXIS_REPLAY_BASIC_PLAYER_SMOOTHING", {
    dropoutGaps,
    featuredId,
    inputPoints: playerTrack.length,
    lowConfidenceDrops,
    outputPoints: points.length,
  });
  return { dropoutGaps, lowConfidenceDrops, points };
}

function selectFeaturedPlayerId(playerTrack: AxisPlayerTrackPoint[]) {
  const scores = new Map<string, number>();
  for (const point of playerTrack) {
    scores.set(point.id, (scores.get(point.id) ?? 0) + toConfidence01(point.confidence));
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "player_1";
}

function mapExportBox(point: AxisPlayerTrackPoint, targetWidth: number, targetHeight: number) {
  const center = mapExportPoint(point, targetWidth, targetHeight);
  const sourceWidth = point.sourceWidth || targetWidth || 1;
  const sourceHeight = point.sourceHeight || targetHeight || 1;
  const width = point.boxWidth ? (point.boxWidth / sourceWidth) * targetWidth : 72;
  const height = point.boxHeight ? (point.boxHeight / sourceHeight) * targetHeight : 180;
  return {
    height: Math.max(72, Math.min(targetHeight * 0.55, height)),
    width: Math.max(34, Math.min(targetWidth * 0.28, width)),
    x: center.x,
    y: center.y,
  };
}

function drawBoxFilter({
  alpha,
  color,
  end,
  height,
  start,
  thickness,
  width,
  x,
  y,
}: {
  alpha: number;
  color: string;
  end: number;
  height: number;
  start: number;
  thickness: number | "fill";
  width: number;
  x: number;
  y: number;
}) {
  return `drawbox=x=${Math.round(x)}:y=${Math.round(y)}:w=${Math.max(1, Math.round(width))}:h=${Math.max(
    1,
    Math.round(height),
  )}:color=${color}@${Math.max(0, Math.min(1, alpha)).toFixed(2)}:t=${thickness}:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`;
}

function toConfidence01(value: number) {
  return Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
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
