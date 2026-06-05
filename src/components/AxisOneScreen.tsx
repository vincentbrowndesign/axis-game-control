"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AppState = "choose" | "complete" | "failed" | "processing" | "replay";
type VisibleStage =
  | "Building Track"
  | "Detecting Basketball"
  | "Extracting Frames"
  | "Rendering Replay"
  | "Uploading";

type BallTrackPoint = {
  confidence: number;
  frame: number;
  time: number;
  x: number;
  y: number;
};

type BallJobResponse = {
  ballTrack?: BallTrackPoint[];
  ballTrackCount?: number;
  detectionCount?: number;
  error?: string;
  frameCount?: number;
  jobId?: string;
  processingStage?: string;
  status?: "failed" | "processing" | "ready";
  videoUrl?: string;
};

type MuxUploadResponse = {
  error?: string;
  message?: string;
  uploadId?: string;
};

type MuxReadyResponse = {
  playbackId?: string;
  ready?: boolean;
};

const confidenceThreshold = 0.35;
const trailLength = 20;

export function AxisOneScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);
  const timerStartedAtRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const [state, setState] = useState<AppState>("choose");
  const [stage, setStage] = useState<VisibleStage>("Uploading");
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
    if (!canvas || !video || !ctx || state !== "replay") return;

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
    if (nearest && normalizeConfidence(nearest.point.confidence) >= confidenceThreshold) {
      drawTrail(ctx, sortedTrack, nearest.index, video, width, height);
      drawGlow(ctx, nearest.point, video, width, height);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [sortedTrack, state]);

  useEffect(() => {
    if (state !== "processing") return;

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((performance.now() - timerStartedAtRef.current) / 1000));
    }, 250);

    return () => window.clearInterval(interval);
  }, [state]);

  useEffect(() => {
    if (state !== "replay") return;
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw, state]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!jobId || state !== "processing") return;

    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/axis/ball-job/${encodeURIComponent(jobId)}`);
        const result = (await response.json().catch(() => null)) as BallJobResponse | null;
        if (cancelled || !result) return;
        if (!response.ok) throw new Error(result.error ?? "Processing failed.");

        setStage(stageFromJob(result.processingStage));

        if (result.status === "failed") throw new Error(result.error ?? "Processing failed.");
        if (result.status !== "ready") return;

        const nextTrack = Array.isArray(result.ballTrack) ? result.ballTrack : [];
        setTrack(nextTrack);
        setStage("Rendering Replay");
        setElapsedSeconds(Math.floor((performance.now() - timerStartedAtRef.current) / 1000));
        setState("complete");
        window.clearInterval(interval);
      } catch (nextError) {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "Processing failed.");
        setElapsedSeconds(Math.floor((performance.now() - timerStartedAtRef.current) / 1000));
        setState("failed");
        window.clearInterval(interval);
      }
    }, 1800);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [jobId, state]);

  async function handleFile(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const localVideoUrl = URL.createObjectURL(file);
    objectUrlRef.current = localVideoUrl;
    setVideoUrl(localVideoUrl);
    setTrack([]);
    setError("");
    setJobId("");
    setElapsedSeconds(0);
    setStage("Uploading");
    timerStartedAtRef.current = performance.now();
    setState("processing");

    try {
      console.info("UPLOAD_FLOW_SELECTED", "SERVER_TO_MUX");
      const mux = await uploadFileToMuxServer(file);
      if (!mux.uploadId) throw new Error("Upload could not be created.");

      setStage("Extracting Frames");
      console.info("PROCESSING_START", { uploadId: mux.uploadId });
      const ready = await waitForMuxPlayback(mux.uploadId);
      if (!ready.playbackId) throw new Error("Video storage was not ready.");

      const response = await fetch("/api/axis/ball-debug-v2", {
        body: JSON.stringify({
          muxPlaybackId: ready.playbackId,
          muxUploadId: mux.uploadId,
          videoUrl: `https://stream.mux.com/${ready.playbackId}.m3u8`,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as BallJobResponse | null;
      if (!response.ok || !result?.jobId) throw new Error(result?.error ?? "Processing job could not be created.");
      setJobId(result.jobId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Processing failed.");
      setElapsedSeconds(Math.floor((performance.now() - timerStartedAtRef.current) / 1000));
      setState("failed");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <main className="axis-one-screen" data-state={state}>
      {state === "choose" ? (
        <button className="axis-one-choose" onClick={() => inputRef.current?.click()} type="button">
          Choose File
        </button>
      ) : null}

      {state === "processing" || state === "failed" ? (
        <section className="axis-one-processing" aria-live="polite">
          <strong>{state === "failed" ? "PROCESSING FAILED" : "PROCESSING VIDEO"}</strong>
          <time>{formatElapsed(elapsedSeconds)}</time>
          <span>{state === "failed" ? error || "Try Again" : stage}</span>
          {state === "failed" ? (
            <button className="axis-one-small-button" onClick={() => inputRef.current?.click()} type="button">
              Choose File
            </button>
          ) : null}
        </section>
      ) : null}

      {state === "complete" ? (
        <section className="axis-one-complete">
          <time>{formatElapsed(elapsedSeconds)}</time>
          <button className="axis-one-view" onClick={() => setState("replay")} type="button">
            View Replay
          </button>
        </section>
      ) : null}

      {state === "replay" ? (
        <section className="axis-one-replay" aria-label="Replay">
          <video
            autoPlay
            className="axis-one-video"
            controls
            onLoadedMetadata={draw}
            onPlay={draw}
            onSeeked={draw}
            onTimeUpdate={draw}
            playsInline
            ref={videoRef}
            src={videoUrl}
          />
          <canvas aria-hidden="true" className="axis-one-canvas" ref={canvasRef} />
        </section>
      ) : null}

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

async function uploadFileToMuxServer(file: File) {
  console.info("UPLOAD_START", {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    route: "/api/film/uploads/server",
  });

  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/film/uploads/server", {
    body: form,
    method: "POST",
  });
  const result = (await response.json().catch(() => null)) as MuxUploadResponse | null;

  if (!response.ok || !result?.uploadId) {
    throw new Error(result?.message ?? result?.error ?? "Upload endpoint unavailable.");
  }

  console.info("UPLOAD_COMPLETE", {
    route: "/api/film/uploads/server",
    uploadId: result.uploadId,
  });

  return result;
}

async function waitForMuxPlayback(uploadId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`/api/film/uploads/${encodeURIComponent(uploadId)}`);
    const result = (await response.json().catch(() => null)) as MuxReadyResponse | null;
    if (response.ok && result?.ready && result.playbackId) return result;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Video storage was not ready.");
}

function stageFromJob(stage: unknown): VisibleStage {
  if (stage === "extracting_frames") return "Extracting Frames";
  if (stage === "detecting_basketball") return "Detecting Basketball";
  if (stage === "building_track") return "Building Track";
  if (stage === "rendering_replay" || stage === "complete") return "Rendering Replay";
  return "Uploading";
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
    ctx.globalAlpha = fade * 0.52;
    ctx.shadowColor = "rgba(42,255,91,0.95)";
    ctx.shadowBlur = 14 + fade * 22;
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
  ctx.globalAlpha = Math.max(0.3, confidence * 0.7);
  ctx.shadowColor = "rgba(42,255,91,1)";
  ctx.shadowBlur = 54;
  ctx.fillStyle = "rgba(42,255,91,0.35)";
  ctx.beginPath();
  ctx.arc(mapped.x, mapped.y, 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = Math.max(0.72, confidence);
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
