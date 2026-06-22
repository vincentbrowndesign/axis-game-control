"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadAxisPoseDetector,
  type AxisPoseDetector,
  type AxisPoseFrame,
  type AxisPoseLandmark,
} from "../../lib/axis/axis-pose-detector";
import {
  createAxisJumpRopeCounter,
  type AxisJumpRopeState,
} from "../../lib/axis/axis-jump-rope-counter";

type CameraStatus = "idle" | "requesting" | "live" | "denied" | "error" | "unsupported";
type ModelStatus = "idle" | "loading" | "ready" | "error";
type CounterStatus = "idle" | "running" | "error";
type FacingMode = "environment" | "user";

type JumpRopeEvidenceFrame = {
  frameId: number;
  timestamp: number;
  confidence: number;
  reps: number;
  phase: AxisJumpRopeState["phase"];
  jumpsPerMinute: number;
  rhythmScore: number;
};

type JumpRopeEvidence = {
  route: "/axis/jump-rope";
  sessionId: string;
  startedAt: number;
  endedAt?: number;
  durationMs: number;
  repCount: number;
  maxStreak: number;
  averageRhythmScore: number;
  confidenceSummary: {
    average: number;
    latest: number;
    frames: number;
  };
  samples: AxisJumpRopeState["samples"];
  repEvents: AxisJumpRopeState["events"];
  frames: JumpRopeEvidenceFrame[];
};

const poseIntervalMs = 75;
const maxEvidenceFrames = 900;
const skeletonPairs = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
] as const;

function createSessionId() {
  return `jump-${Date.now().toString(36)}`;
}

function emptyJumpState(): AxisJumpRopeState {
  return {
    confidence: 0,
    events: [],
    jumpsPerMinute: 0,
    phase: "idle",
    reps: 0,
    rhythmScore: 0,
    samples: [],
    streak: 0,
  };
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatPercent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function formatSize(value: number) {
  return Math.round(value).toString();
}

function findLandmark(frame: AxisPoseFrame | null, name: string) {
  return frame?.landmarks.find((landmark) => landmark.name === name) ?? null;
}

function midpoint(a: AxisPoseLandmark | null, b: AxisPoseLandmark | null) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export default function AxisJumpRopeCounter() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<AxisPoseDetector | null>(null);
  const counterRef = useRef(createAxisJumpRopeCounter());
  const rafRef = useRef<number | null>(null);
  const counterRunningRef = useRef(false);
  const lastPoseAtRef = useRef(0);
  const latestPoseRef = useRef<AxisPoseFrame | null>(null);
  const evidenceFramesRef = useRef<JumpRopeEvidenceFrame[]>([]);
  const sessionIdRef = useRef("jump-local");
  const sessionStartedAtRef = useRef(0);
  const maxStreakRef = useRef(0);
  const rhythmTotalRef = useRef(0);
  const rhythmCountRef = useRef(0);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [counterStatus, setCounterStatus] = useState<CounterStatus>("idle");
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [jumpState, setJumpState] = useState<AxisJumpRopeState>(emptyJumpState);
  const [sessionId, setSessionId] = useState(sessionIdRef.current);
  const [sessionStartedAt, setSessionStartedAt] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastError, setLastError] = useState("");
  const [poseFrameCount, setPoseFrameCount] = useState(0);
  const [evidenceFrames, setEvidenceFrames] = useState<JumpRopeEvidenceFrame[]>([]);

  const isCameraLive = cameraStatus === "live";
  const canStartCounter = isCameraLive && counterStatus !== "running";

  const confidenceLabel = useMemo(
    () => formatPercent(jumpState.confidence),
    [jumpState.confidence],
  );

  useEffect(() => {
    if (sessionStartedAtRef.current === 0) {
      const nextSessionId = createSessionId();
      sessionIdRef.current = nextSessionId;
      sessionStartedAtRef.current = Date.now();
      setSessionId(nextSessionId);
      setSessionStartedAt(sessionStartedAtRef.current);
    }

    const interval = window.setInterval(() => {
      if (sessionStartedAtRef.current > 0) {
        setElapsedMs(Date.now() - sessionStartedAtRef.current);
      }
    }, 500);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      stopCounter();
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera(nextFacingMode: FacingMode = facingMode) {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unsupported");
      setLastError("Camera is not supported in this browser.");
      return;
    }

    setLastError("");
    setCameraStatus("requesting");

    try {
      stopCameraTracks();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: nextFacingMode },
          height: { ideal: 720 },
          width: { ideal: 1280 },
        },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraStatus("live");
      drawOverlay(latestPoseRef.current, jumpState);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera could not start.";
      setCameraStatus(message.toLowerCase().includes("permission") ? "denied" : "error");
      setLastError(message);
    }
  }

  function stopCameraTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function stopCamera() {
    stopCounter();
    stopCameraTracks();
    setCameraStatus("idle");
    clearCanvas();
  }

  async function flipCamera() {
    const nextMode: FacingMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (!isCameraLive) return;

    stopCounter();
    stopCameraTracks();
    setCameraStatus("idle");

    window.setTimeout(() => {
      void startCamera(nextMode);
    }, 100);
  }

  async function startCounter() {
    if (!videoRef.current || !isCameraLive) {
      setLastError("Start the camera first.");
      return;
    }

    setLastError("");
    setModelStatus((status) => (status === "ready" ? status : "loading"));

    try {
      if (!detectorRef.current) detectorRef.current = await loadAxisPoseDetector();
      setModelStatus("ready");
      setCounterStatus("running");
      counterRunningRef.current = true;
      lastPoseAtRef.current = 0;
      if (rafRef.current === null) rafRef.current = window.requestAnimationFrame(runPoseLoop);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pose model could not load.";
      setModelStatus("error");
      setCounterStatus("error");
      setLastError(message);
      counterRunningRef.current = false;
    }
  }

  function stopCounter() {
    counterRunningRef.current = false;
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setCounterStatus("idle");
  }

  function resetSession() {
    const nextSessionId = createSessionId();
    sessionIdRef.current = nextSessionId;
    sessionStartedAtRef.current = Date.now();
    counterRef.current.reset();
    evidenceFramesRef.current = [];
    latestPoseRef.current = null;
    maxStreakRef.current = 0;
    rhythmTotalRef.current = 0;
    rhythmCountRef.current = 0;
    setSessionId(nextSessionId);
    setSessionStartedAt(sessionStartedAtRef.current);
    setElapsedMs(0);
    setEvidenceFrames([]);
    setJumpState(emptyJumpState());
    setPoseFrameCount(0);
    clearCanvas();
  }

  function runPoseLoop(timestamp: number) {
    rafRef.current = null;

    if (!counterRunningRef.current || !videoRef.current || !detectorRef.current) return;

    if (timestamp - lastPoseAtRef.current >= poseIntervalMs) {
      lastPoseAtRef.current = timestamp;

      try {
        const poseFrame = detectorRef.current.detect(videoRef.current, timestamp);
        latestPoseRef.current = poseFrame;
        const nextState = counterRef.current.update(poseFrame, timestamp);
        maxStreakRef.current = Math.max(maxStreakRef.current, nextState.streak);

        if (nextState.rhythmScore > 0) {
          rhythmTotalRef.current += nextState.rhythmScore;
          rhythmCountRef.current += 1;
        }

        if (poseFrame) {
          const evidenceFrame: JumpRopeEvidenceFrame = {
            confidence: poseFrame.confidence,
            frameId: poseFrame.frameId,
            jumpsPerMinute: nextState.jumpsPerMinute,
            phase: nextState.phase,
            reps: nextState.reps,
            rhythmScore: nextState.rhythmScore,
            timestamp,
          };
          const nextFrames = [...evidenceFramesRef.current, evidenceFrame].slice(-maxEvidenceFrames);
          evidenceFramesRef.current = nextFrames;
          setEvidenceFrames(nextFrames);
          setPoseFrameCount((count) => count + 1);
        }

        setJumpState(nextState);
        drawOverlay(poseFrame, nextState);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pose detection failed.";
        setCounterStatus("error");
        setLastError(message);
        counterRunningRef.current = false;
        return;
      }
    } else {
      drawOverlay(latestPoseRef.current, jumpState);
    }

    rafRef.current = window.requestAnimationFrame(runPoseLoop);
  }

  function ensureCanvasSize() {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, height: rect.height, width: rect.width };
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function pointToCanvas(point: AxisPoseLandmark | { x: number; y: number }, width: number, height: number) {
    return {
      x: point.x * width,
      y: point.y * height,
    };
  }

  function drawOverlay(poseFrame: AxisPoseFrame | null, state: AxisJumpRopeState) {
    const drawing = ensureCanvasSize();
    if (!drawing) return;

    const { ctx, height, width } = drawing;
    ctx.clearRect(0, 0, width, height);

    if (poseFrame) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(141, 239, 196, 0.82)";
      ctx.fillStyle = "rgba(141, 239, 196, 0.9)";

      for (const [aName, bName] of skeletonPairs) {
        const a = findLandmark(poseFrame, aName);
        const b = findLandmark(poseFrame, bName);
        if (!a || !b) continue;
        const start = pointToCanvas(a, width, height);
        const end = pointToCanvas(b, width, height);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }

      for (const point of poseFrame.landmarks) {
        const canvasPoint = pointToCanvas(point, width, height);
        ctx.beginPath();
        ctx.arc(canvasPoint.x, canvasPoint.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      const hip = midpoint(findLandmark(poseFrame, "left_hip"), findLandmark(poseFrame, "right_hip"));
      const ankle = midpoint(
        findLandmark(poseFrame, "left_ankle"),
        findLandmark(poseFrame, "right_ankle"),
      );

      if (hip) {
        const p = pointToCanvas(hip, width, height);
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText("HIP", p.x + 10, p.y - 8);
      }

      if (ankle) {
        const p = pointToCanvas(ankle, width, height);
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText("ANKLE", p.x + 10, p.y - 8);
      }
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
    ctx.fillRect(18, 18, 190, 76);
    ctx.fillStyle = "#fff";
    ctx.font = "800 14px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`REPS ${state.reps}`, 32, 44);
    ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`PHASE ${state.phase.toUpperCase()}`, 32, 65);
    ctx.fillText(`RHYTHM ${state.rhythmScore}`, 32, 84);
  }

  function createEvidence(): JumpRopeEvidence {
    const frames = evidenceFramesRef.current;
    const confidenceAverage =
      frames.length === 0
        ? 0
        : frames.reduce((sum, frame) => sum + frame.confidence, 0) / frames.length;

    return {
      averageRhythmScore:
        rhythmCountRef.current === 0
          ? 0
          : Math.round(rhythmTotalRef.current / rhythmCountRef.current),
      confidenceSummary: {
        average: confidenceAverage,
        frames: frames.length,
        latest: jumpState.confidence,
      },
      durationMs: Date.now() - sessionStartedAtRef.current,
      endedAt: counterRunningRef.current ? undefined : Date.now(),
      frames,
      maxStreak: maxStreakRef.current,
      repCount: jumpState.reps,
      repEvents: jumpState.events,
      route: "/axis/jump-rope",
      samples: jumpState.samples,
      sessionId: sessionIdRef.current,
      startedAt: sessionStartedAtRef.current,
    };
  }

  function exportEvidenceJson() {
    const evidence = createEvidence();
    const blob = new Blob([JSON.stringify(evidence, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `axis-jump-rope-${sessionIdRef.current}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-dvh bg-black text-white">
      <section className="relative min-h-dvh overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full bg-black object-contain"
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {cameraStatus !== "live" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <button
              type="button"
              onClick={() => void startCamera()}
              className="rounded-full border border-white/20 bg-white px-7 py-4 text-sm font-black uppercase tracking-[0.2em] text-black shadow-2xl"
            >
              Start Camera
            </button>
          </div>
        ) : null}

        <div className="pointer-events-none absolute left-0 right-0 top-0 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-black tracking-[0.22em]">AXIS JUMP ROPE</div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/72">
                <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 backdrop-blur">
                  Camera {cameraStatus}
                </span>
                <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 backdrop-blur">
                  Pose {modelStatus}
                </span>
                <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 backdrop-blur">
                  Counter {counterStatus}
                </span>
              </div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-black/40 px-5 py-4 text-right shadow-2xl backdrop-blur">
              <div className="text-6xl font-black leading-none tabular-nums">{jumpState.reps}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/62">
                Reps
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {lastError ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-950/70 px-4 py-3 text-sm text-red-100 backdrop-blur">
              {lastError}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 rounded-3xl border border-white/12 bg-black/50 p-3 text-center text-xs font-bold uppercase tracking-[0.12em] backdrop-blur md:grid-cols-6">
            <div>
              <div className="text-white/45">Phase</div>
              <div className="mt-1 text-yellow-200">{jumpState.phase}</div>
            </div>
            <div>
              <div className="text-white/45">Rhythm</div>
              <div className="mt-1">{jumpState.rhythmScore}</div>
            </div>
            <div>
              <div className="text-white/45">Streak</div>
              <div className="mt-1">{jumpState.streak}</div>
            </div>
            <div>
              <div className="text-white/45">JPM</div>
              <div className="mt-1">{jumpState.jumpsPerMinute}</div>
            </div>
            <div>
              <div className="text-white/45">Pose</div>
              <div className="mt-1">{confidenceLabel}</div>
            </div>
            <div>
              <div className="text-white/45">Time</div>
              <div className="mt-1">{formatElapsed(elapsedMs)}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={cameraStatus === "requesting" || cameraStatus === "live"}
              className="rounded-full bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-black disabled:cursor-not-allowed disabled:bg-white/35"
            >
              {cameraStatus === "requesting" ? "Starting..." : "Start Camera"}
            </button>
            <button
              type="button"
              onClick={startCounter}
              disabled={!canStartCounter || modelStatus === "loading"}
              className="rounded-full bg-yellow-300 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-black disabled:cursor-not-allowed disabled:bg-yellow-300/35"
            >
              {modelStatus === "loading" ? "Loading Pose..." : "Start Counter"}
            </button>
            <button
              type="button"
              onClick={resetSession}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={flipCamera}
              disabled={!isCameraLive}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white disabled:opacity-40"
            >
              Flip Camera
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white"
            >
              Stop
            </button>
            <button
              type="button"
              onClick={exportEvidenceJson}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white"
            >
              Export JSON
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/45 p-4 text-xs text-white/62 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold uppercase tracking-[0.18em] text-white/80">
                  Evidence local
                </div>
                <div className="mt-1">
                  Session {sessionId} ·{" "}
                  {sessionStartedAt > 0 ? (
                    <>
                      Started{" "}
                      <time dateTime={new Date(sessionStartedAt).toISOString()}>
                        {new Date(sessionStartedAt).toLocaleTimeString()}
                      </time>
                    </>
                  ) : (
                    "Ready"
                  )}
                </div>
              </div>
              <div className="text-right">
                <div>Pose frames {formatSize(poseFrameCount)}</div>
                <div>Stored frames {formatSize(evidenceFrames.length)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
