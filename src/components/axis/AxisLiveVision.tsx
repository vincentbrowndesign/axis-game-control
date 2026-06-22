"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadAxisLiveDetector,
  type AxisLiveDetection,
  type AxisLiveDetector,
} from "../../lib/axis/axis-live-detector";

type CameraStatus = "idle" | "requesting" | "live" | "denied" | "error" | "unsupported";
type ModelStatus = "idle" | "loading" | "ready" | "error";
type AiStatus = "idle" | "running" | "error";
type FacingMode = "environment" | "user";

const inferenceIntervalMs = 200;

export default function AxisLiveVision() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<AxisLiveDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastInferenceAtRef = useRef(0);
  const aiRunningRef = useRef(false);
  const detectionsRef = useRef<AxisLiveDetection[]>([]);
  const frameCountRef = useRef(0);
  const fpsWindowStartedAtRef = useRef(0);
  const fpsFramesRef = useRef(0);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [detections, setDetections] = useState<AxisLiveDetection[]>([]);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [lastError, setLastError] = useState("");

  const peopleCount = useMemo(
    () => detections.filter((detection) => detection.kind === "person").length,
    [detections],
  );
  const ballCount = useMemo(
    () => detections.filter((detection) => detection.kind === "ball").length,
    [detections],
  );

  useEffect(() => {
    return () => {
      stopAI();
      stopCamera();
    };
  }, []);

  useEffect(() => {
    detectionsRef.current = detections;
    drawDetections(detections);
  }, [detections, cameraStatus, aiStatus, fps, frameCount]);

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
      requestAnimationFrame(() => drawDetections(detectionsRef.current));
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
    setFps(0);
    setFrameCount(0);
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
      frameCountRef.current = 0;
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
      drawDetections(detectionsRef.current);
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    lastInferenceAtRef.current = now;

    try {
      const video = videoRef.current;
      const detector = detectorRef.current;

      if (video && detector && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const nextDetections = await detector.detect(video);
        frameCountRef.current += 1;
        fpsFramesRef.current += 1;
        setFrameCount(frameCountRef.current);
        setDetections(nextDetections);

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

  function drawDetections(nextDetections = detectionsRef.current) {
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

    for (const detection of nextDetections) {
      const [x, y, width, height] = detection.bbox;
      const boxX = offsetX + x * scale;
      const boxY = offsetY + y * scale;
      const boxWidth = width * scale;
      const boxHeight = height * scale;
      const color = detection.kind === "ball" ? "#f8d45c" : "#7cf7d4";
      const label = `${detection.kind === "ball" ? "BALL" : "PERSON"} ${Math.round(detection.score * 100)}%`;

      ctx.strokeStyle = color;
      ctx.lineWidth = detection.kind === "ball" ? 3 : 2;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      const labelWidth = Math.max(88, ctx.measureText(label).width + 18);
      ctx.fillRect(boxX, Math.max(0, boxY - 28), labelWidth, 24);
      ctx.fillStyle = color;
      ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(label, boxX + 9, Math.max(16, boxY - 11));
    }

    drawHud(ctx, rect.width, peopleCountFrom(nextDetections), ballCountFrom(nextDetections));
  }

  function drawHud(ctx: CanvasRenderingContext2D, width: number, people: number, balls: number) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(14, 14, Math.min(270, width - 28), 132);
    ctx.fillStyle = "#f8f7f2";
    ctx.font = "800 14px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("AXIS LIVE VISION", 28, 38);
    ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`CAMERA: ${cameraStatus.toUpperCase()}`, 28, 62);
    ctx.fillText(`AI: ${aiStatus.toUpperCase()}`, 28, 84);
    ctx.fillText(`PEOPLE: ${people}`, 28, 106);
    ctx.fillText(`BALLS: ${balls}`, 28, 128);
    ctx.fillText(`FPS: ${fps.toFixed(1)}`, 150, 128);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const isCameraLive = cameraStatus === "live";
  const isAiRunning = aiStatus === "running";
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
          <strong>{peopleCount}</strong>
        </div>
        <div>
          <span>Ball</span>
          <strong>{ballCount > 0 ? ballCount : "Searching"}</strong>
        </div>
        <div>
          <span>FPS</span>
          <strong>{fps.toFixed(1)}</strong>
        </div>
        <div>
          <span>Frames</span>
          <strong>{frameCount}</strong>
        </div>
      </aside>

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
        .axis-live-vision__status span {
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
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          min-height: 3rem;
          padding: 0 1.2rem;
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

        .axis-live-vision__top span {
          align-items: center;
          background: rgba(0, 0, 0, 0.52);
          border: 1px solid rgba(248, 247, 242, 0.18);
          border-radius: 999px;
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

        .axis-live-vision__status strong {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.92rem;
          overflow-wrap: anywhere;
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

        .axis-live-vision__controls button:not(:first-child) {
          background: rgba(248, 247, 242, 0.08);
          color: #f8f7f2;
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

function peopleCountFrom(detections: AxisLiveDetection[]) {
  return detections.filter((detection) => detection.kind === "person").length;
}

function ballCountFrom(detections: AxisLiveDetection[]) {
  return detections.filter((detection) => detection.kind === "ball").length;
}
