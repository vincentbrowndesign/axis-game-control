"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadAxisLiveDetector,
  type AxisLiveDetector,
} from "../../lib/axis/axis-live-detector";
import { createAxisTracker } from "../../lib/axis/axis-simple-tracker";
import type {
  AxisLiveDetection,
  AxisVisionFrame,
  AxisVisionSession,
  AxisVisionTrack,
} from "../../lib/axis/axis-vision-types";

type CameraStatus = "idle" | "requesting" | "live" | "denied" | "error" | "unsupported";
type ModelStatus = "idle" | "loading" | "ready" | "error";
type AiStatus = "idle" | "running" | "error";
type FacingMode = "environment" | "user";

const inferenceIntervalMs = 200;
const maxStoredFrames = 600;

function createSessionId() {
  return `vision-${Date.now().toString(36)}`;
}

export default function AxisLiveVision() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<AxisLiveDetector | null>(null);
  const trackerRef = useRef(createAxisTracker());
  const rafRef = useRef<number | null>(null);
  const lastInferenceAtRef = useRef(0);
  const aiRunningRef = useRef(false);
  const tracksRef = useRef<AxisVisionTrack[]>([]);
  const frameCountRef = useRef(0);
  const fpsWindowStartedAtRef = useRef(0);
  const fpsFramesRef = useRef(0);
  const sessionIdRef = useRef(createSessionId());
  const sessionStartedAtRef = useRef(Date.now());
  const visionFramesRef = useRef<AxisVisionFrame[]>([]);
  const maxPeopleCountRef = useRef(0);
  const ballSeenFramesRef = useRef(0);
  const ballLostFramesRef = useRef(0);
  const recentBallLostRef = useRef(false);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [detections, setDetections] = useState<AxisLiveDetection[]>([]);
  const [activeTracks, setActiveTracks] = useState<AxisVisionTrack[]>([]);
  const [visionFrames, setVisionFrames] = useState<AxisVisionFrame[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState(sessionStartedAtRef.current);
  const [sessionId, setSessionId] = useState(sessionIdRef.current);
  const [ballVisible, setBallVisible] = useState(false);
  const [ballLostCount, setBallLostCount] = useState(0);
  const [maxPeopleCount, setMaxPeopleCount] = useState(0);
  const [evidencePanelOpen, setEvidencePanelOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [lastError, setLastError] = useState("");

  const peopleCount = useMemo(
    () => activeTracks.filter((track) => track.kind === "person").length,
    [activeTracks],
  );
  const ballCount = useMemo(
    () => activeTracks.filter((track) => track.kind === "ball").length,
    [activeTracks],
  );

  useEffect(() => {
    return () => {
      stopAI();
      stopCamera();
    };
  }, []);

  useEffect(() => {
    tracksRef.current = activeTracks;
    drawDetections(activeTracks);
  }, [activeTracks, cameraStatus, aiStatus, fps, frameCount, ballVisible, maxPeopleCount]);

  async function startLiveVision() {
    const cameraStarted = await startCamera();
    if (cameraStarted) await startAI();
  }

  async function startCamera() {
    setLastError("");

    if (!("mediaDevices" in navigator) || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unsupported");
      setLastError("Camera is not supported in this browser.");
      return false;
    }

    setCameraStatus("requesting");
    stopCameraTracks();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          height: { ideal: 720 },
          width: { ideal: 1280 },
        },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Video element is not ready.");

      video.srcObject = stream;
      await video.play();

      setCameraStatus("live");
      requestAnimationFrame(() => drawDetections(tracksRef.current));
      return true;
    } catch (error) {
      stopCameraTracks();
      const message = error instanceof Error ? error.message : "Camera could not start.";
      setLastError(message);
      setCameraStatus(/denied|permission/i.test(message) ? "denied" : "error");
      return false;
    }
  }

  function stopCamera() {
    stopAI();
    stopCameraTracks();
    setCameraStatus("idle");
    setDetections([]);
    setActiveTracks([]);
    setFps(0);
    setFrameCount(0);
    tracksRef.current = [];
    clearCanvas();
  }

  function stopCameraTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function flipCamera() {
    const nextFacingMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacingMode);
    stopAI();

    if (cameraStatus === "live" || cameraStatus === "requesting") {
      setLastError("");
      setCameraStatus("requesting");
      stopCameraTracks();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: nextFacingMode },
            height: { ideal: 720 },
            width: { ideal: 1280 },
          },
        });
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) throw new Error("Video element is not ready.");

        video.srcObject = stream;
        await video.play();
        setCameraStatus("live");
        await startAI();
      } catch (error) {
        stopCameraTracks();
        setCameraStatus("error");
        setLastError(error instanceof Error ? error.message : "Camera could not flip.");
      }
    }
  }

  async function startAI() {
    if (aiRunningRef.current) return;
    if (cameraStatus !== "live" && !streamRef.current) {
      const cameraStarted = await startCamera();
      if (!cameraStarted) return;
    }

    setLastError("");

    try {
      if (!detectorRef.current) {
        setModelStatus("loading");
        detectorRef.current = await loadAxisLiveDetector();
        setModelStatus("ready");
      }

      aiRunningRef.current = true;
      setAiStatus("running");
      lastInferenceAtRef.current = 0;
      fpsFramesRef.current = 0;
      fpsWindowStartedAtRef.current = performance.now();
      loop();
    } catch (error) {
      aiRunningRef.current = false;
      setAiStatus("error");
      setModelStatus("error");
      setLastError(error instanceof Error ? error.message : "AI model could not start.");
    }
  }

  function stopAI() {
    aiRunningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setAiStatus("idle");
  }

  async function loop() {
    if (!aiRunningRef.current) return;

    const now = performance.now();
    if (now - lastInferenceAtRef.current < inferenceIntervalMs) {
      drawDetections(tracksRef.current);
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    lastInferenceAtRef.current = now;

    try {
      const video = videoRef.current;
      const detector = detectorRef.current;

      if (video && detector && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const timestamp = Date.now();
        const nextDetections = await detector.detect(video);
        const nextTracks = trackerRef.current.update(nextDetections, timestamp);
        const nextPeopleCount = nextTracks.filter((track) => track.kind === "person").length;
        const nextBallCount = nextTracks.filter((track) => track.kind === "ball").length;
        const nextBallVisible = nextBallCount > 0;

        frameCountRef.current += 1;
        fpsFramesRef.current += 1;

        const nextFrame: AxisVisionFrame = {
          ballCount: nextBallCount,
          ballVisible: nextBallVisible,
          detections: nextDetections,
          frameId: frameCountRef.current,
          peopleCount: nextPeopleCount,
          timestamp,
          tracks: nextTracks,
        };

        visionFramesRef.current = [...visionFramesRef.current, nextFrame].slice(-maxStoredFrames);
        maxPeopleCountRef.current = Math.max(maxPeopleCountRef.current, nextPeopleCount);
        if (nextBallVisible) {
          ballSeenFramesRef.current += 1;
          recentBallLostRef.current = false;
        } else {
          ballLostFramesRef.current += 1;
          recentBallLostRef.current = ballSeenFramesRef.current > 0;
        }

        tracksRef.current = nextTracks;
        setFrameCount(frameCountRef.current);
        setDetections(nextDetections);
        setActiveTracks(nextTracks);
        setVisionFrames(visionFramesRef.current);
        setBallVisible(nextBallVisible);
        setBallLostCount(ballLostFramesRef.current);
        setMaxPeopleCount(maxPeopleCountRef.current);

        const fpsElapsed = now - fpsWindowStartedAtRef.current;
        if (fpsElapsed >= 1000) {
          setFps((fpsFramesRef.current * 1000) / fpsElapsed);
          fpsFramesRef.current = 0;
          fpsWindowStartedAtRef.current = now;
        }
      }
    } catch (error) {
      setAiStatus("error");
      setLastError(error instanceof Error ? error.message : "Detection failed.");
      aiRunningRef.current = false;
      return;
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  function drawDetections(nextTracks = tracksRef.current) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;
    const scale = Math.min(rect.width / videoWidth, rect.height / videoHeight);
    const renderedWidth = videoWidth * scale;
    const renderedHeight = videoHeight * scale;
    const offsetX = (rect.width - renderedWidth) / 2;
    const offsetY = (rect.height - renderedHeight) / 2;

    for (const track of nextTracks) {
      const [x, y, width, height] = track.bbox;
      const boxX = offsetX + x * scale;
      const boxY = offsetY + y * scale;
      const boxWidth = width * scale;
      const boxHeight = height * scale;
      const color = track.kind === "ball" ? "#f8d45c" : "#7cf7d4";
      const label = track.kind === "ball"
        ? `${track.trackId} BALL ${Math.round(track.score * 100)}%`
        : `${track.trackId} ${Math.round(track.score * 100)}%`;

      ctx.strokeStyle = color;
      ctx.lineWidth = track.kind === "ball" ? 3 : 2;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      const labelWidth = Math.max(78, ctx.measureText(label).width + 18);
      ctx.fillRect(boxX, Math.max(0, boxY - 28), labelWidth, 24);
      ctx.fillStyle = color;
      ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(label, boxX + 9, Math.max(16, boxY - 11));
    }

    drawHud(ctx, rect.width, nextTracks);
  }

  function drawHud(ctx: CanvasRenderingContext2D, width: number, tracks: AxisVisionTrack[]) {
    const people = tracks.filter((track) => track.kind === "person").length;
    const balls = tracks.filter((track) => track.kind === "ball").length;
    const ballState = balls > 0 ? "LIVE" : recentBallLostRef.current ? "LOST" : "SEARCHING";

    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(14, 14, Math.min(310, width - 28), 178);
    ctx.fillStyle = "#f8f7f2";
    ctx.font = "800 14px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("AXIS LIVE VISION", 28, 38);
    ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`AI ${aiStatus.toUpperCase()}`, 28, 62);
    ctx.fillText(`PEOPLE: ${people} / ${maxPeopleCountRef.current}`, 28, 86);
    ctx.fillText(`BALL: ${ballState}`, 28, 110);
    ctx.fillText(`TRACKS: ${tracks.length}`, 28, 134);
    ctx.fillText(`FRAMES: ${frameCountRef.current}`, 28, 158);
    ctx.fillText(`FPS: ${fps.toFixed(1)}`, 28, 182);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function buildSessionExport(): AxisVisionSession {
    return {
      ballLostFrames: ballLostFramesRef.current,
      ballSeenFrames: ballSeenFramesRef.current,
      frames: visionFramesRef.current,
      maxPeopleCount: maxPeopleCountRef.current,
      sessionId,
      startedAt: sessionStartedAt,
    };
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportEvidenceJson() {
    const session = buildSessionExport();
    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, `axis-vision-session-${session.sessionId}.json`);
  }

  async function captureSnapshot() {
    const video = videoRef.current;
    const overlay = canvasRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const snapshot = document.createElement("canvas");
    snapshot.width = Math.max(1, Math.floor(rect.width * pixelRatio));
    snapshot.height = Math.max(1, Math.floor(rect.height * pixelRatio));
    const ctx = snapshot.getContext("2d");
    if (!ctx) return;

    ctx.scale(pixelRatio, pixelRatio);
    ctx.fillStyle = "#020304";
    ctx.fillRect(0, 0, rect.width, rect.height);
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
      const renderedWidth = video.videoWidth * scale;
      const renderedHeight = video.videoHeight * scale;
      const offsetX = (rect.width - renderedWidth) / 2;
      const offsetY = (rect.height - renderedHeight) / 2;
      ctx.drawImage(video, offsetX, offsetY, renderedWidth, renderedHeight);
    }
    ctx.drawImage(overlay, 0, 0, rect.width, rect.height);

    const blob = await new Promise<Blob | null>((resolve) => snapshot.toBlob(resolve, "image/png"));
    if (blob) downloadBlob(blob, `axis-vision-snapshot-${sessionId}.png`);
  }

  function clearSession() {
    const nextSessionId = createSessionId();
    const nextStartedAt = Date.now();
    trackerRef.current.reset();
    sessionIdRef.current = nextSessionId;
    sessionStartedAtRef.current = nextStartedAt;
    visionFramesRef.current = [];
    tracksRef.current = [];
    frameCountRef.current = 0;
    maxPeopleCountRef.current = 0;
    ballSeenFramesRef.current = 0;
    ballLostFramesRef.current = 0;
    recentBallLostRef.current = false;
    setSessionId(nextSessionId);
    setSessionStartedAt(nextStartedAt);
    setVisionFrames([]);
    setActiveTracks([]);
    setDetections([]);
    setFrameCount(0);
    setMaxPeopleCount(0);
    setBallVisible(false);
    setBallLostCount(0);
    drawDetections([]);
  }

  const isCameraLive = cameraStatus === "live";
  const isAiRunning = aiStatus === "running";
  const durationSeconds = Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000));
  const activeTrackLabel = activeTracks.length === 1 ? "1 track" : `${activeTracks.length} tracks`;
  const primaryLabel = cameraStatus === "requesting"
    ? "Starting camera..."
    : modelStatus === "loading"
      ? "Loading AI model..."
      : "Start Live Vision";

  return (
    <main className="axis-live-vision">
      <section className="axis-live-vision__stage" aria-label="Axis live camera AI detection">
        <video
          aria-label="Live camera feed"
          autoPlay
          className="axis-live-vision__video"
          muted
          playsInline
          ref={videoRef}
        />
        <canvas className="axis-live-vision__canvas" ref={canvasRef} />

        {!isCameraLive && (
          <div className="axis-live-vision__empty">
            <p>AXIS</p>
            <h1>Live camera AI</h1>
            <button disabled={cameraStatus === "requesting" || modelStatus === "loading"} onClick={startLiveVision} type="button">
              {primaryLabel}
            </button>
          </div>
        )}
      </section>

      <header className="axis-live-vision__top">
        <div>
          <p>AXIS</p>
          <strong>LIVE CAMERA</strong>
        </div>
        <span data-live={isCameraLive ? "true" : "false"}>{isCameraLive ? "LIVE" : cameraStatus.toUpperCase()}</span>
      </header>

      <aside className="axis-live-vision__status" aria-label="Live detection status">
        <div>
          <span>Camera</span>
          <strong>{isCameraLive ? (facingMode === "environment" ? "Back" : "Front") : cameraStatus}</strong>
        </div>
        <div>
          <span>AI</span>
          <strong>{aiStatus === "running" ? "Running" : modelStatus}</strong>
        </div>
        <div>
          <span>People</span>
          <strong>{peopleCount} / {maxPeopleCount}</strong>
        </div>
        <div>
          <span>Ball</span>
          <strong>{ballVisible ? "Live" : ballLostCount > 0 ? "Lost" : "Searching"}</strong>
        </div>
        <div>
          <span>Tracks</span>
          <strong>{activeTrackLabel}</strong>
        </div>
        <div>
          <span>Frames</span>
          <strong>{visionFrames.length}</strong>
        </div>
      </aside>

      <section className={`axis-live-vision__evidence ${evidencePanelOpen ? "is-open" : ""}`} aria-label="Evidence session panel">
        <button className="axis-live-vision__evidence-toggle" onClick={() => setEvidencePanelOpen((open) => !open)} type="button">
          Evidence {visionFrames.length}
        </button>
        {evidencePanelOpen && (
          <div className="axis-live-vision__evidence-body">
            <dl>
              <div><dt>Session</dt><dd>{sessionId}</dd></div>
              <div><dt>Duration</dt><dd>{durationSeconds}s</dd></div>
              <div><dt>Frames</dt><dd>{visionFrames.length}</dd></div>
              <div><dt>Max people</dt><dd>{maxPeopleCount}</dd></div>
              <div><dt>Ball seen</dt><dd>{ballSeenFramesRef.current}</dd></div>
              <div><dt>Ball lost</dt><dd>{ballLostCount}</dd></div>
              <div><dt>Active tracks</dt><dd>{activeTracks.map((track) => track.trackId).join(", ") || "None"}</dd></div>
            </dl>
            <div className="axis-live-vision__evidence-actions">
              <button onClick={exportEvidenceJson} type="button">Export Evidence JSON</button>
              <button onClick={captureSnapshot} type="button">Capture Snapshot</button>
              <button onClick={clearSession} type="button">Clear Session</button>
            </div>
          </div>
        )}
      </section>

      <footer className="axis-live-vision__controls" aria-label="Live vision controls">
        <button onClick={startLiveVision} type="button" disabled={cameraStatus === "requesting" || modelStatus === "loading"}>
          {isAiRunning ? "Vision Running" : "Start Vision"}
        </button>
        <button onClick={startAI} type="button" disabled={!isCameraLive || modelStatus === "loading" || isAiRunning}>
          Start AI
        </button>
        <button onClick={flipCamera} type="button" disabled={cameraStatus === "requesting"}>
          Flip
        </button>
        <button onClick={stopCamera} type="button">
          Stop
        </button>
      </footer>

      {lastError && <p className="axis-live-vision__error">{lastError}</p>}

      <style jsx>{`
        .axis-live-vision {
          background: #020304;
          color: #f8f7f2;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          height: 100dvh;
          overflow: hidden;
          position: relative;
          width: 100vw;
        }

        .axis-live-vision__stage {
          inset: 0;
          position: absolute;
        }

        .axis-live-vision__video,
        .axis-live-vision__canvas {
          height: 100%;
          inset: 0;
          position: absolute;
          width: 100%;
        }

        .axis-live-vision__video {
          background: #050607;
          object-fit: contain;
        }

        .axis-live-vision__canvas {
          pointer-events: none;
          z-index: 2;
        }

        .axis-live-vision__empty {
          align-items: center;
          background:
            radial-gradient(circle at 50% 35%, rgba(122, 247, 212, 0.12), transparent 34rem),
            rgba(2, 3, 4, 0.88);
          display: grid;
          inset: 0;
          justify-items: center;
          padding: 2rem;
          position: absolute;
          text-align: center;
          z-index: 3;
        }

        .axis-live-vision__empty p,
        .axis-live-vision__top p,
        .axis-live-vision__status span,
        .axis-live-vision__evidence dt {
          color: rgba(248, 247, 242, 0.58);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-live-vision__empty h1 {
          font-size: clamp(2.4rem, 11vw, 6rem);
          letter-spacing: -0.04em;
          line-height: 0.92;
          margin: 0.65rem 0 1.8rem;
          text-transform: uppercase;
        }

        .axis-live-vision button {
          background: rgba(248, 247, 242, 0.92);
          border: 1px solid rgba(248, 247, 242, 0.45);
          border-radius: 999px;
          color: #030405;
          cursor: pointer;
          font: inherit;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          min-height: 2.8rem;
          padding: 0 1rem;
          text-transform: uppercase;
        }

        .axis-live-vision button:disabled {
          cursor: default;
          opacity: 0.48;
        }

        .axis-live-vision__top {
          align-items: center;
          display: flex;
          justify-content: space-between;
          left: 0;
          padding: max(1rem, env(safe-area-inset-top)) 1rem 0;
          position: absolute;
          right: 0;
          top: 0;
          z-index: 4;
        }

        .axis-live-vision__top strong {
          display: block;
          font-size: 1.05rem;
          letter-spacing: 0.04em;
          margin-top: 0.18rem;
        }

        .axis-live-vision__top span,
        .axis-live-vision__evidence-toggle {
          align-items: center;
          background: rgba(0, 0, 0, 0.52);
          border: 1px solid rgba(248, 247, 242, 0.18);
          border-radius: 999px;
          color: #f8f7f2;
          display: inline-flex;
          font-size: 0.72rem;
          font-weight: 900;
          gap: 0.45rem;
          letter-spacing: 0.08em;
          padding: 0.55rem 0.72rem;
        }

        .axis-live-vision__top span::before {
          background: #7a7a7a;
          border-radius: 50%;
          content: "";
          height: 0.5rem;
          width: 0.5rem;
        }

        .axis-live-vision__top span[data-live="true"]::before {
          background: #7cf7d4;
          box-shadow: 0 0 1rem rgba(124, 247, 212, 0.78);
        }

        .axis-live-vision__status {
          background: rgba(0, 0, 0, 0.58);
          border: 1px solid rgba(248, 247, 242, 0.12);
          border-radius: 1rem;
          bottom: calc(6.3rem + env(safe-area-inset-bottom));
          display: grid;
          gap: 0.65rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          left: 1rem;
          padding: 0.8rem;
          position: absolute;
          right: 1rem;
          z-index: 4;
        }

        .axis-live-vision__status div {
          display: grid;
          gap: 0.15rem;
        }

        .axis-live-vision__status strong,
        .axis-live-vision__evidence dd {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.88rem;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .axis-live-vision__evidence {
          bottom: calc(10.8rem + env(safe-area-inset-bottom));
          left: 1rem;
          position: absolute;
          z-index: 5;
        }

        .axis-live-vision__evidence-body {
          background: rgba(0, 0, 0, 0.72);
          border: 1px solid rgba(248, 247, 242, 0.14);
          border-radius: 1rem;
          margin-top: 0.55rem;
          max-width: min(23rem, calc(100vw - 2rem));
          padding: 0.85rem;
        }

        .axis-live-vision__evidence dl {
          display: grid;
          gap: 0.55rem;
          margin: 0;
        }

        .axis-live-vision__evidence dl div {
          display: grid;
          gap: 0.15rem;
        }

        .axis-live-vision__evidence-actions {
          display: grid;
          gap: 0.45rem;
          margin-top: 0.85rem;
        }

        .axis-live-vision__evidence-actions button,
        .axis-live-vision__controls button:not(:first-child) {
          background: rgba(248, 247, 242, 0.08);
          color: #f8f7f2;
        }

        .axis-live-vision__controls {
          bottom: 0;
          display: grid;
          gap: 0.65rem;
          grid-template-columns: 1.4fr 1fr 0.75fr 0.75fr;
          left: 0;
          padding: 0 1rem max(1rem, env(safe-area-inset-bottom));
          position: absolute;
          right: 0;
          z-index: 4;
        }

        .axis-live-vision__error {
          background: rgba(255, 80, 80, 0.16);
          border: 1px solid rgba(255, 130, 130, 0.28);
          border-radius: 0.85rem;
          color: #ffd7d7;
          font-size: 0.84rem;
          left: 1rem;
          line-height: 1.35;
          margin: 0;
          padding: 0.75rem;
          position: absolute;
          right: 1rem;
          top: 5.2rem;
          z-index: 5;
        }

        @media (min-width: 880px) {
          .axis-live-vision__top {
            padding: 1.2rem 1.4rem 0;
          }

          .axis-live-vision__status {
            bottom: auto;
            grid-template-columns: 1fr;
            left: auto;
            right: 1.4rem;
            top: 5.8rem;
            width: 13rem;
          }

          .axis-live-vision__evidence {
            bottom: 6rem;
            left: auto;
            right: 1.4rem;
          }

          .axis-live-vision__controls {
            grid-template-columns: repeat(4, minmax(0, 12rem));
            justify-content: center;
            padding-bottom: 1.25rem;
          }
        }

        @media (max-width: 560px) {
          .axis-live-vision__controls {
            grid-template-columns: 1fr 0.72fr;
          }

          .axis-live-vision__controls button {
            min-height: 2.8rem;
          }
        }
      `}</style>
    </main>
  );
}
