"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { axisFetchWithAccessToken, getAxisAccessToken } from "../lib/axis-client-auth";
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
  errorObject?: unknown;
  jobId?: string;
  status?: BallJobResponse["status"];
  triggerRequested?: boolean;
  triggerResponse?: unknown;
  triggerRunId?: string;
};

const confidenceThreshold = 0.35;

export function AxisOneScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const overlayStateRef = useRef(createAxisOverlayEngineState());
  const pollingAccessTokenRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);
  const timerStartedAtRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const [pollWarning, setPollWarning] = useState("");
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
  const replayUrl = saveUrl || videoUrl;

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
        const accessToken = pollingAccessTokenRef.current;
        console.info("POLL_START", {
          accessTokenPresent: Boolean(accessToken),
          jobId,
          route,
        });
        if (!accessToken) {
          console.warn("POLL_AUTH_ERROR", {
            jobId,
            reason: "missing_cached_access_token",
            route,
          });
          setPollWarning("Replay started. Refresh status failed.");
          return;
        }
        const response = await axisFetchWithAccessToken(accessToken, route);
        const result = (await response.json().catch(() => null)) as BallJobResponse | null;
        console.info("POLL_RESPONSE", {
          body: result,
          jobId,
          ok: response.ok,
          route,
          status: response.status,
        });
        if (response.status === 401) {
          console.info("AXIS_AUTH_401_RESPONSE", {
            body: result,
            route,
          });
          console.warn("POLL_AUTH_ERROR", {
            body: result,
            jobId,
            route,
            status: response.status,
          });
          setPollWarning("Replay started. Refresh status failed.");
          return;
        }
        if (cancelled || !result) return;
        if (!response.ok) {
          setError(result.error ?? "Processing failed.");
          setElapsedSeconds(Math.floor((performance.now() - timerStartedAtRef.current) / 1000));
          setState("failed");
          window.clearInterval(interval);
          return;
        }

        setPollWarning("");
        setStage(stageFromJob(result.processingStage));

        if (result.status === "failed") {
          setError(result.error ?? "Processing failed.");
          setElapsedSeconds(Math.floor((performance.now() - timerStartedAtRef.current) / 1000));
          setState("failed");
          window.clearInterval(interval);
          return;
        }
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
        console.warn("POLL_AUTH_ERROR", {
          error: serializeError(nextError),
          jobId,
        });
        setPollWarning("Replay started. Refresh status failed.");
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
    setPollWarning("");
    pollingAccessTokenRef.current = null;
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
      const accessToken = await getAxisAccessToken();
      pollingAccessTokenRef.current = accessToken;
      if (!accessToken) throw new Error("Authenticated session is required to create a replay.");
      let upload: VideoUploadUrlResponse;
      try {
        console.info("LOG_BEFORE_UPLOAD_URL", {
          fileName: file.name,
          fileSize: file.size,
          route: "/api/axis/video-upload-url",
        });
        upload = await createVideoUploadUrl(file, accessToken);
        console.info("LOG_AFTER_UPLOAD_URL", {
          cloudflareUid: upload.cloudflareUid,
          jobId: upload.jobId,
          uploadUrlPresent: Boolean(upload.uploadURL),
        });
      } catch (uploadUrlError) {
        console.error("LOG_UPLOAD_URL_ERROR", serializeError(uploadUrlError));
        throw uploadUrlError;
      }

      try {
        console.info("LOG_BEFORE_UPLOAD", {
          cloudflareUid: upload.cloudflareUid,
          fileName: file.name,
          fileSize: file.size,
        });
        await uploadFileToCloudflare(file, upload);
        console.info("LOG_AFTER_UPLOAD", {
          cloudflareUid: upload.cloudflareUid,
          jobId: upload.jobId,
        });
      } catch (uploadError) {
        console.error("LOG_UPLOAD_ERROR", serializeError(uploadError));
        throw uploadError;
      }

      setStage("Uploading");
      console.info("PROCESSING_START", { cloudflareUid: upload.cloudflareUid, jobId: upload.jobId });
      const route = "/api/axis/video-job";
      let response: Response;
      try {
        console.info("LOG_BEFORE_JOB_CREATE", {
          cloudflareUid: upload.cloudflareUid,
          jobId: upload.jobId,
          route,
        });
        response = await axisFetchWithAccessToken(accessToken, route, {
          body: JSON.stringify({
            cloudflareUid: upload.cloudflareUid,
            fileSize: file.size,
            filename: file.name || "axis-video.mp4",
            jobId: upload.jobId,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        console.info("LOG_AFTER_JOB_CREATE", {
          cloudflareUid: upload.cloudflareUid,
          jobId: upload.jobId,
          ok: response.ok,
          status: response.status,
        });
      } catch (jobCreateError) {
        console.error("LOG_JOB_CREATE_ERROR", serializeError(jobCreateError));
        throw jobCreateError;
      }
      const result = (await response.json().catch(() => null)) as VideoJobResponse | null;
      console.info("JOB_CREATE_RESPONSE_BODY", {
        body: result,
        cloudflareUid: upload.cloudflareUid,
        jobId: upload.jobId,
        ok: response.ok,
        status: response.status,
      });
      if (response.status === 401) {
        console.info("AXIS_AUTH_401_RESPONSE", {
          body: result,
          route,
        });
      }
      if (!response.ok || !result?.jobId) throw new Error(result?.error ?? "Processing job could not be created.");
      if (!result.triggerRequested && !result.triggerRunId) {
        throw new Error(result.error ?? "Trigger was not started for this replay.");
      }
      setJobId(result.jobId);
    } catch (nextError) {
      console.error("UPLOAD_FLOW_ERROR", serializeError(nextError));
      setError(nextError instanceof Error ? nextError.message : "Processing failed.");
      setElapsedSeconds(Math.floor((performance.now() - timerStartedAtRef.current) / 1000));
      setState("failed");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handlePreviewReplay() {
    console.info("PREVIEW_URL", {
      replayUrl,
      saveUrl,
      videoUrl,
    });
    setState("replay");
  }

  function logVideoLoaded(eventName: "canplay" | "loadedmetadata", video: HTMLVideoElement) {
    console.info("VIDEO_LOADED", {
      currentSrc: video.currentSrc,
      duration: video.duration,
      event: eventName,
      height: video.videoHeight,
      readyState: video.readyState,
      replayUrl,
      saveUrl,
      videoUrl,
      width: video.videoWidth,
    });
  }

  function logVideoError(video: HTMLVideoElement) {
    console.error("VIDEO_ERROR", {
      currentSrc: video.currentSrc,
      error: video.error
        ? {
            code: video.error.code,
            message: video.error.message,
          }
        : null,
      networkState: video.networkState,
      readyState: video.readyState,
      replayUrl,
      saveUrl,
      videoUrl,
    });
  }

  return (
    <main className="axis-one-screen" data-state={state}>
      <header className="axis-one-header" aria-label="Axis home">
        <span>AXIS</span>
        <strong>{state === "processing" ? stage : "Camera Roll Replay"}</strong>
      </header>

      {state === "choose" ? (
        <section className="axis-one-intro" aria-label="Create overlay replay">
          <h1>Turn a basketball clip into a replay.</h1>
          <button className="axis-one-select" onClick={() => inputRef.current?.click()} type="button">
            SELECT VIDEO
          </button>
          <button className="axis-one-record-soon" disabled type="button">
            RECORD CLIP <span>Coming Soon</span>
          </button>
          <p>Upload a clip. Axis tracks the ball, adds replay graphics, and exports a new video.</p>
        </section>
      ) : null}

      {state === "selected" ? (
        <section className="axis-one-status">
          <span>{selectedFile?.name || "Video selected"}</span>
          <p>Ready to turn this clip into an overlay replay.</p>
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
          <span>{state === "failed" ? error || "Try Again" : pollWarning || stage}</span>
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
          <p>Replay exported. Preview it, then save or share the finished video.</p>
          <button className="axis-one-primary" onClick={handlePreviewReplay} type="button">
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
            onCanPlay={(event) => logVideoLoaded("canplay", event.currentTarget)}
            onError={(event) => logVideoError(event.currentTarget)}
            onLoadedMetadata={(event) => {
              console.info("VIDEO_ELEMENT_SRC", {
                currentSrc: event.currentTarget.currentSrc,
                replayUrl,
                saveUrl,
                src: event.currentTarget.src,
                videoUrl,
              });
              logVideoLoaded("loadedmetadata", event.currentTarget);
              draw();
            }}
            onPlay={draw}
            onSeeked={draw}
            onTimeUpdate={draw}
            playsInline
            ref={videoRef}
            src={replayUrl}
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
            <span>Recent Replays</span>
          </div>
          {saveUrl ? (
            <article className="axis-one-real-replay">
              <video muted playsInline preload="metadata" src={saveUrl} />
              <div>
                <strong>Latest Replay</strong>
                <em>Ready to save</em>
              </div>
            </article>
          ) : (
            <div className="axis-one-empty-replays">
              <strong>No replays yet.</strong>
              <span>Create your first replay from a video.</span>
            </div>
          )}
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
    </main>
  );
}

async function createVideoUploadUrl(file: File, accessToken: string | null) {
  const route = "/api/axis/video-upload-url";
  const response = await axisFetchWithAccessToken(accessToken, route, {
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

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      cause: error.cause,
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  return {
    error,
    message: String(error),
    type: typeof error,
  };
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
