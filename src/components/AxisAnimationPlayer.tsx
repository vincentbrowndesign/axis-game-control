"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { factsToScene, type AnimationFact, type AnimationTrack } from "../lib/axis-animation-renderer";

type ExportState = "idle" | "saving" | "saved" | "failed";

type OverlayUnderstanding = {
  ballDetected: boolean;
  callouts: string[];
  drive: boolean;
  hoopDetected: boolean;
  makeMiss: "make" | "miss" | null;
  movementPath: string | null;
  paintTouch: boolean;
  shotAttempt: boolean;
};

type BallDebugState = {
  ballConfidence: string;
  ballTrackCount: number;
  currentBallX: string;
  currentBallY: string;
  overlayHeight: number;
  overlayWidth: number;
  videoHeight: number;
  videoWidth: number;
};

type BallTrackPoint = {
  confidence?: number;
  frame: number;
  time: number;
  x: number;
  y: number;
};

type VideoMapping = {
  drawHeight: number;
  drawWidth: number;
  offsetX: number;
  offsetY: number;
};

const OVERLAY_W = 1080;
const OVERLAY_H = 1920;
const EXPORT_FPS = 30;
const EXPORT_MS = 9000;
const BALL_CONFIDENCE_THRESHOLD = 0.35;
const BALL_TRAIL_SECONDS = 0.75;

function getBestMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function fileExtForMime(mime: string) {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

function factText(facts: AnimationFact[], key: string) {
  return facts.find((fact) => fact.fact_key === key)?.fact_text_value ?? null;
}

function factBool(facts: AnimationFact[], key: string) {
  return (facts.find((fact) => fact.fact_key === key)?.fact_value ?? 0) === 1;
}

function factsToOverlayUnderstanding(facts: AnimationFact[]): OverlayUnderstanding {
  const scene = factsToScene(facts);
  const movementPath = factText(facts, "movement_path");
  const understanding: OverlayUnderstanding = {
    ballDetected: factBool(facts, "ball_detected"),
    callouts: [],
    drive: scene.drive,
    hoopDetected: factBool(facts, "hoop_detected"),
    makeMiss: scene.makeMiss,
    movementPath,
    paintTouch: scene.paintTouch,
    shotAttempt: scene.shotAttempt,
  };

  if (understanding.drive) understanding.callouts.push("DRIVE");
  if (understanding.paintTouch) understanding.callouts.push("PAINT TOUCH");
  if (understanding.shotAttempt) understanding.callouts.push("SHOT ATTEMPT");
  if (understanding.makeMiss === "make") understanding.callouts.push("MAKE");
  if (understanding.makeMiss === "miss") understanding.callouts.push("MISS");

  return understanding;
}

export function AxisAnimationPlayer({
  facts,
  onReplaySaved,
  replayStatus = "ready",
  thumbnailUrl,
  tracks = [],
  videoUrl,
}: {
  facts: AnimationFact[];
  onReplaySaved?: () => void;
  replayStatus?: "processing" | "ready" | "failed";
  thumbnailUrl?: string | null;
  tracks?: AnimationTrack[];
  videoUrl?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const [cropped, setCropped] = useState(true);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [overlayCanvasReady, setOverlayCanvasReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);
  const [ballDebug, setBallDebug] = useState<BallDebugState>({
    ballConfidence: "n/a",
    ballTrackCount: 0,
    currentBallX: "n/a",
    currentBallY: "n/a",
    overlayHeight: OVERLAY_H,
    overlayWidth: OVERLAY_W,
    videoHeight: 0,
    videoWidth: 0,
  });
  const understanding = useMemo(() => factsToOverlayUnderstanding(facts), [facts]);
  const canExport = replayStatus === "ready";
  const ballTrack = useMemo(() => tracksToBallTrack(tracks), [tracks]);

  const drawOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, timing: OverlayTiming, video: HTMLVideoElement | null) => {
      const debug = drawUnderstandingOverlay(ctx, understanding, tracks, ballTrack, timing, OVERLAY_W, OVERLAY_H, video, cropped);
      setBallDebug(debug);
    },
    [ballTrack, cropped, tracks, understanding],
  );

  const paintOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    const video = videoRef.current;
    if (!canvas || !ctx) return;

    const duration = video && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const currentTime = video ? video.currentTime : performance.now() / 1000;
    const progress = Math.max(0, Math.min(1, duration > 0 ? currentTime / duration : 0));
    drawOverlay(ctx, { currentTime, duration, progress }, video ?? null);

    rafRef.current = requestAnimationFrame(paintOverlay);
  }, [drawOverlay]);

  useEffect(() => {
    setSupportsNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(paintOverlay);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [paintOverlay]);

  useEffect(() => {
    setVideoFailed(false);
    setVideoLoaded(false);
  }, [videoUrl]);

  useEffect(() => {
    console.info("REPLAY_BALL_TRACK_COUNT", {
      count: ballTrack.length,
      source: "player_component",
    });
  }, [ballTrack.length]);

  function handlePlayState() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    paintOverlay();
  }

  const handleOverlayRef = useCallback((node: HTMLCanvasElement | null) => {
    overlayRef.current = node;
    setOverlayCanvasReady(Boolean(node));
  }, []);

  async function renderOverlayPreview(
    video: HTMLVideoElement,
    overlay: HTMLCanvasElement,
  ) {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = OVERLAY_W;
    exportCanvas.height = OVERLAY_H;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return null;

    drawVideoCover(ctx, video, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(overlay, 0, 0, exportCanvas.width, exportCanvas.height);

    return await new Promise<{ blob: Blob; ext: string; isMp4: boolean } | null>((resolve) => {
      exportCanvas.toBlob((blob) => {
        resolve(blob ? { blob, ext: "png", isMp4: false } : null);
      }, "image/png");
    });
  }

  async function recordOverlayAsset() {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay || exportState === "saving") return null;
    console.info("EXPORT_BALL_TRACK_COUNT", {
      count: ballTrack.length,
    });

    const mimeType = getBestMimeType();
    if (!mimeType || typeof MediaRecorder === "undefined") return renderOverlayPreview(video, overlay);

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = OVERLAY_W;
    exportCanvas.height = OVERLAY_H;
    exportCanvasRef.current = exportCanvas;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return null;

    try {
      await video.play().catch(() => null);
      video.currentTime = 0;

      return await new Promise<{ blob: Blob; ext: string; isMp4: boolean } | null>((resolve) => {
        const stream = exportCanvas.captureStream(EXPORT_FPS);
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 8_000_000,
        });
        const chunks: Blob[] = [];
        const startedAt = performance.now();

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
          setExportState("failed");
          resolve(null);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve({
            blob,
            ext: fileExtForMime(mimeType),
            isMp4: mimeType.startsWith("video/mp4"),
          });
        };

        function drawFrame() {
          if (!ctx || !video) return;
          const elapsed = performance.now() - startedAt;
          const progress = Math.max(0, Math.min(1, elapsed / EXPORT_MS));
          const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : EXPORT_MS / 1000;
          const currentTime = progress * duration;
          drawVideoCover(ctx, video, exportCanvas.width, exportCanvas.height, cropped ? "cover" : "contain");
          drawUnderstandingOverlay(
            ctx,
            understanding,
            tracks,
            ballTrack,
            { currentTime, duration, progress },
            exportCanvas.width,
            exportCanvas.height,
            video,
            cropped,
          );

          if (progress < 1 && !video.ended) {
            requestAnimationFrame(drawFrame);
          } else {
            setTimeout(() => recorder.stop(), 180);
          }
        }

        recorder.start();
        drawFrame();
      });
    } catch (error) {
      console.error("Axis overlay film export failed", error);
      return renderOverlayPreview(video, overlay);
    }
  }

  function getExportButtonText() {
    if (exportState === "saving") return "Saving...";
    if (exportState === "saved") return "Saved";
    if (exportState === "failed") return "Export failed";
    return "Save Replay";
  }

  async function handleSaveReplay({ share }: { share: boolean }) {
    setExportState("saving");
    const recording = await recordOverlayAsset();
    if (!recording) {
      setExportState("failed");
      return null;
    }

    const fileName = `axis-replay-${Date.now()}.${recording.ext}`;
    const file = new File([recording.blob], fileName, { type: recording.blob.type });
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    try {
      if (share && supportsNativeShare && nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Axis Replay" });
      } else {
        downloadBlob(recording.blob, fileName);
      }

      onReplaySaved?.();
      setExportState("saved");
    } catch {
      setExportState("failed");
    }
  }

  const busy = exportState === "saving";

  return (
    <div className="axis-overlay-film">
      <div className="axis-overlay-stage" data-cropped={cropped}>
        {videoUrl ? (
          <video
            className="axis-overlay-video"
            controls
            crossOrigin="anonymous"
            onCanPlay={() => setVideoLoaded(true)}
            onError={() => setVideoFailed(true)}
            onLoadedData={() => setVideoLoaded(true)}
            onLoadedMetadata={() => {
              setVideoLoaded(true);
              paintOverlay();
            }}
            onPause={handlePlayState}
            onPlay={handlePlayState}
            onSeeked={paintOverlay}
            onTimeUpdate={paintOverlay}
            playsInline
            ref={videoRef}
            src={videoUrl}
          />
        ) : (
          <div className="axis-overlay-video axis-overlay-no-video" aria-hidden="true" />
        )}
        {videoFailed && thumbnailUrl ? (
          <img className="axis-overlay-video axis-overlay-thumbnail" alt="" src={thumbnailUrl} />
        ) : null}
        <canvas
          aria-hidden="true"
          className="axis-overlay-canvas"
          height={OVERLAY_H}
          ref={handleOverlayRef}
          width={OVERLAY_W}
        />
      </div>

      {canExport ? (
        <div className="axis-overlay-actions">
          <button
            className="axis-cloud-primary"
            disabled={busy}
            onClick={() => void handleSaveReplay({ share: false })}
            type="button"
          >
            {getExportButtonText()}
          </button>
          <button
            className="axis-cloud-primary"
            disabled={busy}
            onClick={() => void handleSaveReplay({ share: true })}
            type="button"
          >
            {busy ? "Saving..." : "Share Replay"}
          </button>
        </div>
      ) : null}

      <dl className="axis-ball-debug" aria-label="Ball tracking debug">
        <div>
          <dt>ball_track_count</dt>
          <dd>{ballDebug.ballTrackCount}</dd>
        </div>
        <div>
          <dt>current_ball_x</dt>
          <dd>{ballDebug.currentBallX}</dd>
        </div>
        <div>
          <dt>current_ball_y</dt>
          <dd>{ballDebug.currentBallY}</dd>
        </div>
        <div>
          <dt>ball_confidence</dt>
          <dd>{ballDebug.ballConfidence}</dd>
        </div>
        <div>
          <dt>video_width</dt>
          <dd>{ballDebug.videoWidth}</dd>
        </div>
        <div>
          <dt>video_height</dt>
          <dd>{ballDebug.videoHeight}</dd>
        </div>
        <div>
          <dt>overlay_width</dt>
          <dd>{ballDebug.overlayWidth}</dd>
        </div>
        <div>
          <dt>overlay_height</dt>
          <dd>{ballDebug.overlayHeight}</dd>
        </div>
      </dl>
    </div>
  );
}

type OverlayTiming = {
  currentTime: number;
  duration: number;
  progress: number;
};

function drawUnderstandingOverlay(
  ctx: CanvasRenderingContext2D,
  u: OverlayUnderstanding,
  tracks: AnimationTrack[],
  ballTrack: BallTrackPoint[],
  timing: OverlayTiming,
  width: number,
  height: number,
  video: HTMLVideoElement | null,
  cover: boolean,
) {
  ctx.clearRect(0, 0, width, height);

  const t = Math.max(0, Math.min(1, timing.progress));
  const cx = width / 2;
  const paint = { x: cx, y: height * 0.42, w: width * 0.42, h: height * 0.19 };
  const mapping = getVideoMapping(video, width, height, cover ? "cover" : "contain");
  const ball = getNearestBallPoint(ballTrack, timing.currentTime);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  drawMinimalReplayOverlay(ctx, t, width, height);
  drawNonBallTracks(ctx, tracks, t, width, height, mapping);
  drawBallOverlay(ctx, ballTrack, ball, timing.currentTime, width, height, mapping);

  if (u.paintTouch) drawPaintPulse(ctx, paint, pulse(t, 0.38, 0.68));
  if (ball && u.shotAttempt) drawBallShotPath(ctx, ballTrack, timing.currentTime, width, height, mapping);
  if (ball && u.makeMiss === "make") drawResultBurst(ctx, mapVideoPointToCanvas(ball, mapping), "#19ff78", pulse(t, 0.72, 1));
  if (ball && u.makeMiss === "miss") drawResultBurst(ctx, mapVideoPointToCanvas(ball, mapping), "#ff4055", pulse(t, 0.72, 1));

  drawCalloutStack(ctx, u.callouts, width, height, phase(t, 0.62, 0.92));
  ctx.restore();

  return {
    ballConfidence: ball?.confidence === undefined ? "n/a" : formatDebugNumber(ball.confidence),
    ballTrackCount: ballTrack.length,
    currentBallX: ball ? formatDebugNumber(ball.x) : "n/a",
    currentBallY: ball ? formatDebugNumber(ball.y) : "n/a",
    overlayHeight: height,
    overlayWidth: width,
    videoHeight: video?.videoHeight ?? 0,
    videoWidth: video?.videoWidth ?? 0,
  };
}

function drawMinimalReplayOverlay(
  ctx: CanvasRenderingContext2D,
  progress: number,
  width: number,
  height: number,
) {
  const pad = width * 0.055;
  const len = width * 0.085;
  const scanY = lerp(height * 0.18, height * 0.82, progress);

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = "rgba(184,219,77,0.72)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pad, pad + len);
  ctx.lineTo(pad, pad);
  ctx.lineTo(pad + len, pad);
  ctx.moveTo(width - pad - len, pad);
  ctx.lineTo(width - pad, pad);
  ctx.lineTo(width - pad, pad + len);
  ctx.moveTo(pad, height - pad - len);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(pad + len, height - pad);
  ctx.moveTo(width - pad - len, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.lineTo(width - pad, height - pad - len);
  ctx.stroke();

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(184,219,77,0.94)";
  ctx.font = "800 38px Arial, Helvetica, sans-serif";
  ctx.fillText("AXIS", pad, height - pad - 34);

  ctx.globalAlpha = 0.28 + Math.sin(progress * Math.PI * 2) * 0.14;
  ctx.strokeStyle = "rgba(184,219,77,0.68)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(width * 0.5, height * 0.5, width * 0.18 + progress * width * 0.06, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "rgba(184,219,77,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, scanY);
  ctx.lineTo(width - pad, scanY);
  ctx.stroke();
  ctx.restore();
}

function drawNonBallTracks(
  ctx: CanvasRenderingContext2D,
  tracks: AnimationTrack[],
  progress: number,
  width: number,
  height: number,
  mapping: VideoMapping,
) {
  if (!tracks.length) return;
  const nonBallTracks = tracks.filter((track) => track.entity_type !== "ball");
  if (!nonBallTracks.length) return;
  const maxFrame = Math.max(...nonBallTracks.map((track) => track.frame), 1);
  const currentFrame = progress * maxFrame;
  const byEntity = new Map<string, AnimationTrack[]>();

  for (const track of nonBallTracks) {
    const list = byEntity.get(track.entity_id) ?? [];
    list.push(track);
    byEntity.set(track.entity_id, list);
  }

  for (const list of byEntity.values()) {
    const ordered = [...list].sort((a, b) => a.frame - b.frame);
    const current = getTrackPositionAt(ordered, currentFrame);
    if (!current) continue;

    const visible = ordered.filter((track) => track.frame <= currentFrame);
    const path = [...visible, current].filter((track, index, values) => {
      const previous = values[index - 1];
      return !previous || previous.frame !== track.frame || previous.x !== track.x || previous.y !== track.y;
    });
    const color = current.entity_type === "hoop" ? "#ff7a24" : "#b8db4d";
    const radius = current.entity_type === "hoop" ? 22 : 20;
    const alpha = current.entity_type === "hoop" ? 0.76 : 0.92;

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = current.entity_type === "player" ? 5 : 4;
    ctx.lineCap = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    path.forEach((track, index) => {
      const point = mapVideoPointToCanvas(track, mapping);
      index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    const point = mapVideoPointToCanvas(current, mapping);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = current.entity_type === "hoop" ? 0.25 : 0.85;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, current.entity_type === "hoop" ? 4 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function getTrackPositionAt(ordered: AnimationTrack[], frame: number): AnimationTrack | null {
  if (!ordered.length) return null;
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (frame <= first.frame) return first;
  if (frame >= last.frame) return last;

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    if (frame < current.frame || frame > next.frame) continue;
    const amount = (frame - current.frame) / Math.max(1, next.frame - current.frame);
    return {
      entity_id: current.entity_id,
      entity_type: current.entity_type,
      frame,
      x: lerp(current.x, next.x, amount),
      y: lerp(current.y, next.y, amount),
    };
  }

  return last;
}

function tracksToBallTrack(tracks: AnimationTrack[]): BallTrackPoint[] {
  const bestByFrame = new Map<number, BallTrackPoint>();

  for (const track of tracks) {
    if (track.entity_type !== "ball") continue;
    if (!Number.isFinite(track.x) || !Number.isFinite(track.y)) continue;
    const confidence = getNormalizedConfidence(track.confidence);
    const point: BallTrackPoint = {
      confidence: track.confidence,
      frame: track.frame,
      time: Number.isFinite(track.time) ? (track.time as number) : track.frame,
      x: track.x,
      y: track.y,
    };
    const current = bestByFrame.get(point.frame);
    if (!current || confidence > getNormalizedConfidence(current.confidence)) {
      bestByFrame.set(point.frame, point);
    }
  }

  return Array.from(bestByFrame.values()).sort((a, b) => a.time - b.time || a.frame - b.frame);
}

function getNearestBallPoint(ballTrack: BallTrackPoint[], currentTime: number): BallTrackPoint | null {
  if (!ballTrack.length) return null;
  let best: { distance: number; point: BallTrackPoint } | null = null;

  for (const point of ballTrack) {
    const confidence = getNormalizedConfidence(point.confidence);
    if (confidence < BALL_CONFIDENCE_THRESHOLD) continue;
    const distance = Math.abs(point.time - currentTime);
    if (!best || distance < best.distance) best = { distance, point };
  }

  if (!best || best.distance > 0.55) return null;
  return best.point;
}

function drawBallOverlay(
  ctx: CanvasRenderingContext2D,
  ballTrack: BallTrackPoint[],
  current: BallTrackPoint | null,
  currentTime: number,
  width: number,
  height: number,
  mapping: VideoMapping,
) {
  if (!current) return;

  const recent = ballTrack.filter((point) => {
    const confidence = getNormalizedConfidence(point.confidence);
    return confidence >= BALL_CONFIDENCE_THRESHOLD && point.time <= currentTime && currentTime - point.time <= BALL_TRAIL_SECONDS;
  });

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (recent.length > 1) {
    for (let index = 1; index < recent.length; index += 1) {
      const previous = recent[index - 1];
      const point = recent[index];
      const age = Math.max(0, currentTime - point.time);
      const fade = 1 - Math.min(1, age / BALL_TRAIL_SECONDS);
      const from = mapVideoPointToCanvas(previous, mapping);
      const to = mapVideoPointToCanvas(point, mapping);
      ctx.globalAlpha = 0.18 + fade * 0.62;
      ctx.strokeStyle = "rgba(255,154,60,0.95)";
      ctx.lineWidth = Math.max(3, width * 0.006 * fade);
      ctx.shadowColor = "rgba(255,154,60,0.75)";
      ctx.shadowBlur = 18 * fade;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
  }

  const p = mapVideoPointToCanvas(current, mapping);
  const confidence = getNormalizedConfidence(current.confidence);
  const radius = Math.max(12, Math.min(width, height) * 0.018);
  ctx.globalAlpha = Math.max(0.35, confidence);
  ctx.shadowColor = "rgba(255,154,60,0.95)";
  ctx.shadowBlur = radius * 2.4;
  ctx.strokeStyle = "rgba(255,184,102,0.96)";
  ctx.lineWidth = Math.max(2, radius * 0.22);
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = Math.max(0.55, confidence);
  ctx.fillStyle = "rgba(255,154,60,0.92)";
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(3, radius * 0.28), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBallShotPath(
  ctx: CanvasRenderingContext2D,
  ballTrack: BallTrackPoint[],
  currentTime: number,
  width: number,
  height: number,
  mapping: VideoMapping,
) {
  const visible = ballTrack.filter((point) => {
    const confidence = getNormalizedConfidence(point.confidence);
    return confidence >= BALL_CONFIDENCE_THRESHOLD && point.time <= currentTime;
  });
  if (visible.length < 2) return;

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = Math.max(2, width * 0.004);
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  visible.slice(-8).forEach((point, index) => {
    const mapped = mapVideoPointToCanvas(point, mapping);
    index === 0 ? ctx.moveTo(mapped.x, mapped.y) : ctx.lineTo(mapped.x, mapped.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function getVideoMapping(
  video: Pick<HTMLVideoElement, "videoHeight" | "videoWidth"> | null,
  overlayWidth: number,
  overlayHeight: number,
  fit: "contain" | "cover",
): VideoMapping {
  const videoWidth = video?.videoWidth || overlayWidth;
  const videoHeight = video?.videoHeight || overlayHeight;
  const scale = fit === "contain"
    ? Math.min(overlayWidth / videoWidth, overlayHeight / videoHeight)
    : Math.max(overlayWidth / videoWidth, overlayHeight / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;

  return {
    drawHeight,
    drawWidth,
    offsetX: (overlayWidth - drawWidth) / 2,
    offsetY: (overlayHeight - drawHeight) / 2,
  };
}

function mapVideoPointToCanvas(point: Pick<AnimationTrack | BallTrackPoint, "x" | "y">, mapping: VideoMapping) {
  return {
    x: mapping.offsetX + point.x * mapping.drawWidth,
    y: mapping.offsetY + point.y * mapping.drawHeight,
  };
}

function getNormalizedConfidence(confidence: number | undefined) {
  if (confidence === undefined || !Number.isFinite(confidence)) return 0;
  return confidence > 1 ? confidence / 100 : confidence;
}

function formatDebugNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : "n/a";
}

function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  fit: "contain" | "cover" = "cover",
) {
  ctx.fillStyle = "#020303";
  ctx.fillRect(0, 0, width, height);

  const vw = video.videoWidth || width;
  const vh = video.videoHeight || height;
  const mapping = getVideoMapping({ videoWidth: vw, videoHeight: vh }, width, height, fit);
  ctx.drawImage(video, mapping.offsetX, mapping.offsetY, mapping.drawWidth, mapping.drawHeight);
}

function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, alpha: number) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawDirectionalCue(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  progress: number,
) {
  if (progress <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.42 * progress;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 16]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(lerp(from.x, to.x, progress), lerp(from.y, to.y, progress));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawAttackTrail(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  progress: number,
) {
  if (progress <= 0) return;
  const x = lerp(from.x, to.x, progress);
  const y = lerp(from.y, to.y, progress);
  const grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  grad.addColorStop(0, "rgba(184,219,77,0)");
  grad.addColorStop(1, "rgba(184,219,77,0.95)");
  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineCap = "round";
  ctx.lineWidth = 16;
  ctx.shadowColor = "#b8db4d";
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}

function drawPaintPulse(
  ctx: CanvasRenderingContext2D,
  paint: { x: number; y: number; w: number; h: number },
  amount: number,
) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = amount * 0.28;
  ctx.fillStyle = "#19ff78";
  ctx.fillRect(paint.x - paint.w / 2, paint.y - paint.h / 2, paint.w, paint.h);
  ctx.globalAlpha = amount;
  ctx.strokeStyle = "#19ff78";
  ctx.lineWidth = 4;
  ctx.shadowColor = "#19ff78";
  ctx.shadowBlur = 24;
  ctx.strokeRect(paint.x - paint.w / 2, paint.y - paint.h / 2, paint.w, paint.h);
  ctx.restore();
}

function drawShotArc(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  progress: number,
) {
  if (progress <= 0) return;
  const cp = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 260 };
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 5;
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  for (let i = 0; i <= 40 * progress; i += 1) {
    const p = bezier(i / 40, from, cp, to);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawResultBurst(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, color: string, amount: number) {
  if (amount <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 28;
  for (let i = 0; i < 3; i += 1) {
    ctx.globalAlpha = Math.max(0, amount - i * 0.2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 36 + amount * 180 + i * 42, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCalloutStack(
  ctx: CanvasRenderingContext2D,
  callouts: string[],
  width: number,
  height: number,
  amount: number,
) {
  if (!callouts.length || amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.textAlign = "center";
  ctx.font = "800 58px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "#f3f4ef";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 20;
  callouts.slice(0, 4).forEach((callout, index) => {
    ctx.fillText(callout, width / 2, height * 0.78 + index * 70);
  });
  ctx.restore();
}

function phase(t: number, start: number, end: number) {
  return Math.max(0, Math.min(1, (t - start) / Math.max(0.001, end - start)));
}

function pulse(t: number, start: number, end: number) {
  const p = phase(t, start, end);
  return Math.sin(p * Math.PI);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function bezier(
  t: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    y: u * u * a.y + 2 * u * t * b.y + t * t * c.y,
  };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
