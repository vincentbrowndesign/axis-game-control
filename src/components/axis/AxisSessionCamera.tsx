"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AxisPoseFrame } from "../../lib/axis/axis-pose-detector";
import type { AxisMovementChain } from "../../axis/biomechanics/movement-chain-types";
import { buildAxisLoadChain, saveAxisMovementChain } from "../../axis/biomechanics/load-chain-builder";
import { renderAxisMovementChain } from "../../axis/biomechanics/movement-chain-renderer";
import type { AxisDetectedObject, AxisEvidence, AxisVisionRead } from "../../axis/core/types";
import { axisFeatureFlags } from "../../axis/core/feature-flags";
import {
  openAxisCameraSource,
  type AxisCameraFacingMode,
  type AxisCameraSource,
  type AxisCameraState,
} from "../../axis/camera/camera-source";
import { saveAxisVisionReadEvidence } from "../../axis/evidence/evidence-store";
import type { AxisCommand } from "../../axis/query/axis-command-types";
import { saveAxisCommandMetadata } from "../../axis/query/axis-command-store";
import { parseAxisOpenCommand } from "../../axis/query/open-command-parser";
import { AxisQueryToolbar } from "../../axis/query/query-toolbar";
import { saveAxisMemoryPage, sessionObjectToMemoryPage } from "../../axis/memory/memory-store";
import { saveAxisSessionObject, visionReadToSessionObject } from "../../axis/session/session-store";
import { loadAxisMediaPipePoseAdapter, type AxisMediaPipePoseAdapter } from "../../axis/vision/mediapipe-pose-adapter";
import {
  createPlayerVisionRead,
  playerVisionReadToEvidence,
  poseFrameToPlayerCandidate,
  type AxisPlayerCandidate,
} from "../../axis/vision/player-read-normalizer";
import { renderAxisBasketballVisionOverlay } from "../../axis/vision/overlay-renderer";
import { detectTensorFlowPersonCandidate } from "../../axis/vision/tensorflow-coco-detector";

type Props = {
  onEvidence: (evidence: AxisEvidence[]) => void;
  sessionId: string;
};

const playerReadWindowSize = 10;
const lockReadThreshold = 3;
const shortMissThreshold = 3;
const lostMissThreshold = 5;
const smoothingFactor = 0.32;

export function AxisSessionCamera({ onEvidence, sessionId }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const sourceRef = useRef<AxisCameraSource | null>(null);
  const poseAdapterRef = useRef<AxisMediaPipePoseAdapter | null>(null);
  const latestPlayerReadRef = useRef<AxisVisionRead | null>(null);
  const latestLoadChainRef = useRef<AxisMovementChain | null>(null);
  const previousSmoothedReadRef = useRef<AxisVisionRead | null>(null);
  const playerReadWindowRef = useRef<AxisVisionRead[]>([]);
  const rafRef = useRef<number | null>(null);
  const renderLoopRef = useRef<(timestamp: number) => void>(() => undefined);
  const detectingRef = useRef(false);
  const lastDetectAtRef = useRef(0);
  const cameraFacingModeRef = useRef<AxisCameraFacingMode>("environment");
  const savedPulseUntilRef = useRef(0);
  const uploadUrlRef = useRef<string | null>(null);

  const [cameraState, setCameraState] = useState<AxisCameraState>("idle");
  const [message, setMessage] = useState("Camera ready");
  const [uploadName, setUploadName] = useState("");

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    sourceRef.current?.stop();
    sourceRef.current = null;
    if (uploadUrlRef.current) {
      URL.revokeObjectURL(uploadUrlRef.current);
      uploadUrlRef.current = null;
    }
  }, []);

  const createRead = useCallback(async (command?: string, includeFallback = false) => {
    const video = videoRef.current;
    const timestampMs = Date.now();
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      return createPlayerVisionRead({
        cameraFacingMode: cameraFacingModeRef.current,
        candidates: [],
        command,
        sessionId,
        timestampMs,
      });
    }

    let detectorError = false;
    let poseFrame: AxisPoseFrame | null = null;
    let poseCandidate: AxisPlayerCandidate | null = null;

    try {
      const adapter = poseAdapterRef.current ?? await withTimeout(loadAxisMediaPipePoseAdapter(), 1600);
      poseAdapterRef.current = adapter;
      poseFrame = adapter?.detect(video, timestampMs) ?? null;
      latestLoadChainRef.current = axisFeatureFlags.movementChains
        ? buildAxisLoadChain(poseFrame, { sessionId, timestampMs })
        : null;
      poseCandidate = poseFrameToPlayerCandidate(poseFrame, {
        timestampMs,
        videoHeight: video.videoHeight,
        videoWidth: video.videoWidth,
      });
    } catch {
      detectorError = true;
    }

    const needsFallback = includeFallback && (!poseCandidate || poseCandidate.confidence < 0.65);
    const tensorflowCandidate = needsFallback ? await detectTensorFlowPersonCandidate(video, timestampMs) : null;

    return createPlayerVisionRead({
      cameraFacingMode: cameraFacingModeRef.current,
      candidates: [poseCandidate, tensorflowCandidate],
      command,
      detectorError: detectorError && !poseCandidate && !tensorflowCandidate,
      sessionId,
      timestampMs,
    });
  }, [sessionId]);

  const refreshPlayerRead = useCallback(async (command = "check player", includeFallback = false) => {
    const read = await createRead(command, includeFallback);
    const smoothedRead = stabilizePlayerRead(read, {
      previousRead: previousSmoothedReadRef.current,
      savedPulseUntil: savedPulseUntilRef.current,
      window: playerReadWindowRef.current,
    });
    previousSmoothedReadRef.current = smoothedRead;
    latestPlayerReadRef.current = smoothedRead;
    return smoothedRead;
  }, [createRead]);

  useEffect(() => {
    renderLoopRef.current = (timestamp: number) => {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (video && overlay && video.readyState >= 2) {
        renderAxisBasketballVisionOverlay(overlay, {
          read: latestPlayerReadRef.current,
          video,
        });
        if (axisFeatureFlags.movementChains) {
          renderAxisMovementChain(overlay, {
            chain: latestLoadChainRef.current,
            video,
          });
        }
      }

      if (!detectingRef.current && timestamp - lastDetectAtRef.current > 700) {
        detectingRef.current = true;
        lastDetectAtRef.current = timestamp;
        void refreshPlayerRead("player", false).finally(() => {
          detectingRef.current = false;
        });
      }

      rafRef.current = window.requestAnimationFrame(renderLoopRef.current);
    };
  }, [refreshPlayerRead]);

  const startCamera = useCallback(async (nextFacingMode?: AxisCameraFacingMode) => {
    const video = videoRef.current;
    if (!video) return;
    const facingMode = nextFacingMode ?? cameraFacingModeRef.current;

    stopCamera();
    cameraFacingModeRef.current = facingMode;
    setUploadName("");
    setCameraState("opening");
    setMessage("Opening camera");

    const source = await openAxisCameraSource(video, facingMode);
    sourceRef.current = source;
    setCameraState(source.state);
    setMessage(source.state === "live" ? "Camera ready" : source.message);

    if (source.state === "live") {
      rafRef.current = window.requestAnimationFrame(renderLoopRef.current);
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera("environment");
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  async function switchCamera(facingMode: AxisCameraFacingMode) {
    playerReadWindowRef.current = [];
    previousSmoothedReadRef.current = null;
    latestPlayerReadRef.current = null;
    latestLoadChainRef.current = null;
    await startCamera(facingMode);
  }

  async function flipCamera() {
    await switchCamera(cameraFacingModeRef.current === "environment" ? "user" : "environment");
  }

  async function saveCurrentPlayerRead(command = "save player") {
    const read = createSavedRead(latestPlayerReadRef.current, {
      command,
      sessionId,
    });
    savedPulseUntilRef.current = Date.now() + 850;
    latestPlayerReadRef.current = read;
    previousSmoothedReadRef.current = read;

    const evidence = playerVisionReadToEvidence(read);
    saveAxisVisionReadEvidence(read);
    const sessionObject = visionReadToSessionObject(read);
    saveAxisSessionObject(sessionObject);
    if (axisFeatureFlags.memoryPages) {
      saveAxisMemoryPage(sessionObjectToMemoryPage(sessionObject));
    }
    if (axisFeatureFlags.movementChains && latestLoadChainRef.current) {
      saveAxisMovementChain(latestLoadChainRef.current);
    }
    onEvidence([evidence]);
    return read;
  }

  async function handleCommand(raw: string) {
    const command = parseAxisOpenCommand(raw, {
      cameraReady: cameraState === "live",
      latestPlayerRead: latestPlayerReadRef.current
        ? {
            id: latestPlayerReadRef.current.id,
            lockState: latestPlayerReadRef.current.lockState,
          }
        : null,
    });

    return runCommand(command);
  }

  async function runCommand(command: AxisCommand): Promise<string> {
    if (command.type === "context_submit") {
      if (command.resolvedAction === "open_camera") {
        saveAxisCommandMetadata(command, latestPlayerReadRef.current);
        await startCamera(cameraFacingModeRef.current);
        return "Camera opened";
      }
      if (command.resolvedAction === "check_player") {
        const read = await refreshPlayerRead("check player", true);
        saveAxisCommandMetadata(command, read);
        return "Checking player";
      }
      if (command.resolvedAction === "export") {
        const exported = await exportRead();
        saveAxisCommandMetadata(command, latestPlayerReadRef.current);
        return exported ? "Exported" : "Nothing to export";
      }
      const read = await saveCurrentPlayerRead("save");
      saveAxisCommandMetadata(command, read);
      return "Saved";
    }

    if (command.type === "note") {
      saveAxisNote(command);
      saveAxisCommandMetadata(command, latestPlayerReadRef.current);
      return command.noteKind === "question" ? "Question saved" : "Noted";
    }

    if (command.tool === "session" && command.action === "reset_current") {
      playerReadWindowRef.current = [];
      previousSmoothedReadRef.current = null;
      latestPlayerReadRef.current = null;
      latestLoadChainRef.current = null;
      saveAxisCommandMetadata(command, null);
      return "Reset";
    }

    if (command.tool === "player_lock" && command.action === "check") {
      await refreshPlayerRead(command.raw || "check player", true);
      saveAxisCommandMetadata(command, latestPlayerReadRef.current);
      return "Checking player";
    }

    if (command.tool === "camera" && command.action === "start") {
      await startCamera(cameraFacingModeRef.current);
      saveAxisCommandMetadata(command, latestPlayerReadRef.current);
      return "Camera opened";
    }

    if (command.tool === "camera" && command.action === "front") {
      await switchCamera("user");
      saveAxisCommandMetadata(command, latestPlayerReadRef.current);
      return "Camera opened";
    }

    if (command.tool === "camera" && command.action === "rear") {
      await switchCamera("environment");
      saveAxisCommandMetadata(command, latestPlayerReadRef.current);
      return "Camera opened";
    }

    if (command.tool === "camera" && command.action === "flip") {
      await flipCamera();
      saveAxisCommandMetadata(command, latestPlayerReadRef.current);
      return "Camera opened";
    }

    if (command.tool === "export" && command.action === "frame") {
      const exported = await exportRead();
      saveAxisCommandMetadata(command, latestPlayerReadRef.current);
      return exported ? "Exported" : "Nothing to export";
    }

    const read = await saveCurrentPlayerRead(command.raw || "save player");
    saveAxisCommandMetadata(command, read);
    return "Saved";
  }

  async function exportRead() {
    if (!latestPlayerReadRef.current && cameraState === "live") {
      await refreshPlayerRead("export", true);
    }
    return exportCurrentRead();
  }

  function exportCurrentRead() {
    const read = latestPlayerReadRef.current;
    if (!read) {
      return false;
    }

    const blob = new Blob([JSON.stringify(toExportRead(read), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${read.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  }

  function saveAxisNote(command: AxisCommand & { type: "note" }) {
    const sessionObject = {
      createdAt: command.createdAt,
      evidenceIds: command.attachedToReadId ? [`axis-evidence-${command.attachedToReadId}`] : [],
      id: `axis-session-object-${command.id}`,
      kind: "note" as const,
      label: noteLabel(command.noteKind),
      reviewState: command.noteKind === "question" ? "needs_review" as const : "ready" as const,
      searchableText: [command.raw, command.noteKind, command.attachedToReadId].filter(Boolean).join(" "),
      sessionId,
    };
    saveAxisSessionObject(sessionObject);
    if (axisFeatureFlags.memoryPages) {
      saveAxisMemoryPage(sessionObjectToMemoryPage(sessionObject));
    }
  }

  async function loadUploadFallback(file: File | null) {
    const video = videoRef.current;
    if (!video || !file) return;

    stopCamera();
    const url = URL.createObjectURL(file);
    uploadUrlRef.current = url;
    setUploadName(file.name);
    setCameraState("live");
    setMessage("Upload fallback");
    video.srcObject = null;
    video.src = url;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    rafRef.current = window.requestAnimationFrame(renderLoopRef.current);
  }

  return (
    <section className="axis-session-camera" aria-label="Camera">
      <div className="axis-session-camera__stage">
        <video ref={videoRef} autoPlay muted playsInline />
        <canvas ref={overlayRef} aria-hidden="true" />
        {cameraState !== "live" && (
          <div className="axis-session-camera__empty">
            <strong>{message}</strong>
            <span>Upload fallback is available.</span>
            <label className="axis-session-camera__upload">
              Upload
              <input type="file" accept="video/*" onChange={(event) => void loadUploadFallback(event.target.files?.[0] ?? null)} />
            </label>
          </div>
        )}
        {cameraState === "live" && uploadName && <span className="axis-session-camera__upload-name">{uploadName}</span>}
        <AxisQueryToolbar
          disabled={cameraState !== "live"}
          onCamera={() => void flipCamera()}
          onCommand={handleCommand}
          onExport={() => runCommand(parseAxisOpenCommand("export", {
            cameraReady: cameraState === "live",
            latestPlayerRead: latestPlayerReadRef.current
              ? {
                  id: latestPlayerReadRef.current.id,
                  lockState: latestPlayerReadRef.current.lockState,
                }
              : null,
          }))}
        />
      </div>
    </section>
  );
}

function createSavedRead(read: AxisVisionRead | null, input: {
  command: string;
  sessionId: string;
}): AxisVisionRead {
  const timestampMs = Date.now();
  const base: AxisVisionRead = read ?? {
    confidence: 0,
    id: `axis-player-read-${crypto.randomUUID()}`,
    lockState: "searching",
    motionHints: [],
    objects: [],
    reviewState: "uncertain",
    sessionId: input.sessionId,
    source: "manual",
    timestampMs,
  };

  return {
    ...base,
    cameraFacingMode: base.cameraFacingMode,
    command: input.command,
    id: `axis-player-read-${crypto.randomUUID()}`,
    lockState: base.objects.some((object) => object.label === "player") ? "saved" : base.lockState,
    reviewState: reviewStateFromLockState(base.lockState),
    timestampMs,
  };
}

function reviewStateFromLockState(lockState: AxisVisionRead["lockState"]): AxisVisionRead["reviewState"] {
  if (lockState === "locked" || lockState === "saved") return "ready";
  if (lockState === "review") return "needs_review";
  if (lockState === "error") return "error";
  return "uncertain";
}

function toExportRead(read: AxisVisionRead) {
  return {
    cameraFacingMode: read.cameraFacingMode,
    command: read.command,
    confidence: read.confidence,
    id: read.id,
    lockState: read.lockState,
    note: read.note,
    objects: read.objects.map((object) => ({
      box: object.box,
      confidence: object.confidence,
      id: object.id,
      label: object.label,
      point: object.point,
      source: object.source,
    })),
    reviewState: read.reviewState,
    sessionId: read.sessionId,
    source: read.source,
    timestampMs: read.timestampMs,
  };
}

function noteLabel(noteKind: "coach_note" | "correction" | "question" | "intent") {
  if (noteKind === "question") return "Question";
  if (noteKind === "correction") return "Correction";
  if (noteKind === "intent") return "Intent";
  return "Coach note";
}

function stabilizePlayerRead(read: AxisVisionRead, input: {
  previousRead: AxisVisionRead | null;
  savedPulseUntil: number;
  window: AxisVisionRead[];
}) {
  input.window.push(read);
  if (input.window.length > playerReadWindowSize) input.window.splice(0, input.window.length - playerReadWindowSize);

  const currentPlayer = getPlayer(read);
  const previousPlayer = input.previousRead ? getPlayer(input.previousRead) : null;
  const validReads = input.window.filter((candidate) => Boolean(getPlayer(candidate)?.box));
  const recentValidReads = input.window.slice(-5).filter((candidate) => Boolean(getPlayer(candidate)?.box));
  const missCount = countTrailingMisses(input.window);
  const lastValidRead = [...input.window].reverse().find((candidate) => Boolean(getPlayer(candidate)?.box)) ?? null;
  const lastValidPlayer = lastValidRead ? getPlayer(lastValidRead) : null;
  const sourcePlayer = currentPlayer?.box ? currentPlayer : lastValidPlayer;

  if (!sourcePlayer?.box) {
    return {
      ...read,
      lockState: "searching" as const,
      objects: [],
      reviewState: "uncertain" as const,
    };
  }

  const smoothedBox = previousPlayer?.box
    ? smoothBox(previousPlayer.box, sourcePlayer.box)
    : sourcePlayer.box;
  const smoothedPlayer: AxisDetectedObject = {
    ...sourcePlayer,
    box: smoothedBox,
    point: smoothedBox
      ? { x: smoothedBox.x + smoothedBox.width / 2, y: smoothedBox.y + smoothedBox.height / 2 }
      : sourcePlayer.point,
  };
  const confidence = validReads.length
    ? validReads.slice(-5).reduce((sum, candidate) => sum + candidate.confidence, 0) / Math.min(5, validReads.length)
    : read.confidence;
  const hasSavedPulse = Date.now() < input.savedPulseUntil && Boolean(previousPlayer?.box);
  const lockState = hasSavedPulse
    ? "saved"
    : playerLockState({
        confidence,
        missCount,
        previousLockState: input.previousRead?.lockState,
        recentValidCount: recentValidReads.length,
      });

  return {
    ...read,
    confidence,
    lockState,
    objects: lockState === "searching" ? [] : [smoothedPlayer],
    reviewState: reviewStateFromLockState(lockState),
  };
}

function playerLockState(input: {
  confidence: number;
  missCount: number;
  previousLockState?: AxisVisionRead["lockState"];
  recentValidCount: number;
}): AxisVisionRead["lockState"] {
  if (input.missCount >= lostMissThreshold) return "searching";
  if (input.missCount > shortMissThreshold) return "lost";
  if (
    input.previousLockState === "locked"
    && input.missCount > 0
    && input.missCount <= shortMissThreshold
  ) {
    return "locked";
  }
  if (input.recentValidCount >= lockReadThreshold && input.confidence >= 0.65) return "locked";
  return "review";
}

function countTrailingMisses(reads: AxisVisionRead[]) {
  let count = 0;
  for (let index = reads.length - 1; index >= 0; index -= 1) {
    if (getPlayer(reads[index])?.box) break;
    count += 1;
  }
  return count;
}

function getPlayer(read: AxisVisionRead | null) {
  return read?.objects.find((object) => object.label === "player") ?? null;
}

function smoothBox(
  previous: NonNullable<AxisDetectedObject["box"]>,
  next: NonNullable<AxisDetectedObject["box"]>,
) {
  return {
    height: smoothValue(previous.height, next.height),
    width: smoothValue(previous.width, next.width),
    x: smoothValue(previous.x, next.x),
    y: smoothValue(previous.y, next.y),
  };
}

function smoothValue(previous: number, next: number) {
  return clamp01(previous + (next - previous) * smoothingFactor);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeoutId: number | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}
