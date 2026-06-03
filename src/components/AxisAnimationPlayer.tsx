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

const OVERLAY_W = 1080;
const OVERLAY_H = 1920;
const EXPORT_FPS = 30;
const EXPORT_MS = 9000;

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
  const understanding = useMemo(() => factsToOverlayUnderstanding(facts), [facts]);
  const canExport = replayStatus === "ready";

  const drawOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, progress: number) => {
      drawUnderstandingOverlay(ctx, understanding, tracks, progress, OVERLAY_W, OVERLAY_H);
    },
    [tracks, understanding],
  );

  const paintOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    const video = videoRef.current;
    if (!canvas || !ctx) return;

    const duration = video && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const currentTime = video && !video.paused ? video.currentTime : performance.now() / 1000;
    const progress = Math.max(0, Math.min(1, (currentTime % duration) / duration));
    drawOverlay(ctx, progress);

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
          drawVideoCover(ctx, video, exportCanvas.width, exportCanvas.height);
          drawUnderstandingOverlay(ctx, understanding, tracks, progress, exportCanvas.width, exportCanvas.height);

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
    </div>
  );
}

function drawUnderstandingOverlay(
  ctx: CanvasRenderingContext2D,
  u: OverlayUnderstanding,
  tracks: AnimationTrack[],
  progress: number,
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);

  const t = Math.max(0, Math.min(1, progress));
  const cx = width / 2;
  const cy = height / 2;
  const rim = { x: cx, y: height * 0.22 };
  const startX = u.movementPath === "left" ? width * 0.28 : u.movementPath === "right" ? width * 0.72 : cx;
  const start = { x: startX, y: height * 0.66 };
  const paint = { x: cx, y: height * 0.42, w: width * 0.42, h: height * 0.19 };

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  drawMinimalReplayOverlay(ctx, t, width, height);
  drawTrackedEntities(ctx, tracks, t, width, height);

  if (!tracks.length && u.hoopDetected) drawLock(ctx, rim.x, rim.y, "#ff7a24", pulse(t, 0.05, 0.28));
  if (!tracks.length && u.ballDetected) {
    const ballT = u.drive ? phase(t, 0.18, 0.62) : t;
    const bx = lerp(start.x, rim.x, ballT);
    const by = lerp(start.y, rim.y, ballT);
    drawLock(ctx, bx, by, "#ff9a3c", 0.75);
  }

  if (!tracks.length && u.movementPath) drawDirectionalCue(ctx, start, { x: cx, y: height * 0.46 }, phase(t, 0.08, 0.44));
  if (!tracks.length && u.drive) drawAttackTrail(ctx, start, { x: cx, y: height * 0.43 }, phase(t, 0.14, 0.56));
  if (u.paintTouch) drawPaintPulse(ctx, paint, pulse(t, 0.38, 0.68));
  if (u.shotAttempt) drawShotArc(ctx, { x: cx, y: height * 0.43 }, rim, phase(t, 0.52, 0.78));
  if (u.makeMiss === "make") drawResultBurst(ctx, rim, "#19ff78", pulse(t, 0.72, 1));
  if (u.makeMiss === "miss") drawResultBurst(ctx, rim, "#ff4055", pulse(t, 0.72, 1));

  drawCalloutStack(ctx, u.callouts, width, height, phase(t, 0.62, 0.92));
  ctx.restore();
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

function drawTrackedEntities(
  ctx: CanvasRenderingContext2D,
  tracks: AnimationTrack[],
  progress: number,
  width: number,
  height: number,
) {
  if (!tracks.length) return;
  const maxFrame = Math.max(...tracks.map((track) => track.frame), 1);
  const currentFrame = progress * maxFrame;
  const byEntity = new Map<string, AnimationTrack[]>();

  for (const track of tracks) {
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
    const color = current.entity_type === "ball" ? "#ff9a3c" : current.entity_type === "hoop" ? "#ff7a24" : "#b8db4d";
    const radius = current.entity_type === "ball" ? 16 : current.entity_type === "hoop" ? 22 : 20;
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
      const point = trackToCanvas(track, width, height);
      index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    const point = trackToCanvas(current, width, height);
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

function trackToCanvas(track: AnimationTrack, width: number, height: number) {
  return {
    x: track.x * width,
    y: track.y * height,
  };
}

function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  ctx.fillStyle = "#020303";
  ctx.fillRect(0, 0, width, height);

  const vw = video.videoWidth || width;
  const vh = video.videoHeight || height;
  const scale = Math.max(width / vw, height / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh);
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
