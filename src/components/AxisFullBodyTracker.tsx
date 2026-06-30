"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { type AxisFullBodyAIContext } from "../lib/basketball";

type CameraFacing = "front" | "rear";
type CameraState = "idle" | "requesting" | "switching" | "ready" | "error" | "denied";
type PoseState = "idle" | "loading" | "no-body" | "partial" | "full" | "low-confidence" | "error";
type HfTask = "object_detection" | "segmentation" | "frame_reasoning";
type HfState = "idle" | "checking-objects" | "checking-mask" | "asking-ai" | "received" | "error";
type HfError =
  | "none"
  | "token-missing"
  | "frame-unavailable"
  | "frame-too-large"
  | "token-unauthorized"
  | "model-not-found"
  | "input-mismatch"
  | "model-loading"
  | "request-failed"
  | "result-unavailable"
  | "could-not-check";

type AxisFullBodyTruth = {
  cameraActive: boolean;
  sessionStarted: boolean;
  poseDetected: boolean;
  fullBodyVisible: boolean;
  upperBodyVisible: boolean;
  lowerBodyVisible: boolean;
  feetVisible: boolean;
  fullBodyPercent: number;
  bodyContextReady: boolean;
  visionReady: boolean;
  message: string;
};

type AxisVisionContextFrame = {
  timestampMs: number;
  cameraFacing: CameraFacing;
  bodyContext: {
    bodyDetected: boolean;
    fullBodyVisible: boolean;
    poseConfidence?: number;
    stanceRead?: string;
    balanceRead?: string;
    kneeBendRead?: string;
    torsoLeanRead?: string;
  };
  vision: {
    objects?: unknown;
    segmentation?: unknown;
    frameReasoning?: unknown;
  };
};

type ReadValue =
  | "full body"
  | "partial body"
  | "no body"
  | "narrow"
  | "normal"
  | "wide"
  | "balanced"
  | "left-heavy"
  | "right-heavy"
  | "forward"
  | "backward"
  | "unstable"
  | "low"
  | "medium"
  | "high"
  | "level"
  | "tilted left"
  | "tilted right"
  | "upright"
  | "forward lean"
  | "backward lean"
  | "stable";

type FullBodyFrameStatus = {
  bodyDetected: boolean;
  fullBodyVisible: boolean;
  upperBodyVisible: boolean;
  lowerBodyVisible: boolean;
  feetVisible: boolean;
  leftSideVisible: boolean;
  rightSideVisible: boolean;
  confidence: number;
  message: string;
};

type Point = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

type AxisFullBodyFrame = {
  sessionId: string;
  timestampMs: number;
  cameraFacing: CameraFacing;
  frameStatus: Omit<FullBodyFrameStatus, "message">;
  landmarks: Array<{ name: string; x: number; y: number; z?: number; visibility?: number }>;
  bodyStructure: {
    bodyCenter?: { x: number; y: number };
    shoulderLineAngle?: number;
    hipLineAngle?: number;
    spineAngle?: number;
    headOverHips?: "stacked" | "forward" | "back" | "left" | "right";
    torsoLean?: "upright" | "forward" | "backward" | "left" | "right";
    bodyHeightEstimate?: number;
  };
  base: {
    stanceWidth?: "narrow" | "normal" | "wide";
    leftFootVisible: boolean;
    rightFootVisible: boolean;
    baseStable?: boolean;
    balance?: "balanced" | "left-heavy" | "right-heavy" | "forward" | "backward" | "unstable";
  };
  jointAngles: {
    leftKnee?: number;
    rightKnee?: number;
    leftHip?: number;
    rightHip?: number;
    leftAnkle?: number;
    rightAnkle?: number;
    leftElbow?: number;
    rightElbow?: number;
    leftShoulder?: number;
    rightShoulder?: number;
  };
  movement: {
    bodyCenterVelocity?: number;
    verticalChange?: number;
    lateralChange?: number;
    kneeBendChange?: number;
    hipDropChange?: number;
    footPlantChange?: string;
  };
  reads: {
    frameRead: "no_body" | "partial_body" | "full_body";
    stanceRead?: string;
    balanceRead?: string;
    kneeBendRead?: string;
    hipLevelRead?: string;
    shoulderLevelRead?: string;
    torsoLeanRead?: string;
    movementQualityRead?: string;
    notes: string[];
  };
};

const wasmPath = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const modelPath =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

const landmarkNames = [
  "nose",
  "leftEyeInner",
  "leftEye",
  "leftEyeOuter",
  "rightEyeInner",
  "rightEye",
  "rightEyeOuter",
  "leftEar",
  "rightEar",
  "mouthLeft",
  "mouthRight",
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist",
  "leftPinky",
  "rightPinky",
  "leftIndex",
  "rightIndex",
  "leftThumb",
  "rightThumb",
  "leftHip",
  "rightHip",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle",
  "leftHeel",
  "rightHeel",
  "leftToe",
  "rightToe",
] as const;

const skeletonPairs: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],
];

const importantIndexes = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
const visibleThreshold = 0.28;

const defaultStatus: FullBodyFrameStatus = {
  bodyDetected: false,
  fullBodyVisible: false,
  upperBodyVisible: false,
  lowerBodyVisible: false,
  feetVisible: false,
  leftSideVisible: false,
  rightSideVisible: false,
  confidence: 0,
  message: "Step fully into frame",
};

export function AxisFullBodyTracker() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastFrameRef = useRef<AxisFullBodyFrame | null>(null);
  const timelineRef = useRef<AxisFullBodyFrame[]>([]);
  const cameraFacingRef = useRef<CameraFacing>("rear");
  const sessionIdRef = useRef(crypto.randomUUID());

  const [title, setTitle] = useState("Full body session");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("rear");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [, setPoseState] = useState<PoseState>("idle");
  const [frameStatus, setFrameStatus] = useState<FullBodyFrameStatus>(defaultStatus);
  const [aiContext, setAiContext] = useState<AxisFullBodyAIContext | null>(null);
  const [cameraMessage, setCameraMessage] = useState("Camera off");
  const [hfState, setHfState] = useState<HfState>("idle");
  const [hfError, setHfError] = useState<HfError>("none");
  const [hfTokenPresent, setHfTokenPresent] = useState(false);
  const [hfRouteReady, setHfRouteReady] = useState(false);
  const [hfLastResult, setHfLastResult] = useState<AxisVisionContextFrame | null>(null);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      landmarkerRef.current?.close();
    };
  }, []);

  useEffect(() => {
    cameraFacingRef.current = cameraFacing;
  }, [cameraFacing]);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/axis/vision/huggingface/health")
      .then(async (response) => {
        if (!response.ok) throw new Error("HF health check failed");
        return (await response.json()) as {
          ok?: boolean;
          hfTokenPresent?: boolean;
          env?: { hfTokenPresent?: boolean };
        };
      })
      .then((result) => {
        if (cancelled) return;
        const tokenPresent = Boolean(result.hfTokenPresent ?? result.env?.hfTokenPresent);
        setHfTokenPresent(tokenPresent);
        setHfRouteReady(true);
        setHfError(tokenPresent ? "none" : "token-missing");
      })
      .catch(() => {
        if (cancelled) return;
        setHfRouteReady(false);
        setHfError("request-failed");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fullBodyPercent = useMemo(() => {
    return aiContext?.summary.totalFrames
      ? Math.round((aiContext.summary.fullBodyFrames / aiContext.summary.totalFrames) * 100)
      : 0;
  }, [aiContext]);

  const truth = useMemo(
    () =>
      buildFullBodyTruth({
        cameraState,
        sessionStarted,
        frameStatus,
        fullBodyPercent,
        hfTokenPresent,
      }),
    [cameraState, frameStatus, fullBodyPercent, sessionStarted, hfTokenPresent],
  );

  const cameraLabel = cameraStatusLabel(cameraState, cameraMessage);

  async function startCamera(nextFacing = cameraFacing) {
    await openCamera(nextFacing, cameraState === "ready" || cameraState === "switching");
  }

  async function switchCamera(nextFacing: CameraFacing) {
    setCameraFacing(nextFacing);
    cameraFacingRef.current = nextFacing;
    await openCamera(nextFacing, cameraState === "ready" || cameraState === "requesting" || cameraState === "switching");
  }

  async function openCamera(nextFacing: CameraFacing, isSwitching: boolean) {
    setCameraState(isSwitching ? "switching" : "requesting");
    setPoseState("loading");
    setFrameStatus({ ...defaultStatus, message: "Reading body" });
    stopCurrentStream();

    try {
      const cameraResult = await requestCameraStream(nextFacing);
      await attachStream(cameraResult.stream);

      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelPath, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      setCameraState("ready");
      setCameraFacing(nextFacing);
      cameraFacingRef.current = nextFacing;
      setCameraMessage(
        cameraResult.message || `${nextFacing === "front" ? "Front" : "Rear"} camera active`,
      );
      setPoseState("no-body");
      lastVideoTimeRef.current = -1;
      detectPoseLoop();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setCameraState(name === "NotAllowedError" ? "denied" : "error");
      setPoseState("error");
      setCameraMessage(name === "NotAllowedError" ? "Camera permission needed" : "Camera unavailable");
      setFrameStatus({
        ...defaultStatus,
        message: name === "NotAllowedError" ? "Allow camera access" : "Need more light",
      });
    }
  }

  function stopCurrentStream() {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    lastVideoTimeRef.current = -1;
    clearCanvas();

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }

  async function requestCameraStream(nextFacing: CameraFacing): Promise<{
    stream: MediaStream;
    message?: string;
  }> {
    const facingMode = nextFacing === "front" ? "user" : ({ ideal: "environment" } as const);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      return { stream };
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        throw error;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");

      if (!cameras.length) {
        throw error;
      }

      if (cameras.length === 1) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: { exact: cameras[0].deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        return { stream, message: "Only one camera found" };
      }

      const selectedCamera =
        cameras.find((device) => {
          const label = device.label.toLowerCase();
          return nextFacing === "front"
            ? label.includes("front") || label.includes("user")
            : label.includes("back") || label.includes("rear") || label.includes("environment");
        }) || cameras[0];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: { exact: selectedCamera.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      return { stream };
    }
  }

  async function attachStream(stream: MediaStream) {
    streamRef.current = stream;

    if (!videoRef.current) return;

    const video = videoRef.current;
    video.srcObject = stream;

    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) {
        resolve();
        return;
      }

      video.onloadedmetadata = () => resolve();
    });

    await video.play();
  }

  function detectPoseLoop() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(detectPoseLoop);
      return;
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      handlePoseResult(landmarker.detectForVideo(video, video.currentTime * 1000), video);
    }

    animationRef.current = requestAnimationFrame(detectPoseLoop);
  }

  function handlePoseResult(result: PoseLandmarkerResult, video: HTMLVideoElement) {
    const landmarks = result.landmarks[0];
    resizeCanvasToVideo(video);

    if (!landmarks?.length) {
      clearCanvas();
      const status = { ...defaultStatus, message: "No body detected" };
      setFrameStatus(status);
      setPoseState("no-body");
      return;
    }

    const status = buildFrameStatus(landmarks);
    drawPose(landmarks, status);
    const frame = buildFullBodyFrame(
      sessionIdRef.current,
      landmarks,
      cameraFacingRef.current,
      status,
      lastFrameRef.current,
    );

    lastFrameRef.current = frame;
    timelineRef.current = [...timelineRef.current.slice(-119), frame];
    const nextContext = buildAIContext(
      sessionIdRef.current,
      cameraFacingRef.current,
      timelineRef.current,
      streamRef.current?.getVideoTracks()[0]?.getSettings().frameRate,
    );
    saveFullBodyContext(title, nextContext);

    setFrameStatus(status);
    setAiContext(nextContext);
    setPoseState(nextPoseState(status));
  }

  async function captureAndSendToHf(task: HfTask) {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    const frame = lastFrameRef.current;

    if (!truth.cameraActive || !truth.poseDetected) {
      setHfState("error");
      setHfError("frame-unavailable");
      return;
    }

    if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setHfState("error");
      setHfError("frame-unavailable");
      return;
    }

    const taskToState: Record<HfTask, HfState> = {
      object_detection: "checking-objects",
      segmentation: "checking-mask",
      frame_reasoning: "asking-ai",
    };

    setHfState(taskToState[task]);
    setHfError("none");

    try {
      const maxWidth = 640;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setHfState("error");
        setHfError("frame-unavailable");
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
      const base64Image = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

      const response = await fetch("/api/axis/vision/huggingface", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          image: {
            type: "base64",
            value: base64Image,
          },
          axisContext: {
            sessionId: sessionIdRef.current,
            cameraFacing,
            bodyDetected: frameStatus.bodyDetected,
            fullBodyVisible: frameStatus.fullBodyVisible,
            poseConfidence: frameStatus.confidence,
            stanceRead: frame?.reads.stanceRead,
            balanceRead: frame?.reads.balanceRead,
            kneeBendRead: frame?.reads.kneeBendRead,
            torsoLeanRead: frame?.reads.torsoLeanRead,
            frameStatus: frameStatus.message,
          },
          prompt: task === "frame_reasoning"
            ? "Describe this athlete's body position, stance, balance, and any observable movement patterns."
            : undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null) as { error?: string } | null;
        const errCode = errData?.error ?? "";
        setHfError(hfErrorFromCode(errCode));
        setHfState("error");
        return;
      }

      const result = await response.json() as {
        task: HfTask;
        model: HfTask;
        huggingFaceResult?: unknown;
        result?: unknown;
      };

      setHfLastResult((previous) => mergeVisionContextFrame(previous, {
        task,
        result: result.huggingFaceResult ?? result.result,
        timestampMs: Date.now(),
        cameraFacing,
        bodyDetected: frameStatus.bodyDetected,
        fullBodyVisible: frameStatus.fullBodyVisible,
        poseConfidence: frameStatus.confidence,
        stanceRead: frame?.reads.stanceRead,
        balanceRead: frame?.reads.balanceRead,
        kneeBendRead: frame?.reads.kneeBendRead,
        torsoLeanRead: frame?.reads.torsoLeanRead,
      }));
      setHfState("received");
      setHfError("none");
    } catch {
      setHfState("error");
      setHfError("request-failed");
    }
  }

  function resizeCanvasToVideo(video: HTMLVideoElement) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const nextWidth = video.videoWidth || canvas.clientWidth;
    const nextHeight = video.videoHeight || canvas.clientHeight;

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawPose(landmarks: NormalizedLandmark[], status: FullBodyFrameStatus) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";

    const point = (index: number) => toCanvasPoint(landmarks[index], canvas, cameraFacingRef.current);
    const lineColor = status.fullBodyVisible ? "rgba(238, 242, 255, 0.95)" : "rgba(250, 204, 21, 0.86)";

    const drawLine = (fromIndex: number, toIndex: number, color = lineColor, width = 4) => {
      const from = point(fromIndex);
      const to = point(toIndex);
      if (!from || !to) return;
      context.strokeStyle = color;
      context.lineWidth = width;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    };

    skeletonPairs.forEach(([from, to]) => drawLine(from, to));
    drawLine(11, 12, "#62d0ff", 5);
    drawLine(23, 24, "#f8b84e", 5);
    drawLine(27, 28, status.feetVisible ? "#ffffff" : "#facc15", 4);

    const head = point(0);
    const shoulderMid = midpoint(point(11), point(12));
    const hipMid = midpoint(point(23), point(24));
    const bodyCenter = midpoint(shoulderMid, hipMid);

    if (head && shoulderMid) {
      context.strokeStyle = "#8cf7c1";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(head.x, head.y);
      context.lineTo(shoulderMid.x, shoulderMid.y);
      context.stroke();
    }

    if (shoulderMid && hipMid) {
      context.strokeStyle = "#8cf7c1";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(shoulderMid.x, shoulderMid.y);
      context.lineTo(hipMid.x, hipMid.y);
      context.stroke();
    }

    if (bodyCenter) {
      context.fillStyle = "#34d399";
      context.beginPath();
      context.arc(bodyCenter.x, bodyCenter.y, 7, 0, Math.PI * 2);
      context.fill();
    }

    importantIndexes.forEach((index) => {
      const landmark = landmarks[index];
      if (!visibleEnough(landmark)) return;
      const next = point(index);
      if (!next) return;
      context.fillStyle = index === 0 ? "#fef08a" : sideColor(index);
      context.beginPath();
      context.arc(next.x, next.y, index === 0 ? 6 : 5, 0, Math.PI * 2);
      context.fill();
    });
  }

  return (
    <main className="body-shell">
      <section className="body-stack">
        <header className="body-header">
          <p>Axis Basketball</p>
          <h1>Full Body Tracker</h1>
          <span>Camera-first. Full-body-first. Pose-overlay-first.</span>
        </header>

        <section className="body-card">
          <div className="section-title">
            <span>1</span>
            <h2>Start Full Body Session</h2>
          </div>

          <label>
            Session name
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <div className="camera-choice" aria-label="Choose Front or Rear Camera">
            <button
              className={cameraFacing === "front" ? "selected" : ""}
              type="button"
              onClick={() => void switchCamera("front")}
            >
              Front
            </button>
            <button
              className={cameraFacing === "rear" ? "selected" : ""}
              type="button"
              onClick={() => void switchCamera("rear")}
            >
              Rear
            </button>
          </div>

          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              onClick={() => setSessionStarted(true)}
            >
              {sessionStarted ? "Session Active" : "Start Session"}
            </button>
            <button type="button" onClick={() => void startCamera()}>
              Turn On Camera
            </button>
            <button
              type="button"
              onClick={() => void switchCamera(cameraFacing === "front" ? "rear" : "front")}
            >
              Switch Camera
            </button>
          </div>
        </section>

        <section className="body-stage-card">
          <div className="camera-topline">
            <div>
              <p>{cameraLabel}</p>
              <strong>{headerStatusLabel(truth)}</strong>
            </div>
            <span className={truth.fullBodyVisible ? "body-pill active" : "body-pill"}>
              {truth.fullBodyVisible ? "Full body detected" : truth.message}
            </span>
          </div>

          <div className="body-video-wrap">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cameraFacing === "front" ? "mirrored-video" : ""}
            />
            <canvas ref={canvasRef} className="pose-canvas" />
            {cameraState !== "ready" ? (
              <div className="camera-empty">
                <strong>Step Fully Into Frame</strong>
                <span>{frameStatus.message}</span>
              </div>
            ) : null}
          </div>
        </section>

        <BodyReadPanel truth={truth} />
        <AIContextPanel context={aiContext} truth={truth} />
        <HuggingFaceVisionPanel
          onCapture={(task) => void captureAndSendToHf(task)}
          truth={truth}
          hfState={hfState}
          hfError={hfError}
          hfTokenPresent={hfTokenPresent}
          hfRouteReady={hfRouteReady}
          hasVisionResult={Boolean(hfLastResult)}
        />
        <canvas ref={captureCanvasRef} hidden />
      </section>
    </main>
  );
}

function BodyReadPanel({ truth }: { truth: AxisFullBodyTruth }) {
  return (
    <section className="body-card">
      <div className="section-title">
        <span>2</span>
        <h2>Body Read</h2>
      </div>
      <div className="body-read-grid">
        <ReadTile label="Frame" value={truth.fullBodyVisible ? "full body" : truth.poseDetected ? "partial body" : "no body"} />
        <ReadTile label="Upper Body" value={truth.upperBodyVisible ? "stable" : "unstable"} />
        <ReadTile label="Lower Body" value={truth.lowerBodyVisible ? "stable" : "unstable"} />
        <ReadTile label="Feet" value={truth.feetVisible ? "stable" : "unstable"} />
        <StatusLine label="Next Move" value={truth.message} />
      </div>
    </section>
  );
}

function AIContextPanel({
  context,
  truth,
}: {
  context: AxisFullBodyAIContext | null;
  truth: AxisFullBodyTruth;
}) {
  return (
    <section className="body-card">
      <div className="section-title">
        <span>3</span>
        <h2>AI Body Context</h2>
      </div>
      <div className="body-read-grid">
        <StatusLine label="Context" value={aiContextLabel(truth)} />
        <StatusLine label="Full Body" value={`${truth.fullBodyPercent}%`} />
        <StatusLine label="Check Next" value={truth.message} />
        <StatusLine label="AI Use" value={aiUseLabel(truth)} />
      </div>
      <p className="frame-message">
        {truth.sessionStarted
          ? context
            ? "Body context is building from the live pose read."
            : "Body context building"
          : "Start session to save body context."}
      </p>
    </section>
  );
}

function HuggingFaceVisionPanel({
  onCapture,
  truth,
  hfState,
  hfError,
  hfTokenPresent,
  hfRouteReady,
  hasVisionResult,
}: {
  onCapture: (task: HfTask) => void;
  truth: AxisFullBodyTruth;
  hfState: HfState;
  hfError: HfError;
  hfTokenPresent: boolean;
  hfRouteReady: boolean;
  hasVisionResult: boolean;
}) {
  const busy = hfState === "checking-objects" || hfState === "checking-mask" || hfState === "asking-ai";
  const canCapture = truth.cameraActive && truth.poseDetected && hfTokenPresent && hfRouteReady && !busy;

  return (
    <section className="body-card">
      <div className="section-title">
        <span>4</span>
        <h2>Hugging Face Vision Support</h2>
      </div>
      <div className="body-read-grid">
        <StatusLine label="Status" value={hfStatusLabel(hfState, hasVisionResult, hfError)} />
        <StatusLine label="HF Token" value={hfTokenPresent ? "Present" : "Missing"} />
        <StatusLine label="Objects" value={hfTokenPresent ? "Ready" : "Needs token"} />
        <StatusLine label="Body Mask" value={hfTokenPresent ? "Ready" : "Needs token"} />
        <StatusLine label="Frame AI" value={hfTokenPresent ? "Ready" : "Needs token"} />
        <StatusLine label="API Route" value={hfRouteReady ? "Ready" : "Checking"} />
        <StatusLine label="Last Result" value={hasVisionResult ? "Available" : "None yet"} />
        {hfError !== "none" && (
          <StatusLine label="Last Error" value={hfErrorLabel(hfError)} />
        )}
      </div>
      <div className="button-row">
        <button
          type="button"
          disabled={!canCapture}
          onClick={() => onCapture("object_detection")}
        >
          {hfState === "checking-objects" ? "Checking..." : "Check Objects"}
        </button>
        <button
          type="button"
          disabled={!canCapture}
          onClick={() => onCapture("segmentation")}
        >
          {hfState === "checking-mask" ? "Checking..." : "Check Body Mask"}
        </button>
        <button
          type="button"
          disabled={!canCapture}
          onClick={() => onCapture("frame_reasoning")}
        >
          {hfState === "asking-ai" ? "Asking..." : "Ask Frame AI"}
        </button>
      </div>
      <p className="frame-message">
        Hugging Face Inference API. Token is server-side only - never exposed to the browser.
      </p>
    </section>
  );
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function hfStatusLabel(state: HfState, hasResult: boolean, error: HfError) {
  if (state === "checking-objects") return "Detecting objects...";
  if (state === "checking-mask") return "Segmenting body...";
  if (state === "asking-ai") return "Asking frame AI...";
  if (state === "received") return hasResult ? "Vision checked" : "Result unavailable";
  if (state === "error") return hfErrorLabel(error);
  return "Vision ready";
}

function hfErrorLabel(error: HfError) {
  if (error === "token-missing") return "HF_TOKEN missing. Add it to Vercel env.";
  if (error === "frame-unavailable") return "Camera frame unavailable";
  if (error === "frame-too-large") return "Frame too large";
  if (error === "token-unauthorized") return "Hugging Face token unauthorized. Check HF_TOKEN in Vercel.";
  if (error === "model-not-found") return "Hugging Face model not found";
  if (error === "input-mismatch") return "Hugging Face rejected the frame input";
  if (error === "model-loading") return "Hugging Face model loading. Try again.";
  if (error === "request-failed") return "Request to Hugging Face failed";
  if (error === "result-unavailable") return "Vision result unavailable";
  if (error === "could-not-check") return "Could not check frame";
  return "Vision unavailable";
}

function hfErrorFromCode(code: string): HfError {
  if (code === "HF_TOKEN_MISSING") return "token-missing";
  if (code === "IMAGE_PAYLOAD_MISSING") return "frame-unavailable";
  if (code === "FRAME_TOO_LARGE") return "frame-too-large";
  if (code === "HF_401") return "token-unauthorized";
  if (code === "HF_404") return "model-not-found";
  if (code === "HF_INPUT_MISMATCH") return "input-mismatch";
  if (code === "HF_MODEL_LOADING") return "model-loading";
  if (code === "HF_NETWORK_ERROR") return "request-failed";
  return "could-not-check";
}

function mergeVisionContextFrame(
  previous: AxisVisionContextFrame | null,
  next: {
    task: HfTask;
    result: unknown;
    timestampMs: number;
    cameraFacing: CameraFacing;
    bodyDetected: boolean;
    fullBodyVisible: boolean;
    poseConfidence?: number;
    stanceRead?: string;
    balanceRead?: string;
    kneeBendRead?: string;
    torsoLeanRead?: string;
  },
): AxisVisionContextFrame {
  const vision = {
    ...(previous?.vision || {}),
    ...(next.task === "object_detection" ? { objects: next.result } : {}),
    ...(next.task === "segmentation" ? { segmentation: next.result } : {}),
    ...(next.task === "frame_reasoning" ? { frameReasoning: next.result } : {}),
  };

  return {
    timestampMs: next.timestampMs,
    cameraFacing: next.cameraFacing,
    bodyContext: {
      bodyDetected: next.bodyDetected,
      fullBodyVisible: next.fullBodyVisible,
      poseConfidence: next.poseConfidence,
      stanceRead: next.stanceRead,
      balanceRead: next.balanceRead,
      kneeBendRead: next.kneeBendRead,
      torsoLeanRead: next.torsoLeanRead,
    },
    vision,
  };
}

function buildFullBodyTruth({
  cameraState,
  sessionStarted,
  frameStatus,
  fullBodyPercent,
  hfTokenPresent,
}: {
  cameraState: CameraState;
  sessionStarted: boolean;
  frameStatus: FullBodyFrameStatus;
  fullBodyPercent: number;
  hfTokenPresent: boolean;
}): AxisFullBodyTruth {
  const cameraActive = cameraState === "ready";
  const poseDetected = cameraActive && frameStatus.bodyDetected;
  const fullBodyVisible = poseDetected && frameStatus.fullBodyVisible;
  const bodyContextReady = fullBodyVisible && fullBodyPercent > 0 && sessionStarted;
  const visionReady = cameraActive && poseDetected && hfTokenPresent;

  return {
    cameraActive,
    sessionStarted,
    poseDetected,
    fullBodyVisible,
    upperBodyVisible: poseDetected && frameStatus.upperBodyVisible,
    lowerBodyVisible: poseDetected && frameStatus.lowerBodyVisible,
    feetVisible: poseDetected && frameStatus.feetVisible,
    fullBodyPercent,
    bodyContextReady,
    visionReady,
    message: bodyTruthMessage({
      cameraActive,
      poseDetected,
      fullBodyVisible,
      upperBodyVisible: frameStatus.upperBodyVisible,
      lowerBodyVisible: frameStatus.lowerBodyVisible,
      feetVisible: frameStatus.feetVisible,
      fullBodyPercent,
      frameMessage: frameStatus.message,
    }),
  };
}

function bodyTruthMessage({
  cameraActive,
  poseDetected,
  fullBodyVisible,
  upperBodyVisible,
  lowerBodyVisible,
  feetVisible,
  fullBodyPercent,
  frameMessage,
}: {
  cameraActive: boolean;
  poseDetected: boolean;
  fullBodyVisible: boolean;
  upperBodyVisible: boolean;
  lowerBodyVisible: boolean;
  feetVisible: boolean;
  fullBodyPercent: number;
  frameMessage: string;
}) {
  if (!cameraActive) return "Turn on camera";
  if (!poseDetected) return "Step fully into frame";
  if (fullBodyVisible && fullBodyPercent > 0) return "Full body read active";
  if (fullBodyVisible) return "Body context building";
  if (feetVisible && !upperBodyVisible) return "Hold camera steady";
  if (upperBodyVisible && !lowerBodyVisible) return "Move back for full body";
  return frameMessage || "Move back for full body";
}

function cameraStatusLabel(cameraState: CameraState, cameraMessage: string) {
  if (cameraState === "ready") return cameraMessage;
  if (cameraState === "switching") return "Switching camera...";
  if (cameraState === "requesting") return "Opening camera";
  if (cameraState === "denied") return "Camera permission needed";
  if (cameraState === "error") return "Camera unavailable";
  return "Camera off";
}

function headerStatusLabel(truth: AxisFullBodyTruth) {
  if (!truth.cameraActive) return "Camera off";
  if (!truth.poseDetected) return "Camera active";
  if (truth.fullBodyVisible && truth.fullBodyPercent > 0) return "Full body read active";
  if (truth.fullBodyVisible) return "Full body detected";
  return "Partial body read";
}

function aiContextLabel(truth: AxisFullBodyTruth) {
  if (!truth.sessionStarted) return "Building";
  if (truth.fullBodyPercent > 80) return "Ready";
  if (truth.fullBodyPercent > 50) return "Usable";
  return "Building";
}

function aiUseLabel(truth: AxisFullBodyTruth) {
  if (!truth.sessionStarted) return "Not ready yet";
  if (truth.fullBodyPercent > 80) return "Session summary ready";
  if (truth.fullBodyPercent > 50) return "Review body pattern";
  return "Not ready yet";
}

function ReadTile({ label, value }: { label: string; value: ReadValue }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildFrameStatus(landmarks: NormalizedLandmark[]): FullBodyFrameStatus {
  const visible = (index: number) => visibleEnough(landmarks[index]);
  const head = visible(0);
  const upperBodyVisible = [11, 12, 13, 14, 15, 16].every(visible);
  const hipsVisible = [23, 24].every(visible);
  const kneesVisible = [25, 26].every(visible);
  const anklesVisible = [27, 28].every(visible);
  const leftFootVisible = [27, 29, 31].some(visible);
  const rightFootVisible = [28, 30, 32].some(visible);
  const feetVisible = leftFootVisible && rightFootVisible;
  const lowerBodyVisible = hipsVisible && kneesVisible && anklesVisible;
  const leftSideVisible = [11, 13, 15, 23, 25, 27].every(visible);
  const rightSideVisible = [12, 14, 16, 24, 26, 28].every(visible);
  const confidence = average(importantIndexes.map((index) => landmarkConfidence(landmarks[index])));
  const bodyDetected = confidence > 0.22 && (upperBodyVisible || lowerBodyVisible || head);
  const fullBodyVisible =
    bodyDetected &&
    head &&
    upperBodyVisible &&
    lowerBodyVisible &&
    feetVisible &&
    leftSideVisible &&
    rightSideVisible &&
    confidence >= 0.45;

  return {
    bodyDetected,
    fullBodyVisible,
    upperBodyVisible,
    lowerBodyVisible,
    feetVisible,
    leftSideVisible,
    rightSideVisible,
    confidence,
    message: frameMessage({
      bodyDetected,
      fullBodyVisible,
      upperBodyVisible,
      lowerBodyVisible,
      feetVisible,
      leftSideVisible,
      rightSideVisible,
      confidence,
    }),
  };
}

function frameMessage(status: Omit<FullBodyFrameStatus, "message">) {
  if (!status.bodyDetected) return "No body detected";
  if (status.confidence < 0.35) return "Pose confidence low";
  if (status.fullBodyVisible) return "Full body read active";
  if (!status.upperBodyVisible && status.lowerBodyVisible) return "Move camera up";
  if (status.upperBodyVisible && !status.lowerBodyVisible) return "Partial body read. Move back for full body.";
  if (!status.lowerBodyVisible) return "Lower body not visible";
  if (!status.feetVisible) return "Feet missing";
  if (!status.leftSideVisible || !status.rightSideVisible) return "Step fully into frame";
  return "Move camera back";
}

function nextPoseState(status: FullBodyFrameStatus): PoseState {
  if (!status.bodyDetected) return "no-body";
  if (status.confidence < 0.35) return "low-confidence";
  if (status.fullBodyVisible) return "full";
  return "partial";
}

function buildFullBodyFrame(
  sessionId: string,
  landmarks: NormalizedLandmark[],
  cameraFacing: CameraFacing,
  status: FullBodyFrameStatus,
  previous: AxisFullBodyFrame | null,
): AxisFullBodyFrame {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftHeel = landmarks[29];
  const rightHeel = landmarks[30];
  const leftToe = landmarks[31];
  const rightToe = landmarks[32];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const head = landmarks[0];
  const shoulderCenter = normalizedMidpoint(leftShoulder, rightShoulder);
  const hipCenter = normalizedMidpoint(leftHip, rightHip);
  const bodyCenter = shoulderCenter && hipCenter ? normalizedMidpoint(shoulderCenter, hipCenter) : undefined;
  const previousCenter = previous?.bodyStructure.bodyCenter;
  const lateralChange = bodyCenter && previousCenter ? bodyCenter.x - previousCenter.x : 0;
  const verticalChange = bodyCenter && previousCenter ? bodyCenter.y - previousCenter.y : 0;
  const bodyCenterVelocity = Math.hypot(lateralChange, verticalChange);
  const shoulderLineAngle = lineAngle(leftShoulder, rightShoulder);
  const hipLineAngle = lineAngle(leftHip, rightHip);
  const spineAngle = shoulderCenter && hipCenter ? lineAngle(shoulderCenter, hipCenter) : undefined;
  const leftKneeAngle = jointAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = jointAngle(rightHip, rightKnee, rightAnkle);
  const leftHipAngle = jointAngle(leftShoulder, leftHip, leftKnee);
  const rightHipAngle = jointAngle(rightShoulder, rightHip, rightKnee);
  const leftAnkleAngle = jointAngle(leftKnee, leftAnkle, leftToe);
  const rightAnkleAngle = jointAngle(rightKnee, rightAnkle, rightToe);
  const leftElbowAngle = jointAngle(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = jointAngle(rightShoulder, rightElbow, rightWrist);
  const leftShoulderAngle = jointAngle(leftElbow, leftShoulder, leftHip);
  const rightShoulderAngle = jointAngle(rightElbow, rightShoulder, rightHip);
  const stanceWidth = stanceValue(distance(leftAnkle, rightAnkle), distance(leftHip, rightHip));
  const balance = balanceValue(bodyCenter, leftAnkle, rightAnkle, bodyCenterVelocity);
  const kneeBend = kneeBendValue(averageDefined([leftKneeAngle, rightKneeAngle]));
  const hipLevel = levelValue(hipLineAngle);
  const shoulderLevel = levelValue(shoulderLineAngle);
  const torsoLean = torsoLeanValue(spineAngle);
  const previousKnee = previous
    ? averageDefined([previous.jointAngles.leftKnee ?? null, previous.jointAngles.rightKnee ?? null])
    : undefined;
  const currentKnee = averageDefined([leftKneeAngle, rightKneeAngle]);
  const previousHipY = previous?.bodyStructure.bodyCenter?.y ?? null;
  const baseStable = status.fullBodyVisible && balance === "balanced" && bodyCenterVelocity < 0.035;
  const frameRead = status.fullBodyVisible ? "full_body" : status.bodyDetected ? "partial_body" : "no_body";

  return {
    sessionId,
    timestampMs: Date.now(),
    cameraFacing,
    frameStatus: {
      bodyDetected: status.bodyDetected,
      fullBodyVisible: status.fullBodyVisible,
      upperBodyVisible: status.upperBodyVisible,
      lowerBodyVisible: status.lowerBodyVisible,
      feetVisible: status.feetVisible,
      leftSideVisible: status.leftSideVisible,
      rightSideVisible: status.rightSideVisible,
      confidence: status.confidence,
    },
    landmarks: landmarkNames.map((name, index) => ({
      name,
      x: landmarks[index]?.x ?? 0,
      y: landmarks[index]?.y ?? 0,
      z: landmarks[index]?.z,
      visibility: landmarkConfidence(landmarks[index]),
    })),
    bodyStructure: {
      bodyCenter,
      shoulderLineAngle,
      hipLineAngle,
      spineAngle,
      headOverHips: headOverHipsValue(head, hipCenter),
      torsoLean,
      bodyHeightEstimate: bodyHeightEstimate(head, leftHeel, rightHeel, leftToe, rightToe),
    },
    base: {
      stanceWidth,
      leftFootVisible: visibleEnough(leftAnkle) || visibleEnough(leftHeel) || visibleEnough(leftToe),
      rightFootVisible: visibleEnough(rightAnkle) || visibleEnough(rightHeel) || visibleEnough(rightToe),
      baseStable,
      balance,
    },
    jointAngles: {
      leftKnee: leftKneeAngle,
      rightKnee: rightKneeAngle,
      leftHip: leftHipAngle,
      rightHip: rightHipAngle,
      leftAnkle: leftAnkleAngle,
      rightAnkle: rightAnkleAngle,
      leftElbow: leftElbowAngle,
      rightElbow: rightElbowAngle,
      leftShoulder: leftShoulderAngle,
      rightShoulder: rightShoulderAngle,
    },
    movement: {
      bodyCenterVelocity,
      verticalChange,
      lateralChange,
      kneeBendChange:
        currentKnee !== undefined && previousKnee !== undefined ? currentKnee - previousKnee : 0,
      hipDropChange: bodyCenter && previousHipY !== null ? bodyCenter.y - previousHipY : 0,
      footPlantChange: footPlantChange(previous, leftAnkle, rightAnkle),
    },
    reads: {
      frameRead,
      stanceRead: status.fullBodyVisible ? stanceWidth : undefined,
      balanceRead: status.fullBodyVisible ? balance : undefined,
      kneeBendRead: status.fullBodyVisible ? kneeBend : undefined,
      hipLevelRead: status.fullBodyVisible ? hipLevel : undefined,
      shoulderLevelRead: status.fullBodyVisible ? shoulderLevel : undefined,
      torsoLeanRead: status.fullBodyVisible ? torsoLean : undefined,
      movementQualityRead: status.fullBodyVisible ? (bodyCenterVelocity > 0.035 ? "unstable" : "stable") : undefined,
      notes: status.fullBodyVisible ? ["Full body detected"] : [status.message],
    },
  };
}

function buildAIContext(
  sessionId: string,
  cameraFacing: CameraFacing,
  frames: AxisFullBodyFrame[],
  frameRate?: number,
): AxisFullBodyAIContext {
  const totalFrames = frames.length;
  const fullBodyFrames = frames.filter((frame) => frame.reads.frameRead === "full_body").length;
  const partialBodyFrames = frames.filter((frame) => frame.reads.frameRead === "partial_body").length;
  const noBodyFrames = frames.filter((frame) => frame.reads.frameRead === "no_body").length;
  const averageConfidence = totalFrames
    ? average(frames.map((frame) => frame.frameStatus.confidence))
    : 0;
  const issueCounts = new Map<string, number>();

  frames.forEach((frame) => {
    frame.reads.notes.forEach((note) => {
      issueCounts.set(note, (issueCounts.get(note) || 0) + 1);
    });
  });

  const mostCommonFrameIssue = [...issueCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    sessionId,
    cameraFacing,
    frameRate,
    frames,
    summary: {
      totalFrames,
      fullBodyFrames,
      partialBodyFrames,
      noBodyFrames,
      averageConfidence,
      mostCommonFrameIssue,
    },
    bodyReadTimeline: frames.map((frame) => ({
      timestampMs: frame.timestampMs,
      frameRead: frame.reads.frameRead,
      stanceRead: frame.reads.stanceRead,
      balanceRead: frame.reads.balanceRead,
      kneeBendRead: frame.reads.kneeBendRead,
      hipLevelRead: frame.reads.hipLevelRead,
      shoulderLevelRead: frame.reads.shoulderLevelRead,
      torsoLeanRead: frame.reads.torsoLeanRead,
      movementQualityRead: frame.reads.movementQualityRead,
      notes: frame.reads.notes,
    })),
  };
}

function saveFullBodyContext(title: string, context: AxisFullBodyAIContext) {
  try {
    window.localStorage.setItem(
      "axis-basketball-full-body-context",
      JSON.stringify({
        title,
        updatedAt: new Date().toISOString(),
        ...context,
        frames: context.frames.slice(-120),
        bodyReadTimeline: context.bodyReadTimeline.slice(-120),
      }),
    );
  } catch {
    // Local full-body context is best-effort until persistent storage is added.
  }
}

function toCanvasPoint(
  landmark: NormalizedLandmark | undefined,
  canvas: HTMLCanvasElement,
  cameraFacing: CameraFacing,
) {
  if (!landmark || !visibleEnough(landmark)) return null;
  return {
    x: (cameraFacing === "front" ? 1 - landmark.x : landmark.x) * canvas.width,
    y: landmark.y * canvas.height,
  };
}

function visibleEnough(landmark: NormalizedLandmark | undefined) {
  return landmarkConfidence(landmark) > visibleThreshold;
}

function landmarkConfidence(landmark: NormalizedLandmark | undefined) {
  return landmark?.visibility ?? 0;
}

function midpoint(a: Point | null | undefined, b: Point | null | undefined) {
  if (!a || !b) return undefined;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 };
}

function normalizedMidpoint(a: { x: number; y: number } | undefined, b: { x: number; y: number } | undefined) {
  if (!a || !b) return undefined;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: { x: number; y: number } | undefined, b: { x: number; y: number } | undefined) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lineAngle(a: { x: number; y: number } | undefined, b: { x: number; y: number } | undefined) {
  if (!a || !b) return undefined;
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

function jointAngle(
  a: NormalizedLandmark | undefined,
  b: NormalizedLandmark | undefined,
  c: NormalizedLandmark | undefined,
) {
  if (!a || !b || !c) return undefined;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const cross = ab.x * cb.y - ab.y * cb.x;
  return Math.abs(Math.atan2(cross, dot) * (180 / Math.PI));
}

function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function averageDefined(values: Array<number | undefined | null>) {
  const defined = values.filter((v): v is number => v !== undefined && v !== null);
  return defined.length ? defined.reduce((a, b) => a + b, 0) / defined.length : undefined;
}

function stanceValue(
  ankleDist: number,
  hipDist: number,
): "narrow" | "normal" | "wide" | undefined {
  if (!ankleDist || !hipDist) return undefined;
  const ratio = ankleDist / hipDist;
  if (ratio < 0.8) return "narrow";
  if (ratio > 1.4) return "wide";
  return "normal";
}

function balanceValue(
  bodyCenter: { x: number; y: number } | undefined,
  leftAnkle: NormalizedLandmark | undefined,
  rightAnkle: NormalizedLandmark | undefined,
  velocity: number,
): "balanced" | "left-heavy" | "right-heavy" | "forward" | "backward" | "unstable" | undefined {
  if (!bodyCenter || !leftAnkle || !rightAnkle) return undefined;
  if (velocity > 0.08) return "unstable";
  const ankleMidX = (leftAnkle.x + rightAnkle.x) / 2;
  const diff = bodyCenter.x - ankleMidX;
  if (Math.abs(diff) < 0.05) return "balanced";
  return diff < 0 ? "left-heavy" : "right-heavy";
}

function kneeBendValue(angle: number | undefined): "low" | "medium" | "high" | undefined {
  if (angle === undefined) return undefined;
  if (angle > 160) return "low";
  if (angle > 130) return "medium";
  return "high";
}

function levelValue(angle: number | undefined): "level" | "tilted left" | "tilted right" | undefined {
  if (angle === undefined) return undefined;
  if (Math.abs(angle) < 5) return "level";
  return angle < 0 ? "tilted left" : "tilted right";
}

function torsoLeanValue(angle: number | undefined): "upright" | "forward" | "backward" | "left" | "right" | undefined {
  if (angle === undefined) return undefined;
  const abs = Math.abs(angle);
  if (abs < 10) return "upright";
  if (angle < 0) return "forward";
  return "backward";
}

function headOverHipsValue(
  head: { x: number; y: number } | undefined,
  hipCenter: { x: number; y: number } | undefined,
): "stacked" | "forward" | "back" | "left" | "right" | undefined {
  if (!head || !hipCenter) return undefined;
  const dx = head.x - hipCenter.x;
  const dy = head.y - hipCenter.y;
  if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return "stacked";
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "forward" : "back";
}

function bodyHeightEstimate(
  head: { x: number; y: number } | undefined,
  leftHeel: { x: number; y: number } | undefined,
  rightHeel: { x: number; y: number } | undefined,
  leftToe: { x: number; y: number } | undefined,
  rightToe: { x: number; y: number } | undefined,
) {
  if (!head) return undefined;
  const heelY = Math.max(leftHeel?.y ?? 0, rightHeel?.y ?? 0, leftToe?.y ?? 0, rightToe?.y ?? 0);
  if (!heelY) return undefined;
  return Math.abs(heelY - head.y);
}

function footPlantChange(
  previous: AxisFullBodyFrame | null,
  leftAnkle: NormalizedLandmark | undefined,
  rightAnkle: NormalizedLandmark | undefined,
): string | undefined {
  if (!previous || !leftAnkle || !rightAnkle) return undefined;
  const prevLeft = previous.landmarks.find((l) => l.name === "leftAnkle");
  const prevRight = previous.landmarks.find((l) => l.name === "rightAnkle");
  if (!prevLeft || !prevRight) return undefined;
  const leftMove = distance(leftAnkle, { x: prevLeft.x, y: prevLeft.y });
  const rightMove = distance(rightAnkle, { x: prevRight.x, y: prevRight.y });
  const moved = Math.max(leftMove, rightMove);
  if (moved > 0.05) return "stepping";
  if (moved > 0.02) return "shifting";
  return "planted";
}

function sideColor(index: number) {
  const leftIndexes = [11, 13, 15, 23, 25, 27, 29, 31];
  return leftIndexes.includes(index) ? "#60a5fa" : "#f87171";
}
