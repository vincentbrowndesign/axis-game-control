"use client";

import * as tus from "tus-js-client";
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
  expiresAt?: string | null;
  message?: string;
  stack?: string | null;
  stage?: string;
  uploadId?: string;
  uploadUrl?: string;
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
      const mux = await createMuxUpload();
      if (!mux.uploadId || !mux.uploadUrl) throw new Error("Upload could not be created.");
      await uploadFileToMux(file, mux.uploadUrl);

      setStage("Extracting Frames");
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

async function createMuxUpload() {
  const response = await fetch("/api/film/uploads", { method: "POST" });
  const result = (await response.json().catch(() => null)) as MuxUploadResponse | null;
  console.info("MUX_UPLOAD_CREATE_RESPONSE", {
    body: result,
    ok: response.ok,
    responseHeaders: headersToObject(response.headers),
    status: response.status,
  });
  if (!response.ok || !result?.uploadId || !result.uploadUrl) {
    const failure = {
      error: result?.error ?? "MuxUploadCreateError",
      message: result?.message ?? "Upload could not be created.",
      stack: result?.stack ?? null,
      stage: result?.stage ?? "mux_upload_create",
    };
    console.error("MUX_UPLOAD_BROWSER_FAILED", failure);
    throw new Error(failure.message);
  }
  console.info("MUX_UPLOAD_ID", result.uploadId);
  console.info("MUX_UPLOAD_URL", {
    expiresAt: result.expiresAt ?? null,
    uploadId: result.uploadId,
    uploadUrl: result.uploadUrl,
  });
  return result;
}

function uploadFileToMux(file: File, uploadUrl: string) {
  return new Promise<void>((resolve, reject) => {
    const metadata = {
      filename: file.name || "axis-video.mp4",
      filetype: file.type || "video/mp4",
    };
    const tusConfiguration = {
      endpoint: uploadUrl,
      metadata,
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000],
      uploadSize: file.size,
    };
    console.info("MUX_UPLOAD_BROWSER_START", {
      browserUploadConfiguration: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      },
      tusConfiguration,
      uploadUrl,
    });

    const upload = new tus.Upload(file, {
      endpoint: uploadUrl,
      metadata,
      onAfterResponse: (request, response) => {
        console.info("MUX_UPLOAD_BROWSER_RESPONSE", {
          requestHeaders: getTusRequestHeaders(request),
          requestMethod: request.getMethod(),
          requestUrl: request.getURL(),
          responseBody: response.getBody(),
          responseHeaders: getTusResponseHeaders(response),
          status: response.getStatus(),
        });
      },
      onBeforeRequest: (request) => {
        console.info("MUX_UPLOAD_BROWSER_REQUEST", {
          requestHeaders: getTusRequestHeaders(request),
          requestMethod: request.getMethod(),
          requestUrl: request.getURL(),
        });
      },
      onError: (uploadError) => {
        const failure = serializeBrowserFailure("mux_upload_browser_tus", uploadError);
        console.error("MUX_UPLOAD_BROWSER_FAILED", failure);
        reject(uploadError);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        console.info("MUX_UPLOAD_BROWSER_PROGRESS", {
          bytesTotal,
          bytesUploaded,
          percent: bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 10000) / 100 : null,
        });
      },
      onSuccess: () => {
        console.info("MUX_UPLOAD_BROWSER_COMPLETE", {
          uploadUrl,
        });
        resolve();
      },
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000],
      uploadSize: file.size,
    });
    upload.start();
  });
}

function getTusRequestHeaders(request: tus.HttpRequest) {
  return {
    "Content-Type": request.getHeader("Content-Type"),
    "Tus-Resumable": request.getHeader("Tus-Resumable"),
    "Upload-Length": request.getHeader("Upload-Length"),
    "Upload-Metadata": request.getHeader("Upload-Metadata"),
    "Upload-Offset": request.getHeader("Upload-Offset"),
  };
}

function getTusResponseHeaders(response: tus.HttpResponse) {
  return {
    Location: response.getHeader("Location"),
    "Tus-Resumable": response.getHeader("Tus-Resumable"),
    "Upload-Offset": response.getHeader("Upload-Offset"),
  };
}

function headersToObject(headers: Headers) {
  return Object.fromEntries(headers.entries());
}

function serializeBrowserFailure(stage: string, error: unknown) {
  const detailed = error as Partial<tus.DetailedError> & Error;
  return {
    error: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    requestHeaders: detailed.originalRequest ? getTusRequestHeaders(detailed.originalRequest) : null,
    requestMethod: detailed.originalRequest?.getMethod?.() ?? null,
    requestUrl: detailed.originalRequest?.getURL?.() ?? null,
    responseBody: detailed.originalResponse?.getBody?.() ?? null,
    responseHeaders: detailed.originalResponse ? getTusResponseHeaders(detailed.originalResponse) : null,
    responseStatus: detailed.originalResponse?.getStatus?.() ?? null,
    stack: error instanceof Error ? error.stack ?? null : null,
    stage,
  };
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
