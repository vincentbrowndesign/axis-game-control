"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

type CameraFacing = "user" | "environment";
type CameraState = "idle" | "requesting" | "ready" | "error" | "denied";
type PoseState = "idle" | "loading" | "active" | "low-confidence" | "no-body" | "error";

type BodyReadValue =
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
  | "upright"
  | "forward lean"
  | "backward lean"
  | "stable";

type BodyReads = {
  stance: BodyReadValue;
  balance: BodyReadValue;
  kneeBend: BodyReadValue;
  hipLevel: BodyReadValue;
  shoulderLevel: BodyReadValue;
  torsoLean: BodyReadValue;
  bodyCenter: BodyReadValue;
  movementQuality: BodyReadValue;
};

type Point3D = {
  x: number;
  y: number;
  z?: number;
  confidence: number;
};

type BodyFrame = {
  timestamp: number;
  cameraFacing: CameraFacing;
  bodyDetected: boolean;
  landmarks: Record<string, Point3D>;
  landmarkConfidence: number;
  bodyCenter: Point3D | null;
  shoulderLineAngle: number | null;
  hipLineAngle: number | null;
  spineAngle: number | null;
  torsoLean: BodyReadValue;
  stanceWidth: BodyReadValue;
  balanceEstimate: BodyReadValue;
  kneeAngles: { left: number | null; right: number | null };
  hipAngles: { left: number | null; right: number | null };
  elbowAngles: { left: number | null; right: number | null };
  verticalChange: number;
  lateralChange: number;
  bodyCenterVelocity: number;
  kneeBendChange: number;
  hipDropChange: number;
  reads: BodyReads;
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

const defaultReads: BodyReads = {
  stance: "normal",
  balance: "stable",
  kneeBend: "medium",
  hipLevel: "stable",
  shoulderLevel: "stable",
  torsoLean: "upright",
  bodyCenter: "balanced",
  movementQuality: "stable",
};

export function AxisBodyTracker() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastFrameRef = useRef<BodyFrame | null>(null);
  const frameTimelineRef = useRef<BodyFrame[]>([]);
  const cameraFacingRef = useRef<CameraFacing>("environment");

  const [title, setTitle] = useState("Body session");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("environment");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [poseState, setPoseState] = useState<PoseState>("idle");
  const [message, setMessage] = useState("Step fully into frame");
  const [reads, setReads] = useState<BodyReads>(defaultReads);
  const [bodyDetected, setBodyDetected] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);

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

  const cameraLabel = useMemo(() => {
    if (cameraState === "ready") return "Camera ready";
    if (cameraState === "requesting") return "Opening camera";
    if (cameraState === "denied") return "Camera permission needed";
    if (cameraState === "error") return "Camera unavailable";
    return "Camera off";
  }, [cameraState]);

  const poseLabel = useMemo(() => {
    if (poseState === "active") return "Body read active";
    if (poseState === "loading") return "Reading body";
    if (poseState === "low-confidence") return "Pose confidence low";
    if (poseState === "no-body") return "Step fully into frame";
    if (poseState === "error") return "Need better body signal";
    return "Pose waiting";
  }, [poseState]);

  async function startCamera() {
    setCameraState("requesting");
    setPoseState("loading");
    setMessage("Reading body");
    setBodyDetected(false);

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: cameraFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      setCameraState("ready");
      setPoseState("no-body");
      setMessage("Step fully into frame");
      detectPoseLoop();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setCameraState(name === "NotAllowedError" ? "denied" : "error");
      setPoseState("error");
      setMessage(
        name === "NotAllowedError"
          ? "Allow camera access"
          : "Need more light or a supported camera",
      );
    }
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
      const result = landmarker.detectForVideo(video, video.currentTime * 1000);
      handlePoseResult(result, video);
    }

    animationRef.current = requestAnimationFrame(detectPoseLoop);
  }

  function handlePoseResult(result: PoseLandmarkerResult, video: HTMLVideoElement) {
    const landmarks = result.landmarks[0];
    resizeCanvasToVideo(video);

    if (!landmarks?.length) {
      clearCanvas();
      setBodyDetected(false);
      setPoseState("no-body");
      setMessage("Step fully into frame");
      return;
    }

    drawPose(landmarks);
    const frame = buildBodyFrame(landmarks, cameraFacingRef.current, lastFrameRef.current);
    lastFrameRef.current = frame;
    frameTimelineRef.current = [...frameTimelineRef.current.slice(-119), frame];
    saveBodyContext(title, frameTimelineRef.current);

    setBodyDetected(frame.bodyDetected);
    setConfidence(frame.landmarkConfidence);
    setReads(frame.reads);
    setSampleCount(frameTimelineRef.current.length);
    setPoseState(frame.landmarkConfidence >= 0.58 ? "active" : "low-confidence");
    setMessage(frame.landmarkConfidence >= 0.58 ? "Body detected" : "Move camera back");
  }

  const resizeCanvasToVideo = (video: HTMLVideoElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const nextWidth = video.videoWidth || canvas.clientWidth;
    const nextHeight = video.videoHeight || canvas.clientHeight;

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawPose = (landmarks: NormalizedLandmark[]) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";

    const point = (index: number) => toCanvasPoint(landmarks[index], canvas, cameraFacingRef.current);
    const drawLine = (fromIndex: number, toIndex: number, color = "rgba(238, 242, 255, 0.9)", width = 4) => {
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

    const shoulderMid = midpoint(point(11), point(12));
    const hipMid = midpoint(point(23), point(24));
    if (shoulderMid && hipMid) {
      context.strokeStyle = "#8cf7c1";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(shoulderMid.x, shoulderMid.y);
      context.lineTo(hipMid.x, hipMid.y);
      context.stroke();
    }

    drawLine(27, 28, "#ffffff", 4);

    landmarks.forEach((landmark, index) => {
      if (importantLandmark(index) && visibleEnough(landmark)) {
        const next = toCanvasPoint(landmark, canvas, cameraFacing);
        if (!next) return;
        context.fillStyle = index === 0 ? "#fef08a" : "#ffffff";
        context.beginPath();
        context.arc(next.x, next.y, index === 0 ? 6 : 5, 0, Math.PI * 2);
        context.fill();
      }
    });
  };

  return (
    <main className="body-shell">
      <section className="body-stack">
        <header className="body-header">
          <p>Axis Basketball</p>
          <h1>Body Tracker</h1>
          <span>Camera-first. Body-first. Pose-overlay-first.</span>
        </header>

        <section className="body-card">
          <div className="section-title">
            <span>1</span>
            <h2>Start Body Session</h2>
          </div>

          <label>
            Session name
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <div className="camera-choice" aria-label="Choose Camera">
            <button
              className={cameraFacing === "user" ? "selected" : ""}
              type="button"
              onClick={() => setCameraFacing("user")}
            >
              Front
            </button>
            <button
              className={cameraFacing === "environment" ? "selected" : ""}
              type="button"
              onClick={() => setCameraFacing("environment")}
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
            <button type="button" onClick={startCamera}>
              Turn On Camera
            </button>
          </div>
        </section>

        <section className="body-stage-card">
          <div className="camera-topline">
            <div>
              <p>{cameraLabel}</p>
              <strong>{poseLabel}</strong>
            </div>
            <span className={bodyDetected ? "body-pill active" : "body-pill"}>
              {bodyDetected ? "Body detected" : "No body"}
            </span>
          </div>

          <div className="body-video-wrap">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cameraFacing === "user" ? "mirrored-video" : ""}
            />
            <canvas ref={canvasRef} className="pose-canvas" />
            {cameraState !== "ready" ? (
              <div className="camera-empty">
                <strong>Step Into Frame</strong>
                <span>{message}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="body-card">
          <div className="section-title">
            <span>2</span>
            <h2>Body Reads</h2>
          </div>
          <div className="body-read-grid">
            <ReadTile label="Stance" value={reads.stance} />
            <ReadTile label="Balance" value={reads.balance} />
            <ReadTile label="Knee Bend" value={reads.kneeBend} />
            <ReadTile label="Hip Level" value={reads.hipLevel} />
            <ReadTile label="Shoulder Level" value={reads.shoulderLevel} />
            <ReadTile label="Torso Lean" value={reads.torsoLean} />
            <ReadTile label="Body Center" value={reads.bodyCenter} />
            <ReadTile label="Movement Quality" value={reads.movementQuality} />
          </div>
        </section>

        <section className="status-panel body-status-panel">
          <StatusLine label="Session" value={sessionStarted ? title : "Not started"} />
          <StatusLine label="Camera" value={cameraFacing === "user" ? "Front" : "Rear"} />
          <StatusLine label="Pose" value={bodyDetected ? "Pose active" : "Waiting"} />
          <StatusLine label="Confidence" value={`${Math.round(confidence * 100)}%`} />
          <StatusLine label="Body context" value={sampleCount ? "Saving locally" : "Waiting"} />
          <StatusLine label="AI feed" value="Body timeline ready later" />
        </section>
      </section>
    </main>
  );
}

function ReadTile({ label, value }: { label: string; value: BodyReadValue }) {
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

function buildBodyFrame(
  landmarks: NormalizedLandmark[],
  cameraFacing: CameraFacing,
  previous: BodyFrame | null,
): BodyFrame {
  const namedLandmarks = Object.fromEntries(
    landmarkNames.map((name, index) => [
      name,
      {
        x: landmarks[index]?.x ?? 0,
        y: landmarks[index]?.y ?? 0,
        z: landmarks[index]?.z,
        confidence: landmarkConfidence(landmarks[index]),
      },
    ]),
  ) as Record<string, Point3D>;

  const confidence = average([
    landmarks[0],
    landmarks[11],
    landmarks[12],
    landmarks[23],
    landmarks[24],
    landmarks[25],
    landmarks[26],
    landmarks[27],
    landmarks[28],
  ].map(landmarkConfidence));

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  const shoulderCenter = normalizedMidpoint(leftShoulder, rightShoulder);
  const hipCenter = normalizedMidpoint(leftHip, rightHip);
  const bodyCenter = shoulderCenter && hipCenter ? normalizedMidpoint(shoulderCenter, hipCenter) : null;
  const previousCenter = previous?.bodyCenter;
  const lateralChange = bodyCenter && previousCenter ? bodyCenter.x - previousCenter.x : 0;
  const verticalChange = bodyCenter && previousCenter ? bodyCenter.y - previousCenter.y : 0;
  const velocity = Math.hypot(lateralChange, verticalChange);
  const shoulderAngle = lineAngle(leftShoulder, rightShoulder);
  const hipAngle = lineAngle(leftHip, rightHip);
  const spineAngle = shoulderCenter && hipCenter ? lineAngle(shoulderCenter, hipCenter) : null;
  const leftKneeAngle = jointAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = jointAngle(rightHip, rightKnee, rightAnkle);
  const leftHipAngle = jointAngle(leftShoulder, leftHip, leftKnee);
  const rightHipAngle = jointAngle(rightShoulder, rightHip, rightKnee);
  const leftElbowAngle = jointAngle(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = jointAngle(rightShoulder, rightElbow, rightWrist);
  const stance = stanceValue(distance(leftAnkle, rightAnkle), distance(leftHip, rightHip));
  const balance = balanceValue(bodyCenter, leftAnkle, rightAnkle, velocity);
  const kneeBend = kneeBendValue(averageDefined([leftKneeAngle, rightKneeAngle]));
  const torsoLean = torsoLeanValue(spineAngle);
  const shoulderLevel = levelValue(shoulderAngle);
  const hipLevel = levelValue(hipAngle);
  const bodyCenterRead = centerValue(bodyCenter);
  const movementQuality = velocity > 0.035 ? "unstable" : "stable";
  const previousKnee = previous
    ? averageDefined([previous.kneeAngles.left, previous.kneeAngles.right])
    : null;
  const currentKnee = averageDefined([leftKneeAngle, rightKneeAngle]);
  const previousHipY = previous?.bodyCenter?.y ?? null;

  const reads: BodyReads = {
    stance,
    balance,
    kneeBend,
    hipLevel,
    shoulderLevel,
    torsoLean,
    bodyCenter: bodyCenterRead,
    movementQuality,
  };

  return {
    timestamp: Date.now(),
    cameraFacing,
    bodyDetected: confidence > 0.35,
    landmarks: namedLandmarks,
    landmarkConfidence: confidence,
    bodyCenter,
    shoulderLineAngle: shoulderAngle,
    hipLineAngle: hipAngle,
    spineAngle,
    torsoLean,
    stanceWidth: stance,
    balanceEstimate: balance,
    kneeAngles: { left: leftKneeAngle, right: rightKneeAngle },
    hipAngles: { left: leftHipAngle, right: rightHipAngle },
    elbowAngles: { left: leftElbowAngle, right: rightElbowAngle },
    verticalChange,
    lateralChange,
    bodyCenterVelocity: velocity,
    kneeBendChange: currentKnee !== null && previousKnee !== null ? currentKnee - previousKnee : 0,
    hipDropChange: bodyCenter && previousHipY !== null ? bodyCenter.y - previousHipY : 0,
    reads,
  };
}

function saveBodyContext(title: string, frames: BodyFrame[]) {
  try {
    window.localStorage.setItem(
      "axis-basketball-body-context",
      JSON.stringify({
        title,
        updatedAt: new Date().toISOString(),
        frames: frames.slice(-120),
      }),
    );
  } catch {
    // Local body context is best-effort until persistent storage is added.
  }
}

function toCanvasPoint(
  landmark: NormalizedLandmark | undefined,
  canvas: HTMLCanvasElement,
  cameraFacing: CameraFacing,
) {
  if (!landmark || !visibleEnough(landmark)) return null;
  return {
    x: (cameraFacing === "user" ? 1 - landmark.x : landmark.x) * canvas.width,
    y: landmark.y * canvas.height,
  };
}

function visibleEnough(landmark: NormalizedLandmark | undefined) {
  return landmarkConfidence(landmark) > 0.25;
}

function landmarkConfidence(landmark: NormalizedLandmark | undefined) {
  return landmark?.visibility ?? 0;
}

function importantLandmark(index: number) {
  return [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32].includes(index);
}

function midpoint(
  a: { x: number; y: number } | null,
  b: { x: number; y: number } | null,
) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function normalizedMidpoint(
  a: NormalizedLandmark | { x: number; y: number; z?: number } | undefined,
  b: NormalizedLandmark | { x: number; y: number; z?: number } | undefined,
) {
  if (!a || !b) return null;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
    confidence: average([landmarkConfidence(a as NormalizedLandmark), landmarkConfidence(b as NormalizedLandmark)]),
  };
}

function distance(a: NormalizedLandmark | undefined, b: NormalizedLandmark | undefined) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lineAngle(a: NormalizedLandmark | { x: number; y: number } | undefined | null, b: NormalizedLandmark | { x: number; y: number } | undefined | null) {
  if (!a || !b) return null;
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function jointAngle(
  a: NormalizedLandmark | undefined,
  b: NormalizedLandmark | undefined,
  c: NormalizedLandmark | undefined,
) {
  if (!a || !b || !c) return null;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magnitude = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!magnitude) return null;
  const cosine = Math.max(-1, Math.min(1, dot / magnitude));
  return (Math.acos(cosine) * 180) / Math.PI;
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function averageDefined(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number");
  if (!valid.length) return null;
  return average(valid);
}

function stanceValue(ankleWidth: number, hipWidth: number): BodyReadValue {
  if (!hipWidth) return "normal";
  const ratio = ankleWidth / hipWidth;
  if (ratio < 1.15) return "narrow";
  if (ratio > 2.05) return "wide";
  return "normal";
}

function balanceValue(
  bodyCenter: Point3D | null,
  leftAnkle: NormalizedLandmark | undefined,
  rightAnkle: NormalizedLandmark | undefined,
  velocity: number,
): BodyReadValue {
  if (!bodyCenter || !leftAnkle || !rightAnkle) return "unstable";
  if (velocity > 0.04) return "unstable";

  const minX = Math.min(leftAnkle.x, rightAnkle.x);
  const maxX = Math.max(leftAnkle.x, rightAnkle.x);
  const baseWidth = maxX - minX;
  const centerRatio = baseWidth ? (bodyCenter.x - minX) / baseWidth : 0.5;

  if (centerRatio < 0.38) return "left-heavy";
  if (centerRatio > 0.62) return "right-heavy";
  return "balanced";
}

function kneeBendValue(angle: number | null): BodyReadValue {
  if (angle === null) return "medium";
  if (angle < 125) return "low";
  if (angle > 162) return "high";
  return "medium";
}

function torsoLeanValue(angle: number | null): BodyReadValue {
  if (angle === null) return "upright";
  const normalized = Math.abs(Math.abs(angle) - 90);
  if (normalized < 8) return "upright";
  return angle > 0 ? "forward lean" : "backward lean";
}

function levelValue(angle: number | null): BodyReadValue {
  if (angle === null) return "stable";
  return Math.abs(angle) > 7 ? "unstable" : "stable";
}

function centerValue(bodyCenter: Point3D | null): BodyReadValue {
  if (!bodyCenter) return "unstable";
  if (bodyCenter.y < 0.36) return "backward";
  if (bodyCenter.y > 0.7) return "forward";
  return "balanced";
}
