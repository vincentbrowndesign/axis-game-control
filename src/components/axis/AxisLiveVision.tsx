"use client";

/* eslint-disable react-hooks/immutability, react-hooks/purity, react-hooks/refs, react-hooks/set-state-in-effect */

import { type FormEvent, useEffect, useRef, useState } from "react";
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
type VisionStatus = "idle" | "starting_camera" | "camera_ready" | "loading_ai" | "running" | "error" | "stopped";
type RecordingStatus = "idle" | "recording" | "stopping" | "ready" | "error";
type PracticeStatus = "setup" | "live" | "ended";
type AxisVisionMode =
  | "shot_workout"
  | "finishing"
  | "ball_handling"
  | "small_sided"
  | "team_practice"
  | "game_film"
  | "axis_lab";
type DrillZonePoint = { x: number; y: number };
type DrillZone = {
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: number;
};
type IgnoreZone = DrillZone & { id: string };

type RecordingMetadata = {
  recordingStartedAt?: number;
  recordingStoppedAt?: number;
  recordingDurationMs?: number;
  recordingMimeType?: string;
  recordingFileName?: string;
  recordingIncludesOverlay: true;
};

type AxisPlayerSlot = {
  slotId: string;
  playerName?: string;
  currentRawTrackId?: string;
  rawTrackHistory: string[];
  bbox: [number, number, number, number];
  score: number;
  lastSeenAt: number;
  locked: boolean;
  status: "active" | "lost" | "candidate";
};

type SetupChecks = {
  cameraStable: boolean;
  playerVisible: boolean;
  readyToRecord: boolean;
};

type ManualPracticeEventType =
  | "START_SESSION"
  | "GOOD_REP"
  | "AGAIN"
  | "NOTE"
  | "SNAPSHOT"
  | "END_SESSION";

type ManualPracticeEvent = {
  id: string;
  type: ManualPracticeEventType;
  timestamp: number;
  elapsedSessionTime: number;
  playerName?: string;
  players: string[];
  objective: string;
  sessionType: string;
  playerSlots: AxisPlayerSlot[];
  ballStatus: string;
  text?: string;
};

const modeConfigs: Record<AxisVisionMode, {
  label: string;
  description: string;
  ballRelevant: boolean;
  requiresRim: boolean;
  suggestedPlayers: number;
}> = {
  axis_lab: {
    ballRelevant: true,
    description: "Debug and raw detection testing.",
    label: "Axis Lab",
    requiresRim: false,
    suggestedPlayers: 5,
  },
  ball_handling: {
    ballRelevant: true,
    description: "One player, ball trail, and active drill space.",
    label: "Ball Handling",
    requiresRim: false,
    suggestedPlayers: 1,
  },
  finishing: {
    ballRelevant: true,
    description: "Finishing reps with a clean player view.",
    label: "Finishing",
    requiresRim: true,
    suggestedPlayers: 1,
  },
  game_film: {
    ballRelevant: false,
    description: "Clean recording and evidence with minimal overlay.",
    label: "Game Film",
    requiresRim: false,
    suggestedPlayers: 5,
  },
  shot_workout: {
    ballRelevant: true,
    description: "Rim, ball, and one shooter.",
    label: "Shot Workout",
    requiresRim: true,
    suggestedPlayers: 1,
  },
  small_sided: {
    ballRelevant: true,
    description: "Player tags and a controlled drill zone.",
    label: "1v1 / 2v2",
    requiresRim: false,
    suggestedPlayers: 4,
  },
  team_practice: {
    ballRelevant: false,
    description: "Clean capture with limited active players.",
    label: "Team Practice",
    requiresRim: false,
    suggestedPlayers: 5,
  },
};

const inferenceIntervalMs = 200;
const maxStoredFrames = 600;
const defaultMaxDisplayedPlayers = 5;
const playerSlotStaleMs = 2_000;
const gymSetupStorageKey = "axis-live-vision:gym-setup:v1";
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
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<AxisLiveDetector | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const trackerRef = useRef(createAxisTracker());
  const rafRef = useRef<number | null>(null);
  const recordingRafRef = useRef<number | null>(null);
  const lastInferenceAtRef = useRef(0);
  const aiRunningRef = useRef(false);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef<number | undefined>(undefined);
  const recordingMimeTypeRef = useRef("");
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
  const playerSlotsRef = useRef<AxisPlayerSlot[]>([]);
  const rawTrackSeenCountsRef = useRef<Record<string, number>>({});
  const nextPlayerSlotIndexRef = useRef(1);
  const showTrailRef = useRef(true);
  const showCalibrationRef = useRef(true);
  const drillZoneRef = useRef<DrillZone | null>(null);
  const ignoreZonesRef = useRef<IgnoreZone[]>([]);
  const floorTapCountRef = useRef(0);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [, setModelStatus] = useState<ModelStatus>("idle");
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [visionStatus, setVisionStatus] = useState<VisionStatus>("idle");
  const [gymMode] = useState(true);
  const [practiceStatus, setPracticeStatus] = useState<PracticeStatus>("setup");
  const [practiceStarting, setPracticeStarting] = useState(false);
  const [practicePlayerInput, setPracticePlayerInput] = useState("");
  const [practiceObjective, setPracticeObjective] = useState("");
  const [selectedMode, setSelectedMode] = useState<AxisVisionMode | null>("ball_handling");
  const [manualEvents, setManualEvents] = useState<ManualPracticeEvent[]>([]);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [practiceElapsedMs, setPracticeElapsedMs] = useState(0);
  const [practiceEndedAt, setPracticeEndedAt] = useState<number | null>(null);
  const [setupChecks, setSetupChecks] = useState<SetupChecks>({
    cameraStable: false,
    playerVisible: false,
    readyToRecord: false,
  });
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingFileName, setRecordingFileName] = useState("");
  const [recordingMetadata, setRecordingMetadata] = useState<RecordingMetadata | null>(null);
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
  const [calibrationMenuOpen, setCalibrationMenuOpen] = useState(false);
  const [ballTrail, setBallTrail] = useState<AxisBallTrailState>({ points: [], visible: false });
  const [playerSlots, setPlayerSlots] = useState<AxisPlayerSlot[]>([]);
  const [selectedPlayerSlotId, setSelectedPlayerSlotId] = useState<string | null>(null);
  const [playerNameDraft, setPlayerNameDraft] = useState("");
  const [showTrail, setShowTrail] = useState(true);
  const [maxDisplayedPlayers] = useState(defaultMaxDisplayedPlayers);
  const [showConfidence, setShowConfidence] = useState(false);
  const [showRawTrackIds, setShowRawTrackIds] = useState(false);
  const [showAllDetections, setShowAllDetections] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [drillZone, setDrillZone] = useState<DrillZone | null>(null);
  const [ignoreZones, setIgnoreZones] = useState<IgnoreZone[]>([]);
  const [drillZoneMode, setDrillZoneMode] = useState(false);
  const [ignoreZoneMode, setIgnoreZoneMode] = useState(false);
  const [drillZoneDraft, setDrillZoneDraft] = useState<DrillZonePoint | null>(null);
  const [setupLoaded, setSetupLoaded] = useState(false);

  useEffect(() => {
    return () => {
      stopRecordingLoop();
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      stopAI();
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(gymSetupStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          calibration?: AxisCalibrationState;
          drillZone?: DrillZone | null;
          ignoreZones?: IgnoreZone[];
          showAllDetections?: boolean;
          showCandidates?: boolean;
          showConfidence?: boolean;
          showRawTrackIds?: boolean;
          showTrail?: boolean;
        };

        if (parsed.calibration) {
          calibrationRef.current = parsed.calibration;
          setCalibration(parsed.calibration);
        }
        if (parsed.drillZone !== undefined) {
          drillZoneRef.current = parsed.drillZone;
          setDrillZone(parsed.drillZone);
        }
        if (Array.isArray(parsed.ignoreZones)) {
          ignoreZonesRef.current = parsed.ignoreZones;
          setIgnoreZones(parsed.ignoreZones);
        }
        if (typeof parsed.showTrail === "boolean") {
          showTrailRef.current = parsed.showTrail;
          setShowTrail(parsed.showTrail);
        }
        if (typeof parsed.showAllDetections === "boolean") setShowAllDetections(parsed.showAllDetections);
        if (typeof parsed.showCandidates === "boolean") setShowCandidates(parsed.showCandidates);
        if (typeof parsed.showConfidence === "boolean") setShowConfidence(parsed.showConfidence);
        if (typeof parsed.showRawTrackIds === "boolean") setShowRawTrackIds(parsed.showRawTrackIds);
      }
    } catch {
      // A bad local setup should not block the camera.
    } finally {
      setSetupLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!setupLoaded) return;
    const setup = {
      calibration,
      drillZone,
      ignoreZones,
      showAllDetections,
      showCandidates,
      showConfidence,
      showRawTrackIds,
      showTrail,
    };
    window.localStorage.setItem(gymSetupStorageKey, JSON.stringify(setup));
  }, [
    calibration,
    drillZone,
    ignoreZones,
    setupLoaded,
    showAllDetections,
    showCandidates,
    showConfidence,
    showRawTrackIds,
    showTrail,
  ]);

  useEffect(() => {
    calibrationRef.current = calibration;
  }, [calibration]);

  useEffect(() => {
    showTrailRef.current = showTrail;
  }, [showTrail]);

  useEffect(() => {
    drillZoneRef.current = drillZone;
  }, [drillZone]);

  useEffect(() => {
    ignoreZonesRef.current = ignoreZones;
  }, [ignoreZones]);

  useEffect(() => {
    if (recordingStatus !== "recording" || recordingStartedAt === null) return undefined;

    const interval = window.setInterval(() => {
      setRecordingElapsedMs(Date.now() - recordingStartedAt);
    }, 250);

    return () => window.clearInterval(interval);
  }, [recordingStatus, recordingStartedAt]);

  useEffect(() => {
    if (practiceStatus !== "live") return undefined;

    const interval = window.setInterval(() => {
      setPracticeElapsedMs(Date.now() - sessionStartedAtRef.current);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [practiceStatus]);

  useEffect(() => {
    tracksRef.current = activeTracks;
    drawDetections(activeTracks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTracks, cameraStatus, aiStatus, fps, frameCount, ballVisible, maxPeopleCount, calibration, ballTrail, showTrail, playerSlots, showConfidence, showRawTrackIds, showAllDetections, showCandidates, drillZone]);

  // ─── Canvas click / calibration ────────────────────────────────

  function getVideoCoords(e: { clientX: number; clientY: number }) {
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

  function handleCanvasPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const mode = calibrationRef.current.mode !== "off" ? calibrationRef.current.mode : calibrationMode;
    const coords = getVideoCoords(e);
    if (!coords) return;
    const { vx, vy } = coords;

    if (drillZoneMode || ignoreZoneMode) {
      if (!drillZoneDraft) {
        setDrillZoneDraft({ x: vx, y: vy });
        return;
      }

      const nextZone = {
        createdAt: Date.now(),
        height: Math.abs(vy - drillZoneDraft.y),
        width: Math.abs(vx - drillZoneDraft.x),
        x: Math.min(vx, drillZoneDraft.x),
        y: Math.min(vy, drillZoneDraft.y),
      };
      if (drillZoneMode) {
        drillZoneRef.current = nextZone;
        setDrillZone(nextZone);
      } else {
        const ignoreZone: IgnoreZone = { ...nextZone, id: `ignore-${Date.now().toString(36)}` };
        const nextZones = [...ignoreZonesRef.current, ignoreZone];
        ignoreZonesRef.current = nextZones;
        setIgnoreZones(nextZones);
      }
      setDrillZoneDraft(null);
      setDrillZoneMode(false);
      setIgnoreZoneMode(false);
      return;
    }

    if (mode === "off") {
      openPlayerAssignmentFromPoint(vx, vy);
      return;
    }

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
          mode: "set_floor",
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
        mode: paintPoints.length >= 2 ? "off" : "set_paint",
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
    if (next.mode === "off") setCalibrationMenuOpen(false);
  }

  function activateCalMode(mode: CalMode) {
    if (recordingStatus === "recording") {
      setLastError("Stop recording before calibration.");
      return;
    }

    const next = mode === calibrationMode ? "off" : mode;
    if (mode === "set_floor") floorTapCountRef.current = 0;
    const nextCalibration: AxisCalibrationState = {
      ...calibrationRef.current,
      mode: next,
      paintPoints: next === "set_paint" ? [] : calibrationRef.current.paintPoints,
      updatedAt: Date.now(),
    };
    calibrationRef.current = nextCalibration;
    setCalibration(nextCalibration);
    setCalibrationMode(next);
    setCalibrationMenuOpen(false);
    if (next !== "off") {
      setEvidencePanelOpen(false);
      cancelPlayerAssignment();
    }
  }

  function clearCalibration() {
    const next = defaultCal();
    calibrationRef.current = next;
    floorTapCountRef.current = 0;
    setCalibration(next);
    setCalibrationMode("off");
    setCalibrationMenuOpen(false);
  }

  function cancelCalibration() {
    const next: AxisCalibrationState = { ...calibrationRef.current, mode: "off", updatedAt: Date.now() };
    calibrationRef.current = next;
    floorTapCountRef.current = 0;
    setCalibration(next);
    setCalibrationMode("off");
    setCalibrationMenuOpen(false);
  }

  function openPlayerAssignmentFromPoint(x: number, y: number) {
    const slot = findPlayerSlotAtPoint(x, y);

    if (!slot) return;
    openPlayerAssignment(slot.slotId);
  }

  function findPlayerSlotAtPoint(x: number, y: number) {
    const slots = getDisplayedPlayerSlots();
    const paddedHit = slots
      .filter((slot) => pointInsidePaddedBbox(x, y, slot.bbox, 34))
      .sort((a, b) => bboxArea(a.bbox) - bboxArea(b.bbox))[0];

    if (paddedHit) return paddedHit;

    const point = { x, y };
    return slots
      .map((slot) => {
        const center = bboxCenter(slot.bbox);
        const [, , width, height] = slot.bbox;
        const maxDistance = Math.max(90, Math.min(width, height) * 0.75);
        return { distance: distanceBetween(point, center), maxDistance, slot };
      })
      .filter((candidate) => candidate.distance <= candidate.maxDistance)
      .sort((a, b) => a.distance - b.distance)[0]?.slot;
  }

  function openPlayerAssignment(slotId: string) {
    lockPlayer(slotId);
    const slot = playerSlotsRef.current.find((item) => item.slotId === slotId);
    setSelectedPlayerSlotId(slotId);
    setPlayerNameDraft(slot?.playerName ?? "");
    setEvidencePanelOpen(false);
    setCalibrationMenuOpen(false);
    setToolsOpen(false);
  }

  function updatePlayerSlot(slotId: string, patch: Partial<AxisPlayerSlot>) {
    const next = playerSlotsRef.current.map((slot) =>
      slot.slotId === slotId ? { ...slot, ...patch } : slot,
    );
    playerSlotsRef.current = next;
    setPlayerSlots(next);
  }

  function lockPlayer(slotId: string) {
    updatePlayerSlot(slotId, { locked: true, status: "active" });
  }

  function toggleCalibrationMenu() {
    if (recordingStatus === "recording") {
      setLastError("Stop recording before calibration.");
      return;
    }

    setCalibrationMenuOpen((open) => !open);
  }

  function savePlayerAssignment() {
    if (!selectedPlayerSlotId) return;
    const trimmed = playerNameDraft.trim();
    updatePlayerSlot(selectedPlayerSlotId, {
      locked: true,
      playerName: trimmed || undefined,
    });
    setSelectedPlayerSlotId(null);
    setPlayerNameDraft("");
  }

  function clearSelectedPlayerAssignment() {
    if (!selectedPlayerSlotId) return;
    updatePlayerSlot(selectedPlayerSlotId, {
      locked: false,
      playerName: undefined,
    });
    setSelectedPlayerSlotId(null);
    setPlayerNameDraft("");
  }

  function cancelPlayerAssignment() {
    setSelectedPlayerSlotId(null);
    setPlayerNameDraft("");
  }

  function clearPlayerTags() {
    const next = playerSlotsRef.current.map((slot) => ({
      ...slot,
      locked: false,
      playerName: undefined,
    }));
    playerSlotsRef.current = next;
    setPlayerSlots(next);
  }

  function startDrillZone() {
    if (recordingStatus === "recording") {
      setLastError("Stop recording before setting Drill Zone.");
      return;
    }

    const nextCalibration: AxisCalibrationState = { ...calibrationRef.current, mode: "off", updatedAt: Date.now() };
    calibrationRef.current = nextCalibration;
    setCalibration(nextCalibration);
    setCalibrationMode("off");
    setCalibrationMenuOpen(false);
    setToolsOpen(false);
    setEvidencePanelOpen(false);
    cancelPlayerAssignment();
    setDrillZoneDraft(null);
    setIgnoreZoneMode(false);
    setDrillZoneMode(true);
  }

  function startIgnoreZone() {
    if (recordingStatus === "recording") {
      setLastError("Stop recording before setting Ignore Zone.");
      return;
    }

    const nextCalibration: AxisCalibrationState = { ...calibrationRef.current, mode: "off", updatedAt: Date.now() };
    calibrationRef.current = nextCalibration;
    setCalibration(nextCalibration);
    setCalibrationMode("off");
    setCalibrationMenuOpen(false);
    setToolsOpen(false);
    setEvidencePanelOpen(false);
    cancelPlayerAssignment();
    setDrillZoneDraft(null);
    setDrillZoneMode(false);
    setIgnoreZoneMode(true);
  }

  function clearDrillZone() {
    drillZoneRef.current = null;
    setDrillZone(null);
    setDrillZoneDraft(null);
    setDrillZoneMode(false);
  }

  function cancelDrillZone() {
    setDrillZoneDraft(null);
    setDrillZoneMode(false);
    setIgnoreZoneMode(false);
  }

  function selectMode(mode: AxisVisionMode) {
    setSelectedMode(mode);
    setSetupChecks({ cameraStable: false, playerVisible: false, readyToRecord: false });
    setEvidencePanelOpen(false);
    setToolsOpen(false);

    if (mode === "axis_lab") {
      setShowAllDetections(true);
      setShowRawTrackIds(true);
      setShowConfidence(true);
      setShowCandidates(true);
      return;
    }

    setShowAllDetections(false);
    setShowRawTrackIds(false);
    setShowConfidence(false);
    setShowCandidates(false);
    setShowTrail(mode === "ball_handling" || mode === "shot_workout");
    showTrailRef.current = mode === "ball_handling" || mode === "shot_workout";
  }

  function getPracticePlayers() {
    return practicePlayerInput
      .split(/[,;\n]/)
      .map((player) => player.trim())
      .filter(Boolean);
  }

  function getPracticePlayerLabel() {
    const players = getPracticePlayers();
    if (players.length === 0) return "Practice";
    if (players.length === 1) return players[0];
    return `${players[0]} + ${players.length - 1}`;
  }

  function getBallStatusLabel() {
    if (ballVisible) return "live";
    if (ballLostCount > 0) return "lost";
    return "experimental";
  }

  function createManualEvent(type: ManualPracticeEventType, text?: string): ManualPracticeEvent {
    const now = Date.now();
    const players = getPracticePlayers();
    return {
      ballStatus: getBallStatusLabel(),
      elapsedSessionTime: Math.max(0, now - sessionStartedAtRef.current),
      id: `${type.toLowerCase()}-${now.toString(36)}-${manualEvents.length}`,
      objective: practiceObjective.trim(),
      playerName: players[0],
      players,
      playerSlots: playerSlotsRef.current,
      sessionType: selectedMode ? modeConfigs[selectedMode].label : "Practice",
      text,
      timestamp: now,
      type,
    };
  }

  function addManualEvent(type: ManualPracticeEventType, text?: string) {
    const event = createManualEvent(type, text);
    setManualEvents((current) => [...current, event]);
    return event;
  }

  async function startPracticeSession(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const nextId = createSessionId();
    const now = Date.now();
    sessionIdRef.current = nextId;
    sessionStartedAtRef.current = now;
    setSessionId(nextId);
    setSessionStartedAt(now);
    setPracticeElapsedMs(0);
    setPracticeEndedAt(null);
    setManualEvents([]);
    setPracticeStatus("live");
    setPracticeStarting(true);
    selectMode(selectedMode ?? "ball_handling");

    const startEvent = createManualEvent("START_SESSION");
    setManualEvents([startEvent]);

    try {
      await startLiveVision();
    } finally {
      setPracticeStarting(false);
    }
  }

  function resetPracticeForm() {
    setPracticePlayerInput("");
    setPracticeObjective("");
    setSelectedMode("ball_handling");
    setSetupChecks({ cameraStable: false, playerVisible: false, readyToRecord: false });
    setLastError("");
  }

  function logGoodRep() {
    addManualEvent("GOOD_REP");
  }

  function logAgain() {
    addManualEvent("AGAIN");
  }

  function savePracticeNote() {
    const text = noteDraft.trim();
    if (!text) return;
    addManualEvent("NOTE", text);
    setNoteDraft("");
    setNoteOpen(false);
  }

  function endPracticeSession() {
    const endedAt = Date.now();
    setPracticeElapsedMs(Math.max(0, endedAt - sessionStartedAtRef.current));
    setPracticeEndedAt(endedAt);
    addManualEvent("END_SESSION");
    if (recordingStatus === "recording") stopRecording();
    stopAI();
    stopCameraTracks();
    setCameraStatus("idle");
    setVisionStatus("stopped");
    setPracticeStatus("ended");
    clearCanvas();
  }

  function startAnotherPractice() {
    clearSession();
    discardClip();
    resetPracticeForm();
    setManualEvents([]);
    setNoteOpen(false);
    setPracticeStatus("setup");
    setPracticeElapsedMs(0);
    setPracticeEndedAt(null);
  }

  function updateSetupCheck(key: keyof SetupChecks, value: boolean) {
    setSetupChecks((current) => ({ ...current, [key]: value }));
  }

  function clearIgnoreZones() {
    ignoreZonesRef.current = [];
    setIgnoreZones([]);
  }

  function unlockPlayerSlot(slotId: string) {
    updatePlayerSlot(slotId, { locked: false });
  }

  function clearPlayerSlot(slotId: string) {
    const next = playerSlotsRef.current.filter((slot) => slot.slotId !== slotId);
    playerSlotsRef.current = next;
    setPlayerSlots(next);
    if (selectedPlayerSlotId === slotId) cancelPlayerAssignment();
  }

  function resetGymSetup() {
    const nextCal = defaultCal();
    calibrationRef.current = nextCal;
    drillZoneRef.current = null;
    ignoreZonesRef.current = [];
    showTrailRef.current = true;
    setCalibration(nextCal);
    setCalibrationMode("off");
    setCalibrationMenuOpen(false);
    setDrillZone(null);
    setDrillZoneDraft(null);
    setDrillZoneMode(false);
    setIgnoreZoneMode(false);
    setIgnoreZones([]);
    setShowAllDetections(false);
    setShowCandidates(false);
    setShowConfidence(false);
    setShowRawTrackIds(false);
    setShowTrail(true);
    setToolsOpen(false);
    window.localStorage.removeItem(gymSetupStorageKey);
  }

  function buildSetupChecklist() {
    const modeConfig = selectedMode ? modeConfigs[selectedMode] : null;
    return {
      cameraStable: setupChecks.cameraStable,
      drillZoneSet: Boolean(drillZone),
      ignoreZonesSet: ignoreZones.length > 0,
      mode: modeConfig?.label ?? null,
      playerVisible: setupChecks.playerVisible,
      playersTagged: playerSlots.some((slot) => Boolean(slot.playerName)),
      readyToRecord: setupChecks.readyToRecord,
      rimVisible: modeConfig?.requiresRim ? Boolean(calibration.rim) : true,
    };
  }

  // ─── Camera / AI ────────────────────────────────────────────────

  async function startLiveVision() {
    if (aiRunningRef.current) return true;
    setVisionStatus("starting_camera");
    const cameraStarted = await startCamera();
    if (!cameraStarted) {
      setVisionStatus("error");
      return false;
    }

    setVisionStatus("camera_ready");
    setVisionStatus("loading_ai");
    const aiStarted = await startAI();
    setVisionStatus(aiStarted ? "running" : "error");
    return aiStarted;
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
    if (recordingStatus === "recording") stopRecording();
    stopAI();
    stopCameraTracks();
    setCameraStatus("idle");
    setVisionStatus("stopped");

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
    setVisionStatus("starting_camera");

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
        setVisionStatus("loading_ai");
        const aiStarted = await startAI();
        setVisionStatus(aiStarted ? "running" : "error");
      } catch (error) {
        stopCameraTracks();
        setCameraStatus("error");
        setVisionStatus("error");
        setLastError(error instanceof Error ? error.message : "Camera could not flip.");
      }
    }
  }

  async function startAI() {
    if (aiRunningRef.current) return true;
    if (cameraStatus !== "live" && !streamRef.current) {
      const ok = await startCamera();
      if (!ok) return false;
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
      return true;
    } catch (error) {
      aiRunningRef.current = false;
      setAiStatus("error");
      setModelStatus("error");
      setLastError(error instanceof Error ? error.message : "AI model could not start.");
      return false;
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
        const nextPlayerSlots = updatePlayerSlots(nextTracks, timestamp);
        ballTrailRef.current = nextTrail;

        tracksRef.current = nextTracks;
        setFrameCount(frameCountRef.current);
        setActiveTracks(nextTracks);
        setVisionFrames(visionFramesRef.current);
        setBallVisible(nextBallVisible);
        setBallLostCount(ballLostFramesRef.current);
        setMaxPeopleCount(maxPeopleCountRef.current);
        setBallTrail(nextTrail);
        setPlayerSlots(nextPlayerSlots);

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

    drawAxisOverlay(ctx, rect.width, rect.height, video, nextTracks);
  }

  function isTrackInDrillZone(track: AxisVisionTrack) {
    const zone = drillZoneRef.current;
    if (!zone || track.kind === "ball") return true;
    const center = bboxCenter(track.bbox);
    return center.x >= zone.x
      && center.x <= zone.x + zone.width
      && center.y >= zone.y
      && center.y <= zone.y + zone.height;
  }

  function isPointInZone(point: { x: number; y: number }, zone: DrillZone) {
    return point.x >= zone.x
      && point.x <= zone.x + zone.width
      && point.y >= zone.y
      && point.y <= zone.y + zone.height;
  }

  function isTrackInIgnoreZone(track: AxisVisionTrack) {
    if (track.kind !== "person") return false;
    const center = bboxCenter(track.bbox);
    return ignoreZonesRef.current.some((zone) => isPointInZone(center, zone));
  }

  function isSlotInDrillZone(slot: AxisPlayerSlot) {
    const zone = drillZoneRef.current;
    if (!zone) return true;
    const center = bboxCenter(slot.bbox);
    return center.x >= zone.x
      && center.x <= zone.x + zone.width
      && center.y >= zone.y
      && center.y <= zone.y + zone.height;
  }

  function getPlayerSlotLabel(slot: AxisPlayerSlot) {
    if (showRawTrackIds && slot.currentRawTrackId) return slot.currentRawTrackId;
    return slot.playerName || slot.slotId;
  }

  function updatePlayerSlots(nextTracks: AxisVisionTrack[], timestamp: number) {
    const rawPeople = suppressDuplicateRawPeople(
      nextTracks.filter((track) =>
        track.kind === "person"
        && track.status === "active"
        && !isTrackInIgnoreZone(track),
      ),
    );
    const slots = playerSlotsRef.current.map((slot) => ({ ...slot }));
    const matchedSlotIds = new Set<string>();

    for (const track of rawPeople) {
      rawTrackSeenCountsRef.current[track.trackId] = (rawTrackSeenCountsRef.current[track.trackId] ?? 0) + 1;
      const match = findMatchingPlayerSlot(slots, track, timestamp, matchedSlotIds);

      if (match) {
        const seenCount = rawTrackSeenCountsRef.current[track.trackId] ?? 0;
        const confirmed = match.locked || match.playerName || seenCount >= 3 || track.score >= 0.82;
        const history = match.rawTrackHistory.includes(track.trackId)
          ? match.rawTrackHistory
          : [...match.rawTrackHistory, track.trackId];
        Object.assign(match, {
          bbox: track.bbox,
          currentRawTrackId: track.trackId,
          lastSeenAt: timestamp,
          rawTrackHistory: history,
          score: track.score,
          status: confirmed ? "active" as const : "candidate" as const,
        });
        matchedSlotIds.add(match.slotId);
        continue;
      }

      const seenCount = rawTrackSeenCountsRef.current[track.trackId] ?? 0;
      const shouldCreate = seenCount >= 3 || track.score >= 0.82;
      if (!isTrackInDrillZone(track)) continue;

      const slotId = `P${nextPlayerSlotIndexRef.current++}`;
      slots.push({
        bbox: track.bbox,
        currentRawTrackId: track.trackId,
        slotId,
        lastSeenAt: timestamp,
        locked: false,
        playerName: undefined,
        rawTrackHistory: [track.trackId],
        score: track.score,
        status: shouldCreate ? "active" : "candidate",
      });
      matchedSlotIds.add(slotId);
    }

    const nextSlots = slots
      .filter((slot) => slot.locked || timestamp - slot.lastSeenAt <= playerSlotStaleMs)
      .map((slot) => ({
        ...slot,
        currentRawTrackId: timestamp - slot.lastSeenAt <= playerSlotStaleMs ? slot.currentRawTrackId : undefined,
        status: timestamp - slot.lastSeenAt <= playerSlotStaleMs ? slot.status : "lost" as const,
      }));

    playerSlotsRef.current = nextSlots;
    return nextSlots;
  }

  function suppressDuplicateRawPeople(rawPeople: AxisVisionTrack[]) {
    return [...rawPeople]
      .sort((a, b) => b.score - a.score)
      .reduce<AxisVisionTrack[]>((kept, track) => {
        const duplicate = kept.some((existing) => {
          const overlap = calculateBboxIoU(existing.bbox, track.bbox);
          const distance = distanceBetween(bboxCenter(existing.bbox), bboxCenter(track.bbox));
          const bodyWidth = Math.max(existing.bbox[2], track.bbox[2], 1);
          return overlap > 0.48 || distance < bodyWidth * 0.28;
        });
        if (!duplicate) kept.push(track);
        return kept;
      }, []);
  }

  function findMatchingPlayerSlot(
    slots: AxisPlayerSlot[],
    track: AxisVisionTrack,
    timestamp: number,
    matchedSlotIds: Set<string>,
  ) {
    const center = bboxCenter(track.bbox);

    return slots
      .filter((slot) => !matchedSlotIds.has(slot.slotId))
      .map((slot) => {
        const slotCenter = bboxCenter(slot.bbox);
        const distance = distanceBetween(center, slotCenter);
        const maxDistance = Math.max(100, Math.max(slot.bbox[2], slot.bbox[3]) * 0.75);
        const iou = calculateBboxIoU(slot.bbox, track.bbox);
        const sizeRatio = Math.min(bboxArea(slot.bbox), bboxArea(track.bbox))
          / Math.max(bboxArea(slot.bbox), bboxArea(track.bbox), 1);
        const recentlySeen = timestamp - slot.lastSeenAt <= playerSlotStaleMs;
        const sameRawTrack = slot.currentRawTrackId === track.trackId || slot.rawTrackHistory.includes(track.trackId);
        const score = (sameRawTrack ? 2 : 0)
          + (recentlySeen ? 1 : 0)
          + iou * 3
          + Math.max(0, 1 - distance / maxDistance)
          + sizeRatio;
        return { distance, iou, maxDistance, score, sizeRatio, slot };
      })
      .filter((candidate) =>
        candidate.slot.locked
          ? candidate.sizeRatio > 0.38 && (candidate.distance <= candidate.maxDistance * 0.9 || candidate.iou > 0.14)
          : candidate.distance <= candidate.maxDistance || candidate.iou > 0.18,
      )
      .filter((candidate) => candidate.sizeRatio > 0.28 || candidate.iou > 0.2)
      .sort((a, b) => b.score - a.score)[0]?.slot;
  }

  function getDisplayedPlayerSlots() {
    const slots = playerSlotsRef.current;
    const playerLimit = getMaxDisplayedPlayers();

    return slots
      .filter((slot) => slot.status === "active" || (slot.status === "candidate" && showCandidates))
      .map((slot) => {
        const assigned = Boolean(slot.playerName);
        const inZone = isSlotInDrillZone(slot);
        const priority = (assigned ? 1_000 : 0)
          + (slot.locked ? 500 : 0)
          + (inZone ? 100 : -500)
          + slot.score * 10
          + bboxArea(slot.bbox) / 100_000;
        return { assigned, inZone, priority, slot };
      })
      .filter((item) => item.assigned || item.slot.locked || item.inZone)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, playerLimit)
      .map((item) => item.slot);
  }

  function getMaxDisplayedPlayers() {
    return selectedMode ? modeConfigs[selectedMode].suggestedPlayers : maxDisplayedPlayers;
  }

  function getDisplayedTracks(nextTracks: AxisVisionTrack[]) {
    const balls = nextTracks.filter((track) => track.kind === "ball");
    if (showAllDetections) return nextTracks;

    return [...balls];
  }

  function getDisplayPeopleCount() {
    return getDisplayedPlayerSlots().length;
  }

  function drawAxisOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    video: HTMLVideoElement,
    nextTracks = tracksRef.current,
    includeRecordingStatus = false,
  ) {
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const scale = Math.min(width / vw, height / vh);
    const ox = (width - vw * scale) / 2;
    const oy = (height - vh * scale) / 2;

    const displayedPlayerSlots = getDisplayedPlayerSlots();
    const displayedTracks = getDisplayedTracks(nextTracks);

    drawZones(ctx, drillZoneRef.current, ignoreZonesRef.current, ox, oy, scale);

    for (const slot of displayedPlayerSlots) {
      const [x, y, w, h] = slot.bbox;
      const bx = ox + x * scale;
      const by = oy + y * scale;
      const bw = w * scale;
      const bh = h * scale;
      const outsideZone = !isSlotInDrillZone(slot);
      const label = `${getPlayerSlotLabel(slot)}${showConfidence ? ` ${Math.round(slot.score * 100)}%` : ""}`;

      ctx.strokeStyle = "#7cf7d4";
      ctx.globalAlpha = outsideZone ? 0.35 : 1;
      ctx.lineWidth = slot.locked ? 2 : 1.4;
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = "rgba(0,0,0,0.58)";
      const lw = Math.max(44, ctx.measureText(label).width + 14);
      ctx.fillRect(bx, Math.max(0, by - 22), lw, 19);
      ctx.fillStyle = "#7cf7d4";
      ctx.font = MONO;
      ctx.fillText(label, bx + 7, Math.max(14, by - 8));
      ctx.globalAlpha = 1;
    }

    for (const track of displayedTracks) {
      if (track.kind !== "ball") {
        if (!showAllDetections) continue;
      }
      const [x, y, w, h] = track.bbox;
      const bx = ox + x * scale;
      const by = oy + y * scale;
      const bw = w * scale;
      const bh = h * scale;
      const color = track.kind === "ball" ? "#f8d45c" : "rgba(124,247,212,0.42)";
      const label = track.kind === "ball"
        ? `BALL${showConfidence ? ` ${Math.round(track.score * 100)}%` : ""}`
        : `${track.trackId}${showConfidence ? ` ${Math.round(track.score * 100)}%` : ""}`;

      ctx.strokeStyle = color;
      ctx.lineWidth = track.kind === "ball" ? 2 : 1;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      const lw = Math.max(44, ctx.measureText(label).width + 14);
      ctx.fillRect(bx, Math.max(0, by - 22), lw, 19);
      ctx.fillStyle = color;
      ctx.font = MONO;
      ctx.fillText(label, bx + 7, Math.max(14, by - 8));
    }

    if (showCalibrationRef.current) drawCalibration(ctx, calibrationRef.current, ox, oy, scale);
    if (showTrailRef.current) drawTrail(ctx, ballTrailRef.current, ox, oy, scale);

    if (includeRecordingStatus) {
      const elapsed = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : 0;
      ctx.fillStyle = "rgba(0,0,0,0.58)";
      ctx.fillRect(14, 14, 214, 58);
      ctx.fillStyle = "#ff4f4f";
      ctx.beginPath();
      ctx.arc(33, 43, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f8f7f2";
      ctx.font = "800 12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(`AXIS REC ${formatRecordingTime(elapsed)}`, 47, 47);
      ctx.font = MONO;
      ctx.fillText(`${getDisplayPeopleCount()}/${getMaxDisplayedPlayers()} ACTIVE`, 28, 65);
    }
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

  function drawZones(
    ctx: CanvasRenderingContext2D,
    drill: DrillZone | null,
    ignored: IgnoreZone[],
    ox: number,
    oy: number,
    scale: number,
  ) {
    if (!drill && ignored.length === 0 && !drillZoneDraft) return;

    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);

    if (drill) {
      ctx.strokeStyle = "#f8d45c";
      ctx.strokeRect(ox + drill.x * scale, oy + drill.y * scale, drill.width * scale, drill.height * scale);
      ctx.fillStyle = "rgba(248, 212, 92, 0.72)";
      ctx.font = MONO;
      ctx.fillText("DRILL ZONE", ox + drill.x * scale + 8, oy + drill.y * scale + 16);
    }

    for (const zone of ignored) {
      ctx.strokeStyle = "rgba(255, 104, 104, 0.85)";
      ctx.strokeRect(ox + zone.x * scale, oy + zone.y * scale, zone.width * scale, zone.height * scale);
      ctx.fillStyle = "rgba(255, 104, 104, 0.72)";
      ctx.font = MONO;
      ctx.fillText("IGNORE", ox + zone.x * scale + 8, oy + zone.y * scale + 16);
    }

    if (drillZoneDraft) {
      const x = ox + drillZoneDraft.x * scale;
      const y = oy + drillZoneDraft.y * scale;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#f8d45c";
      ctx.fillText(ignoreZoneMode ? "IGNORE A" : "ZONE A", x + 10, y + 4);
    }

    ctx.restore();
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


  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ─── Evidence / export ───────────────────────────────────────────

  function buildSessionExport() {
    const setupChecklist = buildSetupChecklist();
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
      ballTrackingNote: "COCO-SSD sports ball detection is experimental and not verified game truth.",
      calibration: calibrationRef.current,
      selectedMode: selectedMode ? modeConfigs[selectedMode].label : null,
      sessionType: selectedMode ? modeConfigs[selectedMode].label : null,
      objective: practiceObjective.trim(),
      players: getPracticePlayers(),
      manualEvents,
      goodRepCount: manualEvents.filter((event) => event.type === "GOOD_REP").length,
      againCount: manualEvents.filter((event) => event.type === "AGAIN").length,
      noteCount: manualEvents.filter((event) => event.type === "NOTE").length,
      snapshotCount: manualEvents.filter((event) => event.type === "SNAPSHOT").length,
      sessionStartedAt,
      sessionEndedAt: practiceEndedAt ?? undefined,
      durationSeconds: Math.max(
        0,
        Math.round(((practiceEndedAt ?? Date.now()) - sessionStartedAt) / 1000),
      ),
      setupChecklist,
      display: {
        debug: {
          showCandidates,
          showAllDetections,
          showConfidence,
          showRawTrackIds,
        },
        displayedPlayers: getDisplayedPlayerSlots().map((slot) => ({
          slotId: slot.slotId,
          playerName: slot.playerName,
          rawTrackId: slot.currentRawTrackId,
        })),
        displayedPlayerCount: getDisplayPeopleCount(),
        drillZone: drillZoneRef.current,
        ignoreZones: ignoreZonesRef.current,
        maxDisplayedPlayers: getMaxDisplayedPlayers(),
        rawDetectionCount: tracksRef.current.length,
        rawPersonDetectionCount: tracksRef.current.filter((track) => track.kind === "person").length,
      },
      testDuration: Date.now() - sessionStartedAt,
      drillZoneSet: Boolean(drillZoneRef.current),
      ignoreZoneCount: ignoreZonesRef.current.length,
      displayedPlayerCount: getDisplayPeopleCount(),
      rawDetectionCount: tracksRef.current.length,
      debugEnabled: showAllDetections || showCandidates || showConfidence || showRawTrackIds,
      playerAssignments: Object.fromEntries(
        playerSlotsRef.current
          .filter((slot) => slot.playerName)
          .map((slot) => [slot.slotId, slot.playerName]),
      ),
      playerSlots: playerSlotsRef.current,
      rawTrackHistory: Object.fromEntries(
        playerSlotsRef.current.map((slot) => [slot.slotId, slot.rawTrackHistory]),
      ),
      recording: recordingMetadata ?? {
        recordingIncludesOverlay: true,
        recordingMimeType: recordingMimeTypeRef.current || undefined,
        recordingStartedAt: recordingStartedAtRef.current,
      },
      recordingStartedAt: recordingMetadata?.recordingStartedAt ?? recordingStartedAtRef.current,
      recordingDuration: recordingMetadata?.recordingDurationMs ?? recordingElapsedMs,
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
    if (blob) {
      addManualEvent("SNAPSHOT");
      downloadBlob(blob, `axis-vision-snapshot-${sessionId}.png`);
    }
  }

  function getSupportedRecordingMimeType() {
    if (typeof MediaRecorder === "undefined") return "";

    const candidates = [
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];

    return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
  }

  function startRecording() {
    const video = videoRef.current;
    if (!video || !isVisionRunning) {
      setLastError("Start Axis Vision before recording.");
      return;
    }

    if (!setupChecks.readyToRecord) {
      setLastError("Finish setup before recording.");
      return;
    }

    if (recordingStatus === "recording" || recordingStatus === "stopping") return;

    const mimeType = getSupportedRecordingMimeType();
    if (!mimeType) {
      setRecordingStatus("error");
      setLastError("Recording is not supported in this browser.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    recordingCanvasRef.current = canvas;
    recordingChunksRef.current = [];
    recordingMimeTypeRef.current = mimeType;

    try {
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType });
      const startedAt = Date.now();
      const fileExtension = mimeType.includes("mp4") ? "mp4" : "webm";
      const fileName = `axis-vision-clip-${sessionId}-${startedAt}.${fileExtension}`;

      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = startedAt;
      setRecordingStartedAt(startedAt);
      setRecordingElapsedMs(0);
      setRecordingFileName(fileName);
      setRecordingBlob(null);
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      setRecordingUrl("");
      setRecordingMetadata(null);
      setEvidencePanelOpen(false);
      setCalibrationMenuOpen(false);
      setToolsOpen(false);
      setLastError("");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const stoppedAt = Date.now();
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        stopRecordingLoop();
        setRecordingBlob(blob);
        setRecordingUrl(url);
        setRecordingStatus("ready");
        setRecordingStartedAt(null);
        setRecordingElapsedMs(stoppedAt - startedAt);
        setRecordingMetadata({
          recordingDurationMs: stoppedAt - startedAt,
          recordingFileName: fileName,
          recordingIncludesOverlay: true,
          recordingMimeType: mimeType,
          recordingStartedAt: startedAt,
          recordingStoppedAt: stoppedAt,
        });
        mediaRecorderRef.current = null;
        recordingStartedAtRef.current = undefined;
        recordingChunksRef.current = [];
      };

      recorder.onerror = () => {
        stopRecordingLoop();
        setRecordingStatus("error");
        setLastError("Recording failed.");
        mediaRecorderRef.current = null;
        recordingStartedAtRef.current = undefined;
      };

      setRecordingStatus("recording");
      recorder.start(1000);
      drawRecordingFrame();
    } catch (error) {
      stopRecordingLoop();
      setRecordingStatus("error");
      setLastError(error instanceof Error ? error.message : "Recording could not start.");
    }
  }

  function drawRecordingFrame() {
    const video = videoRef.current;
    const canvas = recordingCanvasRef.current;
    if (!video || !canvas || recordingStatus === "error") return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#020304";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const renderedWidth = video.videoWidth * scale;
      const renderedHeight = video.videoHeight * scale;
      const offsetX = (canvas.width - renderedWidth) / 2;
      const offsetY = (canvas.height - renderedHeight) / 2;
      ctx.drawImage(video, offsetX, offsetY, renderedWidth, renderedHeight);
    }
    drawAxisOverlay(ctx, canvas.width, canvas.height, video, tracksRef.current, true);

    if (mediaRecorderRef.current?.state === "recording") {
      recordingRafRef.current = requestAnimationFrame(drawRecordingFrame);
    }
  }

  function stopRecordingLoop() {
    if (recordingRafRef.current !== null) cancelAnimationFrame(recordingRafRef.current);
    recordingRafRef.current = null;
  }

  function stopRecording() {
    if (recordingStatus !== "recording") return;
    setRecordingStatus("stopping");
    stopRecordingLoop();

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function downloadClip() {
    if (!recordingBlob) return;
    downloadBlob(recordingBlob, recordingFileName || `axis-vision-clip-${sessionId}.webm`);
  }

  async function shareClip() {
    if (!recordingBlob) return;

    const file = new File([recordingBlob], recordingFileName || `axis-vision-clip-${sessionId}.webm`, {
      type: recordingBlob.type,
    });
    const shareData = { files: [file], title: "Axis Vision Clip" };

    if ("canShare" in navigator && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    downloadClip();
  }

  function discardClip() {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingBlob(null);
    setRecordingUrl("");
    setRecordingFileName("");
    setRecordingMetadata(null);
    setRecordingStatus("idle");
    setRecordingElapsedMs(0);
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
    playerSlotsRef.current = [];
    rawTrackSeenCountsRef.current = {};
    nextPlayerSlotIndexRef.current = 1;
    drillZoneRef.current = null;
    setSessionId(nextId);
    setSessionStartedAt(nextAt);
    setVisionFrames([]);
    setActiveTracks([]);

    setFrameCount(0);
    setMaxPeopleCount(0);
    setBallVisible(false);
    setBallLostCount(0);
    setBallTrail({ points: [], visible: false });
    setPlayerSlots([]);
    setDrillZone(null);
    setDrillZoneDraft(null);
    setDrillZoneMode(false);
    drawDetections([]);
  }

  const isCameraLive = cameraStatus === "live";
  const isAiRunning = aiStatus === "running";
  const isRecording = recordingStatus === "recording";
  const durationSeconds = Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000));
  const activeTrackLabel = activeTracks.length === 1 ? "1 track" : `${activeTracks.length} tracks`;
  const isVisionRunning = visionStatus === "running" && isAiRunning;
  const isVisionBusy = visionStatus === "starting_camera" || visionStatus === "camera_ready" || visionStatus === "loading_ai";
  const primaryLabel = visionStatus === "starting_camera"
    ? "Starting Camera..."
    : visionStatus === "loading_ai" || visionStatus === "camera_ready"
      ? "Loading AI..."
      : visionStatus === "running"
        ? "Vision Running"
        : visionStatus === "error"
          ? "Retry Axis Vision"
          : "Start Axis Vision";
  const recordingLabel = recordingStatus === "recording"
    ? "Stop Rec"
    : recordingStatus === "stopping"
      ? "Stopping"
      : "Record";

  const calActive = calibrationMode !== "off" || drillZoneMode || ignoreZoneMode;
  const modeConfig = selectedMode ? modeConfigs[selectedMode] : null;
  const setupChecklist = buildSetupChecklist();
  const showPracticeStart = practiceStatus === "setup";
  const showEndSummary = practiceStatus === "ended";
  const showSetupPanel = false;
  const ballStatus = ballVisible ? "Live" : ballLostCount > 0 ? "Lost" : "Experimental";
  const ballDirection = ballTrail.direction ?? "unknown";
  const ballSpeed = ballTrail.velocity ? Math.round(ballTrail.velocity.speed) : null;
  const activePersonTracks = activeTracks.filter((track) => track.kind === "person");
  const displayedPeopleCount = getDisplayPeopleCount();
  const activePlayerLimit = getMaxDisplayedPlayers();
  const rawPeopleCount = activePersonTracks.length;
  const debugEnabled = showAllDetections || showCandidates || showConfidence || showRawTrackIds;
  const selectedPlayerSlot = selectedPlayerSlotId
    ? playerSlots.find((slot) => slot.slotId === selectedPlayerSlotId)
    : null;
  const goodRepCount = manualEvents.filter((event) => event.type === "GOOD_REP").length;
  const againCount = manualEvents.filter((event) => event.type === "AGAIN").length;
  const noteCount = manualEvents.filter((event) => event.type === "NOTE").length;
  const snapshotCount = manualEvents.filter((event) => event.type === "SNAPSHOT").length;
  const aiEvidenceCaptured = visionFrames.length > 0;
  const calibrationInstruction = ignoreZoneMode
    ? drillZoneDraft
      ? "Tap opposite corner of Ignore Zone"
      : "Tap first corner of Ignore Zone"
    : drillZoneMode
    ? drillZoneDraft
      ? "Tap opposite corner of Drill Zone"
      : "Tap first corner of Drill Zone"
    : calibrationMode === "set_rim"
    ? "Tap video to set rim"
    : calibrationMode === "set_floor"
      ? floorTapCountRef.current === 0
        ? "Tap floor point A"
        : "Tap floor point B"
      : calibrationMode === "set_paint"
        ? calibration.paintPoints.length === 0
          ? "Tap paint point A"
          : "Tap paint point B"
      : "";

  return (
    <main className={`axis-live-vision${gymMode ? " axis-live-vision--gym" : ""}`}>
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
          onPointerUp={handleCanvasPointerUp}
          ref={canvasRef}
        />

        {showPracticeStart && (
          <form className="axis-live-vision__practice-start" onSubmit={startPracticeSession}>
            <p>AXIS PRACTICE</p>
            <h1>Today&apos;s Session</h1>
            <label>
              Player / Players
              <input
                autoComplete="off"
                onChange={(event) => setPracticePlayerInput(event.target.value)}
                placeholder="Hailey"
                type="text"
                value={practicePlayerInput}
              />
            </label>
            <label>
              Focus / Objective
              <input
                autoComplete="off"
                onChange={(event) => setPracticeObjective(event.target.value)}
                placeholder="Pound stop pivot finish"
                type="text"
                value={practiceObjective}
              />
            </label>
            <label>
              Session Type
              <select
                onChange={(event) => selectMode(event.target.value as AxisVisionMode)}
                value={selectedMode ?? "ball_handling"}
              >
                <option value="ball_handling">Ball Handling</option>
                <option value="shot_workout">Shooting</option>
                <option value="finishing">Finishing</option>
                <option value="small_sided">1v1 / 2v2</option>
                <option value="team_practice">Team Practice</option>
                <option value="game_film">Game Film</option>
                <option value="axis_lab">Axis Lab</option>
              </select>
            </label>
            <button disabled={practiceStarting || isVisionBusy} type="submit">
              {practiceStarting || isVisionBusy ? primaryLabel : "Start Session"}
            </button>
            <div className="axis-live-vision__start-links">
              <button onClick={() => setLastError("Frame check starts after Start Session.")} type="button">Frame Check</button>
              <button onClick={() => setLastError("Tools open after Start Session.")} type="button">Tools</button>
              <button onClick={resetPracticeForm} type="button">Reset</button>
            </div>
          </form>
        )}

        {practiceStatus === "live" && !isCameraLive && (
          <div className="axis-live-vision__empty">
            <p>AXIS</p>
            <h1>{modeConfig?.label ?? "Practice"}</h1>
            <button
              disabled={isVisionBusy}
              onClick={startLiveVision}
              type="button"
            >
              {primaryLabel}
            </button>
            <span className="axis-live-vision__manual-note">Manual reps and notes still work if camera or AI is unavailable.</span>
          </div>
        )}

        {showSetupPanel && isCameraLive && !calActive && (
          <div className="axis-live-vision__setup-panel">
            <p>{modeConfig?.label ?? "Axis"} setup</p>
            <h2>Get ready to record</h2>
            <div className="axis-live-vision__setup-list">
              <button
                data-complete={setupChecklist.cameraStable ? "true" : undefined}
                onClick={() => updateSetupCheck("cameraStable", !setupChecks.cameraStable)}
                type="button"
              >
                Camera stable
              </button>
              <button
                data-complete={setupChecklist.playerVisible ? "true" : undefined}
                onClick={() => updateSetupCheck("playerVisible", !setupChecks.playerVisible)}
                type="button"
              >
                Player visible
              </button>
              {modeConfig?.requiresRim && (
                <button data-complete={setupChecklist.rimVisible ? "true" : undefined} onClick={() => activateCalMode("set_rim")} type="button">
                  Rim visible
                </button>
              )}
              <button data-complete={setupChecklist.drillZoneSet ? "true" : undefined} onClick={startDrillZone} type="button">
                Drill zone set
              </button>
              <button data-complete={setupChecklist.ignoreZonesSet ? "true" : undefined} onClick={startIgnoreZone} type="button">
                Ignore zones set
              </button>
              <button data-complete={setupChecklist.playersTagged ? "true" : undefined} onClick={() => setEvidencePanelOpen(true)} type="button">
                Players tagged
              </button>
            </div>
            <button
              className="axis-live-vision__setup-ready"
              onClick={() => updateSetupCheck("readyToRecord", true)}
              type="button"
            >
              Ready to record
            </button>
            <button className="axis-live-vision__setup-stop" onClick={stopCamera} type="button">
              Stop camera
            </button>
          </div>
        )}

        {calActive && <div className="axis-live-vision__cal-hint">{calibrationInstruction}</div>}
      </section>

      {!showPracticeStart && !showEndSummary && (
      <header className={`axis-live-vision__top${calActive ? " axis-live-vision__top--cal" : ""}`}>
        <div>
          <p>{modeConfig?.label ?? "AXIS LIVE"}</p>
          <strong>{getPracticePlayerLabel()} · {practiceObjective.trim() || "Practice"}</strong>
        </div>
        {calActive ? (
          <button
            className="axis-live-vision__cancel"
            onClick={drillZoneMode || ignoreZoneMode ? cancelDrillZone : cancelCalibration}
            type="button"
          >
            Cancel
          </button>
        ) : (
          <span data-live={isCameraLive ? "true" : "false"}>{isCameraLive ? "LIVE" : cameraStatus.toUpperCase()}</span>
        )}
      </header>
      )}

      {!showPracticeStart && !showEndSummary && !calActive && (
        <aside className="axis-live-vision__quick-status" aria-label="Live detection status">
          <span>{isRecording ? "Recording" : `${formatRecordingTime(practiceElapsedMs)} Practice`}</span>
          {modeConfig?.ballRelevant && <span>Ball {ballStatus}</span>}
          <span>Active {displayedPeopleCount}/{activePlayerLimit}</span>
          {debugEnabled && <span className="axis-live-vision__debug-pill">DEBUG VIEW</span>}
          {isRecording && <span className="axis-live-vision__rec-pill">REC {formatRecordingTime(recordingElapsedMs)}</span>}
        </aside>
      )}

      {!calActive && evidencePanelOpen && (
        <section
          className={`axis-live-vision__evidence ${evidencePanelOpen ? "is-open" : ""}`}
          aria-label="Evidence session panel"
        >
          <div className="axis-live-vision__evidence-body">
              <dl>
                <div><dt>Session ID</dt><dd>{sessionId}</dd></div>
                <div><dt>Duration</dt><dd>{durationSeconds}s</dd></div>
                <div><dt>FPS</dt><dd>{fps.toFixed(1)}</dd></div>
                <div><dt>Frames</dt><dd>{visionFrames.length}</dd></div>
                <div><dt>Tracks</dt><dd>{activeTrackLabel}</dd></div>
                <div><dt>Active tracks</dt><dd>{activeTracks.map((t) => t.trackId).join(", ") || "None"}</dd></div>
                <div><dt>Raw people</dt><dd>{rawPeopleCount}</dd></div>
                <div><dt>Displayed people</dt><dd>{displayedPeopleCount}/{activePlayerLimit}</dd></div>
                <div><dt>Max people</dt><dd>{maxPeopleCount}</dd></div>
                <div><dt>Ball tracking</dt><dd>Experimental COCO-SSD signal</dd></div>
                <div><dt>Ball seen</dt><dd>{ballSeenFramesRef.current}</dd></div>
                <div><dt>Ball lost</dt><dd>{ballLostCount}</dd></div>
                <div><dt>Ball direction</dt><dd>{ballDirection}</dd></div>
                <div><dt>Ball speed</dt><dd>{ballSpeed === null ? "unknown" : ballSpeed}</dd></div>
                <div>
                  <dt>Player tags</dt>
                  <dd>
                    {playerSlots.some((slot) => slot.playerName)
                      ? playerSlots
                        .filter((slot) => slot.playerName)
                        .map((slot) => `${slot.slotId}: ${slot.playerName}`)
                        .join(", ")
                      : "None"}
                  </dd>
                </div>
                <div><dt>Rim</dt><dd>{calibration.rim ? "Set" : "Not set"}</dd></div>
                <div><dt>Floor</dt><dd>{calibration.floorLine ? "Set" : "Not set"}</dd></div>
                <div><dt>Paint</dt><dd>{calibration.paintPoints.length >= 2 ? "Set" : "Not set"}</dd></div>
                <div><dt>Drill Zone</dt><dd>{drillZone ? "Set" : "Not set"}</dd></div>
                <div><dt>Ignore Zones</dt><dd>{ignoreZones.length}</dd></div>
                <div><dt>Trail</dt><dd>{showTrail ? "On" : "Off"}</dd></div>
              </dl>
              <button
                className="axis-live-vision__trail-toggle"
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
              <div className="axis-live-vision__player-tags" aria-label="Player tags">
                <p>Player Tags</p>
                {playerSlots.length > 0 ? (
                  playerSlots.map((slot) => (
                    <div className="axis-live-vision__player-tag-row" key={slot.slotId}>
                      <span>{slot.slotId}</span>
                      <strong>{slot.playerName || "Unknown"} - {slot.locked ? "Locked" : "Unlocked"}</strong>
                      <button onClick={() => openPlayerAssignment(slot.slotId)} type="button">Edit</button>
                      <button onClick={() => unlockPlayerSlot(slot.slotId)} type="button">Unlock</button>
                      <button onClick={() => clearPlayerSlot(slot.slotId)} type="button">Clear</button>
                    </div>
                  ))
                ) : (
                  <span className="axis-live-vision__muted">No player slots yet</span>
                )}
              </div>
              <div className="axis-live-vision__evidence-actions">
                {isCameraLive && <button onClick={flipCamera} type="button">Flip Camera</button>}
                <button onClick={() => setShowConfidence((value) => !value)} type="button">
                  Show Confidence {showConfidence ? "On" : "Off"}
                </button>
                <button onClick={() => setShowRawTrackIds((value) => !value)} type="button">
                  Show Raw IDs {showRawTrackIds ? "On" : "Off"}
                </button>
                <button onClick={() => setShowAllDetections((value) => !value)} type="button">
                  Show Raw Detections {showAllDetections ? "On" : "Off"}
                </button>
                <button onClick={() => setShowCandidates((value) => !value)} type="button">
                  Show Candidates {showCandidates ? "On" : "Off"}
                </button>
                <button onClick={exportEvidenceJson} type="button">Export Evidence JSON</button>
                <button onClick={captureSnapshot} type="button">Capture Snapshot</button>
                <button onClick={clearPlayerTags} type="button">Clear Player Tags</button>
                <button onClick={clearDrillZone} type="button">Clear Drill Zone</button>
                <button onClick={clearIgnoreZones} type="button">Clear Ignore Zones</button>
                <button onClick={resetGymSetup} type="button">Reset Gym Setup</button>
                <button onClick={clearSession} type="button">Clear Session</button>
              </div>
          </div>
        </section>
      )}

      {!calActive && practiceStatus === "live" && !showSetupPanel && (
        <footer className={`axis-live-vision__controls${isVisionRunning ? " axis-live-vision__controls--running" : ""}`} aria-label="Live vision controls">
          <>
              <button onClick={logGoodRep} type="button">Good Rep</button>
              <button onClick={logAgain} type="button">Again</button>
              <button onClick={() => setNoteOpen(true)} type="button">Note</button>
              <div className="axis-live-vision__control-wrap">
                <button disabled={isRecording} onClick={() => setToolsOpen((open) => !open)} type="button">
                  Tools
                </button>
                {toolsOpen && (
                  <div className="axis-live-vision__tools-sheet">
                    <button
                      data-active={isRecording ? "true" : undefined}
                      disabled={!isVisionRunning || recordingStatus === "stopping"}
                      onClick={isRecording ? stopRecording : startRecording}
                      type="button"
                    >
                      {recordingLabel}
                    </button>
                    <button disabled={isVisionBusy || isVisionRunning} onClick={startLiveVision} type="button">
                      {primaryLabel}
                    </button>
                    <button onClick={toggleCalibrationMenu} type="button">Calibrate</button>
                    {calibrationMenuOpen && (
                      <div className="axis-live-vision__cal-menu">
                        <button onClick={() => activateCalMode("set_rim")} type="button">Set Rim</button>
                        <button onClick={() => activateCalMode("set_floor")} type="button">Set Floor</button>
                        <button onClick={() => activateCalMode("set_paint")} type="button">Set Paint</button>
                        <button onClick={clearCalibration} type="button">Clear Calibration</button>
                      </div>
                    )}
                    <button onClick={() => setEvidencePanelOpen(true)} type="button">Tag Players</button>
                    <button onClick={captureSnapshot} type="button">Snapshot</button>
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
                    <button onClick={() => setEvidencePanelOpen((open) => !open)} type="button">Evidence</button>
                    <button onClick={startDrillZone} type="button">Drill Zone</button>
                    <button onClick={startIgnoreZone} type="button">Ignore Zone</button>
                    <button onClick={() => setEvidencePanelOpen(true)} type="button">Debug</button>
                  </div>
                )}
              </div>
              <button onClick={endPracticeSession} type="button">Stop</button>
          </>
        </footer>
      )}

      {recordingStatus === "ready" && recordingUrl && (
        <section className="axis-live-vision__clip-sheet" aria-label="Recorded Axis clip preview">
          <div className="axis-live-vision__clip-card">
            <p>Axis Clip Ready</p>
            <video controls playsInline src={recordingUrl} />
            <div className="axis-live-vision__clip-actions">
              <button onClick={downloadClip} type="button">Download Clip</button>
              <button onClick={shareClip} type="button">Share / Save Clip</button>
              <button onClick={discardClip} type="button">Discard Clip</button>
            </div>
          </div>
        </section>
      )}

      {noteOpen && !calActive && (
        <section className="axis-live-vision__note-sheet" aria-label="Practice note">
          <div className="axis-live-vision__note-card">
            <p>Practice Note</p>
            <textarea
              autoFocus
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Say the rough note..."
              value={noteDraft}
            />
            <div className="axis-live-vision__note-actions">
              <button onClick={savePracticeNote} type="button">Save Note</button>
              <button onClick={() => setNoteOpen(false)} type="button">Cancel</button>
            </div>
          </div>
        </section>
      )}

      {showEndSummary && (
        <section className="axis-live-vision__summary" aria-label="Practice session summary">
          <div className="axis-live-vision__summary-card">
            <p>Session Complete</p>
            <h1>{getPracticePlayerLabel()}</h1>
            <span>{practiceObjective.trim() || "Practice"} · {modeConfig?.label ?? "Session"}</span>
            <dl>
              <div><dt>Duration</dt><dd>{formatRecordingTime(practiceElapsedMs)}</dd></div>
              <div><dt>Good Rep</dt><dd>{goodRepCount}</dd></div>
              <div><dt>Again</dt><dd>{againCount}</dd></div>
              <div><dt>Notes</dt><dd>{noteCount}</dd></div>
              <div><dt>Snapshots</dt><dd>{snapshotCount}</dd></div>
              <div><dt>AI Evidence captured</dt><dd>{aiEvidenceCaptured ? "Yes" : "No"}</dd></div>
            </dl>
            <div className="axis-live-vision__summary-actions">
              <button onClick={() => setEvidencePanelOpen(true)} type="button">Review Evidence</button>
              <button onClick={exportEvidenceJson} type="button">Export Session Data</button>
              <button onClick={startAnotherPractice} type="button">Start Another</button>
            </div>
          </div>
        </section>
      )}

      {selectedPlayerSlotId && !calActive && (
        <section className="axis-live-vision__assign-sheet" aria-label="Assign player">
          <div className="axis-live-vision__assign-card">
            <p>Assign Player</p>
            <h2>{selectedPlayerSlot?.slotId ?? selectedPlayerSlotId}</h2>
            <label>
              Player name
              <input
                autoFocus
                onChange={(event) => setPlayerNameDraft(event.target.value)}
                placeholder="Unknown"
                type="text"
                value={playerNameDraft}
              />
            </label>
            <div className="axis-live-vision__assign-actions">
              <button onClick={savePlayerAssignment} type="button">Save</button>
              <button onClick={cancelPlayerAssignment} type="button">Cancel</button>
              <button onClick={clearSelectedPlayerAssignment} type="button">Clear Assignment</button>
            </div>
          </div>
        </section>
      )}

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
          pointer-events: auto;
          z-index: 2;
        }

        .axis-live-vision__canvas--cal {
          cursor: crosshair;
          pointer-events: auto;
          z-index: 6;
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
          pointer-events: none;
          z-index: 7;
        }

        .axis-live-vision__empty p,
        .axis-live-vision__top p,
        .axis-live-vision__quick-status span,
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

        .axis-live-vision__practice-start {
          align-content: center;
          background:
            radial-gradient(circle at 50% 28%, rgba(124, 247, 212, 0.1), transparent 31rem),
            rgba(2, 3, 4, 0.94);
          display: grid;
          gap: 0.8rem;
          inset: 0;
          justify-items: stretch;
          margin: 0 auto;
          max-width: 28rem;
          padding: max(2rem, env(safe-area-inset-top)) 1.15rem max(1.2rem, env(safe-area-inset-bottom));
          position: absolute;
          width: 100%;
          z-index: 10;
        }

        .axis-live-vision__practice-start p,
        .axis-live-vision__summary-card p,
        .axis-live-vision__note-card p {
          color: rgba(248, 247, 242, 0.58);
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.16em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-live-vision__practice-start h1 {
          font-size: clamp(2.7rem, 13vw, 5.8rem);
          letter-spacing: -0.05em;
          line-height: 0.9;
          margin: 0 0 0.7rem;
          text-transform: uppercase;
        }

        .axis-live-vision__practice-start label,
        .axis-live-vision__note-card label {
          color: rgba(248, 247, 242, 0.68);
          display: grid;
          font-size: 0.72rem;
          font-weight: 900;
          gap: 0.45rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .axis-live-vision__practice-start input,
        .axis-live-vision__practice-start select,
        .axis-live-vision__note-card textarea {
          background: rgba(248, 247, 242, 0.08);
          border: 1px solid rgba(248, 247, 242, 0.18);
          border-radius: 1rem;
          color: #f8f7f2;
          font: inherit;
          font-size: 1rem;
          min-height: 3.1rem;
          padding: 0 0.95rem;
          text-transform: none;
          width: 100%;
        }

        .axis-live-vision__practice-start select {
          appearance: none;
        }

        .axis-live-vision__practice-start input:focus,
        .axis-live-vision__practice-start select:focus,
        .axis-live-vision__note-card textarea:focus {
          border-color: rgba(248, 212, 92, 0.72);
          outline: none;
        }

        .axis-live-vision__practice-start > button {
          background: #f8d45c;
          border-color: #f8d45c;
          color: #020304;
          margin-top: 0.4rem;
        }

        .axis-live-vision__start-links {
          display: grid;
          gap: 0.5rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .axis-live-vision__start-links button {
          background: rgba(248, 247, 242, 0.08);
          color: #f8f7f2;
          min-height: 2.4rem;
          padding: 0 0.45rem;
        }

        .axis-live-vision__manual-note {
          color: rgba(248, 247, 242, 0.64);
          display: block;
          font-size: 0.86rem;
          font-weight: 700;
          max-width: 18rem;
        }

        .axis-live-vision__mode-picker {
          align-content: center;
          gap: 1rem;
          overflow: auto;
          z-index: 10;
        }

        .axis-live-vision__mode-grid {
          display: grid;
          gap: 0.65rem;
          max-width: 44rem;
          width: min(100%, 44rem);
        }

        .axis-live-vision__mode-grid button {
          align-items: start;
          background: rgba(248, 247, 242, 0.08);
          color: #f8f7f2;
          display: grid;
          gap: 0.25rem;
          min-height: 4.4rem;
          padding: 0.85rem 1rem;
          text-align: left;
          text-transform: none;
        }

        .axis-live-vision__mode-grid button strong {
          font-size: 0.92rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .axis-live-vision__mode-grid button span {
          color: rgba(248, 247, 242, 0.58);
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0;
          line-height: 1.35;
        }

        .axis-live-vision__setup-panel {
          background: rgba(0, 0, 0, 0.66);
          border: 1px solid rgba(248, 247, 242, 0.14);
          border-radius: 1.25rem;
          bottom: max(1rem, env(safe-area-inset-bottom));
          display: grid;
          gap: 0.75rem;
          left: 50%;
          max-width: min(31rem, calc(100vw - 2rem));
          padding: 1rem;
          position: absolute;
          transform: translateX(-50%);
          width: min(31rem, calc(100vw - 2rem));
          z-index: 5;
        }

        .axis-live-vision__setup-panel p {
          color: rgba(248, 247, 242, 0.62);
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.14em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-live-vision__setup-panel h2 {
          font-size: 1.1rem;
          margin: 0;
        }

        .axis-live-vision__setup-list {
          display: grid;
          gap: 0.45rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .axis-live-vision__setup-list button {
          background: rgba(248, 247, 242, 0.08);
          color: #f8f7f2;
          min-height: 2.45rem;
        }

        .axis-live-vision__setup-list button[data-complete] {
          background: rgba(124, 247, 212, 0.16);
          border-color: rgba(124, 247, 212, 0.36);
          color: #7cf7d4;
        }

        .axis-live-vision__setup-ready {
          background: #f8d45c;
          border-color: #f8d45c;
          color: #020304;
        }

        .axis-live-vision__setup-stop {
          background: rgba(248, 247, 242, 0.08);
          color: #f8f7f2;
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
          pointer-events: none;
          display: flex;
          justify-content: space-between;
          left: 0;
          padding: max(1rem, env(safe-area-inset-top)) 1rem 0;
          position: absolute;
          right: 0;
          top: 0;
          z-index: 8;
        }

        .axis-live-vision__top strong {
          display: block;
          font-size: 0.78rem;
          letter-spacing: 0.04em;
          margin-top: 0.18rem;
          text-transform: uppercase;
        }

        .axis-live-vision__top span,
        .axis-live-vision__evidence-toggle,
        .axis-live-vision__cancel {
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
          min-height: 2.3rem;
          padding: 0.55rem 0.72rem;
          pointer-events: auto;
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

        .axis-live-vision__quick-status {
          align-items: center;
          background: rgba(0, 0, 0, 0.46);
          border: 1px solid rgba(248, 247, 242, 0.14);
          border-radius: 999px;
          display: flex;
          gap: 0.35rem;
          left: 50%;
          max-width: calc(100vw - 2rem);
          padding: 0.42rem;
          position: absolute;
          top: max(4.8rem, env(safe-area-inset-top, 0px) + 4rem);
          transform: translateX(-50%);
          z-index: 4;
        }

        .axis-live-vision__quick-status span {
          background: rgba(248, 247, 242, 0.08);
          border-radius: 999px;
          padding: 0.42rem 0.58rem;
          white-space: nowrap;
        }

        .axis-live-vision__quick-status .axis-live-vision__rec-pill {
          background: rgba(255, 48, 48, 0.18);
          color: #ff6b6b;
        }

        .axis-live-vision__quick-status .axis-live-vision__debug-pill {
          background: rgba(248, 212, 92, 0.16);
          color: #f8d45c;
        }

        .axis-live-vision__evidence dd {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.88rem;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .axis-live-vision__evidence {
          bottom: calc(5.2rem + env(safe-area-inset-bottom));
          left: 1rem;
          position: absolute;
          z-index: 12;
        }

        .axis-live-vision__evidence-body {
          background: rgba(0, 0, 0, 0.72);
          border: 1px solid rgba(248, 247, 242, 0.14);
          border-radius: 1rem;
          margin-top: 0.55rem;
          max-height: min(68dvh, 34rem);
          max-width: min(23rem, calc(100vw - 2rem));
          overflow: auto;
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
        .axis-live-vision__trail-toggle,
        .axis-live-vision__controls button:not(:first-child) {
          background: rgba(248, 247, 242, 0.08);
          color: #f8f7f2;
        }

        .axis-live-vision__trail-toggle {
          margin-top: 0.85rem;
          width: 100%;
        }

        .axis-live-vision__player-tags {
          border-top: 1px solid rgba(248, 247, 242, 0.12);
          display: grid;
          gap: 0.45rem;
          margin-top: 0.85rem;
          padding-top: 0.85rem;
        }

        .axis-live-vision__player-tags p {
          color: rgba(248, 247, 242, 0.58);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-live-vision__player-tag-row {
          align-items: center;
          display: grid;
          gap: 0.45rem;
          grid-template-columns: auto minmax(0, 1fr);
        }

        .axis-live-vision__player-tag-row span,
        .axis-live-vision__muted {
          color: rgba(248, 247, 242, 0.58);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.78rem;
        }

        .axis-live-vision__player-tag-row strong {
          font-size: 0.86rem;
          overflow-wrap: anywhere;
        }

        .axis-live-vision__player-tag-row button {
          min-height: 2.1rem;
          padding: 0 0.65rem;
        }

        .axis-live-vision__player-tag-row button:nth-of-type(1) {
          grid-column: 1 / -1;
        }

        .axis-live-vision__tools-sheet,
        .axis-live-vision__cal-menu {
          background: rgba(0, 0, 0, 0.72);
          border: 1px solid rgba(248, 247, 242, 0.14);
          border-radius: 1rem;
          display: grid;
          gap: 0.45rem;
          min-width: min(16rem, calc(100vw - 2rem));
          padding: 0.55rem;
          position: absolute;
        }

        .axis-live-vision__tools-sheet {
          bottom: calc(100% + 0.55rem);
          left: 50%;
          transform: translateX(-50%);
        }

        .axis-live-vision__cal-menu {
          bottom: 0;
          right: calc(100% + 0.55rem);
        }

        .axis-live-vision__tools-sheet .axis-live-vision__cal-menu {
          bottom: auto;
          min-width: 0;
          position: static;
          right: auto;
        }

        .axis-live-vision__controls {
          bottom: 0;
          display: grid;
          gap: 0.45rem;
          grid-template-columns: minmax(0, 1fr);
          left: 0;
          padding: 0 1rem max(1rem, env(safe-area-inset-bottom));
          position: absolute;
          right: 0;
          z-index: 4;
        }

        .axis-live-vision__controls--running {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .axis-live-vision__primary-start {
          justify-self: center;
          max-width: 24rem;
          width: min(100%, 24rem);
        }

        .axis-live-vision__control-wrap {
          display: grid;
          position: relative;
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

        .axis-live-vision__assign-sheet {
          align-items: end;
          background: rgba(0, 0, 0, 0.24);
          display: grid;
          inset: 0;
          padding: 1rem 1rem max(1rem, env(safe-area-inset-bottom));
          position: absolute;
          z-index: 9;
        }

        .axis-live-vision__note-sheet,
        .axis-live-vision__summary {
          align-items: end;
          background: rgba(0, 0, 0, 0.4);
          display: grid;
          inset: 0;
          padding: 1rem 1rem max(1rem, env(safe-area-inset-bottom));
          position: absolute;
          z-index: 11;
        }

        .axis-live-vision__note-card,
        .axis-live-vision__summary-card {
          background: rgba(8, 9, 10, 0.94);
          border: 1px solid rgba(248, 247, 242, 0.16);
          border-radius: 1.25rem;
          box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, 0.45);
          display: grid;
          gap: 0.85rem;
          justify-self: center;
          max-width: 31rem;
          padding: 1rem;
          width: min(100%, 31rem);
        }

        .axis-live-vision__note-card textarea {
          min-height: 8rem;
          padding: 0.85rem;
          resize: vertical;
        }

        .axis-live-vision__note-actions,
        .axis-live-vision__summary-actions {
          display: grid;
          gap: 0.5rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .axis-live-vision__summary {
          align-items: center;
        }

        .axis-live-vision__summary-card h1 {
          font-size: clamp(2rem, 11vw, 4.6rem);
          letter-spacing: -0.05em;
          line-height: 0.92;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-live-vision__summary-card > span {
          color: rgba(248, 247, 242, 0.7);
          font-size: 0.95rem;
          font-weight: 800;
          line-height: 1.35;
        }

        .axis-live-vision__summary-card dl {
          display: grid;
          gap: 0.5rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin: 0;
        }

        .axis-live-vision__summary-card dl div {
          background: rgba(248, 247, 242, 0.07);
          border: 1px solid rgba(248, 247, 242, 0.1);
          border-radius: 0.9rem;
          display: grid;
          gap: 0.2rem;
          min-height: 4.2rem;
          padding: 0.7rem;
        }

        .axis-live-vision__summary-card dt {
          color: rgba(248, 247, 242, 0.54);
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .axis-live-vision__summary-card dd {
          font-size: 1.12rem;
          font-weight: 900;
          margin: 0;
        }

        .axis-live-vision__summary-actions {
          grid-template-columns: 1fr;
        }

        .axis-live-vision__clip-sheet {
          align-items: end;
          background: rgba(0, 0, 0, 0.2);
          display: grid;
          inset: 0;
          padding: 1rem 1rem max(1rem, env(safe-area-inset-bottom));
          position: absolute;
          z-index: 9;
        }

        .axis-live-vision__clip-card {
          background: rgba(8, 9, 10, 0.92);
          border: 1px solid rgba(248, 247, 242, 0.16);
          border-radius: 1.25rem;
          box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, 0.45);
          display: grid;
          gap: 0.85rem;
          justify-self: center;
          max-width: 34rem;
          padding: 1rem;
          width: min(100%, 34rem);
        }

        .axis-live-vision__clip-card p {
          color: rgba(248, 247, 242, 0.72);
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.14em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-live-vision__clip-card video {
          background: #020304;
          border-radius: 0.85rem;
          max-height: 42dvh;
          width: 100%;
        }

        .axis-live-vision__clip-actions {
          display: grid;
          gap: 0.5rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .axis-live-vision__assign-card {
          background: rgba(8, 9, 10, 0.9);
          border: 1px solid rgba(248, 247, 242, 0.16);
          border-radius: 1.25rem;
          box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, 0.45);
          display: grid;
          gap: 0.85rem;
          justify-self: center;
          max-width: 28rem;
          padding: 1rem;
          width: min(100%, 28rem);
        }

        .axis-live-vision__assign-card p {
          color: rgba(248, 247, 242, 0.58);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-live-vision__assign-card h2 {
          font-size: 1.25rem;
          margin: 0;
        }

        .axis-live-vision__assign-card label {
          color: rgba(248, 247, 242, 0.7);
          display: grid;
          font-size: 0.8rem;
          font-weight: 800;
          gap: 0.45rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .axis-live-vision__assign-card input {
          background: rgba(248, 247, 242, 0.08);
          border: 1px solid rgba(248, 247, 242, 0.18);
          border-radius: 0.85rem;
          color: #f8f7f2;
          font: inherit;
          font-size: 1rem;
          min-height: 2.9rem;
          padding: 0 0.85rem;
          text-transform: none;
        }

        .axis-live-vision__assign-card input:focus {
          border-color: rgba(248, 212, 92, 0.7);
          outline: none;
        }

        .axis-live-vision__assign-actions {
          display: grid;
          gap: 0.5rem;
          grid-template-columns: 1fr 1fr;
        }

        .axis-live-vision__assign-actions button:last-child {
          grid-column: 1 / -1;
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

          .axis-live-vision__tools {
            bottom: 5.6rem;
          }

          .axis-live-vision__controls {
            grid-template-columns: minmax(0, 24rem);
            justify-content: center;
            padding-bottom: 1.25rem;
          }

          .axis-live-vision__controls--running {
            grid-template-columns: repeat(5, minmax(0, 8rem));
          }
        }

        @media (max-width: 560px) {
          .axis-live-vision__quick-status {
            bottom: calc(8.9rem + env(safe-area-inset-bottom));
            top: auto;
          }

          .axis-live-vision__controls {
            grid-template-columns: minmax(0, 1fr);
          }

          .axis-live-vision__controls--running {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .axis-live-vision__controls button {
            font-size: 0.62rem;
            min-height: 2.8rem;
            padding: 0 0.18rem;
          }
        }
      `}</style>
    </main>
  );
}

function pointInsidePaddedBbox(
  x: number,
  y: number,
  [boxX, boxY, width, height]: [number, number, number, number],
  padding: number,
) {
  return x >= boxX - padding
    && x <= boxX + width + padding
    && y >= boxY - padding
    && y <= boxY + height + padding;
}

function bboxArea([, , width, height]: [number, number, number, number]) {
  return width * height;
}

function calculateBboxIoU(
  a: [number, number, number, number],
  b: [number, number, number, number],
) {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const x2 = Math.min(ax + aw, bx + bw);
  const y2 = Math.min(ay + ah, by + bh);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = bboxArea(a) + bboxArea(b) - intersection;
  return union > 0 ? intersection / union : 0;
}

function bboxCenter([x, y, width, height]: [number, number, number, number]) {
  return { x: x + width / 2, y: y + height / 2 };
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatRecordingTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
