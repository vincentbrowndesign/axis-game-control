"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { factsToScene, type AnimationFact } from "../lib/axis-animation-renderer";

type ExportState = "idle" | "recording" | "encoding" | "saved" | "preview-saved";
type ExportResult = { mp4_ready: boolean; preview_ready: boolean } | null;

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
  videoUrl,
}: {
  facts: AnimationFact[];
  onReplaySaved?: () => void;
  videoUrl?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const [cropped, setCropped] = useState(true);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [exportResult, setExportResult] = useState<ExportResult>(null);
  const [supportsRecorder, setSupportsRecorder] = useState(true);
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);
  const understanding = useMemo(() => factsToOverlayUnderstanding(facts), [facts]);

  const drawOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, progress: number) => {
      drawUnderstandingOverlay(ctx, understanding, progress, OVERLAY_W, OVERLAY_H);
    },
    [understanding],
  );

  const paintOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    const video = videoRef.current;
    if (!canvas || !ctx || !video) return;

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const progress = Math.max(0, Math.min(1, video.currentTime / duration));
    drawOverlay(ctx, progress);

    if (!video.paused && !video.ended) {
      rafRef.current = requestAnimationFrame(paintOverlay);
    }
  }, [drawOverlay]);

  useEffect(() => {
    setSupportsRecorder(typeof MediaRecorder !== "undefined" && Boolean(getBestMimeType()));
    setSupportsNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  useEffect(() => {
    paintOverlay();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [paintOverlay]);

  function handlePlayState() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    paintOverlay();
  }

  async function recordOverlayFilm() {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay || exportState !== "idle") return null;

    const mimeType = getBestMimeType();
    if (!mimeType) {
      setSupportsRecorder(false);
      return null;
    }

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
          setExportState("idle");
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
          drawUnderstandingOverlay(ctx, understanding, progress, exportCanvas.width, exportCanvas.height);

          if (progress < 1 && !video.ended) {
            requestAnimationFrame(drawFrame);
          } else {
            setExportState("encoding");
            setTimeout(() => recorder.stop(), 180);
          }
        }

        recorder.start();
        setExportState("recording");
        drawFrame();
      });
    } catch (error) {
      console.error("Axis overlay film export failed", error);
      setExportState("idle");
      return null;
    }
  }

  async function handleSaveReplay({ share }: { share: boolean }) {
    const recording = await recordOverlayFilm();
    if (!recording) return;

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
      setExportResult({ mp4_ready: recording.isMp4, preview_ready: true });
      setExportState(recording.isMp4 ? "saved" : "preview-saved");
    } catch {
      setExportState("idle");
    }
  }

  if (!videoUrl) {
    return <p className="axis-cloud-empty">Upload Video</p>;
  }

  const busy = exportState === "recording" || exportState === "encoding";

  return (
    <div className="axis-overlay-film">
      <div className="axis-overlay-stage" data-cropped={cropped}>
        <video
          className="axis-overlay-video"
          controls
          crossOrigin="anonymous"
          onLoadedMetadata={paintOverlay}
          onPause={handlePlayState}
          onPlay={handlePlayState}
          onSeeked={paintOverlay}
          onTimeUpdate={paintOverlay}
          playsInline
          ref={videoRef}
          src={videoUrl}
        />
        <canvas
          aria-hidden="true"
          className="axis-overlay-canvas"
          height={OVERLAY_H}
          ref={overlayRef}
          width={OVERLAY_W}
        />
      </div>

      <div className="axis-overlay-callouts" aria-label="Overlay events">
        {understanding.callouts.map((callout) => (
          <span key={callout}>{callout}</span>
        ))}
      </div>

      <div className="axis-overlay-actions">
        <button
          className="axis-cloud-secondary"
          onClick={() => setCropped((value) => !value)}
          type="button"
        >
          {cropped ? "Fit" : "9:16 Crop"}
        </button>

        {supportsRecorder && onReplaySaved ? (
          <button
            className="axis-cloud-primary"
            disabled={exportState !== "idle"}
            onClick={() => void handleSaveReplay({ share: false })}
            type="button"
          >
            {exportState === "recording"
              ? "Recording"
              : exportState === "encoding"
                ? "Encoding"
                : exportState === "saved"
                  ? "Saved"
                : exportState === "preview-saved"
                  ? "Web Preview Saved"
                    : "Save Replay"}
          </button>
        ) : null}
        {supportsRecorder && onReplaySaved ? (
          <button
            className="axis-cloud-primary"
            disabled={exportState !== "idle"}
            onClick={() => void handleSaveReplay({ share: true })}
            type="button"
          >
            Share Replay
          </button>
        ) : null}
      </div>

      {exportResult ? (
        <p className="axis-export-state">
          {exportResult.mp4_ready
            ? "mp4_ready: true"
            : "preview_ready: true / mp4_ready: false"}
        </p>
      ) : null}
    </div>
  );
}

function drawUnderstandingOverlay(
  ctx: CanvasRenderingContext2D,
  u: OverlayUnderstanding,
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

  if (u.hoopDetected) drawLock(ctx, rim.x, rim.y, "#ff7a24", pulse(t, 0.05, 0.28));
  if (u.ballDetected) {
    const ballT = u.drive ? phase(t, 0.18, 0.62) : t;
    const bx = lerp(start.x, rim.x, ballT);
    const by = lerp(start.y, rim.y, ballT);
    drawLock(ctx, bx, by, "#ff9a3c", 0.75);
  }

  if (u.movementPath) drawDirectionalCue(ctx, start, { x: cx, y: height * 0.46 }, phase(t, 0.08, 0.44));
  if (u.drive) drawAttackTrail(ctx, start, { x: cx, y: height * 0.43 }, phase(t, 0.14, 0.56));
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

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "rgba(184,219,77,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, scanY);
  ctx.lineTo(width - pad, scanY);
  ctx.stroke();
  ctx.restore();
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
