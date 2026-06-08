"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { axisAuthenticatedFetch } from "../lib/axis-client-auth";
import {
  createAxisOverlayEngineState,
  renderAxisOverlayFrame,
  resetAxisOverlayEngineState,
  type AxisOverlayFrame,
} from "../lib/axis-overlay-engine";

type AppState = "choose" | "complete" | "failed" | "processing" | "replay" | "selected";
type VisibleStage =
  | "Detecting Ball"
  | "Detecting Players"
  | "Extracting Frames"
  | "Generating Replay"
  | "Rendering Replay"
  | "Tracking Objects"
  | "Uploading";

type BallTrackPoint = {
  confidence: number;
  frame: number;
  sourceHeight?: number;
  sourceWidth?: number;
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
  status?:
    | "axis_processing"
    | "failed"
    | "ready_for_axis_processing"
    | "replay_ready"
    | "stream_processing"
    | "uploaded"
    | "uploading";
  videoUrl?: string;
};

type VideoUploadUrlResponse = {
  cloudflareUid?: string;
  contentType?: string;
  error?: string;
  fileSize?: number;
  filename?: string;
  jobId?: string;
  message?: string;
  uploadURL?: string;
};

type VideoJobResponse = {
  cloudflareUid?: string;
  error?: string;
  jobId?: string;
  status?: BallJobResponse["status"];
};

const confidenceThreshold = 0.35;
const recentReplays = [
  { label: "Replay 01", meta: "Ready" },
  { label: "Replay 02", meta: "Overlay" },
  { label: "Replay 03", meta: "Saved" },
];

export function AxisOneScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const overlayStateRef = useRef(createAxisOverlayEngineState());
  const rafRef = useRef<number>(0);
  const recordInputRef = useRef<HTMLInputElement>(null);
  const timerStartedAtRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const [saveUrl, setSaveUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

    const nearest = getNearestTrackPoint(sortedTrack, video.currentTime);
    const sourceWidth = nearest?.point.sourceWidth || video.videoWidth || width;
    const sourceHeight = nearest?.point.sourceHeight || video.videoHeight || height;
    const frame: AxisOverlayFrame = {
      ball: nearest?.point,
      players: [],
      timestamp: video.currentTime,
    };
    renderAxisOverlayFrame({
      canvasHeight: height,
      canvasWidth: width,
      ctx,
      frame,
      options: {
        confidenceThreshold,
        coordinateSpace: "video",
        fit: "contain",
        sourceHeight,
        sourceWidth,
      },
      state: overlayStateRef.current,
    });

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
        const route = `/api/axis/video-job/${encodeURIComponent(jobId)}`;
        const response = await axisAuthenticatedFetch(route);
        const result = (await response.json().catch(() => null)) as BallJobResponse | null;
        if (response.status === 401) {
          console.info("AXIS_AUTH_401_RESPONSE", {
            body: result,
            route,
          });
        }
        if (cancelled || !result) return;
        if (!response.ok) throw new Error(result.error ?? "Processing failed.");

        setStage(stageFromJob(result.processingStage));

        if (result.status === "failed") throw new Error(result.error ?? "Processing failed.");
        if (result.status !== "replay_ready") return;

        const nextTrack = Array.isArray(result.ballTrack) ? result.ballTrack : [];
        setTrack(nextTrack);
        if (result.videoUrl) {
          setVideoUrl(result.videoUrl);
          setSaveUrl(result.videoUrl);
        }
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

  function handleFile(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const localVideoUrl = URL.createObjectURL(file);
    objectUrlRef.current = localVideoUrl;
    setVideoUrl(localVideoUrl);
    setTrack([]);
    setSaveUrl("");
    setError("");
    setJobId("");
    setElapsedSeconds(0);
    setSelectedFile(file);
    resetAxisOverlayEngineState(overlayStateRef.current);
    setState("selected");
  }

  async function handleGenerateReplay() {
    const file = selectedFile;
    if (!file) return;
    setStage("Uploading");
    timerStartedAtRef.current = performance.now();
    setState("processing");

    try {
      console.info("UPLOAD_FLOW_SELECTED", "CLOUDFLARE_STREAM_DIRECT");
      const upload = await createVideoUploadUrl(file);
      await uploadFileToCloudflare(file, upload);

      setStage("Uploading");
      console.info("PROCESSING_START", { cloudflareUid: upload.cloudflareUid, jobId: upload.jobId });
      const route = "/api/axis/video-job";
      const response = await axisAuthenticatedFetch(route, {
        body: JSON.stringify({
          cloudflareUid: upload.cloudflareUid,
          fileSize: file.size,
          filename: file.name || "axis-video.mp4",
          jobId: upload.jobId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as VideoJobResponse | null;
      if (response.status === 401) {
        console.info("AXIS_AUTH_401_RESPONSE", {
          body: result,
          route,
        });
      }
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
      <header className="axis-one-header" aria-label="Axis home">
        <span>AXIS</span>
        <strong>{state === "processing" ? stage : "Camera Roll + Live Replay"}</strong>
      </header>

      {state === "choose" ? (
        <section className="axis-one-camera" aria-label="Create replay">
          <button className="axis-one-record" onClick={() => recordInputRef.current?.click()} type="button" aria-label="Record live replay">
            <span />
            RECORD
          </button>
          <button className="axis-one-select" onClick={() => inputRef.current?.click()} type="button">
            SELECT VIDEO
          </button>
        </section>
      ) : null}

      {state === "selected" ? (
        <section className="axis-one-status">
          <span>{selectedFile?.name || "Video selected"}</span>
          <button className="axis-one-primary" onClick={() => void handleGenerateReplay()} type="button">
            GENERATE REPLAY
          </button>
          <button className="axis-one-secondary" onClick={() => inputRef.current?.click()} type="button">
            SELECT ANOTHER
          </button>
        </section>
      ) : null}

      {state === "processing" || state === "failed" ? (
        <section className="axis-one-processing" aria-live="polite">
          <strong>{state === "failed" ? "PROCESSING FAILED" : "PROCESSING VIDEO"}</strong>
          <time>{formatElapsed(elapsedSeconds)}</time>
          <span>{state === "failed" ? error || "Try Again" : stage}</span>
          {state === "failed" ? (
            <button className="axis-one-secondary" onClick={() => inputRef.current?.click()} type="button">
              SELECT VIDEO
            </button>
          ) : null}
        </section>
      ) : null}

      {state === "complete" ? (
        <section className="axis-one-status">
          <time>{formatElapsed(elapsedSeconds)}</time>
          <button className="axis-one-primary" onClick={() => setState("replay")} type="button">
            PREVIEW REPLAY
          </button>
          <button className="axis-one-secondary" onClick={() => inputRef.current?.click()} type="button">
            SELECT VIDEO
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
          {saveUrl ? (
            <a className="axis-one-save" download href={saveUrl}>
              SAVE VIDEO
            </a>
          ) : null}
        </section>
      ) : null}

      {state !== "replay" ? (
        <section className="axis-one-recent" aria-label="Recent replays">
          <div className="axis-one-recent-head">
            <span>Recent Replay</span>
          </div>
          <div className="axis-one-recent-grid">
            {recentReplays.map((replay, index) => (
              <article className="axis-one-thumb" key={replay.label}>
                <div>
                  <span className="axis-one-thumb-ring" />
                  <span className="axis-one-thumb-ball" />
                  <span className="axis-one-thumb-trail" />
                </div>
                <strong>{replay.label}</strong>
                <em>{index === 0 && state === "complete" ? "New" : replay.meta}</em>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <input
        ref={inputRef}
        accept="video/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
        }}
        type="file"
      />
      <input
        ref={recordInputRef}
        accept="video/*"
        capture="environment"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
        }}
        type="file"
      />
    </main>
  );
}

async function createVideoUploadUrl(file: File) {
  const route = "/api/axis/video-upload-url";
  const response = await axisAuthenticatedFetch(route, {
    body: JSON.stringify({
      contentType: file.type || "video/mp4",
      fileSize: file.size,
      filename: file.name || "axis-video.mp4",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const result = (await response.json().catch(() => null)) as VideoUploadUrlResponse | null;
  if (response.status === 401) {
    console.info("AXIS_AUTH_401_RESPONSE", {
      body: result,
      route,
    });
  }
  if (!response.ok || !result?.cloudflareUid || !result.jobId || !result.uploadURL) {
    throw new Error(result?.message ?? result?.error ?? "Upload could not be created.");
  }

  return result;
}

async function uploadFileToCloudflare(file: File, upload: VideoUploadUrlResponse) {
  console.info("UPLOAD_START", {
    cloudflareUid: upload.cloudflareUid,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    storageProvider: "cloudflare_stream",
  });

  if (!upload.uploadURL) throw new Error("Upload URL is incomplete.");
  const body = new FormData();
  body.append("file", file, file.name || "axis-video.mp4");

  const response = await fetch(upload.uploadURL, {
    body,
    method: "POST",
  });
  if (!response.ok) throw new Error(`Cloudflare upload failed HTTP ${response.status}`);

  console.info("UPLOAD_COMPLETE", {
    cloudflareUid: upload.cloudflareUid,
    storageProvider: "cloudflare_stream",
  });
}

function stageFromJob(stage: unknown): VisibleStage {
  if (stage === "queued" || stage === "uploading") return "Uploading";
  if (stage === "extracting_frames") return "Extracting Frames";
  if (stage === "detecting_basketball") return "Detecting Ball";
  if (stage === "building_track") return "Tracking Objects";
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
