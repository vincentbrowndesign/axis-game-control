"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BallTrackPoint = {
  confidence: number;
  frame: number;
  time: number;
  x: number;
  y: number;
};

type AxisBallResponse = {
  ball_track?: BallTrackPoint[];
  debug?: Partial<DebugState>;
  error?: string;
  videoUrl?: string;
};

type DebugState = {
  BALL_CONFIDENCE: string;
  BALL_TRACK_COUNT: number;
  BASKETBALL_DETECTIONS: number;
  CURRENT_BALL_X: string;
  CURRENT_BALL_Y: string;
  DETECTIONS_RETURNED: number;
  FRAMES_EXTRACTED: number;
  FRAMES_SENT_TO_ROBOFLOW: number;
};

const emptyDebug: DebugState = {
  BALL_CONFIDENCE: "N/A",
  BALL_TRACK_COUNT: 0,
  BASKETBALL_DETECTIONS: 0,
  CURRENT_BALL_X: "N/A",
  CURRENT_BALL_Y: "N/A",
  DETECTIONS_RETURNED: 0,
  FRAMES_EXTRACTED: 0,
  FRAMES_SENT_TO_ROBOFLOW: 0,
};

const confidenceThreshold = 0.35;
const trailLength = 12;

export default function AxisBallPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [debug, setDebug] = useState<DebugState>(emptyDebug);
  const [error, setError] = useState("");
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
        BALL_CONFIDENCE: "N/A",
        CURRENT_BALL_X: "N/A",
        CURRENT_BALL_Y: "N/A",
      }));
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    drawTrail(ctx, sortedTrack, nearest.index, video, width, height);
    drawGlow(ctx, nearest.point, video, width, height);

    setDebug((current) => ({
      ...current,
      BALL_CONFIDENCE: formatNumber(nearest.point.confidence),
      CURRENT_BALL_X: formatNumber(nearest.point.x),
      CURRENT_BALL_Y: formatNumber(nearest.point.y),
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

  async function handleUpload(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const localVideoUrl = URL.createObjectURL(file);
    objectUrlRef.current = localVideoUrl;
    setVideoUrl(localVideoUrl);
    setTrack([]);
    setDebug(emptyDebug);
    setError("");
    setStatus("processing");

    try {
      const response = await fetch("/api/axis/ball/process", {
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-axis-file-name": encodeURIComponent(file.name || "upload.mp4"),
          "x-axis-file-size": String(file.size),
        },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as AxisBallResponse | null;
      if (!response.ok || !result) throw new Error(result?.error ?? "Axis Ball failed.");

      const nextTrack = Array.isArray(result.ball_track) ? result.ball_track : [];
      setTrack(nextTrack);
      setDebug({
        BALL_CONFIDENCE: "N/A",
        BALL_TRACK_COUNT: nextTrack.length,
        BASKETBALL_DETECTIONS: getDebugNumber(result.debug?.BASKETBALL_DETECTIONS),
        CURRENT_BALL_X: "N/A",
        CURRENT_BALL_Y: "N/A",
        DETECTIONS_RETURNED: getDebugNumber(result.debug?.DETECTIONS_RETURNED),
        FRAMES_EXTRACTED: getDebugNumber(result.debug?.FRAMES_EXTRACTED),
        FRAMES_SENT_TO_ROBOFLOW: getDebugNumber(result.debug?.FRAMES_SENT_TO_ROBOFLOW),
      });
      setStatus("ready");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Axis Ball failed.");
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

      <section style={styles.stage} aria-label="Axis Ball Engine V1">
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
        <DebugRow label="FRAMES_SENT_TO_ROBOFLOW" value={debug.FRAMES_SENT_TO_ROBOFLOW} />
        <DebugRow label="DETECTIONS_RETURNED" value={debug.DETECTIONS_RETURNED} />
        <DebugRow label="BASKETBALL_DETECTIONS" value={debug.BASKETBALL_DETECTIONS} />
        <DebugRow label="BALL_TRACK_COUNT" value={debug.BALL_TRACK_COUNT} />
        <DebugRow label="CURRENT_BALL_X" value={debug.CURRENT_BALL_X} />
        <DebugRow label="CURRENT_BALL_Y" value={debug.CURRENT_BALL_Y} />
        <DebugRow label="BALL_CONFIDENCE" value={debug.BALL_CONFIDENCE} />
      </dl>

      {status === "processing" ? <p style={styles.status}>Processing...</p> : null}
      {status === "failed" ? <p style={styles.error}>{error || "Axis Ball failed."}</p> : null}

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

function getDebugNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
