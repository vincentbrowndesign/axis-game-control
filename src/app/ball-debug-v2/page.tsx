"use client";

import * as tus from "tus-js-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BallTrackPoint = {
  confidence: number;
  frame: number;
  time: number;
  x: number;
  y: number;
};

type BallDebugResponse = {
  ballTrack?: BallTrackPoint[];
  ballTrackCount?: number;
  detectionCount?: number;
  error?: string;
  failure?: {
    details?: Record<string, unknown>;
    error?: string;
    stage?: string;
  } | null;
  frameCount?: number;
  jobId?: string;
  status?: "failed" | "processing" | "ready";
  videoUrl?: string;
};

type MuxUploadResponse = {
  uploadId?: string;
  uploadUrl?: string;
};

type MuxReadyResponse = {
  playbackId?: string;
  ready?: boolean;
};

type DebugState = {
  BALL_TRACK_COUNT: number;
  BASKETBALL_DETECTIONS: number;
  CURRENT_BALL_X: string;
  CURRENT_BALL_Y: string;
  CURRENT_CONFIDENCE: string;
  ERROR_MESSAGE: string;
  FAILED_STAGE: string;
  FIRST_FRAME: string;
  FRAMES_EXTRACTED: number;
  LAST_FRAME: string;
};

const emptyDebug: DebugState = {
  BALL_TRACK_COUNT: 0,
  BASKETBALL_DETECTIONS: 0,
  CURRENT_BALL_X: "N/A",
  CURRENT_BALL_Y: "N/A",
  CURRENT_CONFIDENCE: "N/A",
  ERROR_MESSAGE: "N/A",
  FAILED_STAGE: "N/A",
  FIRST_FRAME: "N/A",
  FRAMES_EXTRACTED: 0,
  LAST_FRAME: "N/A",
};

const confidenceThreshold = 0.35;
const trailLength = 12;

export default function BallDebugV2Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [debug, setDebug] = useState<DebugState>(emptyDebug);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<"idle" | "processing" | "ready" | "failed">("idle");
  const [track, setTrack] = useState<BallTrackPoint[]>([]);
  const [videoUrl, setVideoUrl] = useState("");

  const sortedTrack = useMemo(
    () => [...track].sort((a, b) => a.time - b.time || a.frame - b.frame),
    [track],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !video || !ctx) return;

    const rect = video.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const nearest = getNearestTrackPoint(sortedTrack, video.currentTime);
    if (!nearest || normalizeConfidence(nearest.point.confidence) < confidenceThreshold) {
      setDebug((current) => ({
        ...current,
        CURRENT_BALL_X: "N/A",
        CURRENT_BALL_Y: "N/A",
        CURRENT_CONFIDENCE: "N/A",
      }));
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    drawTrail(ctx, sortedTrack, nearest.index, video, width, height);
    drawGlow(ctx, nearest.point, video, width, height);

    setDebug((current) => ({
      ...current,
      CURRENT_BALL_X: formatNumber(nearest.point.x),
      CURRENT_BALL_Y: formatNumber(nearest.point.y),
      CURRENT_CONFIDENCE: formatNumber(nearest.point.confidence),
    }));

    rafRef.current = requestAnimationFrame(draw);
  }, [sortedTrack]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!jobId || status !== "processing") return;

    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/axis/ball-job/${encodeURIComponent(jobId)}`);
        const result = (await response.json().catch(() => null)) as BallDebugResponse | null;
        if (cancelled || !result) return;

        if (!response.ok) throw new Error(result.error ?? "Ball job unavailable.");
        if (result.status === "processing") {
          setDebug((current) => ({
            ...current,
            BALL_TRACK_COUNT: result.ballTrackCount ?? current.BALL_TRACK_COUNT,
            BASKETBALL_DETECTIONS: result.detectionCount ?? current.BASKETBALL_DETECTIONS,
            FRAMES_EXTRACTED: result.frameCount ?? current.FRAMES_EXTRACTED,
          }));
          return;
        }

        if (result.status === "failed") {
          setDebug((current) => ({
            ...current,
            ERROR_MESSAGE: result.error ?? "Ball debug failed.",
            FAILED_STAGE: "background_processing",
          }));
          throw new Error(result.error ?? "Ball debug failed.");
        }

        const nextTrack = Array.isArray(result.ballTrack) ? result.ballTrack : [];
        setTrack(nextTrack);
        setDebug({
          BALL_TRACK_COUNT: nextTrack.length,
          BASKETBALL_DETECTIONS: result.detectionCount ?? 0,
          CURRENT_BALL_X: "N/A",
          CURRENT_BALL_Y: "N/A",
          CURRENT_CONFIDENCE: "N/A",
          ERROR_MESSAGE: "N/A",
          FAILED_STAGE: "N/A",
          FIRST_FRAME: nextTrack[0] ? String(nextTrack[0].frame) : "N/A",
          FRAMES_EXTRACTED: result.frameCount ?? 0,
          LAST_FRAME: nextTrack.at(-1) ? String(nextTrack.at(-1)?.frame) : "N/A",
        });
        setStatus("ready");
        window.clearInterval(interval);
      } catch (nextError) {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "Ball debug failed.");
        setStatus("failed");
        window.clearInterval(interval);
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [jobId, status]);

  async function handleUpload(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const localVideoUrl = URL.createObjectURL(file);
    objectUrlRef.current = localVideoUrl;
    setVideoUrl(localVideoUrl);
    setTrack([]);
    setDebug(emptyDebug);
    setError("");
    setJobId("");
    setStatus("processing");

    try {
      const mux = await createMuxUpload();
      if (!mux.uploadId || !mux.uploadUrl) throw new Error("Mux upload could not be created.");
      await uploadFileToMux(file, mux.uploadUrl);
      const ready = await waitForMuxPlayback(mux.uploadId);
      if (!ready.playbackId) throw new Error("Mux playback was not ready.");

      const muxVideoUrl = `https://stream.mux.com/${ready.playbackId}.m3u8`;
      const response = await fetch("/api/axis/ball-debug-v2", {
        body: JSON.stringify({
          muxPlaybackId: ready.playbackId,
          muxUploadId: mux.uploadId,
          videoUrl: muxVideoUrl,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as BallDebugResponse | null;
      if (!response.ok || !result) {
        const failedStage = result?.failure?.stage ?? "job_create";
        const errorMessage = result?.failure?.error ?? result?.error ?? "Ball debug failed.";
        setDebug({
          ...emptyDebug,
          BASKETBALL_DETECTIONS: result?.detectionCount ?? 0,
          ERROR_MESSAGE: errorMessage,
          FAILED_STAGE: failedStage,
          FRAMES_EXTRACTED: result?.frameCount ?? 0,
        });
        throw new Error(errorMessage);
      }

      if (!result.jobId) throw new Error("Ball job was not created.");
      setJobId(result.jobId);
      setStatus("processing");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Ball debug failed.");
      setStatus("failed");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <main style={styles.page}>
      <button style={styles.uploadButton} onClick={() => inputRef.current?.click()} type="button">
        Upload Video
      </button>

      <section style={styles.stage} aria-label="Basketball tracking proof">
        {videoUrl ? (
          <>
            <video
              controls
              onLoadedMetadata={draw}
              onPlay={draw}
              onSeeked={draw}
              onTimeUpdate={draw}
              playsInline
              ref={videoRef}
              src={videoUrl}
              style={styles.video}
            />
            <canvas aria-hidden="true" ref={canvasRef} style={styles.canvas} />
          </>
        ) : (
          <div style={styles.empty}>Upload video</div>
        )}
      </section>

      <dl style={styles.debugPanel}>
        <DebugRow label="FRAMES_EXTRACTED" value={debug.FRAMES_EXTRACTED} />
        <DebugRow label="BASKETBALL_DETECTIONS" value={debug.BASKETBALL_DETECTIONS} />
        <DebugRow label="BALL_TRACK_COUNT" value={debug.BALL_TRACK_COUNT} />
        <DebugRow label="CURRENT_BALL_X" value={debug.CURRENT_BALL_X} />
        <DebugRow label="CURRENT_BALL_Y" value={debug.CURRENT_BALL_Y} />
        <DebugRow label="CURRENT_CONFIDENCE" value={debug.CURRENT_CONFIDENCE} />
        <DebugRow label="FAILED_STAGE" value={debug.FAILED_STAGE} />
        <DebugRow label="ERROR_MESSAGE" value={debug.ERROR_MESSAGE} />
        <DebugRow label="FIRST_FRAME" value={debug.FIRST_FRAME} />
        <DebugRow label="LAST_FRAME" value={debug.LAST_FRAME} />
      </dl>

      {status === "processing" ? <p style={styles.status}>Processing...</p> : null}
      {status === "failed" ? <p style={styles.error}>{error || "Ball debug failed."}</p> : null}

      <input
        ref={inputRef}
        accept="video/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleUpload(file);
        }}
        type="file"
      />
    </main>
  );
}

async function createMuxUpload() {
  const response = await fetch("/api/film/uploads", { method: "POST" });
  const result = (await response.json().catch(() => null)) as MuxUploadResponse | null;
  if (!response.ok || !result?.uploadId || !result.uploadUrl) throw new Error("Mux upload could not be created.");
  return result;
}

function uploadFileToMux(file: File, uploadUrl: string) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: uploadUrl,
      metadata: {
        filename: file.name || "axis-video.mp4",
        filetype: file.type || "video/mp4",
      },
      onError: (uploadError) => reject(uploadError),
      onSuccess: () => resolve(),
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000],
      uploadSize: file.size,
    });
    upload.start();
  });
}

async function waitForMuxPlayback(uploadId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`/api/film/uploads/${encodeURIComponent(uploadId)}`);
    const result = (await response.json().catch(() => null)) as MuxReadyResponse | null;
    if (response.ok && result?.ready && result.playbackId) return result;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Mux playback was not ready.");
}

function DebugRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={styles.debugRow}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function getNearestTrackPoint(track: BallTrackPoint[], currentTime: number) {
  let nearest: { distance: number; index: number; point: BallTrackPoint } | null = null;

  for (let index = 0; index < track.length; index += 1) {
    const point = track[index];
    const distance = Math.abs(point.time - currentTime);
    if (!nearest || distance < nearest.distance) nearest = { distance, index, point };
  }

  if (!nearest || nearest.distance > 0.35) return null;
  return nearest;
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  track: BallTrackPoint[],
  currentIndex: number,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const points = track
    .slice(Math.max(0, currentIndex - trailLength), currentIndex)
    .filter((point) => normalizeConfidence(point.confidence) >= confidenceThreshold);

  points.forEach((point, index) => {
    const mapped = mapPointToVideo(point, video, width, height);
    const fade = (index + 1) / Math.max(1, points.length);

    ctx.save();
    ctx.globalAlpha = fade * 0.48;
    ctx.shadowColor = "rgba(42,255,91,0.95)";
    ctx.shadowBlur = 12 + fade * 18;
    ctx.fillStyle = "rgba(42,255,91,0.95)";
    ctx.beginPath();
    ctx.arc(mapped.x, mapped.y, 3 + fade * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  point: BallTrackPoint,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const mapped = mapPointToVideo(point, video, width, height);
  const confidence = normalizeConfidence(point.confidence);

  ctx.save();
  ctx.globalAlpha = Math.max(0.28, confidence * 0.62);
  ctx.shadowColor = "rgba(42,255,91,1)";
  ctx.shadowBlur = 48;
  ctx.fillStyle = "rgba(42,255,91,0.38)";
  ctx.beginPath();
  ctx.arc(mapped.x, mapped.y, 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = Math.max(0.66, confidence);
  ctx.shadowBlur = 24;
  ctx.fillStyle = "rgba(42,255,91,1)";
  ctx.beginPath();
  ctx.arc(mapped.x, mapped.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function mapPointToVideo(
  point: Pick<BallTrackPoint, "x" | "y">,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const videoWidth = video.videoWidth || width;
  const videoHeight = video.videoHeight || height;
  const scale = Math.min(width / videoWidth, height / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;

  return {
    x: (width - drawWidth) / 2 + point.x * scale,
    y: (height - drawHeight) / 2 + point.y * scale,
  };
}

function normalizeConfidence(confidence: number) {
  return confidence > 1 ? confidence / 100 : confidence;
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : "N/A";
}

const styles = {
  canvas: {
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
  },
  debugPanel: {
    borderTop: "1px solid rgba(184,219,77,0.28)",
    display: "grid",
    margin: 0,
    width: "min(960px, 100%)",
  },
  debugRow: {
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    color: "#f3f4ef",
    display: "flex",
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: 12,
    justifyContent: "space-between",
    letterSpacing: 0,
    padding: "10px 0",
  },
  empty: {
    alignItems: "center",
    color: "rgba(243,244,239,0.5)",
    display: "flex",
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: 12,
    height: "100%",
    justifyContent: "center",
    textTransform: "uppercase",
  },
  error: {
    color: "#ff6678",
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: 12,
    margin: 0,
  },
  page: {
    alignItems: "center",
    background: "#020303",
    color: "#f3f4ef",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    minHeight: "100vh",
    padding: 20,
  },
  stage: {
    aspectRatio: "16 / 9",
    background: "#080a09",
    border: "1px solid rgba(255,255,255,0.12)",
    position: "relative",
    width: "min(960px, 100%)",
  },
  status: {
    color: "#b8db4d",
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: 12,
    margin: 0,
  },
  uploadButton: {
    background: "#b8db4d",
    border: 0,
    color: "#020303",
    cursor: "pointer",
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: 12,
    fontWeight: 800,
    padding: "12px 18px",
    textTransform: "uppercase",
  },
  video: {
    display: "block",
    height: "100%",
    objectFit: "contain",
    width: "100%",
  },
} satisfies Record<string, React.CSSProperties>;
