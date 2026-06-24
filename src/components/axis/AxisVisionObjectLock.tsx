"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createAxisTracker } from "../../lib/axis/axis-simple-tracker";
import {
  calculateVisionRelationships,
  recordAxisVisionObjectEvent,
  smoothBox,
  trackToBox,
} from "../../lib/axis/axis-object-lock";
import type { AxisLiveDetection, AxisVisionTrack } from "../../lib/axis/axis-vision-types";
import type { VisionBox, VisionFrameState, VisionObject } from "../../lib/axis/axis-object-lock-types";

type CameraState = "idle" | "starting" | "live" | "error";
type ModelState = "idle" | "loading" | "ready" | "error";
type OverlayMode = "product" | "debug";

const maxPlayers = 3;
const inferenceIntervalMs = 700;

type AxisVisionObjectLockProps = {
  detectEndpoint?: string;
  initialRimSetup?: boolean;
  productName?: string;
  route?: string;
};

export function AxisVisionObjectLock({
  detectEndpoint = "/api/axis/vision/detect",
  initialRimSetup = false,
  productName = "Axis Vision",
  route = "/axis/vision",
}: AxisVisionObjectLockProps = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef(createAxisTracker({ ballIouThreshold: 0.12, maxMissedFrames: 8, personIouThreshold: 0.2 }));
  const rafRef = useRef<number | null>(null);
  const lastInferenceAtRef = useRef(0);
  const inferenceRunningRef = useRef(false);
  const objectsRef = useRef<VisionObject[]>([]);
  const frameIdRef = useRef(0);
  const pressTimerRef = useRef<number | null>(null);
  const objectStateRef = useRef<Record<string, VisionObject["state"]>>({});

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [modelState, setModelState] = useState<ModelState>("idle");
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("product");
  const [objects, setObjects] = useState<VisionObject[]>([]);
  const [frameState, setFrameState] = useState<VisionFrameState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rimSetup, setRimSetup] = useState(initialRimSetup);
  const [rimBox, setRimBox] = useState<VisionBox | null>(null);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [detectorUrl, setDetectorUrl] = useState("http://127.0.0.1:8011");
  const [detectorError, setDetectorError] = useState("");
  const [lastInferenceMs, setLastInferenceMs] = useState(0);
  const [lastCadenceMs, setLastCadenceMs] = useState(inferenceIntervalMs);

  const players = objects.filter((object) => object.type === "player");
  const rim = objects.find((object) => object.type === "rim");
  const ball = objects.find((object) => object.type === "ball");
  const relationships = frameState?.relationships ?? [];

  useEffect(() => {
    recordAxisVisionObjectEvent("vision_opened", { productName, route });
    return () => stopVision();
  }, [productName, route]);

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, overlayMode, frameState, selectedId]);

  async function startVision() {
    if (cameraState === "starting" || cameraState === "live") return;

    setError("");
    setCameraState("starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          height: { ideal: 720 },
          width: { ideal: 1280 },
        },
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video surface is unavailable.");
      video.srcObject = stream;
      await video.play();
      setCameraState("live");
      recordAxisVisionObjectEvent("camera_started");

      setModelState("ready");

      loop();
    } catch {
      setCameraState("error");
      setModelState((current) => (current === "loading" ? "error" : current));
      setError("Camera or model could not start. Check permission and try again.");
    }
  }

  function stopVision() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
    setModelState("idle");
  }

  function loop() {
    rafRef.current = requestAnimationFrame(loop);
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const now = performance.now();
    if (now - lastInferenceAtRef.current < inferenceIntervalMs || inferenceRunningRef.current) {
      draw();
      return;
    }

    const cadenceMs = lastInferenceAtRef.current ? now - lastInferenceAtRef.current : inferenceIntervalMs;
    lastInferenceAtRef.current = now;
    void runInference(video, now, cadenceMs);
  }

  async function runInference(video: HTMLVideoElement, timestamp: number, cadenceMs: number) {
    inferenceRunningRef.current = true;
    const startedAt = performance.now();
    try {
      const result = await detectWithYolo(video, frameIdRef.current + 1, timestamp);
      const detections = result.detections;
      const tracks = trackerRef.current.update(detections, timestamp);
      const nextObjects = buildObjectsFromTracks(tracks, timestamp);
      const relationships = calculateVisionRelationships(nextObjects, timestamp);
      const nextFrame: VisionFrameState = {
        frameId: frameIdRef.current + 1,
        mode: overlayMode,
        objects: nextObjects,
        relationships,
        timestamp,
      };

      frameIdRef.current = nextFrame.frameId;
      objectsRef.current = nextObjects;
      setObjects(nextObjects);
      setFrameState(nextFrame);
      setModelState("ready");
      setError("");
      setDetectorError("");
      setDetectorUrl(result.detectorUrl || "http://127.0.0.1:8011");
      setLastCadenceMs(cadenceMs);
      setLastInferenceMs(performance.now() - startedAt);

      nextObjects.forEach((object) => {
        if (object.state === "locked") {
          recordAxisVisionObjectEvent("object_detected", { id: object.id, type: object.type });
        }
      });

      recordObjectLossEvents(nextObjects);

      relationships.forEach((relationship) => {
        if (relationship.type === "possible_possession") recordAxisVisionObjectEvent("ball_possession_candidate", relationship);
        if (relationship.type === "shot_window") recordAxisVisionObjectEvent("shot_window_detected", relationship);
        if (relationship.type === "drive_window") recordAxisVisionObjectEvent("drive_window_detected", relationship);
        if (relationship.type === "finish_window") recordAxisVisionObjectEvent("finish_window_detected", relationship);
      });
    } catch (caughtError) {
      const reason = caughtError instanceof Error ? caughtError.message : "Detector service unavailable.";
      setModelState("error");
      setDetectorError(reason);
      setError("Detector service unavailable. Camera stays usable.");
      setLastInferenceMs(performance.now() - startedAt);
    } finally {
      inferenceRunningRef.current = false;
    }
  }

  async function detectWithYolo(
    video: HTMLVideoElement,
    frameId: number,
    timestamp: number,
  ): Promise<{ detections: AxisLiveDetection[]; detectorUrl?: string }> {
    const imageDataUrl = captureVideoFrame(video);
    const response = await fetch(detectEndpoint, {
      body: JSON.stringify({ frameId, imageDataUrl, timestamp }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as { detections?: AxisLiveDetection[]; detectorUrl?: string; error?: string; ok?: boolean } | null;
    if (!response.ok || !result?.ok) throw new Error(result?.error || "Detection failed.");
    return {
      detections: Array.isArray(result.detections) ? result.detections : [],
      detectorUrl: result.detectorUrl,
    };
  }

  function captureVideoFrame(video: HTMLVideoElement) {
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = captureCanvasRef.current ?? document.createElement("canvas");
    captureCanvasRef.current = canvas;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Frame capture is unavailable.");
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.72);
  }

  function buildObjectsFromTracks(tracks: AxisVisionTrack[], timestamp: number): VisionObject[] {
    const previous = objectsRef.current;
    const selected = selectedId;
    const playerTracks = tracks
      .filter((track) => track.kind === "person")
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPlayers);
    const ballTrack = tracks.filter((track) => track.kind === "ball").sort((a, b) => b.score - a.score)[0];

    const nextPlayers: VisionObject[] = playerTracks.map((track, index) => {
      const previousObject = previous.find((object) => object.trackId === track.trackId);
      const id = previousObject?.id ?? `player-${track.trackId}`;
      const fallbackLabel = `P${index + 1}`;
      return {
        bbox: smoothBox(previousObject?.bbox, trackToBox(track), 0.34),
        classId: track.classId,
        className: track.className,
        confidence: track.score,
        id,
        label: playerNames[id] || fallbackLabel,
        lastSeenAt: timestamp,
        manuallyLocked: Boolean(playerNames[id]),
        selected: selected === id,
        state: track.seenFrames > 2 || track.score > 0.7 ? "locked" : "candidate",
        trackId: track.trackId,
        type: "player",
      };
    });

    const nextBall: VisionObject | null = ballTrack
      ? {
          bbox: smoothBox(previous.find((object) => object.type === "ball")?.bbox, trackToBox(ballTrack), 0.48),
          classId: ballTrack.classId,
          className: ballTrack.className,
          confidence: ballTrack.score,
          id: "ball-1",
          label: "Ball",
          lastSeenAt: timestamp,
          manuallyLocked: false,
          selected: selected === "ball-1",
          state: ballTrack.score > 0.48 ? "locked" : "candidate",
          trackId: ballTrack.trackId,
          type: "ball",
        }
      : previous.find((object) => object.type === "ball" && timestamp - object.lastSeenAt < 1100)
        ? {
            ...previous.find((object) => object.type === "ball")!,
            confidence: Math.max(0.12, previous.find((object) => object.type === "ball")!.confidence * 0.86),
            selected: selected === "ball-1",
            state: "lost",
          }
        : null;

    const rimObject: VisionObject | null = rimBox
      ? {
          bbox: rimBox,
          confidence: 1,
          id: "rim-1",
          label: "Rim",
          lastSeenAt: timestamp,
          manuallyLocked: true,
          selected: selected === "rim-1",
          state: "manual_override",
          trackId: "manual-rim",
          type: "rim",
        }
      : null;

    return [...nextPlayers, ...(rimObject ? [rimObject] : []), ...(nextBall ? [nextBall] : [])];
  }

  function recordObjectLossEvents(nextObjects: VisionObject[]) {
    const nextStates: Record<string, VisionObject["state"]> = {};
    nextObjects.forEach((object) => {
      nextStates[object.id] = object.state;
      if (object.state === "lost" && objectStateRef.current[object.id] !== "lost") {
        recordAxisVisionObjectEvent("object_lost", { id: object.id, type: object.type });
      }
    });
    objectStateRef.current = nextStates;
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = canvasPoint(event);

    if (rimSetup) {
      const box = {
        height: 54,
        width: 86,
        x: point.x - 43,
        y: point.y - 27,
      };
      setRimBox(box);
      setRimSetup(false);
      recordAxisVisionObjectEvent("rim_locked", { bbox: box });
      recordAxisVisionObjectEvent("object_locked", { id: "rim-1", type: "rim" });
      return;
    }

    const object = hitTest(point.x, point.y);
    if (!object) return;

    setSelectedId(object.id);
    if (object.type === "player") {
      recordAxisVisionObjectEvent("player_selected", { id: object.id, label: object.label });
      pressTimerRef.current = window.setTimeout(() => {
        assignPlayerName(object.id, object.label);
      }, 650);
    }

    if (object.type === "rim" && object.manuallyLocked) {
      setRimSetup(true);
    }
  }

  function handleCanvasPointerUp() {
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
  }

  function assignPlayerName(id: string, currentLabel: string) {
    const nextName = window.prompt("Player label", currentLabel);
    if (!nextName) return;
    setPlayerNames((current) => ({ ...current, [id]: nextName.trim() }));
    recordAxisVisionObjectEvent("player_named", { id, label: nextName.trim() });
  }

  function hitTest(x: number, y: number) {
    return [...objectsRef.current]
      .reverse()
      .find((object) => x >= object.bbox.x - 12 && x <= object.bbox.x + object.bbox.width + 12 && y >= object.bbox.y - 12 && y <= object.bbox.y + object.bbox.height + 12);
  }

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function draw() {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = video.videoWidth || canvas.clientWidth || 1280;
    const height = video.videoHeight || canvas.clientHeight || 720;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    objectsRef.current.forEach((object) => drawObject(ctx, object));

    if (overlayMode === "debug") {
      drawDebug(ctx);
    } else {
      drawRelationshipHint(ctx);
    }
  }

  function drawObject(ctx: CanvasRenderingContext2D, object: VisionObject) {
    const color = object.type === "player" ? "#f7f4eb" : object.type === "rim" ? "#d8ad52" : "#c8f1dd";
    const alpha = object.state === "lost" ? Math.max(0.18, object.confidence) : 0.94;
    const labelVisible = object.type !== "ball" || overlayMode === "debug";
    const debugClass = object.classId !== undefined ? ` c${object.classId}` : "";
    const label = overlayMode === "debug" ? `${object.label}${debugClass} ${Math.round(object.confidence * 100)}% ${object.trackId}` : object.label;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = object.selected ? "#d8ad52" : color;
    ctx.lineWidth = object.selected ? 2.5 : 1.5;
    drawBracketBox(ctx, object.bbox);

    if (labelVisible) {
      ctx.fillStyle = "rgba(8, 10, 9, 0.62)";
      ctx.fillRect(object.bbox.x, Math.max(0, object.bbox.y - 24), Math.min(124, label.length * 8 + 18), 20);
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 13px system-ui";
      ctx.fillText(label, object.bbox.x + 8, Math.max(14, object.bbox.y - 9));
    }
    ctx.restore();
  }

  function drawBracketBox(ctx: CanvasRenderingContext2D, box: VisionBox) {
    const corner = Math.min(22, box.width * 0.22, box.height * 0.22);
    const left = box.x;
    const top = box.y;
    const right = box.x + box.width;
    const bottom = box.y + box.height;

    ctx.beginPath();
    ctx.moveTo(left, top + corner);
    ctx.lineTo(left, top);
    ctx.lineTo(left + corner, top);
    ctx.moveTo(right - corner, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, top + corner);
    ctx.moveTo(right, bottom - corner);
    ctx.lineTo(right, bottom);
    ctx.lineTo(right - corner, bottom);
    ctx.moveTo(left + corner, bottom);
    ctx.lineTo(left, bottom);
    ctx.lineTo(left, bottom - corner);
    ctx.stroke();
  }

  function drawRelationshipHint(ctx: CanvasRenderingContext2D) {
    const relationship = relationships.find((item) => item.type !== "lost_ball");
    if (!relationship) return;
    ctx.save();
    ctx.fillStyle = "rgba(8, 10, 9, 0.52)";
    ctx.fillRect(16, 16, 190, 30);
    ctx.fillStyle = "#f7f4eb";
    ctx.font = "700 13px system-ui";
    ctx.fillText(labelRelationship(relationship.type), 28, 36);
    ctx.restore();
  }

  function drawDebug(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(16, 16, 320, detectorError ? 166 : 146);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 13px system-ui";
    ctx.fillText(`DEBUG VIEW`, 28, 38);
    ctx.fillText(`Objects: ${objectsRef.current.length}`, 28, 60);
    ctx.fillText(`Frame: ${frameIdRef.current}`, 28, 82);
    ctx.fillText(`Model: ${modelState}`, 28, 104);
    ctx.fillText(`Detector: ${detectorUrl.replace("http://", "")}`, 28, 126);
    ctx.fillText(`Cadence: ${Math.round(lastCadenceMs)}ms  Latency: ${Math.round(lastInferenceMs)}ms`, 28, 148);
    if (detectorError) ctx.fillText(`Error: ${detectorError.slice(0, 34)}`, 28, 170);
    ctx.restore();
  }

  function toggleMode(nextMode: OverlayMode) {
    setOverlayMode(nextMode);
    if (nextMode === "debug") recordAxisVisionObjectEvent("debug_mode_enabled");
  }

  const status = useMemo(() => {
    const lockedPlayers = players.filter((object) => object.state === "locked" || object.state === "manual_override").length;
    return {
      ball: ball?.state === "lost" ? "lost" : ball ? "locked" : "searching",
      players: `${lockedPlayers || players.length} locked`,
      rim: rim ? "locked" : "searching",
    };
  }, [ball, players, rim]);

  return (
    <main className="axis-object-lock">
      <section className="axis-object-lock__stage" aria-label="Axis Vision object lock">
        <video ref={videoRef} autoPlay className="axis-object-lock__video" muted playsInline />
        <canvas
          ref={canvasRef}
          className="axis-object-lock__canvas"
          onPointerDown={handleCanvasPointerDown}
          onPointerLeave={handleCanvasPointerUp}
          onPointerUp={handleCanvasPointerUp}
        />

        {cameraState !== "live" && (
          <div className="axis-object-lock__empty">
            <strong>{productName}</strong>
            <p>Find the player. Find the rim. Find the ball.</p>
            <button type="button" onClick={() => void startVision()}>
              Start Vision
            </button>
          </div>
        )}

        <header className="axis-object-lock__top">
          <div>
            <strong>{productName}</strong>
            <span>{cameraState === "live" ? "Live" : cameraState}</span>
          </div>
          <div className="axis-object-lock__toggle" aria-label="Overlay mode">
            <button data-active={overlayMode === "product"} type="button" onClick={() => toggleMode("product")}>
              Product
            </button>
            <button data-active={overlayMode === "debug"} type="button" onClick={() => toggleMode("debug")}>
              Debug
            </button>
          </div>
          <button data-active={rimSetup} type="button" onClick={() => setRimSetup((current) => !current)}>
            Set Rim
          </button>
        </header>

        {rimSetup && <div className="axis-object-lock__hint">Tap the rim to lock the anchor.</div>}

        <footer className="axis-object-lock__bottom">
          <div><span>Player</span><strong>{status.players}</strong></div>
          <div><span>Rim</span><strong>{status.rim}</strong></div>
          <div><span>Ball</span><strong>{status.ball}</strong></div>
          {cameraState === "live" ? (
            <button type="button" onClick={stopVision}>Stop</button>
          ) : (
            <button type="button" onClick={() => void startVision()}>Start</button>
          )}
        </footer>

        {error && <p className="axis-object-lock__error">{error}</p>}
      </section>
      <style jsx>{styles}</style>
    </main>
  );
}

function labelRelationship(type: string) {
  if (type === "possible_possession") return "Possession possible";
  if (type === "shot_window") return "Shot window";
  if (type === "drive_window") return "Drive window";
  if (type === "finish_window") return "Finish window";
  if (type === "contested_window") return "Contested";
  return "Ball lost";
}

const styles = `
  .axis-object-lock {
    background: #050706;
    color: #f7f4eb;
    min-height: 100dvh;
    overflow: hidden;
  }

  .axis-object-lock__stage {
    background: #050706;
    min-height: 100dvh;
    position: relative;
  }

  .axis-object-lock__video,
  .axis-object-lock__canvas {
    height: 100dvh;
    inset: 0;
    object-fit: cover;
    position: absolute;
    width: 100%;
  }

  .axis-object-lock__canvas {
    touch-action: none;
    z-index: 2;
  }

  .axis-object-lock__empty {
    align-content: center;
    background: radial-gradient(circle at top, rgba(216, 173, 82, 0.12), transparent 26rem), #050706;
    display: grid;
    gap: 0.8rem;
    inset: 0;
    justify-items: start;
    padding: 1.2rem;
    position: absolute;
    z-index: 5;
  }

  .axis-object-lock__empty strong {
    font-size: clamp(2.4rem, 14vw, 6rem);
    letter-spacing: -0.08em;
    line-height: 0.9;
  }

  .axis-object-lock__empty p {
    color: rgba(247, 244, 235, 0.72);
    margin: 0;
  }

  .axis-object-lock button {
    background: rgba(247, 244, 235, 0.9);
    border: 1px solid rgba(247, 244, 235, 0.18);
    border-radius: 999px;
    color: #050706;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 850;
    min-height: 2.65rem;
    padding: 0 0.85rem;
  }

  .axis-object-lock button[data-active="true"],
  .axis-object-lock__toggle button[data-active="true"] {
    background: rgba(216, 173, 82, 0.92);
    color: #151008;
  }

  .axis-object-lock__top,
  .axis-object-lock__bottom,
  .axis-object-lock__hint,
  .axis-object-lock__error {
    backdrop-filter: blur(18px);
    background: rgba(5, 7, 6, 0.48);
    border: 1px solid rgba(247, 244, 235, 0.12);
    border-radius: 1.2rem;
    position: absolute;
    z-index: 4;
  }

  .axis-object-lock__top {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    left: 0.75rem;
    right: 0.75rem;
    top: max(0.75rem, env(safe-area-inset-top));
    padding: 0.5rem;
  }

  .axis-object-lock__top div:first-child {
    display: grid;
    gap: 0.05rem;
  }

  .axis-object-lock__top strong {
    font-size: 0.92rem;
  }

  .axis-object-lock__top span,
  .axis-object-lock__bottom span {
    color: rgba(247, 244, 235, 0.62);
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .axis-object-lock__toggle {
    display: flex;
    gap: 0.25rem;
  }

  .axis-object-lock__toggle button {
    background: rgba(247, 244, 235, 0.1);
    color: #f7f4eb;
    min-height: 2.25rem;
  }

  .axis-object-lock__hint {
    left: 50%;
    padding: 0.7rem 0.9rem;
    top: 5.6rem;
    transform: translateX(-50%);
    white-space: nowrap;
  }

  .axis-object-lock__bottom {
    align-items: center;
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    display: grid;
    gap: 0.45rem;
    grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
    left: 0.75rem;
    right: 0.75rem;
    padding: 0.55rem;
  }

  .axis-object-lock__bottom div {
    display: grid;
    gap: 0.08rem;
    min-width: 0;
  }

  .axis-object-lock__bottom strong {
    font-size: 0.78rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .axis-object-lock__error {
    color: #ffd7c7;
    left: 1rem;
    margin: 0;
    padding: 0.75rem;
    right: 1rem;
    top: 6rem;
  }

  @media (min-width: 900px) {
    .axis-object-lock__stage {
      margin: 0 auto;
      max-width: 76rem;
    }
  }
`;
