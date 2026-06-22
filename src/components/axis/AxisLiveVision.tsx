"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadAxisLiveDetector,
  type AxisLiveDetector,
} from "../../lib/axis/axis-live-detector";
import { createAxisTracker } from "../../lib/axis/axis-simple-tracker";
import type {
  AxisVisionFrame,
  AxisVisionSession,
  AxisVisionTrack,
} from "../../lib/axis/axis-vision-types";
import type {
  AxisCalibrationPoint,
  AxisCalibrationState,
} from "../../lib/axis/axis-calibration-types";
import {
  updateBallTrail,
  type AxisBallTrailState,
} from "../../lib/axis/axis-ball-trail";

type CameraStatus = "idle" | "requesting" | "live" | "denied" | "error" | "unsupported";
type ModelStatus = "idle" | "loading" | "ready" | "error";
type AiStatus = "idle" | "running" | "error";
type FacingMode = "environment" | "user";
type CalMode = AxisCalibrationState["mode"];

const inferenceIntervalMs = 200;
const maxStoredFrames = 600;
const MONO = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";

function createSessionId() {
  return `vision-${Date.now().toString(36)}`;
}

function defaultCal(): AxisCalibrationState {
  return { mode: "off", paintPoints: [], points: [], updatedAt: Date.now() };
}

function makePoint(
  type: AxisCalibrationPoint["type"],
  label: string,
  x: number,
  y: number,
): AxisCalibrationPoint {
  return { createdAt: Date.now(), id: `${type}-${Date.now()}`, label, type, x, y };
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
  const calibrationRef = useRef<AxisCalibrationState>(defaultCal());
  const ballTrailRef = useRef<AxisBallTrailState>({ points: [], visible: false });
  const showTrailRef = useRef(true);
  const showCalibrationRef = useRef(true);
  const floorTapCountRef = useRef(0);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
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
  const [calibration, setCalibration] = useState<AxisCalibrationState>(defaultCal());
  const [calibrationMode, setCalibrationMode] = useState<CalMode>("off");
  const [ballTrail, setBallTrail] = useState<AxisBallTrailState>({ points: [], visible: false });
  const [showTrail, setShowTrail] = useState(true);

  const peopleCount = useMemo(
    () => activeTracks.filter((t) => t.kind === "person").length,
    [activeTracks],
  );

  useEffect(() => {
    return () => {
      stopAI();
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    calibrationRef.current = calibration;
  }, [calibration]);

  useEffect(() => {
    showTrailRef.current = showTrail;
  }, [showTrail]);

  useEffect(() => {
    tracksRef.current = activeTracks;
    drawDetections(activeTracks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTracks, cameraStatus, aiStatus, fps, frameCount, ballVisible, maxPeopleCount, calibration, ballTrail, showTrail]);

  // ─── Canvas click / calibration ────────────────────────────────

  function getVideoCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return null;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const ox = (rect.width - vw * scale) / 2;
    const oy = (rect.height - vh * scale) / 2;
    return { vx: (cx - ox) / scale, vy: (cy - oy) / scale };
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const mode = calibrationRef.current.mode !== "off" ? calibrationRef.current.mode : calibrationMode;
    if (mode === "off") return;

    const coords = getVideoCoords(e);
    if (!coords) return;
    const { vx, vy } = coords;

    const prev = calibrationRef.current;
    let next: AxisCalibrationState;

    if (mode === "set_rim") {
      const rim = makePoint("rim", "RIM", vx, vy);
      next = {
        ...prev,
        mode: "off",
        points: [...prev.points.filter((p) => p.type !== "rim"), rim],
        rim,
        updatedAt: Date.now(),
      };
    } else if (mode === "set_floor") {
      if (floorTapCountRef.current === 0) {
        const lf = makePoint("left_floor", "FLOOR L", vx, vy);
        floorTapCountRef.current = 1;
        next = {
          ...prev,
          points: [...prev.points.filter((p) => p.type !== "left_floor" && p.type !== "right_floor"), lf],
          updatedAt: Date.now(),
        };
      } else {
        const existingLeft = prev.points.find((p) => p.type === "left_floor");
        if (!existingLeft) return;
        const rf = makePoint("right_floor", "FLOOR R", vx, vy);
        floorTapCountRef.current = 0;
        next = {
          ...prev,
          floorLine: [existingLeft, rf],
          mode: "off",
          points: [...prev.points.filter((p) => p.type !== "right_floor"), rf],
          updatedAt: Date.now(),
        };
      }
    } else if (mode === "set_paint") {
      if (prev.paintPoints.length >= 2) return;
      const pt = makePoint(
        prev.paintPoints.length === 0 ? "paint_left" : "paint_right",
        `PAINT ${prev.paintPoints.length + 1}`,
        vx,
        vy,
      );
      const paintPoints = [...prev.paintPoints, pt];
      next = {
        ...prev,
        mode: paintPoints.length >= 2 ? "off" : prev.mode,
        paintPoints,
        points: [...prev.points, pt],
        updatedAt: Date.now(),
      };
    } else {
      return;
    }

    calibrationRef.current = next;
    setCalibration(next);
    setCalibrationMode(next.mode);
  }

  function activateCalMode(mode: CalMode) {
    const next = mode === calibrationMode ? "off" : mode;
    if (mode === "set_floor") floorTapCountRef.current = 0;
    setCalibrationMode(next);
  }

  function clearCalibration() {
    const next = defaultCal();
    calibrationRef.current = next;
    floorTapCountRef.current = 0;
    setCalibration(next);
    setCalibrationMode("off");
  }

  // ─── Camera / AI ────────────────────────────────────────────────

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
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    stopAI();

    if (cameraStatus === "live" || cameraStatus === "requesting") {
      setLastError("");
      setCameraStatus("requesting");
      stopCameraTracks();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: next }, height: { ideal: 720 }, width: { ideal: 1280 } },
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
      const ok = await startCamera();
      if (!ok) return;
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
        const nextPeopleCount = nextTracks.filter((t) => t.kind === "person").length;
        const nextBallCount = nextTracks.filter((t) => t.kind === "ball").length;
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

        const ballTrack = nextTracks.find((t) => t.kind === "ball" && t.status === "active");
        const nextTrail = updateBallTrail(ballTrailRef.current, ballTrack, frameCountRef.current, timestamp);
        ballTrailRef.current = nextTrail;

        tracksRef.current = nextTracks;
        setFrameCount(frameCountRef.current);
        setActiveTracks(nextTracks);
        setVisionFrames(visionFramesRef.current);
        setBallVisible(nextBallVisible);
        setBallLostCount(ballLostFramesRef.current);
        setMaxPeopleCount(maxPeopleCountRef.current);
        setBallTrail(nextTrail);

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

  // ─── Drawing ─────────────────────────────────────────────────────

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

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const ox = (rect.width - vw * scale) / 2;
    const oy = (rect.height - vh * scale) / 2;

    for (const track of nextTracks) {
      const [x, y, w, h] = track.bbox;
      const bx = ox + x * scale;
      const by = oy + y * scale;
      const bw = w * scale;
      const bh = h * scale;
      const color = track.kind === "ball" ? "#f8d45c" : "#7cf7d4";
      const label = track.kind === "ball"
        ? `${track.trackId} BALL ${Math.round(track.score * 100)}%`
        : `${track.trackId} ${Math.round(track.score * 100)}%`;

      ctx.strokeStyle = color;
      ctx.lineWidth = track.kind === "ball" ? 3 : 2;
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = "rgba(0,0,0,0.72)";
      const lw = Math.max(78, ctx.measureText(label).width + 18);
      ctx.fillRect(bx, Math.max(0, by - 28), lw, 24);
      ctx.fillStyle = color;
      ctx.font = MONO;
      ctx.fillText(label, bx + 9, Math.max(16, by - 11));
    }

    if (showCalibrationRef.current) drawCalibration(ctx, calibrationRef.current, ox, oy, scale);
    if (showTrailRef.current) drawTrail(ctx, ballTrailRef.current, ox, oy, scale);
    drawHud(ctx, rect.width, nextTracks);
  }

  function drawCalibration(
    ctx: CanvasRenderingContext2D,
    cal: AxisCalibrationState,
    ox: number,
    oy: number,
    scale: number,
  ) {
    ctx.font = MONO;

    if (cal.rim) {
      const rx = ox + cal.rim.x * scale;
      const ry = oy + cal.rim.y * scale;
      ctx.strokeStyle = "#f8d45c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx - 14, ry); ctx.lineTo(rx + 14, ry);
      ctx.moveTo(rx, ry - 14); ctx.lineTo(rx, ry + 14);
      ctx.stroke();
      ctx.strokeStyle = "#f8d45c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rx, ry, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#f8d45c";
      ctx.fillText("RIM", rx + 16, ry + 4);
    }

    if (cal.floorLine) {
      const [p1, p2] = cal.floorLine;
      const x1 = ox + p1.x * scale;
      const y1 = oy + p1.y * scale;
      const x2 = ox + p2.x * scale;
      const y2 = oy + p2.y * scale;
      ctx.strokeStyle = "#7cf7d4";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of [p1, p2]) {
        const px = ox + p.x * scale;
        const py = oy + p.y * scale;
        ctx.fillStyle = "#7cf7d4";
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(p.label, px + 8, py + 4);
      }
    }

    for (const p of cal.paintPoints) {
      const px = ox + p.x * scale;
      const py = oy + p.y * scale;
      ctx.fillStyle = "#f7a07c";
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f7a07c";
      ctx.fillText(p.label, px + 8, py + 4);
    }
  }

  function drawTrail(
    ctx: CanvasRenderingContext2D,
    trail: AxisBallTrailState,
    ox: number,
    oy: number,
    scale: number,
  ) {
    const pts = trail.points;
    if (pts.length < 2) return;

    for (let i = 1; i < pts.length; i++) {
      const alpha = (i / pts.length) * 0.72;
      ctx.strokeStyle = `rgba(248,212,92,${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox + pts[i - 1].x * scale, oy + pts[i - 1].y * scale);
      ctx.lineTo(ox + pts[i].x * scale, oy + pts[i].y * scale);
      ctx.stroke();
    }

    const last = pts[pts.length - 1];
    ctx.fillStyle = "#f8d45c";
    ctx.beginPath();
    ctx.arc(ox + last.x * scale, oy + last.y * scale, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHud(ctx: CanvasRenderingContext2D, width: number, tracks: AxisVisionTrack[]) {
    const people = tracks.filter((t) => t.kind === "person").length;
    const balls = tracks.filter((t) => t.kind === "ball").length;
    const ballState = balls > 0 ? "LIVE" : recentBallLostRef.current ? "LOST" : "SEARCHING";
    const cal = calibrationRef.current;
    const trail = ballTrailRef.current;

    const rimStr = `RIM: ${cal.rim ? "SET" : "NOT SET"}`;
    const trailStr = `TRAIL: ${showTrailRef.current ? "ON" : "OFF"}`;
    const dirStr = `BALL DIR: ${(trail.direction ?? "—").toUpperCase()}`;
    const speedStr = `BALL SPEED: ${trail.velocity ? Math.round(trail.velocity.speed) : "—"}`;

    const lines = [
      "AXIS LIVE VISION",
      `AI ${aiStatus.toUpperCase()}`,
      `PEOPLE: ${people} / ${maxPeopleCountRef.current}`,
      `BALL: ${ballState}`,
      `TRACKS: ${tracks.length}`,
      `FRAMES: ${frameCountRef.current}`,
      `FPS: ${fps.toFixed(1)}`,
      rimStr,
      trailStr,
      dirStr,
      speedStr,
    ];

    const boxH = 14 + lines.length * 24 + 8;
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(14, 14, Math.min(310, width - 28), boxH);

    lines.forEach((line, i) => {
      const y = 38 + i * 24;
      ctx.fillStyle = "#f8f7f2";
      ctx.font = i === 0
        ? "800 14px ui-monospace, SFMono-Regular, Menlo, monospace"
        : MONO;
      ctx.fillText(line, 28, y);
    });
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ─── Evidence / export ───────────────────────────────────────────

  function buildSessionExport() {
    const base: AxisVisionSession = {
      ballLostFrames: ballLostFramesRef.current,
      ballSeenFrames: ballSeenFramesRef.current,
      frames: visionFramesRef.current,
      maxPeopleCount: maxPeopleCountRef.current,
      sessionId,
      startedAt: sessionStartedAt,
    };
    const trail = ballTrailRef.current;
    return {
      ...base,
      calibration: calibrationRef.current,
      ballTrailSummary: {
        direction: trail.direction,
        lastSeenAt: trail.lastSeenAt,
        totalPoints: trail.points.length,
        velocity: trail.velocity,
        visible: trail.visible,
      },
    };
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportEvidenceJson() {
    const session = buildSessionExport();
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
    downloadBlob(blob, `axis-vision-session-${session.sessionId}.json`);
  }

  async function captureSnapshot() {
    const video = videoRef.current;
    const overlay = canvasRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const snap = document.createElement("canvas");
    snap.width = Math.max(1, Math.floor(rect.width * pixelRatio));
    snap.height = Math.max(1, Math.floor(rect.height * pixelRatio));
    const ctx = snap.getContext("2d");
    if (!ctx) return;

    ctx.scale(pixelRatio, pixelRatio);
    ctx.fillStyle = "#020304";
    ctx.fillRect(0, 0, rect.width, rect.height);
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
      const rw = video.videoWidth * scale;
      const rh = video.videoHeight * scale;
      const ox = (rect.width - rw) / 2;
      const oy = (rect.height - rh) / 2;
      ctx.drawImage(video, ox, oy, rw, rh);
    }
    ctx.drawImage(overlay, 0, 0, rect.width, rect.height);

    const blob = await new Promise<Blob | null>((resolve) => snap.toBlob(resolve, "image/png"));
    if (blob) downloadBlob(blob, `axis-vision-snapshot-${sessionId}.png`);
  }

  function clearSession() {
    const nextId = createSessionId();
    const nextAt = Date.now();
    trackerRef.current.reset();
    sessionIdRef.current = nextId;
    sessionStartedAtRef.current = nextAt;
    visionFramesRef.current = [];
    tracksRef.current = [];
    frameCountRef.current = 0;
    maxPeopleCountRef.current = 0;
    ballSeenFramesRef.current = 0;
    ballLostFramesRef.current = 0;
    recentBallLostRef.current = false;
    ballTrailRef.current = { points: [], visible: false };
    setSessionId(nextId);
    setSessionStartedAt(nextAt);
    setVisionFrames([]);
    setActiveTracks([]);

    setFrameCount(0);
    setMaxPeopleCount(0);
    setBallVisible(false);
    setBallLostCount(0);
    setBallTrail({ points: [], visible: false });
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

  const calActive = calibrationMode !== "off";

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
        <canvas
          className={`axis-live-vision__canvas${calActive ? " axis-live-vision__canvas--cal" : ""}`}
          onClick={handleCanvasClick}
          ref={canvasRef}
        />

        {!isCameraLive && (
          <div className="axis-live-vision__empty">
            <p>AXIS</p>
            <h1>Live camera AI</h1>
            <button
              disabled={cameraStatus === "requesting" || modelStatus === "loading"}
              onClick={startLiveVision}
              type="button"
            >
              {primaryLabel}
            </button>
          </div>
        )}

        {calActive && (
          <div className="axis-live-vision__cal-hint">
            {calibrationMode === "set_rim" && "TAP VIDEO TO SET RIM"}
            {calibrationMode === "set_floor" && (
              floorTapCountRef.current === 0 ? "TAP LEFT FLOOR POINT" : "TAP RIGHT FLOOR POINT"
            )}
            {calibrationMode === "set_paint" && (
              calibration.paintPoints.length === 0 ? "TAP PAINT POINT 1" : "TAP PAINT POINT 2"
            )}
          </div>
        )}
      </section>

      <header className="axis-live-vision__top">
        <div>
          <p>AXIS LIVE VISION</p>
          <strong>LIVE CAMERA</strong>
        </div>
        <span data-live={isCameraLive ? "true" : "false"}>{isCameraLive ? "LIVE" : cameraStatus.toUpperCase()}</span>
      </header>

      <aside className="axis-live-vision__status" aria-label="Live detection status">
        <div><span>Camera</span><strong>{isCameraLive ? (facingMode === "environment" ? "Back" : "Front") : cameraStatus}</strong></div>
        <div><span>AI</span><strong>{aiStatus === "running" ? "Running" : modelStatus}</strong></div>
        <div><span>People</span><strong>{peopleCount} / {maxPeopleCount}</strong></div>
        <div><span>Ball</span><strong>{ballVisible ? "Live" : ballLostCount > 0 ? "Lost" : "Searching"}</strong></div>
        <div><span>Tracks</span><strong>{activeTrackLabel}</strong></div>
        <div><span>Frames</span><strong>{visionFrames.length}</strong></div>
      </aside>

      <section
        className={`axis-live-vision__evidence ${evidencePanelOpen ? "is-open" : ""}`}
        aria-label="Evidence session panel"
      >
        <button
          className="axis-live-vision__evidence-toggle"
          onClick={() => setEvidencePanelOpen((o) => !o)}
          type="button"
        >
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
              <div><dt>Tracks</dt><dd>{activeTracks.map((t) => t.trackId).join(", ") || "None"}</dd></div>
              <div><dt>Rim</dt><dd>{calibration.rim ? "Set" : "Not set"}</dd></div>
              <div><dt>Floor</dt><dd>{calibration.floorLine ? "Set" : "Not set"}</dd></div>
              <div><dt>Trail pts</dt><dd>{ballTrail.points.length}</dd></div>
            </dl>
            <div className="axis-live-vision__evidence-actions">
              <button onClick={exportEvidenceJson} type="button">Export Evidence JSON</button>
              <button onClick={captureSnapshot} type="button">Capture Snapshot</button>
              <button onClick={clearSession} type="button">Clear Session</button>
            </div>
          </div>
        )}
      </section>

      <div className="axis-live-vision__tools" aria-label="Calibration and trail tools">
        <button
          data-active={calibrationMode === "set_rim" ? "true" : undefined}
          onClick={() => activateCalMode("set_rim")}
          type="button"
        >
          Set Rim
        </button>
        <button
          data-active={calibrationMode === "set_floor" ? "true" : undefined}
          onClick={() => activateCalMode("set_floor")}
          type="button"
        >
          Set Floor
        </button>
        <button
          data-active={calibrationMode === "set_paint" ? "true" : undefined}
          onClick={() => activateCalMode("set_paint")}
          type="button"
        >
          Set Paint
        </button>
        <button onClick={clearCalibration} type="button">Clear Cal</button>
        <button
          data-active={showTrail ? "true" : undefined}
          onClick={() => {
            const next = !showTrail;
            showTrailRef.current = next;
            setShowTrail(next);
          }}
          type="button"
        >
          Trail {showTrail ? "On" : "Off"}
        </button>
      </div>

      <footer className="axis-live-vision__controls" aria-label="Live vision controls">
        <button
          disabled={cameraStatus === "requesting" || modelStatus === "loading"}
          onClick={startLiveVision}
          type="button"
        >
          {isAiRunning ? "Vision Running" : "Start Vision"}
        </button>
        <button
          disabled={!isCameraLive || modelStatus === "loading" || isAiRunning}
          onClick={startAI}
          type="button"
        >
          Start AI
        </button>
        <button disabled={cameraStatus === "requesting"} onClick={flipCamera} type="button">
          Flip
        </button>
        <button onClick={stopCamera} type="button">Stop</button>
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

        .axis-live-vision__canvas--cal {
          cursor: crosshair;
          pointer-events: auto;
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

        .axis-live-vision__cal-hint {
          background: rgba(248, 212, 92, 0.14);
          border: 1px solid rgba(248, 212, 92, 0.38);
          border-radius: 999px;
          color: #f8d45c;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.7rem;
          font-weight: 800;
          left: 50%;
          letter-spacing: 0.1em;
          padding: 0.45rem 1.1rem;
          position: absolute;
          top: max(4rem, env(safe-area-inset-top, 0px) + 4rem);
          transform: translateX(-50%);
          white-space: nowrap;
          z-index: 5;
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

        .axis-live-vision button[data-active] {
          background: #f8d45c;
          border-color: #f8d45c;
          color: #020304;
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
          bottom: calc(9.8rem + env(safe-area-inset-bottom));
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
          bottom: calc(14.4rem + env(safe-area-inset-bottom));
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
        .axis-live-vision__tools button,
        .axis-live-vision__controls button:not(:first-child) {
          background: rgba(248, 247, 242, 0.08);
          color: #f8f7f2;
        }

        .axis-live-vision__tools {
          bottom: calc(5.6rem + env(safe-area-inset-bottom));
          display: grid;
          gap: 0.5rem;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          left: 0;
          padding: 0 1rem;
          position: absolute;
          right: 0;
          z-index: 4;
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
            bottom: 10rem;
            left: auto;
            right: 1.4rem;
          }

          .axis-live-vision__tools {
            bottom: 5.6rem;
            grid-template-columns: repeat(5, minmax(0, 10rem));
            justify-content: center;
          }

          .axis-live-vision__controls {
            grid-template-columns: repeat(4, minmax(0, 12rem));
            justify-content: center;
            padding-bottom: 1.25rem;
          }
        }

        @media (max-width: 560px) {
          .axis-live-vision__tools {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

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
