"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createAxisTracker } from "../../lib/axis/axis-simple-tracker";
import {
  calculateVisionRelationships,
  recordAxisVisionObjectEvent,
  smoothBox,
  trackToBox,
} from "../../lib/axis/axis-object-lock";
import {
  axisMeasureEvidenceQualityLabels,
  saveAxisMeasureEvidenceFrame,
  updateAxisMeasureEvidenceFrame,
  type AxisMeasureEvidenceQualityLabel,
} from "../../lib/axis/measure/evidence-capture";
import type { AxisSurface } from "../../lib/axis/surface";
import type { AxisLiveDetection, AxisVisionTrack } from "../../lib/axis/axis-vision-types";
import type { VisionBox, VisionFrameState, VisionObject } from "../../lib/axis/axis-object-lock-types";

type CameraState = "idle" | "starting" | "live" | "error";
type ModelState = "idle" | "loading" | "ready" | "error";
type OverlayMode = "product" | "debug";
type RimEditMode = "idle" | "placing" | "adjusting";
type RimDragMode = "move" | "resize";

const maxPlayers = 3;
const inferenceIntervalMs = 700;
const productPlayerMinConfidence = 0.38;
const productPlayerMinAreaRatio = 0.035;
const productPlayerEdgeMarginRatio = 0.04;
const productPlayerAliveMs = 2100;
const ballAliveMs = 1200;

type AxisVisionObjectLockProps = {
  detectEndpoint?: string;
  initialRimSetup?: boolean;
  productName?: string;
  route?: string;
  surface?: AxisSurface;
};

export function AxisVisionObjectLock({
  detectEndpoint = "/api/axis/vision/detect",
  initialRimSetup = false,
  productName = "Axis Vision",
  route = "/axis/vision",
  surface = "axis",
}: AxisVisionObjectLockProps = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef(createAxisTracker({ ballIouThreshold: 0.12, maxMissedFrames: 3, personIouThreshold: 0.22 }));
  const rafRef = useRef<number | null>(null);
  const lastInferenceAtRef = useRef(0);
  const inferenceRunningRef = useRef(false);
  const objectsRef = useRef<VisionObject[]>([]);
  const rawObjectsRef = useRef<VisionObject[]>([]);
  const frameIdRef = useRef(0);
  const pressTimerRef = useRef<number | null>(null);
  const objectStateRef = useRef<Record<string, VisionObject["state"]>>({});
  const primaryPlayerTrackIdRef = useRef<string | null>(null);
  const detectorMissesRef = useRef(0);
  const droppedFramesRef = useRef(0);
  const rawDetectionCountRef = useRef(0);
  const modelClassesRef = useRef("");
  const rimDraftRef = useRef<VisionBox | null>(null);
  const rimDragRef = useRef<{
    mode: RimDragMode;
    offsetX: number;
    offsetY: number;
    startBox: VisionBox;
    startX: number;
    startY: number;
  } | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [modelState, setModelState] = useState<ModelState>("idle");
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("product");
  const [multiPlayer, setMultiPlayer] = useState(false);
  const [objects, setObjects] = useState<VisionObject[]>([]);
  const [frameState, setFrameState] = useState<VisionFrameState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rimSetup, setRimSetup] = useState<RimEditMode>(initialRimSetup ? "placing" : "idle");
  const [rimBox, setRimBox] = useState<VisionBox | null>(null);
  const [rimLocked, setRimLocked] = useState(false);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [detectorUrl, setDetectorUrl] = useState("http://127.0.0.1:8011");
  const [detectorError, setDetectorError] = useState("");
  const [lastInferenceMs, setLastInferenceMs] = useState(0);
  const [lastCadenceMs, setLastCadenceMs] = useState(inferenceIntervalMs);
  const [savedFrameId, setSavedFrameId] = useState<string | null>(null);
  const [savedFrameLabels, setSavedFrameLabels] = useState<AxisMeasureEvidenceQualityLabel[]>([]);
  const [saveMessage, setSaveMessage] = useState("");

  const players = objects.filter((object) => object.type === "player");
  const rim = objects.find((object) => object.type === "rim");
  const ball = objects.find((object) => object.type === "ball");

  useEffect(() => {
    recordAxisVisionObjectEvent("vision_opened", { productName, route });
    return () => stopVision();
  }, [productName, route]);

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, overlayMode, frameState, selectedId, rimSetup, rimBox, rimLocked]);

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
      if (inferenceRunningRef.current) droppedFramesRef.current += 1;
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
      rawDetectionCountRef.current = detections.length;
      modelClassesRef.current = summarizeDetectionClasses(detections);
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
      rawObjectsRef.current = buildRawObjectsFromTracks(tracks, timestamp);
      setObjects(nextObjects);
      setFrameState(nextFrame);
      setModelState("ready");
      setError("");
      detectorMissesRef.current = 0;
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
      detectorMissesRef.current += 1;
      setModelState("error");
      setDetectorError(reason);
      if (detectorMissesRef.current >= 3 || overlayMode === "debug") {
        setError("Detector service unavailable. Camera stays usable.");
      }
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

  function saveTestFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setSaveMessage("Start camera before saving a frame.");
      return;
    }

    const imageDataUrl = captureVideoFrame(video);
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const timestamp = Date.now();
    const evidenceFrame = saveAxisMeasureEvidenceFrame({
      createdAt: new Date(timestamp).toISOString(),
      detectorLatencyMs: Math.round(lastInferenceMs),
      frameHeight: height,
      frameWidth: width,
      id: `axis-measure-frame-${timestamp.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      imageDataUrl,
      notes: "",
      objects: getEvidenceObjects(timestamp),
      qualityLabels: [],
      relationships: frameState?.relationships ?? [],
      reviewStatus: "unreviewed",
      route,
      surface,
      timestamp,
    });

    setSavedFrameId(evidenceFrame.id);
    setSavedFrameLabels([]);
    setSaveMessage("Test frame saved. Add quick labels.");
  }

  function toggleSavedFrameLabel(label: AxisMeasureEvidenceQualityLabel) {
    if (!savedFrameId) return;
    setSavedFrameLabels((current) => {
      const next = current.includes(label) ? current.filter((item) => item !== label) : [...current, label];
      updateAxisMeasureEvidenceFrame(savedFrameId, { qualityLabels: next });
      return next;
    });
  }

  function getEvidenceObjects(timestamp: number) {
    return getDrawableObjects()
      .filter((object) => object.type === "player" || object.type === "ball" || object.type === "rim")
      .map((object) => ({
        ...object,
        lastSeenAt: object.type === "rim" ? timestamp : object.lastSeenAt,
        selected: false,
      }));
  }

  function buildObjectsFromTracks(tracks: AxisVisionTrack[], timestamp: number): VisionObject[] {
    const previous = objectsRef.current;
    const selected = selectedId;
    const playerTracks = selectVisiblePlayerTracks(tracks, timestamp);
    const ballTrack = tracks.filter((track) => track.kind === "ball").sort((a, b) => b.score - a.score)[0];

    const nextPlayers: VisionObject[] = playerTracks.map((track, index) => {
      const previousObject = previous.find((object) => object.trackId === track.trackId);
      const isPrimary = track.trackId === primaryPlayerTrackIdRef.current || index === 0;
      const id = isPrimary ? "player-primary" : (previousObject?.id ?? `player-${track.trackId}`);
      const fallbackLabel = isPrimary ? "P1" : `P${index + 1}`;
      return {
        bbox: smoothBox(previousObject?.bbox, trackToBox(track), 0.24),
        classId: track.classId,
        className: track.className,
        confidence: track.score,
        id,
        label: playerNames[id] || fallbackLabel,
        lastSeenAt: timestamp,
        manuallyLocked: Boolean(playerNames[id]),
        selected: selected === id,
        state: track.seenFrames >= 2 || track.score > 0.72 ? "locked" : "candidate",
        trackId: track.trackId,
        type: "player",
      };
    });

    const nextBall: VisionObject | null = ballTrack
      ? {
          bbox: smoothBox(previous.find((object) => object.type === "ball")?.bbox, trackToBox(ballTrack), 0.38),
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
      : previous.find((object) => object.type === "ball" && timestamp - object.lastSeenAt < ballAliveMs)
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
          state: rimLocked ? "manual_override" : "candidate",
          trackId: "manual-rim",
          type: "rim",
        }
      : null;

    return [...nextPlayers, ...(rimObject ? [rimObject] : []), ...(nextBall ? [nextBall] : [])];
  }

  function buildRawObjectsFromTracks(tracks: AxisVisionTrack[], timestamp: number): VisionObject[] {
    const previous = rawObjectsRef.current;
    const rawPlayers = tracks
      .filter((track) => track.kind === "person")
      .sort((a, b) => detectionPriority(b) - detectionPriority(a))
      .slice(0, maxPlayers)
      .map((track, index): VisionObject => {
        const previousObject = previous.find((object) => object.trackId === track.trackId);
        return {
          bbox: smoothBox(previousObject?.bbox, trackToBox(track), 0.4),
          classId: track.classId,
          className: track.className,
          confidence: track.score,
          id: previousObject?.id ?? `raw-player-${track.trackId}`,
          label: `P${index + 1}`,
          lastSeenAt: timestamp,
          manuallyLocked: false,
          selected: selectedId === previousObject?.id,
          state: track.seenFrames >= 2 ? "locked" : "candidate",
          trackId: track.trackId,
          type: "player" as const,
        };
      });

    return rawPlayers;
  }

  function selectVisiblePlayerTracks(tracks: AxisVisionTrack[], timestamp: number) {
    const playerTracks = tracks
      .filter((track) => track.kind === "person")
      .filter((track) => isUsablePlayerTrack(track, timestamp))
      .sort((a, b) => detectionPriority(b) - detectionPriority(a));

    if (overlayMode === "debug" && multiPlayer) return playerTracks.slice(0, maxPlayers);

    const currentPrimary = playerTracks.find((track) => track.trackId === primaryPlayerTrackIdRef.current);
    const best = currentPrimary ?? playerTracks[0];
    primaryPlayerTrackIdRef.current = best?.trackId ?? primaryPlayerTrackIdRef.current;

    return best ? [best] : [];
  }

  function isUsablePlayerTrack(track: AxisVisionTrack, timestamp: number) {
    const box = trackToBox(track);
    const video = videoRef.current;
    const width = video?.videoWidth || 1280;
    const height = video?.videoHeight || 720;
    const areaRatio = (box.width * box.height) / Math.max(1, width * height);
    const selected = selectedId && objectsRef.current.find((object) => object.trackId === track.trackId && object.id === selectedId);
    const isPrimary = track.trackId === primaryPlayerTrackIdRef.current;

    if (timestamp - track.lastSeenAt > productPlayerAliveMs) return false;
    if (!isPrimary && !selected && track.score < productPlayerMinConfidence) return false;
    if (!isPrimary && areaRatio < productPlayerMinAreaRatio) return false;
    if (!isPrimary && track.seenFrames < 2) return false;

    const edgeMarginX = width * productPlayerEdgeMarginRatio;
    const edgeMarginY = height * productPlayerEdgeMarginRatio;
    const nearEdge =
      box.x <= edgeMarginX ||
      box.y <= edgeMarginY ||
      box.x + box.width >= width - edgeMarginX ||
      box.y + box.height >= height - edgeMarginY;

    return Boolean(isPrimary || selected || !nearEdge);
  }

  function detectionPriority(track: AxisVisionTrack) {
    const [,, width, height] = track.bbox;
    const video = videoRef.current;
    const frameArea = Math.max(1, (video?.videoWidth || 1280) * (video?.videoHeight || 720));
    const areaScore = Math.min(1, (width * height) / frameArea / 0.22);
    const persistenceScore = Math.min(1, track.seenFrames / 4);
    return track.score * 0.55 + areaScore * 0.32 + persistenceScore * 0.13;
  }

  function summarizeDetectionClasses(detections: AxisLiveDetection[]) {
    const classes = Array.from(new Set(detections.map((detection) => detection.className || detection.kind))).filter(Boolean);
    return classes.length ? classes.join(", ") : "none";
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

    if (rimSetup === "placing") {
      const box = {
        height: 54,
        width: 86,
        x: point.x - 43,
        y: point.y - 27,
      };
      rimDraftRef.current = box;
      setRimBox(box);
      setRimSetup("adjusting");
      setRimLocked(false);
      setSelectedId("rim-1");
      return;
    }

    if (rimSetup === "adjusting" && rimBox) {
      const handle = getRimResizeHandle(rimBox);
      const nearHandle = Math.hypot(point.x - handle.x, point.y - handle.y) <= 28;
      const inBox = point.x >= rimBox.x && point.x <= rimBox.x + rimBox.width && point.y >= rimBox.y && point.y <= rimBox.y + rimBox.height;
      if (nearHandle || inBox) {
        rimDragRef.current = {
          mode: nearHandle ? "resize" : "move",
          offsetX: point.x - rimBox.x,
          offsetY: point.y - rimBox.y,
          startBox: rimBox,
          startX: point.x,
          startY: point.y,
        };
        setSelectedId("rim-1");
        return;
      }
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
      startRimSetup();
    }
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!rimDragRef.current) return;
    const point = canvasPoint(event);
    const drag = rimDragRef.current;
    const nextBox = drag.mode === "move"
      ? {
          ...drag.startBox,
          x: point.x - drag.offsetX,
          y: point.y - drag.offsetY,
        }
      : {
          ...drag.startBox,
          height: Math.max(32, drag.startBox.height + (point.y - drag.startY)),
          width: Math.max(48, drag.startBox.width + (point.x - drag.startX)),
        };

    rimDraftRef.current = nextBox;
    setRimBox(nextBox);
  }

  function handleCanvasPointerUp() {
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
    rimDragRef.current = null;
  }

  function startRimSetup() {
    setRimSetup(rimBox ? "adjusting" : "placing");
    setRimLocked(false);
    setSelectedId("rim-1");
  }

  function lockRim() {
    if (!rimBox) {
      setRimSetup("placing");
      return;
    }

    rimDraftRef.current = rimBox;
    setRimLocked(true);
    setRimSetup("idle");
    setSelectedId(null);
    recordAxisVisionObjectEvent("rim_locked", { bbox: rimBox });
    recordAxisVisionObjectEvent("object_locked", { id: "rim-1", type: "rim" });
  }

  function cancelRimSetup() {
    if (!rimLocked) setRimBox(null);
    setRimSetup("idle");
    setSelectedId(null);
    rimDragRef.current = null;
  }

  function assignPlayerName(id: string, currentLabel: string) {
    const nextName = window.prompt("Player label", currentLabel);
    if (!nextName) return;
    setPlayerNames((current) => ({ ...current, [id]: nextName.trim() }));
    recordAxisVisionObjectEvent("player_named", { id, label: nextName.trim() });
  }

  function hitTest(x: number, y: number) {
    return [...getDrawableObjects()]
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
    getDrawableObjects().forEach((object) => drawObject(ctx, object));

    if (overlayMode === "debug") {
      drawDebug(ctx);
    }
  }

  function getDrawableObjects() {
    const withImmediateRim = appendImmediateRim(overlayMode !== "debug"
      ? objectsRef.current
      : [...rawObjectsRef.current, ...objectsRef.current.filter((object) => object.type !== "player")]);
    return withImmediateRim;
  }

  function appendImmediateRim(drawableObjects: VisionObject[]) {
    if (!rimBox || drawableObjects.some((object) => object.type === "rim")) return drawableObjects;
    return [...drawableObjects, rimObjectFromBox(rimBox, performance.now())];
  }

  function rimObjectFromBox(box: VisionBox, timestamp: number): VisionObject {
    return {
      bbox: box,
      confidence: 1,
      id: "rim-1",
      label: "Rim",
      lastSeenAt: timestamp,
      manuallyLocked: true,
      selected: selectedId === "rim-1",
      state: rimLocked ? "manual_override" : "candidate",
      trackId: "manual-rim",
      type: "rim",
    };
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

    if (object.type === "rim" && rimSetup === "adjusting") {
      const handle = getRimResizeHandle(object.bbox);
      ctx.fillStyle = "#d8ad52";
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 7, 0, Math.PI * 2);
      ctx.fill();
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

  function getRimResizeHandle(box: VisionBox) {
    return {
      x: box.x + box.width,
      y: box.y + box.height,
    };
  }

  function drawDebug(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(16, 16, 360, detectorError ? 236 : 216);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 13px system-ui";
    ctx.fillText(`DEBUG VIEW`, 28, 38);
    ctx.fillText(`Objects: ${getDrawableObjects().length}  Raw detections: ${rawDetectionCountRef.current}`, 28, 60);
    ctx.fillText(`Frame: ${frameIdRef.current}`, 28, 82);
    ctx.fillText(`Model: ${modelState}`, 28, 104);
    ctx.fillText(`Detector: ${detectorUrl.replace("http://", "")}`, 28, 126);
    ctx.fillText(`Cadence: ${Math.round(lastCadenceMs)}ms  Latency: ${Math.round(lastInferenceMs)}ms`, 28, 148);
    ctx.fillText(`Misses: ${detectorMissesRef.current}  Dropped: ${droppedFramesRef.current}`, 28, 170);
    ctx.fillText(`Classes: ${modelClassesRef.current || "none"}`, 28, 192);
    ctx.fillText(`Multi-player: ${multiPlayer ? "on" : "off"}`, 28, 214);
    if (detectorError) ctx.fillText(`Error: ${detectorError.slice(0, 38)}`, 28, 236);
    ctx.restore();
  }

  function toggleMode(nextMode: OverlayMode) {
    setOverlayMode(nextMode);
    if (nextMode === "debug") recordAxisVisionObjectEvent("debug_mode_enabled");
  }

  const status = useMemo(() => {
    const lockedPlayers = players.filter((object) => object.state === "locked" || object.state === "manual_override").length;
    return {
      ball: ball?.state === "lost" ? "searching" : ball ? "detected" : "searching",
      players: lockedPlayers || players.length ? "locked" : "searching",
      rim: rimLocked && rimBox ? "locked" : rimBox ? "placed" : "manual",
    };
  }, [ball, players, rimBox, rimLocked]);

  return (
    <main className="axis-object-lock">
      <section className="axis-object-lock__stage" aria-label="Axis Vision object lock">
        <video ref={videoRef} autoPlay className="axis-object-lock__video" muted playsInline />
        <canvas
          ref={canvasRef}
          className="axis-object-lock__canvas"
          onPointerDown={handleCanvasPointerDown}
          onPointerLeave={handleCanvasPointerUp}
          onPointerMove={handleCanvasPointerMove}
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
          <button data-active={rimSetup !== "idle"} type="button" onClick={startRimSetup}>
            Set Rim
          </button>
        </header>

        <div className="axis-object-lock__flow" aria-label="Axis Vision setup flow">
          <span data-active={cameraState === "live"}>1 Start camera</span>
          <span data-active={players.length > 0}>2 Lock player</span>
          <span data-active={Boolean(rim)}>3 Set rim</span>
          <span data-active={Boolean(ball)}>4 Ball</span>
        </div>

        {rimSetup !== "idle" && (
          <div className="axis-object-lock__hint">
            <span>{rimSetup === "placing" ? "Tap where the rim is." : "Drag or resize the rim box."}</span>
            {rimSetup === "adjusting" && (
              <div>
                <button type="button" onClick={lockRim}>Lock Rim</button>
                <button type="button" onClick={cancelRimSetup}>Cancel</button>
              </div>
            )}
          </div>
        )}

        {overlayMode === "debug" && (
          <div className="axis-object-lock__debug-controls">
            <label>
              <input checked={multiPlayer} onChange={(event) => setMultiPlayer(event.target.checked)} type="checkbox" />
              Multi-player
            </label>
            <button type="button" onClick={saveTestFrame}>Save Test Frame</button>
            <a href="/measure/review">Review frames</a>
            {saveMessage && <span>{saveMessage}</span>}
            {savedFrameId && (
              <div className="axis-object-lock__labels" aria-label="Frame quality labels">
                {axisMeasureEvidenceQualityLabels.map((label) => (
                  <button
                    data-active={savedFrameLabels.includes(label)}
                    key={label}
                    onClick={() => toggleSavedFrameLabel(label)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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

        {(overlayMode === "debug" || detectorMissesRef.current >= 3) && error && <p className="axis-object-lock__error">{error}</p>}
      </section>
      <style jsx>{styles}</style>
    </main>
  );
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
  .axis-object-lock__error,
  .axis-object-lock__flow,
  .axis-object-lock__debug-controls {
    backdrop-filter: blur(18px);
    background: rgba(5, 7, 6, 0.48);
    border: 1px solid rgba(247, 244, 235, 0.12);
    border-radius: 0.5rem;
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
    display: grid;
    gap: 0.55rem;
    left: 50%;
    min-width: min(22rem, calc(100vw - 2rem));
    padding: 0.7rem 0.9rem;
    text-align: center;
    top: 8.9rem;
    transform: translateX(-50%);
  }

  .axis-object-lock__hint div {
    display: flex;
    gap: 0.45rem;
    justify-content: center;
  }

  .axis-object-lock__hint button {
    min-height: 2.2rem;
  }

  .axis-object-lock__flow {
    display: flex;
    gap: 0.4rem;
    left: 0.75rem;
    overflow-x: auto;
    padding: 0.45rem;
    right: 0.75rem;
    top: 5.35rem;
  }

  .axis-object-lock__flow span {
    background: rgba(247, 244, 235, 0.08);
    border: 1px solid rgba(247, 244, 235, 0.1);
    border-radius: 999px;
    color: rgba(247, 244, 235, 0.62);
    flex: 0 0 auto;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 0.38rem 0.6rem;
  }

  .axis-object-lock__flow span[data-active="true"] {
    background: rgba(216, 173, 82, 0.88);
    color: #151008;
  }

  .axis-object-lock__debug-controls {
    bottom: 6rem;
    color: #f7f4eb;
    display: grid;
    gap: 0.5rem;
    font-size: 0.8rem;
    font-weight: 800;
    max-width: min(22rem, calc(100vw - 1.5rem));
    padding: 0.55rem 0.7rem;
    right: 0.75rem;
  }

  .axis-object-lock__debug-controls label {
    align-items: center;
    display: flex;
    gap: 0.45rem;
  }

  .axis-object-lock__debug-controls input {
    accent-color: #d8ad52;
  }

  .axis-object-lock__debug-controls a {
    color: #f7f4eb;
    text-decoration: underline;
    text-underline-offset: 0.18rem;
  }

  .axis-object-lock__debug-controls span {
    color: rgba(247, 244, 235, 0.68);
    font-size: 0.72rem;
  }

  .axis-object-lock__labels {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .axis-object-lock__labels button {
    background: rgba(247, 244, 235, 0.1);
    color: #f7f4eb;
    font-size: 0.68rem;
    min-height: 2rem;
    padding: 0 0.55rem;
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
