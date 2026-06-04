"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BallTrackPoint = {
  confidence: number;
  frame: number;
  time: number;
  x: number;
  y: number;
};

type BallDebugResponse = {
  BASKETBALL_DETECTIONS?: number;
  BALL_TRACK_COUNT?: number;
  FRAMES_EXTRACTED?: number;
  PLAYER_TRACK_COUNT?: number;
  ball_track?: BallTrackPoint[];
  error?: string;
  player_tracks?: PlayerTrackPoint[];
};

type PlayerTrackPoint = {
  confidence: number;
  frame: number;
  id: string;
  x: number;
  y: number;
};

type DebugState = {
  BALL_CONFIDENCE: string;
  BALL_TRACK_COUNT: number;
  BASKETBALL_DETECTIONS: number;
  CURRENT_BALL_X: string;
  CURRENT_BALL_Y: string;
  FIRST_FRAME: string;
  FRAMES_EXTRACTED: number;
  LAST_FRAME: string;
  PLAYER_TRACK_COUNT: number;
};

const emptyDebug: DebugState = {
  BALL_CONFIDENCE: "n/a",
  BALL_TRACK_COUNT: 0,
  BASKETBALL_DETECTIONS: 0,
  CURRENT_BALL_X: "n/a",
  CURRENT_BALL_Y: "n/a",
  FIRST_FRAME: "n/a",
  FRAMES_EXTRACTED: 0,
  LAST_FRAME: "n/a",
  PLAYER_TRACK_COUNT: 0,
};

const BALL_CONFIDENCE_THRESHOLD = 0.35;
const TRAIL_POINT_COUNT = 20;

export default function BallDebugPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const objectUrlRef = useRef<string | null>(null);
  const [debug, setDebug] = useState<DebugState>(emptyDebug);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "processing" | "ready" | "failed">("idle");
  const [playerTracks, setPlayerTracks] = useState<PlayerTrackPoint[]>([]);
  const [track, setTrack] = useState<BallTrackPoint[]>([]);
  const [videoUrl, setVideoUrl] = useState("");

  const sortedTrack = useMemo(
    () => [...track].sort((a, b) => a.time - b.time || a.frame - b.frame),
    [track],
  );

  const paint = useCallback(() => {
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

    const currentBall = getNearestTrackPoint(sortedTrack, video.currentTime);
    drawPlayerTracks(ctx, playerTracks, video, width, height);
    if (!currentBall) {
      setDebug((current) => ({
        ...current,
        BALL_CONFIDENCE: "n/a",
        CURRENT_BALL_X: "n/a",
        CURRENT_BALL_Y: "n/a",
      }));
      rafRef.current = requestAnimationFrame(paint);
      return;
    }

    drawBallTrail(ctx, sortedTrack, currentBall.index, video, width, height);
    drawBallGlow(ctx, currentBall.point, video, width, height);

    setDebug((current) => ({
      ...current,
      BALL_CONFIDENCE: formatNumber(currentBall.point.confidence),
      CURRENT_BALL_X: formatNumber(currentBall.point.x),
      CURRENT_BALL_Y: formatNumber(currentBall.point.y),
    }));

    rafRef.current = requestAnimationFrame(paint);
  }, [sortedTrack]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(paint);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [paint]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function handleFile(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current = localUrl;
    setVideoUrl(localUrl);
    setTrack([]);
    setPlayerTracks([]);
    setDebug(emptyDebug);
    setError("");
    setStatus("processing");

    const form = new FormData();
    form.append("video", file);

    try {
      const response = await fetch("/api/axis/ball-debug", {
        body: form,
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as BallDebugResponse | null;
      if (!response.ok || !result) throw new Error(result?.error ?? "Ball debug failed.");

      const nextTrack = Array.isArray(result.ball_track) ? result.ball_track : [];
      const nextPlayerTracks = Array.isArray(result.player_tracks) ? result.player_tracks : [];
      setTrack(nextTrack);
      setPlayerTracks(nextPlayerTracks);
      setDebug({
        BALL_CONFIDENCE: "n/a",
        BALL_TRACK_COUNT: result.BALL_TRACK_COUNT ?? nextTrack.length,
        BASKETBALL_DETECTIONS: result.BASKETBALL_DETECTIONS ?? 0,
        CURRENT_BALL_X: "n/a",
        CURRENT_BALL_Y: "n/a",
        FIRST_FRAME: getTrackFrameLabel(nextTrack, "first"),
        FRAMES_EXTRACTED: result.FRAMES_EXTRACTED ?? 0,
        LAST_FRAME: getTrackFrameLabel(nextTrack, "last"),
        PLAYER_TRACK_COUNT: result.PLAYER_TRACK_COUNT ?? nextPlayerTracks.length,
      });
      setStatus("ready");
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
        Upload Button
      </button>

      <section style={styles.stage} aria-label="Ball tracking proof">
        {videoUrl ? (
          <>
            <video
              controls
              onLoadedMetadata={paint}
              onPlay={paint}
              onSeeked={paint}
              onTimeUpdate={paint}
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
        <DebugRow label="BALL_TRACK_COUNT" value={debug.BALL_TRACK_COUNT} />
        <DebugRow label="PLAYER_TRACK_COUNT" value={debug.PLAYER_TRACK_COUNT} />
        <DebugRow label="FIRST_FRAME" value={debug.FIRST_FRAME} />
        <DebugRow label="LAST_FRAME" value={debug.LAST_FRAME} />
        <DebugRow label="CURRENT_BALL_X" value={debug.CURRENT_BALL_X} />
        <DebugRow label="CURRENT_BALL_Y" value={debug.CURRENT_BALL_Y} />
        <DebugRow label="BALL_CONFIDENCE" value={debug.BALL_CONFIDENCE} />
      </dl>

      {status === "processing" ? <p style={styles.status}>Processing...</p> : null}
      {status === "failed" ? <p style={styles.error}>{error || "Ball debug failed."}</p> : null}

      <input
        ref={inputRef}
        accept="video/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
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
  let best: { distance: number; index: number; point: BallTrackPoint } | null = null;

  for (let index = 0; index < track.length; index += 1) {
    const point = track[index];
    const confidence = normalizeConfidence(point.confidence);
    if (confidence < BALL_CONFIDENCE_THRESHOLD) continue;
    const distance = Math.abs(point.time - currentTime);
    if (!best || distance < best.distance) best = { distance, index, point };
  }

  if (!best || best.distance > 0.35) return null;
  return best;
}

function drawBallTrail(
  ctx: CanvasRenderingContext2D,
  track: BallTrackPoint[],
  currentIndex: number,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const previousPoints = track
    .slice(Math.max(0, currentIndex - TRAIL_POINT_COUNT), currentIndex)
    .filter((point) => normalizeConfidence(point.confidence) >= BALL_CONFIDENCE_THRESHOLD);

  previousPoints.forEach((point, index) => {
    const mapped = mapVideoPointToCanvas(point, video, width, height);
    const ageFade = (index + 1) / Math.max(1, previousPoints.length);
    const confidence = normalizeConfidence(point.confidence);
    const radius = 4 + ageFade * 9;

    ctx.save();
    ctx.globalAlpha = Math.max(0.08, ageFade * confidence * 0.62);
    ctx.shadowColor = "rgba(42,255,91,0.95)";
    ctx.shadowBlur = 18 + ageFade * 18;
    ctx.fillStyle = "rgba(42,255,91,0.95)";
    ctx.beginPath();
    ctx.arc(mapped.x, mapped.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawBallGlow(
  ctx: CanvasRenderingContext2D,
  point: BallTrackPoint,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const mapped = mapVideoPointToCanvas(point, video, width, height);
  const confidence = normalizeConfidence(point.confidence);

  ctx.save();
  ctx.globalAlpha = Math.max(0.25, confidence * 0.55);
  ctx.shadowColor = "rgba(42,255,91,1)";
  ctx.shadowBlur = 46;
  ctx.fillStyle = "rgba(42,255,91,0.42)";
  ctx.beginPath();
  ctx.arc(mapped.x, mapped.y, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = Math.max(0.5, confidence);
  ctx.shadowBlur = 26;
  ctx.fillStyle = "rgba(42,255,91,0.98)";
  ctx.beginPath();
  ctx.arc(mapped.x, mapped.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayerTracks(
  ctx: CanvasRenderingContext2D,
  playerTracks: PlayerTrackPoint[],
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  if (!playerTracks.length) return;
  const frame = Math.max(1, Math.round(video.currentTime / 0.1) + 1);
  const byPlayer = new Map<string, PlayerTrackPoint[]>();

  for (const point of playerTracks) {
    const list = byPlayer.get(point.id) ?? [];
    list.push(point);
    byPlayer.set(point.id, list);
  }

  for (const list of byPlayer.values()) {
    const current = getNearestPlayerPoint(list, frame);
    if (!current || normalizeConfidence(current.confidence) < BALL_CONFIDENCE_THRESHOLD) continue;
    const mapped = mapVideoPointToCanvas(current, video, width, height);

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = "rgba(255,255,255,0.95)";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mapped.x, mapped.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.beginPath();
    ctx.arc(mapped.x, mapped.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function getNearestPlayerPoint(track: PlayerTrackPoint[], frame: number) {
  let best: { distance: number; point: PlayerTrackPoint } | null = null;

  for (const point of track) {
    const distance = Math.abs(point.frame - frame);
    if (!best || distance < best.distance) best = { distance, point };
  }

  if (!best || best.distance > 4) return null;
  return best.point;
}

function getTrackFrameLabel(track: BallTrackPoint[], edge: "first" | "last") {
  if (!track.length) return "n/a";
  const sorted = [...track].sort((a, b) => a.frame - b.frame);
  return String(edge === "first" ? sorted[0].frame : sorted[sorted.length - 1].frame);
}

function mapVideoPointToCanvas(
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
  return Number.isFinite(value) ? value.toFixed(3) : "n/a";
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
    gap: 0,
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
    textTransform: "uppercase",
  },
  empty: {
    alignItems: "center",
    color: "rgba(243,244,239,0.54)",
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
