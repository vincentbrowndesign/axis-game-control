"use client";

import MuxPlayer from "@mux/mux-player-react/lazy";
import * as tus from "tus-js-client";
import { type FormEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { type BallTrackingState, useBallTracking } from "../hooks/useBallTracking";
import { type PlayerTrack, usePersonDetection } from "../hooks/usePersonDetection";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase-browser";

type RitualState = "idle" | "active" | "saving" | "complete";
type AuthPhase = "checking" | "entry" | "restoring" | "authenticated";
type CalibrationStatus = "required" | "calibrated";
type DetectionStatus =
  | "idle"
  | "capturing"
  | "camera_not_ready"
  | "capture_failed"
  | "frame_captured"
  | "sending"
  | "request_failed"
  | "response_received"
  | "invalid_response"
  | "not_one"
  | "ready";
type ActiveView = "session" | "camera";
type CameraState = "offline" | "ready" | "attached";
type CameraDirection = "front" | "back";
type ParticipationWindowStatus = "open" | "closed";
type ParticipationMode = "Training" | "Practice" | "Game" | "Workout" | "Challenge";
type ProductSurface = "capture" | "export" | "overlay";
type OverlaySurface = "export" | "live" | "replay";
type OverlayKey =
  | "attempts"
  | "ballLabels"
  | "fg"
  | "makes"
  | "misses"
  | "organization"
  | "flightPath"
  | "playerLabels"
  | "playerName"
  | "sessionType"
  | "shotScience"
  | "timer"
  | "trackingBoxes";
type OverlaySettings = Record<OverlayKey, boolean>;
type WorkOperatorMode = "coach" | "director" | "parent" | "player";
type WorkDetectionState = "ACTIVE" | "IDLE" | "MOVING" | "SHOOTING";
type RimDragAction = "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se";
type WatchEventType = "assist" | "make" | "miss" | "rebound" | "shot_attempt" | "turnover";
type HighlightClip = {
  attemptNumber: number;
  clipEnd: number;
  clipStart: number;
  shotId: string;
  type: ShotType;
};

type SessionExportType =
  | "coach_report"
  | "player_report"
  | "raw_video"
  | "shot_science_video"
  | "overlay_video"
  | "vertical_social_clip";

const streakDays = ["M", "T", "W", "T", "F", "S", "S"];
const participationModes: ParticipationMode[] = ["Training", "Practice", "Game", "Workout", "Challenge"];
const coachParticipationModes: ParticipationMode[] = ["Practice", "Training", "Game"];
const defaultParticipationMode: ParticipationMode = "Training";
const rimGuideBox = {
  height: 0.08,
  width: 0.14,
  x: 0.43,
  y: 0.055,
};
const filmWatchGroups: Array<{ label: string; type: WatchEventType }> = [
  { label: "WATCH SHOTS", type: "shot_attempt" },
  { label: "WATCH MAKES", type: "make" },
  { label: "WATCH MISSES", type: "miss" },
  { label: "WATCH REBOUNDS", type: "rebound" },
  { label: "WATCH ASSISTS", type: "assist" },
  { label: "WATCH TURNOVERS", type: "turnover" },
];
const sessionExportLabels: Record<SessionExportType, string> = {
  coach_report: "Coach Report",
  overlay_video: "Overlay Video",
  player_report: "Player Report",
  raw_video: "Raw Video",
  shot_science_video: "Shot Science Video",
  vertical_social_clip: "Vertical Social Clip",
};
const storageKey = "axis-ritual-save";
const identityStorageKey = "axis-identity-save";
const organizationSlug = "bridge";
const highConfidenceShotThreshold = 0.62;
const lowConfidenceShotThreshold = 0.46;
const showAxisDebug = process.env.NEXT_PUBLIC_AXIS_DEBUG === "true";
const defaultDetectionDebug: DetectionDebug = {
  athleteMatchedName: null,
  faceConfidence: null,
  faceDetected: false,
  failureReason: "Waiting for athlete identification.",
  identityConfidence: null,
  predictionCount: null,
};

type AthleteIdentity = {
  id: string;
  name: string;
  rosterCode: string;
  calibrationAnchorId: string;
};

type SavedSession = {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  mode?: ParticipationMode;
  recordingAttached?: boolean;
  calibrationStatus?: CalibrationStatus;
  cameraState?: CameraState;
  cameraDirection?: CameraDirection;
  cameraAttachedAt?: string;
  muxAssetId?: string;
  muxPlaybackId?: string;
  thumbnailUrl?: string;
  rimLock?: RimLock;
  participationWindow?: ParticipationWindow;
  clipContinuityContext?: ClipContinuityContext;
  participants?: SessionParticipant[];
  participantCount?: number;
  activeParticipantCount?: number;
  timeline?: SessionTimelineSample[];
  timelineSummary?: SessionTimelineSummary;
  rawMeasurements?: SessionRawMeasurements;
  summaryLayer?: SessionSummaryLayer;
  ballTimeline?: BallTimelineSample[];
  replayEvents?: ReplayEvent[];
  replayAnchors?: ReplayAnchor[];
  replayClips?: ReplayClip[];
  exportQueue?: SessionExportOutput[];
  review?: SessionReview;
  shotEvents?: ShotEvent[];
  shotSummary?: ShotSummary;
  overlayMuxAssetId?: string;
  overlayMuxPlaybackId?: string;
  highlightClips?: HighlightClip[];
};

type ActiveParticipant = AthleteIdentity & {
  joinedAt: string;
  leftAt?: string;
  calibrationStatus?: CalibrationStatus;
  calibratedAt?: string;
  calibrationEvidence?: CalibrationEvidence;
};

type SessionParticipant = AthleteIdentity & {
  joinedAt: string;
  leftAt?: string;
  calibrationStatus?: CalibrationStatus;
  calibratedAt?: string;
  calibrationEvidence?: CalibrationEvidence;
  activeAtCheckout: boolean;
};

type CalibrationEvidence = {
  athlete_id: string;
  camera_id: string;
  session_id: string;
  lockTimestamp: string;
  timestamp: string;
  camera_type: CameraDirection;
  calibration_status: CalibrationStatus;
  track_id?: string;
  visible_people: number;
};

type DetectionDebug = {
  athleteMatchedName: string | null;
  faceConfidence: number | null;
  faceDetected: boolean;
  failureReason: string;
  identityConfidence: number | null;
  predictionCount: number | null;
};

type SessionTimelineSample = {
  athleteId?: string;
  directionChanges: number;
  distanceTraveled: number;
  entered: boolean;
  exited: boolean;
  lostCount: number;
  moving: boolean;
  recoveryCount: number;
  stationary: boolean;
  timestamp: string;
  totalDistanceTraveled: number;
  tracked: boolean;
  trackingLost: boolean;
  trackingRecovered: boolean;
  trackId?: string;
  visible: boolean;
  visibleTimeMs: number;
  x?: number;
  y?: number;
};

type SessionTimelineSummary = {
  directionChanges: number;
  distanceTraveled: number;
  entries: number;
  exits: number;
  timeMovingSeconds: number;
  timeStationarySeconds: number;
  timeTrackedSeconds: number;
  timeVisibleSeconds: number;
  trackingLosses: number;
  trackingRecoveries: number;
};

type BallTimelineSample = {
  position?: {
    x: number;
    y: number;
  };
  timestamp: string;
  velocity?: {
    x: number;
    y: number;
  };
  visible: boolean;
};

type RimLock = {
  cameraDirection: CameraDirection;
  center: {
    x: number;
    y: number;
  };
  createdAt: string;
  height: number;
  id: string;
  polygon: Array<{
    x: number;
    y: number;
  }>;
  sessionId: string;
  width: number;
};

type ShotType = "make" | "miss";
type ActionEventType = "assist" | "block" | "foul" | "rebound" | "steal" | "turnover";
type GameActionType = ActionEventType | ShotType;
const gameActions: GameActionType[] = ["make", "miss", "rebound", "assist", "turnover", "steal", "block"];
const defaultOverlaySettings: OverlaySettings = {
  attempts: true,
  ballLabels: true,
  fg: true,
  makes: true,
  misses: true,
  organization: true,
  flightPath: true,
  playerLabels: true,
  playerName: true,
  sessionType: true,
  shotScience: true,
  timer: true,
  trackingBoxes: true,
};
const overlayControls: Array<{ key: OverlayKey; label: string }> = [
  { key: "trackingBoxes", label: "Boxes" },
  { key: "playerLabels", label: "Player labels" },
  { key: "ballLabels", label: "Ball labels" },
  { key: "makes", label: "Makes" },
  { key: "misses", label: "Misses" },
  { key: "attempts", label: "Attempts" },
  { key: "fg", label: "FG%" },
  { key: "timer", label: "Timer" },
  { key: "sessionType", label: "Session" },
  { key: "organization", label: "Organization" },
  { key: "flightPath", label: "Flight path" },
  { key: "playerName", label: "Player" },
  { key: "shotScience", label: "Shot science" },
];

type ShotScience = {
  arc: number;
  apexFrame: number;
  apexPoint: {
    x: number;
    y: number;
  };
  arcHeight: number;
  arcHeightFeet: number;
  entryPoint: {
    x: number;
    y: number;
  };
  entryAngle: number;
  flightTime: number;
  gatherTime: number;
  hangTime: number;
  jumpHeight: number;
  releaseAngle: number;
  releaseFrame: number;
  releaseHeight: number;
  releasePoint: {
    x: number;
    y: number;
  };
  releaseTime: number;
  releaseSpeed: number;
  rimEntryFrame: number;
  shotEndFrame: number;
  shotArc: number;
  shotDistance: number;
  shotStartFrame: number;
  source: "single_camera_estimate";
  trajectorySpline: Array<{
    x: number;
    y: number;
  }>;
};

type ShotEvent = {
  attemptNumber: number;
  apexFrame: number;
  arcHeight: number;
  athleteId?: string;
  athleteName: string;
  cameraDirection: CameraDirection;
  cameraId: string;
  distance: number;
  entryAngle: number;
  flightTime: number;
  makeStreak: number;
  movementState: "moving" | "stationary" | "unknown";
  replayTimestamp: number;
  releaseFrame: number;
  releaseTime: number;
  resultFrame: number;
  rimFrame: number;
  sessionId: string;
  shotId: string;
  suggestionConfidence?: number;
  suggestionId?: string;
  suggestionReason?: string;
  suggested?: boolean;
  shotScience?: ShotScience;
  shotEndTimestamp: string;
  startFrame: number;
  shotStartTimestamp: string;
  timestamp: string;
  trackId?: string;
  trackedTimeSeconds: number;
  type: ShotType;
  visibleTimeSeconds: number;
};

type ShotSuggestion = {
  athleteId?: string;
  athleteName: string;
  confidence: number;
  id: string;
  needsConfirmation?: boolean;
  reason: string;
  replayTimestamp: number;
  shotId: string;
  shotScience?: ShotScience;
  timestamp: string;
  trackId?: string;
};

type PendingShotAttempt = ShotSuggestion & {
  attemptId: string;
  createdAtMs: number;
  resultSaved: boolean;
};

type ShotSummary = {
  attempts: number;
  fieldGoalPercentage: number;
  makes: number;
  misses: number;
};

type GameResults = {
  assists: number;
  blocks: number;
  fouls: number;
  makes: number;
  misses: number;
  rebounds: number;
  steals: number;
  turnovers: number;
};

type OrganizationRollups = {
  coach: {
    athletes: number;
    development: string;
    sessions: number;
    wins: number;
  };
  director: {
    athletes: number;
    film: number;
    hours: number;
    sessions: number;
  };
  parent: {
    attendance: number;
    film: number;
    makes: number;
    misses: number;
  };
  player: {
    attendance: number;
    hours: number;
    makes: number;
    misses: number;
  };
};

type ReplayEventType =
  | "assist"
  | "ball_lost"
  | "ball_recovered"
  | "ball_visible"
  | "block"
  | "coach_voice"
  | "foul"
  | "left_frame"
  | "make"
  | "miss"
  | "movement_spike"
  | "rebound"
  | "recovered"
  | "rim_contact"
  | "shot_arc"
  | "shot_attempt"
  | "shot_gather"
  | "shot_release"
  | "steal"
  | "tracking_interruption"
  | "turnover";
type BallReplayEventType = "ball_lost" | "ball_recovered" | "ball_visible";
type TrackingReplayEventType = Exclude<
  ReplayEventType,
  | ActionEventType
  | BallReplayEventType
  | "coach_voice"
  | "make"
  | "miss"
  | "rim_contact"
  | "shot_arc"
  | "shot_attempt"
  | "shot_gather"
  | "shot_release"
>;

type ReplayEvent = {
  athleteId?: string;
  athleteName: string;
  cameraDirection: CameraDirection;
  cameraId: string;
  confidence?: number;
  id: string;
  label: string;
  movementDistance?: number;
  timestamp: string;
  trackState: {
    status: "interrupted" | "recovered" | "tracked" | "visible";
    trackId?: string;
    tracked: boolean;
    visible: boolean;
  };
  type: ReplayEventType;
};

type ReplayAnchor = {
  athleteId?: string;
  athleteName?: string;
  cameraDirection?: CameraDirection;
  cameraId?: string;
  eventId: string;
  eventType: string;
  muxAssetId: string;
  replayLabel: string;
  sessionId: string;
  timestamp: string;
  videoTimestamp: number;
};

type ReplayClip = {
  clipEnd: number;
  clipKind?: string;
  clipStart: number;
  eventId: string;
  eventType: string;
  id: string;
  leadInSeconds?: number;
  leadOutSeconds?: number;
  muxAssetId: string;
  playlistOrder?: number;
  replayLabel: string;
  sessionId: string;
  sourceLabel?: string;
};

type SessionExportOutput = {
  label: string;
  sourceCount: number;
  status: "available" | "processing" | "waiting";
  type: SessionExportType;
};

type AxisCapabilityProvider = "bytetrack" | "mux" | "openai" | "rf_detr" | "roboflow" | "supabase";

type AxisCapabilityStage = {
  capability: string;
  outputs: string[];
  provider: AxisCapabilityProvider;
  sourceCount: number;
  status: SessionExportOutput["status"];
};

type SessionExportObject = {
  clips: ReplayClip[];
  events: ReplayEvent[];
  exports: SessionExportOutput[];
  metrics: {
    game: GameResults;
    longestMakeStreak: number;
    shotSummary: ShotSummary;
    workTimeSeconds: number;
  };
  overlays: ReplayAnchor[];
  pipeline: AxisCapabilityStage[];
  playerReport: PlayerReport;
  session: {
    endedAt: string;
    id: string;
    startedAt: string;
    type: ParticipationMode;
  };
  shots: ShotEvent[];
  video: {
    available: boolean;
    muxAssetId?: string;
    playbackId?: string;
    thumbnailUrl?: string;
  };
};

type PlayerReport = {
  attendance: number;
  averageReleaseAngle: number | null;
  averageReleaseSpeed: number | null;
  averageReleaseTime: number | null;
  fieldGoalPercentage: number;
  makes: number;
  misses: number;
  outputs: SessionExportOutput[];
  playerId?: string;
  playerName: string;
  progressGraph: Array<{
    attempts: number;
    fieldGoalPercentage: number;
    makes: number;
    timestamp: string;
  }>;
  releaseMetrics: Array<{
    attemptNumber: number;
    arcHeightFeet?: number;
    entryAngle?: number;
    releaseAngle?: number;
    releaseSpeed?: number;
    releaseTime?: number;
  }>;
  sessionHours: number;
  shotLocations: Array<{
    attemptNumber: number;
    distance?: number;
    x?: number;
    y?: number;
  }>;
  timeline: Array<{
    label: string;
    timestamp: string;
    videoTimestamp: number;
  }>;
  totalAttempts: number;
};

type SessionReview = {
  generatedAt: string;
  largestInterruption: string;
  mostActiveMoment: string;
  notableEvents: string[];
  reviewNotes: string[];
  sessionSummary: string;
};

type AthleteMemory = {
  athleteId: string;
  athleteName: string;
  clips: ReplayClip[];
  events: ReplayEvent[];
  movementSamples: SessionTimelineSample[];
  replayAnchors: ReplayAnchor[];
  sessions: SavedSession[];
  trackingEvents: SessionTimelineSample[];
};

type SessionRawMeasurements = {
  distance: number;
  entered: number;
  exited: number;
  lost: number;
  movingSeconds: number;
  recovered: number;
  trackedSeconds: number;
  visibleSeconds: number;
};

type SessionSummaryLayer = {
  movement: string;
  sessionLength: string;
  trackingQuality: string;
  visibility: string;
};

type TimelineCursor = {
  lastBallTimestampKey?: string;
  lastTimestampKey?: string;
  previousDirection?: "down" | "left" | "right" | "up";
  previousLostCount: number;
  previousRecoveryCount: number;
  previousTracked?: boolean;
  previousVisible?: boolean;
  previousX?: number;
  previousY?: number;
  totalDistanceTraveled: number;
};

type ParticipationWindow = {
  openedAt: string;
  closedAt?: string;
  status: ParticipationWindowStatus;
  context: ParticipationMode;
  participantIds: string[];
};

type ClipContinuityContext = {
  inheritedFromSessionId: string;
  activeParticipantIds: string[];
  calibratedParticipantIds: string[];
  cameraAttached: boolean;
  cameraState: CameraState;
  cameraDirection: CameraDirection;
  cameraAttachedAt?: string;
  mode: ParticipationMode;
  participationWindow: ParticipationWindow;
  rosterSnapshot: Array<{
    id: string;
    name: string;
    calibrationStatus: CalibrationStatus;
    activeInWindow: boolean;
  }>;
};

type AxisSave = {
  activeSession: {
    id: string;
    startedAt: string;
    mode?: ParticipationMode;
    recordingAttached?: boolean;
    calibrationStatus?: CalibrationStatus;
    cameraState?: CameraState;
    cameraDirection?: CameraDirection;
    cameraAttachedAt?: string;
    muxAssetId?: string;
    muxPlaybackId?: string;
    thumbnailUrl?: string;
    rimLock?: RimLock;
    calibrationRecords?: CalibrationEvidence[];
    participationWindow?: ParticipationWindow;
    clipContinuityContext?: ClipContinuityContext;
    participants?: ActiveParticipant[];
    replayEvents?: ReplayEvent[];
    replayAnchors?: ReplayAnchor[];
    replayClips?: ReplayClip[];
    shotEvents?: ShotEvent[];
    timeline?: SessionTimelineSample[];
    ballTimeline?: BallTimelineSample[];
  } | null;
  sessions: SavedSession[];
};

type AxisIdentity = {
  email: string;
  id: string;
  restoredAt: string;
  calibrationStatus?: CalibrationStatus;
  calibratedAt?: string;
  calibrationSessionId?: string;
};

type MovementInterpretation = {
  evidence: {
    endTimestamp: string | null;
    metric: string;
    startTimestamp: string | null;
    value: number | string;
  };
  text: string;
};

type ReviewEngineResponse = {
  review?: SessionReview;
  error?: string;
};

const defaultSave: AxisSave = {
  activeSession: null,
  sessions: [],
};

function formatTime(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatDate(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatStamp(date: Date | string) {
  return `${formatDate(date)} / ${formatTime(date)}`;
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes < 1) return `${seconds}s`;

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatTrackingStatus(status: string) {
  if (status === "lost") return "TRACK LOST";
  if (status === "recovered") return "TRACK RECOVERED";

  return "TRACKING";
}

function formatPlayerTrackStatus(track: PlayerTrack) {
  return track.status === "lost" ? "LOST" : "TRACKED";
}

function formatPlayerMovementState(track: PlayerTrack) {
  return track.movement.moving ? "MOVING" : "IDLE";
}

function formatPlayerVisibilityState(track: PlayerTrack) {
  return track.status === "lost" ? "NOT VISIBLE" : "VISIBLE";
}

function formatBallTrackStatus(ball: BallTrackingState) {
  if (ball.status === "make") return "MAKE";
  if (ball.status === "miss") return "MISS";
  if (ball.status === "rebound") return "REBOUND";

  return "BALL";
}

function getPointDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getRimTarget(rimLock?: RimLock | null) {
  return rimLock
    ? {
        height: rimLock.height,
        width: rimLock.width,
        x: rimLock.center.x,
        y: rimLock.center.y,
      }
    : {
        height: rimGuideBox.height,
        width: rimGuideBox.width,
        x: rimGuideBox.x + rimGuideBox.width / 2,
        y: rimGuideBox.y + rimGuideBox.height / 2,
      };
}

function getRimProbability(ball: BallTrackingState, rimLock?: RimLock | null) {
  if (!ball.visible || !ball.position || !ball.velocity) return 0;

  const rim = getRimTarget(rimLock);
  const horizontalWindow = Math.max(0.08, rim.width * 0.75);
  const verticalWindow = Math.max(0.08, rim.height * 1.1);
  const rimWindowX = Math.abs(ball.position.x - rim.x);
  const rimWindowY = Math.abs(ball.position.y - rim.y);
  const nearRim = rimWindowX <= horizontalWindow && rimWindowY <= verticalWindow;
  const descendingNearRim = nearRim && ball.velocity.y > 0.02;

  if (!descendingNearRim) return 0;

  const centerScore = Math.max(0, 1 - rimWindowX / horizontalWindow) * 0.54 + Math.max(0, 1 - rimWindowY / verticalWindow) * 0.24;

  return Math.min(0.96, 0.18 + ball.confidence * 0.22 + centerScore);
}

function getShotAttemptConfidence(track: PlayerTrack, ball: BallTrackingState, rimLock?: RimLock | null) {
  if (!ball.visible || !ball.position || !ball.velocity) return 0;

  const hoop = getRimTarget(rimLock);
  const ballToPlayer = getPointDistance(ball.position, track.location);
  const ballToHoop = getPointDistance(ball.position, hoop);
  const gather = ballToPlayer <= 0.24;
  const shotMotion = track.movement.direction === "up" || ball.velocity.y < -0.12;
  const ballRelease = ball.position.y < track.location.y && ball.velocity.y < -0.1;
  const towardHoop = ball.velocity.y < -0.08 && ballToHoop < 0.78;

  if (!gather || !shotMotion || !ballRelease) return 0;

  return Math.min(
    0.97,
    0.42 +
      ball.confidence * 0.22 +
      (towardHoop ? 0.14 : 0) +
      Math.min(0.12, Math.abs(ball.velocity.y) * 0.06) +
      Math.min(0.07, track.movement.distanceTraveled * 1.2),
  );
}

function getShotResultFromBall(ball: BallTrackingState, rimLock?: RimLock | null) {
  if (!ball.visible || !ball.position || !ball.velocity) return null;

  const rim = getRimTarget(rimLock);
  const rimWindowX = Math.abs(ball.position.x - rim.x);
  const rimWindowY = Math.abs(ball.position.y - rim.y);
  const nearRim = rimWindowX <= Math.max(0.08, rim.width * 0.75) && rimWindowY <= Math.max(0.08, rim.height * 1.1);
  const descendingNearRim = nearRim && ball.velocity.y > 0.02;

  if (descendingNearRim) {
    return {
      confidence: getRimProbability(ball, rimLock),
      type: "make" as const,
    };
  }

  return null;
}

function getShotPhaseTimestamp(baseMs: number, offsetMs: number) {
  return new Date(Math.max(0, baseMs + offsetMs)).toISOString();
}

function createShotPhaseReplayEvent(
  type: Extract<ReplayEventType, "rim_contact" | "shot_arc" | "shot_attempt" | "shot_gather" | "shot_release">,
  timestamp: string,
  athlete: Pick<AthleteIdentity, "id" | "name">,
  track: PlayerTrack,
  cameraDirection: CameraDirection,
  confidence: number,
): ReplayEvent {
  const labels = {
    rim_contact: "Rim contact",
    shot_arc: "Shot arc",
    shot_attempt: "Shot attempt",
    shot_gather: "Gather",
    shot_release: "Release",
  };

  return {
    athleteId: athlete.id,
    athleteName: athlete.name,
    cameraDirection,
    cameraId: getCameraId(cameraDirection),
    confidence,
    id: `replay:${timestamp}:${type}:${track.id}`,
    label: labels[type],
    timestamp,
    trackState: {
      status: "tracked",
      trackId: track.id,
      tracked: true,
      visible: true,
    },
    type,
  };
}

function createShotScience(track: PlayerTrack | null, ball: BallTrackingState, rimLock?: RimLock | null): ShotScience | undefined {
  if (!ball.visible || !ball.position || !ball.velocity) return undefined;

  const hoop = getRimTarget(rimLock);
  const trajectory = ball.trajectory.length ? ball.trajectory : [ball.position];
  const releaseFrame = 0;
  const apexFrame = trajectory.reduce(
    (bestIndex, point, index) => (point.y < trajectory[bestIndex].y ? index : bestIndex),
    0,
  );
  const rimEntryFrame = trajectory.reduce((bestIndex, point, index) => {
    const currentDistance = getPointDistance(point, hoop);
    const bestDistance = getPointDistance(trajectory[bestIndex], hoop);

    return currentDistance < bestDistance ? index : bestIndex;
  }, 0);
  const releaseSpeed = Math.hypot(ball.velocity.x, ball.velocity.y);
  const releaseAngle = Math.round((Math.atan2(Math.max(0, -ball.velocity.y), Math.max(0.001, Math.abs(ball.velocity.x))) * 180) / Math.PI);
  const releaseHeight = Math.round((1 - ball.position.y) * 100);
  const shotDistance = Math.round(getPointDistance(track?.location ?? ball.position, hoop) * 50 * 10) / 10;
  const highestPoint = trajectory[apexFrame].y;
  const arc = Math.round(Math.max(0, ball.position.y - highestPoint) * 100);
  const arcHeightFeet = Math.round(Math.max(0, ball.position.y - highestPoint) * 12 * 10) / 10;
  const hangTime = Math.round(trajectory.length * 0.12 * 10) / 10;
  const gatherTime = Math.max(0.3, Math.min(1.2, Math.round((0.42 + (track?.movement.distanceTraveled ?? 0) * 4) * 10) / 10));
  const releaseTime = Math.max(0.2, Math.min(1.6, Math.round((hangTime || 0.7) * 10) / 10));
  const jumpHeight = Math.max(0, Math.round((track?.movement.direction === "up" ? track.movement.distanceTraveled * 100 : 0) * 10) / 10);
  const flightTime = Math.max(0.1, Math.round(Math.max(1, rimEntryFrame - releaseFrame) * 0.12 * 10) / 10);
  const entryPoint = trajectory[rimEntryFrame] ?? ball.position;
  const previousEntryPoint = trajectory[Math.max(0, rimEntryFrame - 1)] ?? ball.position;
  const entryVelocity = {
    x: entryPoint.x - previousEntryPoint.x,
    y: entryPoint.y - previousEntryPoint.y,
  };
  const entryAngle = Math.round((Math.atan2(Math.max(0, entryVelocity.y), Math.max(0.001, Math.abs(entryVelocity.x))) * 180) / Math.PI);

  return {
    arc,
    apexFrame,
    apexPoint: trajectory[apexFrame],
    arcHeight: arc,
    arcHeightFeet,
    entryPoint,
    entryAngle,
    flightTime,
    gatherTime,
    hangTime,
    jumpHeight,
    releaseAngle,
    releaseFrame,
    releaseHeight,
    releasePoint: ball.position,
    releaseTime,
    releaseSpeed: Math.round(releaseSpeed * 100) / 100,
    rimEntryFrame,
    shotEndFrame: Math.max(0, trajectory.length - 1),
    shotArc: arc,
    shotDistance,
    shotStartFrame: releaseFrame,
    source: "single_camera_estimate",
    trajectorySpline: trajectory,
  };
}

function getCameraId(direction: CameraDirection) {
  return `camera:${organizationSlug}:${direction}`;
}

function normalizeTimelineSample(sample: unknown): SessionTimelineSample | null {
  if (!sample || typeof sample !== "object") return null;

  const candidate = sample as Partial<SessionTimelineSample>;
  if (typeof candidate.timestamp !== "string") return null;

  return {
    athleteId: typeof candidate.athleteId === "string" ? candidate.athleteId : undefined,
    directionChanges: typeof candidate.directionChanges === "number" ? candidate.directionChanges : 0,
    distanceTraveled: typeof candidate.distanceTraveled === "number" ? candidate.distanceTraveled : 0,
    entered: Boolean(candidate.entered),
    exited: Boolean(candidate.exited),
    lostCount: typeof candidate.lostCount === "number" ? candidate.lostCount : 0,
    moving: Boolean(candidate.moving),
    recoveryCount: typeof candidate.recoveryCount === "number" ? candidate.recoveryCount : 0,
    stationary: Boolean(candidate.stationary),
    timestamp: candidate.timestamp,
    totalDistanceTraveled: typeof candidate.totalDistanceTraveled === "number" ? candidate.totalDistanceTraveled : 0,
    tracked: Boolean(candidate.tracked),
    trackingLost: Boolean(candidate.trackingLost),
    trackingRecovered: Boolean(candidate.trackingRecovered),
    trackId: typeof candidate.trackId === "string" ? candidate.trackId : undefined,
    visible: Boolean(candidate.visible),
    visibleTimeMs: typeof candidate.visibleTimeMs === "number" ? candidate.visibleTimeMs : 0,
    x: typeof candidate.x === "number" ? candidate.x : undefined,
    y: typeof candidate.y === "number" ? candidate.y : undefined,
  };
}

function normalizeTimeline(samples: unknown) {
  if (!Array.isArray(samples)) return [];

  return samples.map(normalizeTimelineSample).filter((sample): sample is SessionTimelineSample => Boolean(sample));
}

function normalizeBallTimelineSample(sample: unknown): BallTimelineSample | null {
  if (!sample || typeof sample !== "object") return null;

  const candidate = sample as Partial<BallTimelineSample>;
  if (typeof candidate.timestamp !== "string") return null;

  const position =
    candidate.position &&
    typeof candidate.position.x === "number" &&
    typeof candidate.position.y === "number"
      ? {
          x: candidate.position.x,
          y: candidate.position.y,
        }
      : undefined;
  const velocity =
    candidate.velocity &&
    typeof candidate.velocity.x === "number" &&
    typeof candidate.velocity.y === "number"
      ? {
          x: candidate.velocity.x,
          y: candidate.velocity.y,
        }
      : undefined;

  return {
    position,
    timestamp: candidate.timestamp,
    velocity,
    visible: Boolean(candidate.visible),
  };
}

function normalizeBallTimeline(samples: unknown) {
  if (!Array.isArray(samples)) return [];

  return samples.map(normalizeBallTimelineSample).filter((sample): sample is BallTimelineSample => Boolean(sample));
}

function normalizeReplayEvent(event: unknown): ReplayEvent | null {
  if (!event || typeof event !== "object") return null;

  const candidate = event as Partial<ReplayEvent>;
  if (typeof candidate.id !== "string" || typeof candidate.timestamp !== "string" || typeof candidate.type !== "string") {
    return null;
  }

  const trackState =
    candidate.trackState && typeof candidate.trackState === "object"
      ? (candidate.trackState as Partial<ReplayEvent["trackState"]>)
      : {};
  const cameraDirection = normalizeCameraDirection(candidate.cameraDirection);

  return {
    athleteId: typeof candidate.athleteId === "string" ? candidate.athleteId : undefined,
    athleteName: typeof candidate.athleteName === "string" ? candidate.athleteName : "Athlete",
    cameraDirection,
    cameraId: typeof candidate.cameraId === "string" ? candidate.cameraId : getCameraId(cameraDirection),
    confidence: typeof candidate.confidence === "number" ? candidate.confidence : undefined,
    id: candidate.id,
    label: typeof candidate.label === "string" ? candidate.label : "Replay event",
    movementDistance: typeof candidate.movementDistance === "number" ? candidate.movementDistance : undefined,
    timestamp: candidate.timestamp,
    trackState: {
      status:
        trackState.status === "interrupted" || trackState.status === "recovered" || trackState.status === "tracked"
          ? trackState.status
          : "visible",
      trackId: typeof trackState.trackId === "string" ? trackState.trackId : undefined,
      tracked: Boolean(trackState.tracked),
      visible: Boolean(trackState.visible),
    },
    type:
      candidate.type === "left_frame" ||
      candidate.type === "assist" ||
      candidate.type === "ball_lost" ||
      candidate.type === "ball_recovered" ||
      candidate.type === "ball_visible" ||
      candidate.type === "coach_voice" ||
      candidate.type === "foul" ||
      candidate.type === "make" ||
      candidate.type === "miss" ||
      candidate.type === "movement_spike" ||
      candidate.type === "rebound" ||
      candidate.type === "recovered" ||
      candidate.type === "rim_contact" ||
      candidate.type === "shot_arc" ||
      candidate.type === "shot_attempt" ||
      candidate.type === "shot_gather" ||
      candidate.type === "shot_release" ||
      candidate.type === "tracking_interruption" ||
      candidate.type === "turnover"
        ? candidate.type
        : "movement_spike",
  };
}

function normalizeReplayEvents(events: unknown) {
  if (!Array.isArray(events)) return [];

  return events.map(normalizeReplayEvent).filter((event): event is ReplayEvent => Boolean(event));
}

function normalizeReplayAnchor(anchor: unknown): ReplayAnchor | null {
  if (!anchor || typeof anchor !== "object") return null;

  const candidate = anchor as Partial<ReplayAnchor>;
  if (
    typeof candidate.eventId !== "string" ||
    typeof candidate.eventType !== "string" ||
    typeof candidate.sessionId !== "string" ||
    typeof candidate.timestamp !== "string"
  ) {
    return null;
  }

  return {
    athleteId: typeof candidate.athleteId === "string" ? candidate.athleteId : undefined,
    athleteName: typeof candidate.athleteName === "string" ? candidate.athleteName : undefined,
    cameraDirection: candidate.cameraDirection ? normalizeCameraDirection(candidate.cameraDirection) : undefined,
    cameraId: typeof candidate.cameraId === "string" ? candidate.cameraId : undefined,
    eventId: candidate.eventId,
    eventType: candidate.eventType,
    muxAssetId: typeof candidate.muxAssetId === "string" ? candidate.muxAssetId : "pending",
    replayLabel: typeof candidate.replayLabel === "string" ? candidate.replayLabel : candidate.eventType,
    sessionId: candidate.sessionId,
    timestamp: candidate.timestamp,
    videoTimestamp: typeof candidate.videoTimestamp === "number" ? candidate.videoTimestamp : 0,
  };
}

function normalizeReplayAnchors(anchors: unknown) {
  if (!Array.isArray(anchors)) return [];

  return anchors.map(normalizeReplayAnchor).filter((anchor): anchor is ReplayAnchor => Boolean(anchor));
}

function normalizeReplayClip(clip: unknown): ReplayClip | null {
  if (!clip || typeof clip !== "object") return null;

  const candidate = clip as Partial<ReplayClip>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.eventId !== "string" ||
    typeof candidate.eventType !== "string" ||
    typeof candidate.sessionId !== "string"
  ) {
    return null;
  }

  return {
    clipEnd: typeof candidate.clipEnd === "number" ? candidate.clipEnd : 0,
    clipKind: typeof candidate.clipKind === "string" ? candidate.clipKind : undefined,
    clipStart: typeof candidate.clipStart === "number" ? candidate.clipStart : 0,
    eventId: candidate.eventId,
    eventType: candidate.eventType,
    id: candidate.id,
    leadInSeconds: typeof candidate.leadInSeconds === "number" ? candidate.leadInSeconds : undefined,
    leadOutSeconds: typeof candidate.leadOutSeconds === "number" ? candidate.leadOutSeconds : undefined,
    muxAssetId: typeof candidate.muxAssetId === "string" ? candidate.muxAssetId : "pending",
    playlistOrder: typeof candidate.playlistOrder === "number" ? candidate.playlistOrder : undefined,
    replayLabel: typeof candidate.replayLabel === "string" ? candidate.replayLabel : candidate.eventType,
    sessionId: candidate.sessionId,
    sourceLabel: typeof candidate.sourceLabel === "string" ? candidate.sourceLabel : undefined,
  };
}

function normalizeReplayClips(clips: unknown) {
  if (!Array.isArray(clips)) return [];

  return clips.map(normalizeReplayClip).filter((clip): clip is ReplayClip => Boolean(clip));
}

function normalizeSessionReview(review: unknown): SessionReview | undefined {
  if (!review || typeof review !== "object") return undefined;

  const candidate = review as Partial<SessionReview>;
  if (
    typeof candidate.sessionSummary !== "string" ||
    typeof candidate.mostActiveMoment !== "string" ||
    typeof candidate.largestInterruption !== "string"
  ) {
    return undefined;
  }

  return {
    generatedAt: typeof candidate.generatedAt === "string" ? candidate.generatedAt : new Date().toISOString(),
    largestInterruption: candidate.largestInterruption,
    mostActiveMoment: candidate.mostActiveMoment,
    notableEvents: Array.isArray(candidate.notableEvents)
      ? candidate.notableEvents.filter((event): event is string => typeof event === "string").slice(0, 5)
      : [],
    reviewNotes: Array.isArray(candidate.reviewNotes)
      ? candidate.reviewNotes.filter((note): note is string => typeof note === "string").slice(0, 5)
      : [],
    sessionSummary: candidate.sessionSummary,
  };
}

function normalizeShotEvent(event: unknown): ShotEvent | null {
  if (!event || typeof event !== "object") return null;

  const candidate = event as Partial<ShotEvent>;
  if (candidate.type !== "make" && candidate.type !== "miss") return null;
  if (typeof candidate.timestamp !== "string" || typeof candidate.sessionId !== "string") return null;
  const cameraDirection = normalizeCameraDirection(candidate.cameraDirection);
  const shotScience =
    candidate.shotScience && typeof candidate.shotScience === "object"
      ? (candidate.shotScience as Partial<ShotScience>)
      : undefined;
  const normalizedShotScience =
    shotScience &&
    typeof shotScience.releaseAngle === "number" &&
    typeof shotScience.releaseHeight === "number" &&
    typeof shotScience.releaseSpeed === "number" &&
    typeof shotScience.arc === "number" &&
    typeof shotScience.shotDistance === "number" &&
    typeof shotScience.hangTime === "number"
        ? {
          arc: shotScience.arc,
          apexFrame: typeof shotScience.apexFrame === "number" ? shotScience.apexFrame : 0,
          apexPoint:
            shotScience.apexPoint &&
            typeof shotScience.apexPoint.x === "number" &&
            typeof shotScience.apexPoint.y === "number"
              ? shotScience.apexPoint
              : { x: 0, y: 0 },
          arcHeight: typeof shotScience.arcHeight === "number" ? shotScience.arcHeight : shotScience.arc,
          arcHeightFeet:
            typeof shotScience.arcHeightFeet === "number"
              ? shotScience.arcHeightFeet
              : Math.round(Math.max(0, shotScience.arc) * 0.12 * 10) / 10,
          entryPoint:
            shotScience.entryPoint &&
            typeof shotScience.entryPoint.x === "number" &&
            typeof shotScience.entryPoint.y === "number"
              ? shotScience.entryPoint
              : { x: 0, y: 0 },
          entryAngle: typeof shotScience.entryAngle === "number" ? shotScience.entryAngle : shotScience.releaseAngle,
          flightTime: typeof shotScience.flightTime === "number" ? shotScience.flightTime : shotScience.hangTime,
          gatherTime: typeof shotScience.gatherTime === "number" ? shotScience.gatherTime : 0.5,
          hangTime: shotScience.hangTime,
          jumpHeight: typeof shotScience.jumpHeight === "number" ? shotScience.jumpHeight : 0,
          releaseAngle: shotScience.releaseAngle,
          releaseFrame: typeof shotScience.releaseFrame === "number" ? shotScience.releaseFrame : 0,
          releaseHeight: shotScience.releaseHeight,
          releasePoint:
            shotScience.releasePoint &&
            typeof shotScience.releasePoint.x === "number" &&
            typeof shotScience.releasePoint.y === "number"
              ? shotScience.releasePoint
              : { x: 0, y: 0 },
          releaseTime: typeof shotScience.releaseTime === "number" ? shotScience.releaseTime : shotScience.hangTime,
          releaseSpeed: shotScience.releaseSpeed,
          rimEntryFrame: typeof shotScience.rimEntryFrame === "number" ? shotScience.rimEntryFrame : 0,
          shotEndFrame: typeof shotScience.shotEndFrame === "number" ? shotScience.shotEndFrame : 0,
          shotArc: typeof shotScience.shotArc === "number" ? shotScience.shotArc : shotScience.arc,
          shotDistance: shotScience.shotDistance,
          shotStartFrame: typeof shotScience.shotStartFrame === "number" ? shotScience.shotStartFrame : 0,
          source: "single_camera_estimate" as const,
          trajectorySpline: Array.isArray(shotScience.trajectorySpline)
            ? shotScience.trajectorySpline
                .filter(
                  (point): point is { x: number; y: number } =>
                    Boolean(point) && typeof point.x === "number" && typeof point.y === "number",
                )
                .slice(-24)
            : [],
        }
      : undefined;

  return {
    attemptNumber: typeof candidate.attemptNumber === "number" ? candidate.attemptNumber : 1,
    apexFrame:
      typeof candidate.apexFrame === "number"
        ? candidate.apexFrame
        : typeof normalizedShotScience?.apexFrame === "number"
          ? normalizedShotScience.apexFrame
          : 0,
    arcHeight:
      typeof candidate.arcHeight === "number"
        ? candidate.arcHeight
        : typeof normalizedShotScience?.arcHeightFeet === "number"
          ? normalizedShotScience.arcHeightFeet
          : 0,
    athleteId: typeof candidate.athleteId === "string" ? candidate.athleteId : undefined,
    athleteName: typeof candidate.athleteName === "string" ? candidate.athleteName : "Athlete",
    cameraDirection,
    cameraId: typeof candidate.cameraId === "string" ? candidate.cameraId : getCameraId(cameraDirection),
    distance:
      typeof candidate.distance === "number"
        ? candidate.distance
        : typeof normalizedShotScience?.shotDistance === "number"
          ? normalizedShotScience.shotDistance
          : 0,
    entryAngle:
      typeof candidate.entryAngle === "number"
        ? candidate.entryAngle
        : typeof normalizedShotScience?.entryAngle === "number"
          ? normalizedShotScience.entryAngle
          : 0,
    flightTime:
      typeof candidate.flightTime === "number"
        ? candidate.flightTime
        : typeof normalizedShotScience?.flightTime === "number"
          ? normalizedShotScience.flightTime
          : 0,
    makeStreak: typeof candidate.makeStreak === "number" ? candidate.makeStreak : 0,
    movementState:
      candidate.movementState === "moving" || candidate.movementState === "stationary" ? candidate.movementState : "unknown",
    replayTimestamp: typeof candidate.replayTimestamp === "number" ? candidate.replayTimestamp : 0,
    releaseFrame:
      typeof candidate.releaseFrame === "number"
        ? candidate.releaseFrame
        : typeof normalizedShotScience?.releaseFrame === "number"
          ? normalizedShotScience.releaseFrame
          : 0,
    releaseTime:
      typeof candidate.releaseTime === "number"
        ? candidate.releaseTime
        : typeof normalizedShotScience?.releaseTime === "number"
          ? normalizedShotScience.releaseTime
          : 0,
    resultFrame:
      typeof candidate.resultFrame === "number"
        ? candidate.resultFrame
        : typeof normalizedShotScience?.shotEndFrame === "number"
          ? normalizedShotScience.shotEndFrame
          : 0,
    rimFrame:
      typeof candidate.rimFrame === "number"
        ? candidate.rimFrame
        : typeof normalizedShotScience?.rimEntryFrame === "number"
          ? normalizedShotScience.rimEntryFrame
          : 0,
    sessionId: candidate.sessionId,
    shotId:
      typeof candidate.shotId === "string"
        ? candidate.shotId
        : `shot:${candidate.sessionId}:${candidate.timestamp}`,
    suggestionConfidence: typeof candidate.suggestionConfidence === "number" ? candidate.suggestionConfidence : undefined,
    suggestionId: typeof candidate.suggestionId === "string" ? candidate.suggestionId : undefined,
    suggestionReason: typeof candidate.suggestionReason === "string" ? candidate.suggestionReason : undefined,
    suggested: Boolean(candidate.suggested),
    shotScience: normalizedShotScience,
    shotEndTimestamp: typeof candidate.shotEndTimestamp === "string" ? candidate.shotEndTimestamp : candidate.timestamp,
    startFrame:
      typeof candidate.startFrame === "number"
        ? candidate.startFrame
        : typeof normalizedShotScience?.shotStartFrame === "number"
          ? normalizedShotScience.shotStartFrame
          : 0,
    shotStartTimestamp: typeof candidate.shotStartTimestamp === "string" ? candidate.shotStartTimestamp : candidate.timestamp,
    timestamp: candidate.timestamp,
    trackId: typeof candidate.trackId === "string" ? candidate.trackId : undefined,
    trackedTimeSeconds: typeof candidate.trackedTimeSeconds === "number" ? candidate.trackedTimeSeconds : 0,
    type: candidate.type,
    visibleTimeSeconds: typeof candidate.visibleTimeSeconds === "number" ? candidate.visibleTimeSeconds : 0,
  };
}

function normalizeShotEvents(events: unknown) {
  if (!Array.isArray(events)) return [];

  return events.map(normalizeShotEvent).filter((event): event is ShotEvent => Boolean(event));
}

function createBallTimelineSample(timestamp: string, ballTracking: BallTrackingState): BallTimelineSample {
  return {
    position: ballTracking.position,
    timestamp,
    velocity: ballTracking.velocity,
    visible: ballTracking.visible,
  };
}

function getReplayAthlete(sample: SessionTimelineSample, participants: SessionParticipant[]) {
  const participant = sample.athleteId ? participants.find((candidate) => candidate.id === sample.athleteId) : undefined;

  return {
    athleteId: participant?.id ?? sample.athleteId,
    athleteName: participant?.name ?? "Athlete",
  };
}

function createReplayEvent(
  type: TrackingReplayEventType,
  sample: SessionTimelineSample,
  participants: SessionParticipant[],
  cameraDirection: CameraDirection,
  index: number,
): ReplayEvent {
  const athlete = getReplayAthlete(sample, participants);
  const labelByType: Record<TrackingReplayEventType, string> = {
    left_frame: "Left frame",
    movement_spike: "Movement spike",
    recovered: "Track recovered",
    tracking_interruption: "Tracking interrupted",
  };

  return {
    athleteId: athlete.athleteId,
    athleteName: athlete.athleteName,
    cameraDirection,
    cameraId: getCameraId(cameraDirection),
    id: `replay:${sample.timestamp}:${type}:${sample.trackId ?? "track"}:${index}`,
    label: labelByType[type],
    movementDistance: type === "movement_spike" ? sample.distanceTraveled : undefined,
    timestamp: sample.timestamp,
    trackState: {
      status:
        type === "tracking_interruption"
          ? "interrupted"
          : type === "recovered"
            ? "recovered"
            : sample.tracked
              ? "tracked"
              : "visible",
      trackId: sample.trackId,
      tracked: sample.tracked,
      visible: sample.visible,
    },
    type,
  };
}

function createReplayEvents(
  samples: SessionTimelineSample[],
  participants: SessionParticipant[],
  cameraDirection: CameraDirection,
) {
  const events: ReplayEvent[] = [];

  samples.forEach((sample, index) => {
    if (sample.exited) events.push(createReplayEvent("left_frame", sample, participants, cameraDirection, index));
    if (sample.trackingLost) events.push(createReplayEvent("tracking_interruption", sample, participants, cameraDirection, index));
    if (sample.trackingRecovered) events.push(createReplayEvent("recovered", sample, participants, cameraDirection, index));
    if (sample.distanceTraveled >= 0.055) {
      events.push(createReplayEvent("movement_spike", sample, participants, cameraDirection, index));
    }
  });

  return events.slice(0, 240);
}

function createShotReplayEvent(shot: ShotEvent, index: number): ReplayEvent {
  return {
    athleteId: shot.athleteId,
    athleteName: shot.athleteName,
    cameraDirection: shot.cameraDirection,
    cameraId: shot.cameraId,
    id: `replay:${shot.timestamp}:${shot.type}:${shot.trackId ?? "track"}:${index}`,
    label: shot.type === "make" ? "Shot made" : "Shot missed",
    timestamp: shot.timestamp,
    trackState: {
      status: shot.trackId ? "tracked" : "visible",
      trackId: shot.trackId,
      tracked: Boolean(shot.trackId),
      visible: shot.visibleTimeSeconds > 0,
    },
    type: shot.type,
  };
}

function formatGameActionLabel(type: GameActionType) {
  if (type === "make") return "Make";
  if (type === "miss") return "Miss";
  if (type === "rebound") return "Rebound";
  if (type === "assist") return "Assist";
  if (type === "turnover") return "Turnover";
  if (type === "steal") return "Steal";
  if (type === "block") return "Block";

  return "Foul";
}

function getVideoTimestamp(timestamp: string, sessionStartedAt: string) {
  return Math.max(0, (new Date(timestamp).getTime() - new Date(sessionStartedAt).getTime()) / 1000);
}

function buildRunningStats(shots: ShotEvent[], videoTime: number) {
  const past = shots.filter((s) => s.replayTimestamp <= videoTime + 0.5);
  const makes = past.filter((s) => s.type === "make").length;
  const misses = past.filter((s) => s.type === "miss").length;
  const attempts = makes + misses;
  return { attempts, makes, misses, fg: attempts > 0 ? Math.round((makes / attempts) * 100) : 0 };
}

function buildHighlightClips(shots: ShotEvent[], leadIn = 2.5, leadOut = 4): HighlightClip[] {
  return shots.map((s) => ({
    attemptNumber: s.attemptNumber,
    clipEnd: Math.max(0, s.replayTimestamp + leadOut),
    clipStart: Math.max(0, s.replayTimestamp - leadIn),
    shotId: s.shotId,
    type: s.type,
  }));
}

function canvasRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}

function drawOverlayFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stats: { attempts: number; makes: number; misses: number; fg: number },
  activeShot: ShotEvent | null,
  shotElapsed: number,
) {
  const sc = width / 390;
  ctx.save();

  // Running score strip — top right
  const sw = 170 * sc;
  const sh = 27 * sc;
  const sx = width - sw - 8 * sc;
  const sy = 8 * sc;
  ctx.fillStyle = "rgba(6,6,6,0.78)";
  ctx.beginPath();
  canvasRoundRect(ctx, sx, sy, sw, sh, 3 * sc);
  ctx.fill();

  const lfs = Math.round(9.5 * sc);
  ctx.font = `900 ${lfs}px "Arial Narrow",Arial,sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const my = sy + sh / 2;
  const c1 = sx + 7 * sc;
  const c2 = sx + 52 * sc;
  const c3 = sx + 90 * sc;
  const c4 = sx + 128 * sc;
  ctx.fillStyle = "rgba(244,244,240,0.55)";
  ctx.fillText("ATT", c1, my);
  ctx.fillText("M", c2, my);
  ctx.fillText("MS", c3, my);
  ctx.fillStyle = stats.fg >= 50 ? "rgba(168,217,51,0.75)" : "rgba(244,244,240,0.55)";
  ctx.fillText("FG%", c4, my);
  const vfs = Math.round(11 * sc);
  ctx.font = `900 ${vfs}px "Arial Narrow",Arial,sans-serif`;
  ctx.fillStyle = "rgba(244,244,240,0.95)";
  ctx.fillText(String(stats.attempts), c1 + 22 * sc, my);
  ctx.fillText(String(stats.makes), c2 + 12 * sc, my);
  ctx.fillText(String(stats.misses), c3 + 16 * sc, my);
  ctx.fillStyle = stats.fg >= 50 ? "rgb(168,217,51)" : "rgba(244,244,240,0.95)";
  ctx.fillText(`${stats.fg}%`, c4 + 22 * sc, my);

  // Active shot overlay
  if (activeShot && shotElapsed >= -0.1 && shotElapsed <= 3.5) {
    const fadeIn = Math.min(1, shotElapsed < 0 ? 0 : shotElapsed < 0.25 ? shotElapsed / 0.25 : 1);
    const fadeOut = shotElapsed > 3.0 ? 1 - (shotElapsed - 3.0) / 0.5 : 1;
    const alpha = Math.max(0, Math.min(1, fadeIn * fadeOut));
    const isMake = activeShot.type === "make";
    const cx = width / 2;
    const ry = height * 0.44;

    ctx.globalAlpha = alpha;

    // Result label
    const rfs = Math.round(68 * sc);
    ctx.font = `900 ${rfs}px "Arial Narrow",Arial,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (isMake) {
      ctx.shadowBlur = 36 * sc;
      ctx.shadowColor = "rgba(168,217,51,0.45)";
      ctx.fillStyle = "rgb(168,217,51)";
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(244,244,240,0.92)";
    }
    ctx.fillText(isMake ? "MAKE" : "MISS", cx, ry);
    ctx.shadowBlur = 0;

    // Attempt number
    const afs = Math.round(9 * sc);
    ctx.font = `700 ${afs}px "Arial Narrow",Arial,sans-serif`;
    ctx.fillStyle = "rgba(244,244,240,0.4)";
    ctx.fillText(`SHOT ${activeShot.attemptNumber}`, cx, ry + rfs * 0.72);

    // Metrics bar
    const science = activeShot.shotScience;
    const metrics: string[] = [];
    if (science?.releaseAngle) metrics.push(`RELEASE ${Math.round(science.releaseAngle)}°`);
    if (science?.arcHeightFeet) metrics.push(`ARC ${science.arcHeightFeet.toFixed(1)}ft`);
    if (activeShot.distance) metrics.push(`${Math.round(activeShot.distance)}ft`);
    if (metrics.length) {
      const mfs = Math.round(9.5 * sc);
      ctx.font = `700 ${mfs}px "Arial Narrow",Arial,sans-serif`;
      const mtext = metrics.join("  ·  ");
      const mw = ctx.measureText(mtext).width + 24 * sc;
      const mbottom = height - 48 * sc;
      ctx.fillStyle = "rgba(6,6,6,0.78)";
      ctx.beginPath();
      canvasRoundRect(ctx, cx - mw / 2, mbottom - 13 * sc, mw, 24 * sc, 3 * sc);
      ctx.fill();
      ctx.fillStyle = "rgba(244,244,240,0.88)";
      ctx.fillText(mtext, cx, mbottom);
    }

    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

async function generateOverlayFilm(rawBlob: Blob, session: SavedSession): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof MediaRecorder === "undefined" || typeof document === "undefined") {
      resolve(null);
      return;
    }
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(rawBlob);
    video.src = objectUrl;

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    video.onerror = () => { cleanup(); resolve(null); };

    video.onloadedmetadata = () => {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctxOrNull = canvas.getContext("2d");
      if (!ctxOrNull) { cleanup(); resolve(null); return; }
      const ctx: CanvasRenderingContext2D = ctxOrNull;

      let stream: MediaStream;
      try {
        stream = canvas.captureStream(30);
      } catch {
        cleanup(); resolve(null); return;
      }

      const mimeType = getSupportedVideoMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const shots = normalizeShotEvents(session.shotEvents);
      let rafId: number | null = null;

      function renderFrame() {
        if (video.ended || video.paused) return;
        const t = video.currentTime;
        ctx.drawImage(video, 0, 0, width, height);
        const stats = buildRunningStats(shots, t);
        let activeShot: ShotEvent | null = null;
        let shotElapsed = -1;
        for (const s of shots) {
          const elapsed = t - s.replayTimestamp;
          if (elapsed >= -0.1 && elapsed <= 3.5) {
            activeShot = s;
            shotElapsed = elapsed;
            break;
          }
        }
        drawOverlayFrame(ctx, width, height, stats, activeShot, shotElapsed);
        rafId = requestAnimationFrame(renderFrame);
      }

      recorder.start(1000);
      video.play().then(() => { rafId = requestAnimationFrame(renderFrame); }).catch(() => {
        recorder.stop(); cleanup(); resolve(null);
      });

      video.onended = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        recorder.onstop = () => {
          const blob = chunks.length ? new Blob(chunks, { type: mimeType || "video/webm" }) : null;
          cleanup();
          resolve(blob?.size ? blob : null);
        };
        recorder.requestData();
        recorder.stop();
      };
    };

    video.load();
  });
}

function createReplayAnchor(
  eventId: string,
  eventType: string,
  timestamp: string,
  sessionId: string,
  sessionStartedAt: string,
  muxAssetId: string | undefined,
  replayLabel: string,
  details: Partial<Pick<ReplayAnchor, "athleteId" | "athleteName" | "cameraDirection" | "cameraId">> = {},
): ReplayAnchor {
  return {
    ...details,
    eventId,
    eventType,
    muxAssetId: muxAssetId ?? "pending",
    replayLabel,
    sessionId,
    timestamp,
    videoTimestamp: getVideoTimestamp(timestamp, sessionStartedAt),
  };
}

function createReplayAnchorsForSession(session: {
  calibrationRecords?: CalibrationEvidence[];
  cameraDirection?: CameraDirection;
  endedAt?: string;
  id: string;
  muxAssetId?: string;
  participants?: SessionParticipant[];
  replayEvents?: ReplayEvent[];
  shotEvents?: ShotEvent[];
  startedAt: string;
}) {
  const cameraDirection = normalizeCameraDirection(session.cameraDirection);
  const muxAssetId = session.muxAssetId;
  const anchors: ReplayAnchor[] = [
    createReplayAnchor(
      `session:${session.id}:start`,
      "session_start",
      session.startedAt,
      session.id,
      session.startedAt,
      muxAssetId,
      "Session start",
      { cameraDirection, cameraId: getCameraId(cameraDirection) },
    ),
  ];

  (session.calibrationRecords ?? []).forEach((record, index) => {
    const participant = session.participants?.find((candidate) => candidate.id === record.athlete_id);
    anchors.push(
      createReplayAnchor(
        `identity:${record.session_id}:${record.athlete_id}:${index}`,
        "identity_locked",
        record.lockTimestamp ?? record.timestamp,
        session.id,
        session.startedAt,
        muxAssetId,
        "Identity locked",
        {
          athleteId: record.athlete_id,
          athleteName: participant?.name,
          cameraDirection: record.camera_type,
          cameraId: record.camera_id,
        },
      ),
    );
  });

  (session.replayEvents ?? []).forEach((event) => {
    anchors.push(
      createReplayAnchor(
        event.id,
        event.type,
        event.timestamp,
        session.id,
        session.startedAt,
        muxAssetId,
        event.label,
        {
          athleteId: event.athleteId,
          athleteName: event.athleteName,
          cameraDirection: event.cameraDirection,
          cameraId: event.cameraId,
        },
      ),
    );
  });

  if (session.endedAt) {
    anchors.push(
      createReplayAnchor(
        `session:${session.id}:end`,
        "session_end",
        session.endedAt,
        session.id,
        session.startedAt,
        muxAssetId,
        "Session end",
        { cameraDirection, cameraId: getCameraId(cameraDirection) },
      ),
    );
  }

  return anchors
    .sort((a, b) => a.videoTimestamp - b.videoTimestamp)
    .filter((anchor, index, allAnchors) => allAnchors.findIndex((candidate) => candidate.eventId === anchor.eventId) === index);
}

function shouldCreateClip(anchor: ReplayAnchor) {
  return anchor.eventType !== "session_start" && anchor.eventType !== "session_end";
}

function createReplayClip(
  anchor: ReplayAnchor,
  options: {
    clipKind?: string;
    leadInSeconds?: number;
    leadOutSeconds?: number;
    playlistOrder?: number;
    sourceLabel?: string;
  } = {},
): ReplayClip {
  const leadInSeconds = options.leadInSeconds ?? 5;
  const leadOutSeconds = options.leadOutSeconds ?? 5;

  return {
    clipEnd: anchor.videoTimestamp + leadOutSeconds,
    clipKind: options.clipKind,
    clipStart: Math.max(0, anchor.videoTimestamp - leadInSeconds),
    eventId: anchor.eventId,
    eventType: anchor.eventType,
    id: `clip:${options.clipKind ?? anchor.eventType}:${anchor.eventId}`,
    leadInSeconds,
    leadOutSeconds,
    muxAssetId: anchor.muxAssetId,
    playlistOrder: options.playlistOrder,
    replayLabel: anchor.replayLabel,
    sessionId: anchor.sessionId,
    sourceLabel: options.sourceLabel,
  };
}

function createReplayClips(anchors: ReplayAnchor[]) {
  return anchors.filter(shouldCreateClip).map((anchor) => createReplayClip(anchor));
}

function findShotAnchor(shot: ShotEvent | undefined, anchors: ReplayAnchor[]) {
  if (!shot) return undefined;

  return anchors.find(
    (anchor) =>
      anchor.eventType === shot.type &&
      anchor.sessionId === shot.sessionId &&
      Math.abs(new Date(anchor.timestamp).getTime() - new Date(shot.timestamp).getTime()) < 1200,
  );
}

function createSyntheticClipAnchor({
  eventId,
  eventType,
  label,
  muxAssetId,
  sessionId,
  sessionStartedAt,
  timestamp,
}: {
  eventId: string;
  eventType: string;
  label: string;
  muxAssetId?: string;
  sessionId: string;
  sessionStartedAt: string;
  timestamp: string;
}) {
  return createReplayAnchor(eventId, eventType, timestamp, sessionId, sessionStartedAt, muxAssetId, label);
}

function createAutomaticReplayClips({
  anchors,
  muxAssetId,
  sessionId,
  sessionStartedAt,
  shotEvents,
  timeline,
}: {
  anchors: ReplayAnchor[];
  muxAssetId?: string;
  sessionId: string;
  sessionStartedAt: string;
  shotEvents: ShotEvent[];
  timeline: SessionTimelineSample[];
}) {
  const clips: ReplayClip[] = [];
  const addClip = (anchor: ReplayAnchor | undefined, clipKind: string, sourceLabel: string, leadInSeconds = 5, leadOutSeconds = 5) => {
    if (!anchor) return;
    clips.push(
      createReplayClip(anchor, {
        clipKind,
        leadInSeconds,
        leadOutSeconds,
        playlistOrder: clips.length + 1,
        sourceLabel,
      }),
    );
  };

  anchors
    .filter((anchor) => anchor.eventType === "make")
    .forEach((anchor) => addClip(anchor, "make", "Make"));
  anchors
    .filter((anchor) => anchor.eventType === "miss")
    .forEach((anchor) => addClip(anchor, "miss", "Miss"));

  const longestStreakShot = shotEvents.reduce<ShotEvent | undefined>(
    (best, shot) => (shot.makeStreak > (best?.makeStreak ?? 0) ? shot : best),
    undefined,
  );
  addClip(findShotAnchor(longestStreakShot, anchors), "longest_streak", "Longest streak", 6, 6);

  const fastestReleaseShot = shotEvents
    .filter((shot) => shot.shotScience)
    .reduce<ShotEvent | undefined>(
      (best, shot) =>
        !best || (shot.shotScience?.releaseTime ?? Number.POSITIVE_INFINITY) < (best.shotScience?.releaseTime ?? Number.POSITIVE_INFINITY)
          ? shot
          : best,
      undefined,
    );
  addClip(findShotAnchor(fastestReleaseShot, anchors), "fastest_release", "Fastest release", 5, 5);

  const highestArcShot = shotEvents
    .filter((shot) => shot.shotScience)
    .reduce<ShotEvent | undefined>(
      (best, shot) =>
        !best || (shot.shotScience?.arcHeightFeet ?? 0) > (best.shotScience?.arcHeightFeet ?? 0) ? shot : best,
      undefined,
    );
  addClip(findShotAnchor(highestArcShot, anchors), "highest_arc", "Highest arc", 5, 5);

  const mostActiveSample = timeline.reduce<SessionTimelineSample | undefined>(
    (best, sample) => (!best || sample.distanceTraveled > best.distanceTraveled ? sample : best),
    undefined,
  );
  if (mostActiveSample && mostActiveSample.distanceTraveled > 0) {
    addClip(
      createSyntheticClipAnchor({
        eventId: `auto:${sessionId}:most-active-period`,
        eventType: "most_active_period",
        label: "Most active period",
        muxAssetId,
        sessionId,
        sessionStartedAt,
        timestamp: mostActiveSample.timestamp,
      }),
      "most_active_period",
      "Most active period",
      8,
      8,
    );
  }

  anchors
    .filter((anchor) => ["left_frame", "recovered", "tracking_interruption"].includes(anchor.eventType))
    .forEach((anchor) => addClip(anchor, "tracking_event", "Tracking event", 4, 4));
  anchors
    .filter((anchor) => ["assist", "coach_voice", "foul", "rebound", "turnover"].includes(anchor.eventType))
    .forEach((anchor) => addClip(anchor, "tagged_event", "Tagged event", 5, 5));

  return clips.filter(
    (clip, index, allClips) =>
      allClips.findIndex((candidate) => candidate.id === clip.id && candidate.clipKind === clip.clipKind) === index,
  );
}

function summarizeShots(events: ShotEvent[]): ShotSummary {
  const makes = events.filter((event) => event.type === "make").length;
  const misses = events.filter((event) => event.type === "miss").length;
  const attempts = makes + misses;

  return {
    attempts,
    fieldGoalPercentage: attempts > 0 ? Math.round((makes / attempts) * 100) : 0,
    makes,
    misses,
  };
}

function summarizeGameResults(shotEvents: ShotEvent[], replayEvents: ReplayEvent[]): GameResults {
  const shotSummary = summarizeShots(shotEvents);

  return {
    assists: replayEvents.filter((event) => event.type === "assist").length,
    blocks: replayEvents.filter((event) => event.type === "block").length,
    fouls: replayEvents.filter((event) => event.type === "foul").length,
    makes: shotSummary.makes,
    misses: shotSummary.misses,
    rebounds: replayEvents.filter((event) => event.type === "rebound").length,
    steals: replayEvents.filter((event) => event.type === "steal").length,
    turnovers: replayEvents.filter((event) => event.type === "turnover").length,
  };
}

function summarizeOrganizationRollups(
  sessions: SavedSession[],
  activeSession: AxisSave["activeSession"],
  activeParticipantCount: number,
  now: number,
  fallbackAthleteCount: number,
): OrganizationRollups {
  const athleteIds = new Set<string>();
  let attendance = activeSession ? activeParticipantCount : 0;
  let film = activeSession?.recordingAttached ? 1 : 0;
  let makes = 0;
  let misses = 0;
  let totalSeconds = activeSession ? Math.max(0, Math.floor((now - new Date(activeSession.startedAt).getTime()) / 1000)) : 0;
  let wins = 0;

  (activeSession?.participants ?? []).forEach((participant) => athleteIds.add(participant.id));

  sessions.forEach((session) => {
    const shotSummary = session.shotSummary ?? summarizeShots(normalizeShotEvents(session.shotEvents));
    const sessionResults = summarizeGameResults(normalizeShotEvents(session.shotEvents), normalizeReplayEvents(session.replayEvents));

    makes += shotSummary.makes;
    misses += shotSummary.misses;
    totalSeconds += session.durationSeconds;
    attendance += session.activeParticipantCount || session.participantCount || session.participants?.length || 1;
    film += session.recordingAttached ? 1 : 0;
        wins += session.mode === "Game" && sessionResults.makes > sessionResults.misses ? 1 : 0;
    (session.participants ?? []).forEach((participant) => athleteIds.add(participant.id));
  });

  const sessionsCount = sessions.length + (activeSession ? 1 : 0);
  const athletes = athleteIds.size || fallbackAthleteCount;
  const hours = totalSeconds / 3600;
  const development = sessionsCount > 0 ? `${sessionsCount} sessions / ${makes + misses} attempts` : "Waiting";

  return {
    coach: {
      athletes,
      development,
      sessions: sessionsCount,
      wins,
    },
    director: {
      athletes,
      film,
      hours,
      sessions: sessionsCount,
    },
    parent: {
      attendance,
      film,
      makes,
      misses,
    },
    player: {
      attendance,
      hours,
      makes,
      misses,
    },
  };
}

function summarizeTimeline(samples: SessionTimelineSample[]): SessionTimelineSummary {
  return samples.reduce<SessionTimelineSummary>(
    (summary, sample) => ({
      directionChanges: summary.directionChanges + sample.directionChanges,
      distanceTraveled: summary.distanceTraveled + sample.distanceTraveled,
      entries: summary.entries + (sample.entered ? 1 : 0),
      exits: summary.exits + (sample.exited ? 1 : 0),
      timeMovingSeconds: summary.timeMovingSeconds + (sample.moving ? 1 : 0),
      timeStationarySeconds: summary.timeStationarySeconds + (sample.stationary ? 1 : 0),
      timeTrackedSeconds: summary.timeTrackedSeconds + (sample.tracked ? 1 : 0),
      timeVisibleSeconds: summary.timeVisibleSeconds + (sample.visible ? 1 : 0),
      trackingLosses: summary.trackingLosses + (sample.trackingLost ? 1 : 0),
      trackingRecoveries: summary.trackingRecoveries + (sample.trackingRecovered ? 1 : 0),
    }),
    {
      directionChanges: 0,
      distanceTraveled: 0,
      entries: 0,
      exits: 0,
      timeMovingSeconds: 0,
      timeStationarySeconds: 0,
      timeTrackedSeconds: 0,
      timeVisibleSeconds: 0,
      trackingLosses: 0,
      trackingRecoveries: 0,
    },
  );
}

function createRawMeasurements(summary?: SessionTimelineSummary): SessionRawMeasurements {
  return {
    distance: summary?.distanceTraveled ?? 0,
    entered: summary?.entries ?? 0,
    exited: summary?.exits ?? 0,
    lost: summary?.trackingLosses ?? 0,
    movingSeconds: summary?.timeMovingSeconds ?? 0,
    recovered: summary?.trackingRecoveries ?? 0,
    trackedSeconds: summary?.timeTrackedSeconds ?? 0,
    visibleSeconds: summary?.timeVisibleSeconds ?? 0,
  };
}

function createSessionSummaryLayer(durationSeconds: number, raw: SessionRawMeasurements): SessionSummaryLayer {
  const safeDuration = typeof durationSeconds === "number" && Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;
  const visibilityRatio = safeDuration > 0 ? raw.visibleSeconds / safeDuration : 0;
  const trackingRatio = raw.visibleSeconds > 0 ? raw.trackedSeconds / raw.visibleSeconds : 0;

  return {
    movement:
      raw.movingSeconds > 0
        ? `${formatDuration(raw.movingSeconds)} moving`
        : raw.visibleSeconds > 0
          ? "Movement quiet"
          : "Movement waiting",
    sessionLength: formatDuration(safeDuration),
    trackingQuality:
      trackingRatio >= 0.9 && raw.lost === 0
        ? "Tracking stable"
        : trackingRatio >= 0.6
          ? "Tracking partial"
        : raw.recovered > 0
          ? "Tracking recovered"
          : raw.lost > 0
            ? "Tracking interrupted"
            : "Tracking waiting",
    visibility:
      visibilityRatio >= 0.8
        ? "Visible most of session"
        : visibilityRatio > 0
          ? "Visible part of session"
          : "Visibility waiting",
  };
}

function formatSummaryLayer(summary?: SessionSummaryLayer) {
  if (!summary) return "";

  return `${summary.sessionLength} / ${summary.movement} / ${summary.trackingQuality} / ${summary.visibility}`;
}

function formatRawMeasurements(raw?: SessionRawMeasurements) {
  if (!raw) return "";

  return `Raw: Visible ${formatDuration(raw.visibleSeconds)} / Tracked ${formatDuration(raw.trackedSeconds)} / Moving ${formatDuration(
    raw.movingSeconds,
  )} / Distance ${raw.distance.toFixed(2)} / Entered ${raw.entered} / Exited ${raw.exited} / Lost ${raw.lost} / Recovered ${raw.recovered}`;
}

function formatBallTimeline(timeline?: BallTimelineSample[]) {
  if (!timeline?.length) return "Ball timeline: none";

  const visibleSamples = timeline.filter((sample) => sample.visible).length;
  const latestVisible = [...timeline].reverse().find((sample) => sample.visible && sample.position);

  return `Ball timeline: ${visibleSamples}/${timeline.length} visible${
    latestVisible?.position
      ? ` / Last ${latestVisible.position.x.toFixed(2)}, ${latestVisible.position.y.toFixed(2)}`
      : ""
  }`;
}

function getReplayCount(events: ReplayEvent[] | undefined, type: ReplayEventType) {
  return events?.filter((event) => event.type === type).length ?? 0;
}

function formatShotSummary(summary?: ShotSummary) {
  if (!summary || summary.attempts === 0) return "Shots waiting";

  return `${summary.makes} makes / ${summary.misses} misses / ${summary.attempts} attempts / ${summary.fieldGoalPercentage}% FG`;
}

function formatActivePeriod(session: SavedSession) {
  const movingSeconds = session.rawMeasurements?.movingSeconds ?? session.timelineSummary?.timeMovingSeconds ?? 0;

  if (movingSeconds > 0) return `${formatDuration(movingSeconds)} moving`;
  if (session.durationSeconds > 0) return `${formatDuration(session.durationSeconds)} captured`;

  return "Work captured";
}

function formatShotResults(summary?: ShotSummary) {
  if (!summary || summary.attempts === 0) return "No shots recorded";

  return `${summary.makes}/${summary.attempts} makes`;
}

function getWorkDetectionState({
  athleteDetected,
  isShooting,
  track,
}: {
  athleteDetected: boolean;
  isShooting: boolean;
  track: PlayerTrack | null;
}): WorkDetectionState {
  if (isShooting) return "SHOOTING";
  if (track?.status !== "lost" && track?.movement.moving) return "MOVING";
  if (athleteDetected || (track && track.status !== "lost")) return "ACTIVE";

  return "IDLE";
}

function formatReplaySummary(events?: ReplayEvent[]) {
  if (!events?.length) return "Session review waiting";

  return `Review ${events.length} / Makes ${getReplayCount(events, "make")} / Misses ${getReplayCount(
    events,
    "miss",
  )} / Left ${getReplayCount(events, "left_frame")} / Recovered ${getReplayCount(
    events,
    "recovered",
  )} / Voice ${getReplayCount(events, "coach_voice")}`;
}

function formatReplayEvent(event: ReplayEvent) {
  const trackLabel = event.trackState.trackId ? ` / ${event.trackState.trackId}` : "";
  const movement = typeof event.movementDistance === "number" ? ` / ${event.movementDistance.toFixed(2)}` : "";

  return `${formatTime(event.timestamp)} / ${event.athleteName}${trackLabel} / ${event.cameraDirection} camera${movement}`;
}

function formatReplayAnchor(anchor: ReplayAnchor) {
  const athlete = anchor.athleteName ? ` / ${anchor.athleteName}` : "";
  const mux = anchor.muxAssetId === "pending" ? " / Video pending" : ` / ${anchor.muxAssetId}`;

  return `${formatDuration(anchor.videoTimestamp)}${athlete}${mux}`;
}

function formatHumanMomentLabel(anchor: ReplayAnchor) {
  if (anchor.eventType === "session_start") return "Start";
  if (anchor.eventType === "session_end") return "End";
  if (anchor.eventType === "identity_locked") return "Player Ready";
  if (anchor.eventType === "make") return "Make";
  if (anchor.eventType === "miss") return "Miss";
  if (anchor.eventType === "rebound") return "Rebound";
  if (anchor.eventType === "assist") return "Assist";
  if (anchor.eventType === "turnover") return "Turnover";
  if (anchor.eventType === "foul") return "Foul";
  if (anchor.eventType === "shot_gather") return "Shot Taken";
  if (anchor.eventType === "shot_release") return "Release";
  if (anchor.eventType === "shot_arc") return "Arc";
  if (anchor.eventType === "rim_contact") return "Rim";
  if (anchor.eventType === "shot_attempt") return "Shot";
  if (anchor.eventType === "ball_visible") return "Ball in Play";
  if (anchor.eventType === "ball_lost") return "Ball Out of Frame";
  if (anchor.eventType === "ball_recovered") return "Ball Back";
  if (anchor.eventType === "coach_voice") return "Coach Note";
  if (anchor.eventType === "recovered") return "Back in Frame";
  if (anchor.eventType === "left_frame") return "Out of Frame";

  return "Moment";
}

function shouldShowFilmTimelineAnchor(anchor: ReplayAnchor) {
  return (
    anchor.eventType === "session_start" ||
    anchor.eventType === "session_end" ||
    anchor.eventType === "make" ||
    anchor.eventType === "miss" ||
    anchor.eventType === "rebound" ||
    anchor.eventType === "assist" ||
    anchor.eventType === "possession" ||
    anchor.eventType === "foul" ||
    anchor.eventType === "turnover" ||
    anchor.eventType === "shot_gather" ||
    anchor.eventType === "shot_release" ||
    anchor.eventType === "shot_arc" ||
    anchor.eventType === "rim_contact" ||
    anchor.eventType === "shot_attempt" ||
    anchor.eventType === "ball_visible" ||
    anchor.eventType === "ball_lost" ||
    anchor.eventType === "ball_recovered" ||
    anchor.eventType === "coach_voice"
  );
}

function getFilmAnchorsByType(anchors: ReplayAnchor[], type: WatchEventType) {
  return anchors.filter((anchor) => anchor.eventType === type);
}

function shouldShowFilmOverlayAnchor(anchor: ReplayAnchor) {
  return ["assist", "foul", "make", "miss", "rebound", "turnover"].includes(anchor.eventType);
}

function getMuxThumbnailUrl(playbackId?: string) {
  return playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : undefined;
}

function getMuxStreamUrl(playbackId?: string) {
  return playbackId ? `https://stream.mux.com/${playbackId}` : undefined;
}

function getMuxDownloadUrl(playbackId?: string) {
  return playbackId ? `https://stream.mux.com/${playbackId}/download.mp4` : undefined;
}

const exportFilmTypes: Array<{ type: SessionExportType; label: string }> = [
  { type: "raw_video", label: "ORIGINAL FILM" },
  { type: "overlay_video", label: "OVERLAY FILM" },
  { type: "shot_science_video", label: "HIGHLIGHTS" },
  { type: "vertical_social_clip", label: "SOCIAL" },
];

function getFilmPlaybackId(session?: Pick<SavedSession, "muxPlaybackId" | "recordingAttached"> | null) {
  if (!session?.recordingAttached) return undefined;

  return session.muxPlaybackId;
}

function getFilmAvailability(session?: Pick<SavedSession, "muxPlaybackId" | "recordingAttached"> | null) {
  if (!session?.recordingAttached) return "No film";
  if (getFilmPlaybackId(session)) return "Film ready";

  return "Film saved";
}

function getSupportedVideoMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function formatReplayClip(clip: ReplayClip) {
  const mux = clip.muxAssetId === "pending" ? "Video pending" : clip.muxAssetId;

  return `${formatDuration(clip.clipStart)} - ${formatDuration(clip.clipEnd)} / ${mux}`;
}

function formatAthleteGrowth(memory: AthleteMemory) {
  if (!memory.sessions.length) return "Memory waiting";

  const totalSeconds = memory.sessions.reduce((total, session) => total + session.durationSeconds, 0);
  const movementSeconds = memory.movementSamples.filter((sample) => sample.moving).length;

  return `${memory.sessions.length} sessions / ${formatDuration(totalSeconds)} / ${formatDuration(movementSeconds)} moving`;
}

function formatTrackingTimelineEvent(sample: SessionTimelineSample) {
  if (sample.trackingLost) return "Track lost";
  if (sample.trackingRecovered) return "Track recovered";
  if (sample.entered) return "Entered frame";
  if (sample.exited) return "Exited frame";

  return "Tracking saved";
}

function formatShotEvent(event: ShotEvent) {
  const science = event.shotScience
    ? ` / ${event.shotScience.releaseAngle} deg / ${event.shotScience.shotDistance} ft`
    : "";

  return `${formatDuration(event.replayTimestamp)} / ${event.athleteName} / ${event.cameraDirection} camera${science}`;
}

function formatShotScience(science?: ShotScience) {
  if (!science) return "Shot science waiting";

  return `${science.releaseAngle} deg / ${science.arcHeight}% arc / ${science.flightTime}s flight`;
}

function formatFilmTimestamp(totalSeconds?: number) {
  if (typeof totalSeconds !== "number" || !Number.isFinite(totalSeconds)) return "--";

  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
}

function formatWorkMinutes(totalSeconds?: number) {
  if (typeof totalSeconds !== "number" || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0m";

  return `${Math.max(1, Math.round(totalSeconds / 60))}m`;
}

function getLongestMakeStreak(events?: ShotEvent[]) {
  if (!events?.length) return 0;

  return events.reduce(
    (streak, event) => {
      const current = event.type === "make" ? streak.current + 1 : 0;

      return {
        current,
        longest: Math.max(streak.longest, current),
      };
    },
    { current: 0, longest: 0 },
  ).longest;
}

function getNextMakeStreak(events: ShotEvent[], type: ShotType) {
  if (type === "miss") return 0;

  let streak = 1;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].type !== "make") break;
    streak += 1;
  }

  return streak;
}

function formatShotScienceRelease(science?: ShotScience) {
  if (!science) return "--";

  return `${science.releaseAngle}\u00b0 release`;
}

function formatShotScienceApex(science?: ShotScience) {
  if (!science) return "--";

  const apexFeet = science.arcHeightFeet ?? Math.max(0, ((science.releaseHeight + science.arcHeight) / 100) * 10);

  return `${apexFeet.toFixed(1)}ft apex`;
}

function formatShotScienceArc(science?: ShotScience) {
  if (!science) return "--";

  return `${science.arcHeightFeet.toFixed(1)} ft arc`;
}

function formatShotScienceReleaseTime(science?: ShotScience) {
  if (!science) return "--";

  return `${science.releaseTime.toFixed(2)} release`;
}

function formatShotScienceEntry(science?: ShotScience) {
  if (!science) return "--";

  return `${science.entryAngle}\u00b0 entry`;
}

function formatShotScienceDistance(science?: ShotScience) {
  if (!science) return "--";

  return `${science.shotDistance.toFixed(0)} ft distance`;
}

function formatShotConfidence(confidence?: number) {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return "-- confidence";

  return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}% confidence`;
}

function averageNumbers(values: Array<number | undefined>) {
  const realValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!realValues.length) return null;

  return Math.round((realValues.reduce((total, value) => total + value, 0) / realValues.length) * 100) / 100;
}

function createPlayerReport(session: SavedSession, shots: ShotEvent[], shotSummary: ShotSummary, clips: ReplayClip[]): PlayerReport {
  const primaryParticipant = session.participants?.[0];
  const playerId = primaryParticipant?.id ?? shots.find((shot) => shot.athleteId)?.athleteId;
  const playerName = primaryParticipant?.name ?? shots.find((shot) => shot.athleteName)?.athleteName ?? "Athlete";
  const hasShots = shots.length > 0;
  const hasFilm = Boolean(session.muxPlaybackId || session.muxAssetId || session.recordingAttached);
  const progressGraph = shots.map((shot, index) => {
    const shotSlice = shots.slice(0, index + 1);
    const summary = summarizeShots(shotSlice);

    return {
      attempts: summary.attempts,
      fieldGoalPercentage: summary.fieldGoalPercentage,
      makes: summary.makes,
      timestamp: shot.timestamp,
    };
  });
  const reportOutputs: SessionExportOutput[] = [
    {
      label: sessionExportLabels.player_report,
      sourceCount: shots.length + clips.length,
      status: hasFilm ? "processing" : hasShots ? "processing" : "waiting",
      type: "player_report",
    },
  ];

  return {
    attendance: session.participantCount ?? session.participants?.length ?? 1,
    averageReleaseAngle: averageNumbers(shots.map((shot) => shot.shotScience?.releaseAngle)),
    averageReleaseSpeed: averageNumbers(shots.map((shot) => shot.shotScience?.releaseSpeed)),
    averageReleaseTime: averageNumbers(shots.map((shot) => shot.shotScience?.releaseTime)),
    fieldGoalPercentage: shotSummary.fieldGoalPercentage,
    makes: shotSummary.makes,
    misses: shotSummary.misses,
    outputs: reportOutputs,
    playerId,
    playerName,
    progressGraph,
    releaseMetrics: shots.map((shot) => ({
      attemptNumber: shot.attemptNumber,
      arcHeightFeet: shot.shotScience?.arcHeightFeet,
      entryAngle: shot.shotScience?.entryAngle,
      releaseAngle: shot.shotScience?.releaseAngle,
      releaseSpeed: shot.shotScience?.releaseSpeed,
      releaseTime: shot.shotScience?.releaseTime,
    })),
    sessionHours: Math.round((session.durationSeconds / 3600) * 100) / 100,
    shotLocations: shots.map((shot) => ({
      attemptNumber: shot.attemptNumber,
      distance: shot.shotScience?.shotDistance,
      x: shot.shotScience?.releasePoint.x,
      y: shot.shotScience?.releasePoint.y,
    })),
    timeline: shots.map((shot) => ({
      label: shot.type === "make" ? "Make" : "Miss",
      timestamp: shot.timestamp,
      videoTimestamp: shot.replayTimestamp,
    })),
    totalAttempts: shotSummary.attempts,
  };
}

function createAxisCapabilityPipeline({
  clips,
  events,
  hasMuxAsset,
  hasPlayableFilm,
  overlays,
  session,
  shots,
}: {
  clips: ReplayClip[];
  events: ReplayEvent[];
  hasMuxAsset: boolean;
  hasPlayableFilm: boolean;
  overlays: ReplayAnchor[];
  session: SavedSession;
  shots: ShotEvent[];
}): AxisCapabilityStage[] {
  const timeline = normalizeTimeline(session.timeline);
  const ballTimeline = normalizeBallTimeline(session.ballTimeline);
  const hasTrackedPlayer = timeline.some((sample) => sample.tracked || sample.visible);
  const hasBallSignal = ballTimeline.some((sample) => sample.visible);
  const hasHoopSignal = shots.some((shot) => Boolean(shot.shotScience?.entryPoint));
  const hasEvents = events.length > 0 || overlays.length > 0 || shots.length > 0;
  const participantCount = session.participants?.length ?? session.participantCount ?? 0;
  const videoStatus: SessionExportOutput["status"] = hasPlayableFilm ? "available" : hasMuxAsset ? "processing" : "waiting";
  const detectionStatus = (ready: boolean): SessionExportOutput["status"] => {
    if (ready) return "available";
    if (hasPlayableFilm || hasMuxAsset) return "processing";

    return "waiting";
  };

  return [
    {
      capability: "Interpretation, summaries, reports",
      outputs: ["Player Report", "Coach Report"],
      provider: "openai",
      sourceCount: events.length + shots.length,
      status: hasEvents ? "processing" : "waiting",
    },
    {
      capability: "Detection",
      outputs: ["Player", "Ball", "Hoop"],
      provider: "roboflow",
      sourceCount: Number(hasPlayableFilm || hasMuxAsset),
      status: videoStatus,
    },
    {
      capability: "Ball, player, hoop",
      outputs: ["Ball Location", "Player Location", "Hoop Location", "Shot Evidence"],
      provider: "rf_detr",
      sourceCount: Number(hasTrackedPlayer) + Number(hasBallSignal) + Number(hasHoopSignal),
      status: detectionStatus(hasTrackedPlayer || hasBallSignal || hasHoopSignal),
    },
    {
      capability: "Identity persistence",
      outputs: ["Stable Athlete Track", "Tracking Recovery", "Session Measurements"],
      provider: "bytetrack",
      sourceCount: participantCount || Number(hasTrackedPlayer),
      status: detectionStatus(hasTrackedPlayer),
    },
    {
      capability: "Video pipeline, playback, export factory",
      outputs: ["Raw Video", "Overlay Video", "Shot Science Video", "Vertical Social Clip", "Player Report", "Coach Report"],
      provider: "mux",
      sourceCount: Number(hasMuxAsset) + clips.length,
      status: videoStatus,
    },
    {
      capability: "Storage, session objects",
      outputs: ["Work", "Film", "Events", "Intelligent Film"],
      provider: "supabase",
      sourceCount: Number(Boolean(session.id)) + events.length + shots.length,
      status: session.id ? "available" : "waiting",
    },
  ];
}

function createSessionExportObject(session: SavedSession): SessionExportObject {
  const events = normalizeReplayEvents(session.replayEvents);
  const shots = normalizeShotEvents(session.shotEvents);
  const overlays = normalizeReplayAnchors(session.replayAnchors);
  const clips = normalizeReplayClips(session.replayClips);
  const shotSummary = session.shotSummary ?? summarizeShots(shots);
  const game = summarizeGameResults(shots, events);
  const playerReport = createPlayerReport(session, shots, shotSummary, clips);
  const hasMuxAsset = Boolean(session.muxAssetId);
  const hasPlayableFilm = Boolean(session.muxPlaybackId);
  const hasMuxExportSource = hasPlayableFilm || hasMuxAsset || session.recordingAttached;
  const hasEvents = events.length > 0 || overlays.length > 0;
  const getExportStatus = (hasSource: boolean): SessionExportOutput["status"] => {
    if (hasPlayableFilm && hasSource) return "available";
    if (hasMuxExportSource && hasSource) return "processing";

    return "waiting";
  };
  const exports: SessionExportOutput[] = [
    {
      label: sessionExportLabels.raw_video,
      sourceCount: hasMuxExportSource ? 1 : 0,
      status: getExportStatus(true),
      type: "raw_video",
    },
    {
      label: sessionExportLabels.overlay_video,
      sourceCount: overlays.length,
      status: getExportStatus(true),
      type: "overlay_video",
    },
    {
      label: sessionExportLabels.shot_science_video,
      sourceCount: shots.length,
      status: getExportStatus(true),
      type: "shot_science_video",
    },
    {
      label: sessionExportLabels.vertical_social_clip,
      sourceCount: clips.length,
      status: getExportStatus(true),
      type: "vertical_social_clip",
    },
    {
      label: sessionExportLabels.player_report,
      sourceCount: shots.length + clips.length,
      status: hasMuxExportSource || hasEvents || shots.length ? "processing" : "waiting",
      type: "player_report",
    },
    {
      label: sessionExportLabels.coach_report,
      sourceCount: events.length + shots.length,
      status: hasMuxExportSource || hasEvents || shots.length ? "processing" : "waiting",
      type: "coach_report",
    },
  ];

  return {
    clips,
    events,
    exports,
    metrics: {
      game,
      longestMakeStreak: getLongestMakeStreak(shots),
      shotSummary,
      workTimeSeconds: session.durationSeconds,
    },
    overlays,
    pipeline: createAxisCapabilityPipeline({
      clips,
      events,
      hasMuxAsset,
      hasPlayableFilm,
      overlays,
      session,
      shots,
    }),
    playerReport,
    session: {
      endedAt: session.endedAt,
      id: session.id,
      startedAt: session.startedAt,
      type: session.mode ?? defaultParticipationMode,
    },
    shots,
    video: {
      available: hasPlayableFilm,
      muxAssetId: session.muxAssetId,
      playbackId: session.muxPlaybackId,
      thumbnailUrl: session.thumbnailUrl,
    },
  };
}

function normalizeRawMeasurements(raw: unknown, fallback: SessionRawMeasurements): SessionRawMeasurements {
  if (!raw || typeof raw !== "object") return fallback;

  const candidate = raw as Partial<SessionRawMeasurements>;

  return {
    distance: typeof candidate.distance === "number" ? candidate.distance : fallback.distance,
    entered: typeof candidate.entered === "number" ? candidate.entered : fallback.entered,
    exited: typeof candidate.exited === "number" ? candidate.exited : fallback.exited,
    lost: typeof candidate.lost === "number" ? candidate.lost : fallback.lost,
    movingSeconds: typeof candidate.movingSeconds === "number" ? candidate.movingSeconds : fallback.movingSeconds,
    recovered: typeof candidate.recovered === "number" ? candidate.recovered : fallback.recovered,
    trackedSeconds: typeof candidate.trackedSeconds === "number" ? candidate.trackedSeconds : fallback.trackedSeconds,
    visibleSeconds: typeof candidate.visibleSeconds === "number" ? candidate.visibleSeconds : fallback.visibleSeconds,
  };
}

function normalizeSummaryLayer(summary: unknown, fallback: SessionSummaryLayer): SessionSummaryLayer {
  if (!summary || typeof summary !== "object") return fallback;

  const candidate = summary as Partial<SessionSummaryLayer>;

  return {
    movement: typeof candidate.movement === "string" ? candidate.movement : fallback.movement,
    sessionLength: typeof candidate.sessionLength === "string" ? candidate.sessionLength : fallback.sessionLength,
    trackingQuality: typeof candidate.trackingQuality === "string" ? candidate.trackingQuality : fallback.trackingQuality,
    visibility: typeof candidate.visibility === "string" ? candidate.visibility : fallback.visibility,
  };
}

function identityFromAxisIdentity(identity: AxisIdentity): AthleteIdentity {
  const label = identity.email.split("@")[0] || "Athlete";

  return {
    id: identity.id,
    name: label,
    rosterCode: identity.id.slice(0, 8).toUpperCase(),
    calibrationAnchorId: `calibration:${organizationSlug}:${identity.id}`,
  };
}

function sessionIncludesAthlete(session: SavedSession, athlete: AthleteIdentity) {
  return Boolean(
    session.participants?.some((participant) => participant.id === athlete.id) ||
      session.replayEvents?.some((event) => event.athleteId === athlete.id || event.athleteName === athlete.name) ||
      session.replayAnchors?.some((anchor) => anchor.athleteId === athlete.id || anchor.athleteName === athlete.name) ||
      session.shotEvents?.some((event) => event.athleteId === athlete.id || event.athleteName === athlete.name),
  );
}

function buildAthleteMemory(athlete: AthleteIdentity | null, sessions: SavedSession[]): AthleteMemory {
  if (!athlete) {
    return {
      athleteId: "",
      athleteName: "Athlete",
      clips: [],
      events: [],
      movementSamples: [],
      replayAnchors: [],
      sessions: [],
      trackingEvents: [],
    };
  }

  const athleteSessions = sessions.filter((session) => sessionIncludesAthlete(session, athlete));
  const events = athleteSessions.flatMap((session) =>
    (session.replayEvents ?? []).filter((event) => event.athleteId === athlete.id || event.athleteName === athlete.name),
  );
  const eventIds = new Set(events.map((event) => event.id));
  const replayAnchors = athleteSessions.flatMap((session) =>
    (session.replayAnchors ?? []).filter(
      (anchor) =>
        anchor.athleteId === athlete.id ||
        anchor.athleteName === athlete.name ||
        eventIds.has(anchor.eventId) ||
        anchor.eventType === "session_start" ||
        anchor.eventType === "session_end",
    ),
  );
  const anchorEventIds = new Set(replayAnchors.map((anchor) => anchor.eventId));
  const clips = athleteSessions.flatMap((session) =>
    (session.replayClips ?? []).filter((clip) => eventIds.has(clip.eventId) || anchorEventIds.has(clip.eventId)),
  );
  const movementSamples = athleteSessions.flatMap((session) =>
    (session.timeline ?? []).filter((sample) => sample.athleteId === athlete.id),
  );
  const trackingEvents = movementSamples.filter(
    (sample) => sample.entered || sample.exited || sample.trackingLost || sample.trackingRecovered,
  );

  return {
    athleteId: athlete.id,
    athleteName: athlete.name,
    clips,
    events,
    movementSamples,
    replayAnchors,
    sessions: athleteSessions,
    trackingEvents,
  };
}

function normalizeActiveParticipant(participant: unknown): ActiveParticipant | null {
  if (typeof participant === "string") return null;

  if (!participant || typeof participant !== "object") return null;

  const candidate = participant as Partial<ActiveParticipant>;
  if (!candidate.id || !candidate.name) return null;
  if (candidate.id.startsWith(`${organizationSlug}-`) && candidate.rosterCode?.startsWith("BR-")) return null;

  return {
    id: candidate.id,
    name: candidate.name,
    rosterCode: candidate.rosterCode ?? candidate.id.slice(0, 8).toUpperCase(),
    calibrationAnchorId: candidate.calibrationAnchorId ?? `calibration:${organizationSlug}:${candidate.id}`,
    joinedAt: candidate.joinedAt ?? new Date().toISOString(),
    leftAt: candidate.leftAt,
    calibrationStatus: normalizeCalibrationStatus(candidate.calibrationStatus),
    calibratedAt: candidate.calibratedAt,
    calibrationEvidence: candidate.calibrationEvidence,
  };
}

function normalizeSessionParticipant(participant: unknown): SessionParticipant | null {
  const activeParticipant = normalizeActiveParticipant(participant);
  if (!activeParticipant) return null;

  const candidate = typeof participant === "object" && participant ? (participant as Partial<SessionParticipant>) : {};

  return {
    ...activeParticipant,
    calibrationStatus: normalizeCalibrationStatus(candidate.calibrationStatus ?? activeParticipant.calibrationStatus),
    calibratedAt: candidate.calibratedAt ?? activeParticipant.calibratedAt,
    calibrationEvidence: candidate.calibrationEvidence ?? activeParticipant.calibrationEvidence,
    activeAtCheckout: Boolean(candidate.activeAtCheckout ?? !activeParticipant.leftAt),
  };
}

function isActiveParticipant(participant: ActiveParticipant | null): participant is ActiveParticipant {
  return Boolean(participant);
}

function isSessionParticipant(participant: SessionParticipant | null): participant is SessionParticipant {
  return Boolean(participant);
}

function normalizeCalibrationStatus(status: unknown): CalibrationStatus {
  return status === "calibrated" ? "calibrated" : "required";
}

function normalizeCameraState(state: unknown): CameraState {
  if (state === "attached" || state === "ready") return state;

  return "offline";
}

function normalizeCameraDirection(direction: unknown): CameraDirection {
  return direction === "front" ? "front" : "back";
}

function normalizeRimLock(lock: unknown): RimLock | undefined {
  if (!lock || typeof lock !== "object") return undefined;

  const candidate = lock as Partial<RimLock>;
  const center =
    candidate.center && typeof candidate.center.x === "number" && typeof candidate.center.y === "number"
      ? candidate.center
      : null;
  const width = typeof candidate.width === "number" && Number.isFinite(candidate.width) ? candidate.width : 0;
  const height = typeof candidate.height === "number" && Number.isFinite(candidate.height) ? candidate.height : 0;
  if (!center || width <= 0 || height <= 0 || typeof candidate.sessionId !== "string") return undefined;

  const polygon = Array.isArray(candidate.polygon)
    ? candidate.polygon
        .filter(
          (point): point is { x: number; y: number } =>
            Boolean(point) && typeof point.x === "number" && typeof point.y === "number",
        )
        .slice(0, 8)
    : [];

  return {
    cameraDirection: normalizeCameraDirection(candidate.cameraDirection),
    center: {
      x: Math.max(0, Math.min(1, center.x)),
      y: Math.max(0, Math.min(1, center.y)),
    },
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
    height: Math.max(0.025, Math.min(0.3, height)),
    id: typeof candidate.id === "string" ? candidate.id : `rim:${candidate.sessionId}`,
    polygon: polygon.length
      ? polygon
      : [
          { x: Math.max(0, center.x - width / 2), y: Math.max(0, center.y - height / 2) },
          { x: Math.min(1, center.x + width / 2), y: Math.max(0, center.y - height / 2) },
          { x: Math.min(1, center.x + width / 2), y: Math.min(1, center.y + height / 2) },
          { x: Math.max(0, center.x - width / 2), y: Math.min(1, center.y + height / 2) },
        ],
    sessionId: candidate.sessionId,
    width: Math.max(0.04, Math.min(0.4, width)),
  };
}

function buildRimPolygon(center: { x: number; y: number }, width: number, height: number) {
  return [
    { x: Math.max(0, center.x - width / 2), y: Math.max(0, center.y - height / 2) },
    { x: Math.min(1, center.x + width / 2), y: Math.max(0, center.y - height / 2) },
    { x: Math.min(1, center.x + width / 2), y: Math.min(1, center.y + height / 2) },
    { x: Math.max(0, center.x - width / 2), y: Math.min(1, center.y + height / 2) },
  ];
}

function formatCameraState(state: unknown) {
  const normalizedState = normalizeCameraState(state);

  if (normalizedState === "attached") return "Camera attached";
  if (normalizedState === "ready") return "Camera ready";

  return "Camera offline";
}

function formatCameraDirection(direction: unknown) {
  return normalizeCameraDirection(direction) === "front" ? "Front camera" : "Back camera";
}

function normalizeParticipationWindow(
  window: unknown,
  openedAt: string,
  context: ParticipationMode,
  participants: ActiveParticipant[] | SessionParticipant[],
): ParticipationWindow {
  const candidate =
    window && typeof window === "object" ? (window as Partial<ParticipationWindow>) : {};

  return {
    openedAt: candidate.openedAt ?? openedAt,
    closedAt: candidate.closedAt,
    status: candidate.status === "closed" ? "closed" : "open",
    context: candidate.context ?? context,
    participantIds: Array.isArray(candidate.participantIds)
      ? candidate.participantIds
      : participants.filter((participant) => !participant.leftAt).map((participant) => participant.id),
  };
}

function createClipContinuityContext(
  sessionId: string,
  mode: ParticipationMode,
  cameraState: CameraState,
  cameraDirection: CameraDirection,
  cameraAttachedAt: string | undefined,
  participationWindow: ParticipationWindow,
  participants: ActiveParticipant[] | SessionParticipant[],
): ClipContinuityContext {
  const activeParticipants = participants.filter((participant) => !participant.leftAt);

  return {
    inheritedFromSessionId: sessionId,
    activeParticipantIds: activeParticipants.map((participant) => participant.id),
    calibratedParticipantIds: activeParticipants
      .filter((participant) => normalizeCalibrationStatus(participant.calibrationStatus) === "calibrated")
      .map((participant) => participant.id),
    cameraAttached: cameraState === "attached",
    cameraState,
    cameraDirection,
    cameraAttachedAt,
    mode,
    participationWindow,
    rosterSnapshot: participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      calibrationStatus: normalizeCalibrationStatus(participant.calibrationStatus),
      activeInWindow: !participant.leftAt,
    })),
  };
}

function dayKey(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function calculateStreak(sessions: SavedSession[]) {
  const sessionDays = new Set(sessions.map((session) => dayKey(session.endedAt)));
  let cursor = new Date();
  let streak = 0;

  while (sessionDays.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  return streak;
}

function readSave(): AxisSave {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return defaultSave;

    const parsed = JSON.parse(stored) as Partial<AxisSave>;

    const activeParticipants = Array.isArray(parsed.activeSession?.participants)
      ? parsed.activeSession.participants.map(normalizeActiveParticipant).filter(isActiveParticipant)
      : [];
    const activeMode = parsed.activeSession?.mode ?? defaultParticipationMode;
    const activeCameraState = normalizeCameraState(parsed.activeSession?.cameraState);
    const activeCameraDirection = normalizeCameraDirection(parsed.activeSession?.cameraDirection);
    const activeParticipationWindow = normalizeParticipationWindow(
      parsed.activeSession?.participationWindow,
      parsed.activeSession?.startedAt ?? new Date().toISOString(),
      activeMode,
      activeParticipants,
    );
    const activeSession = parsed.activeSession
      ? {
          id: parsed.activeSession.id,
          startedAt: parsed.activeSession.startedAt,
          mode: activeMode,
          recordingAttached: Boolean(parsed.activeSession.recordingAttached),
          calibrationStatus: normalizeCalibrationStatus(parsed.activeSession.calibrationStatus),
          cameraState: activeCameraState,
          cameraDirection: activeCameraDirection,
          cameraAttachedAt: parsed.activeSession.cameraAttachedAt,
          muxAssetId: parsed.activeSession.muxAssetId,
          muxPlaybackId: parsed.activeSession.muxPlaybackId,
          thumbnailUrl: parsed.activeSession.thumbnailUrl,
          rimLock: normalizeRimLock(parsed.activeSession.rimLock),
          calibrationRecords: Array.isArray(parsed.activeSession.calibrationRecords)
            ? parsed.activeSession.calibrationRecords
            : [],
          participationWindow: activeParticipationWindow,
          clipContinuityContext: createClipContinuityContext(
            parsed.activeSession.id,
            activeMode,
            activeCameraState,
            activeCameraDirection,
            parsed.activeSession.cameraAttachedAt,
            activeParticipationWindow,
            activeParticipants,
          ),
          participants: activeParticipants,
          timeline: normalizeTimeline(parsed.activeSession.timeline),
          ballTimeline: normalizeBallTimeline(parsed.activeSession.ballTimeline),
          replayAnchors: normalizeReplayAnchors(parsed.activeSession.replayAnchors),
          replayClips: normalizeReplayClips(parsed.activeSession.replayClips),
          replayEvents: normalizeReplayEvents(parsed.activeSession.replayEvents),
          shotEvents: normalizeShotEvents(parsed.activeSession.shotEvents),
        }
      : null;

    return {
      activeSession,
      sessions: Array.isArray(parsed.sessions)
        ? parsed.sessions.map((session) => {
            const sessionParticipants = Array.isArray(session.participants)
              ? session.participants.map(normalizeSessionParticipant).filter(isSessionParticipant)
              : [];
            const sessionMode = session.mode ?? defaultParticipationMode;
            const sessionCameraState = normalizeCameraState(session.cameraState);
            const sessionCameraDirection = normalizeCameraDirection(session.cameraDirection);
            const sessionParticipationWindow = normalizeParticipationWindow(
              session.participationWindow,
              session.startedAt,
              sessionMode,
              sessionParticipants,
            );
            const timeline = normalizeTimeline(session.timeline);
            const timelineSummary = session.timelineSummary ?? summarizeTimeline(timeline);
            const rawMeasurements = normalizeRawMeasurements(session.rawMeasurements, createRawMeasurements(timelineSummary));
            const summaryLayer = normalizeSummaryLayer(
              session.summaryLayer,
              createSessionSummaryLayer(session.durationSeconds, rawMeasurements),
            );
            const replayEvents =
              normalizeReplayEvents(session.replayEvents).length > 0
                ? normalizeReplayEvents(session.replayEvents)
                : createReplayEvents(timeline, sessionParticipants, sessionCameraDirection);
            const shotEvents = normalizeShotEvents(session.shotEvents);
            const replayAnchors =
              normalizeReplayAnchors(session.replayAnchors).length > 0
                ? normalizeReplayAnchors(session.replayAnchors)
                : createReplayAnchorsForSession({
                    ...session,
                    cameraDirection: sessionCameraDirection,
                    participants: sessionParticipants,
                    replayEvents,
                    shotEvents,
                  });
            const replayClips =
              normalizeReplayClips(session.replayClips).length > 0
                ? normalizeReplayClips(session.replayClips)
                : createAutomaticReplayClips({
                    anchors: replayAnchors,
                    muxAssetId: session.muxAssetId,
                    sessionId: session.id,
                    sessionStartedAt: session.startedAt,
                    shotEvents,
                    timeline,
                  });

            return {
              ...session,
              mode: sessionMode,
              calibrationStatus: normalizeCalibrationStatus(session.calibrationStatus),
              cameraState: sessionCameraState,
              cameraDirection: sessionCameraDirection,
              cameraAttachedAt: session.cameraAttachedAt,
              muxAssetId: session.muxAssetId,
              muxPlaybackId: session.muxPlaybackId,
              thumbnailUrl: session.thumbnailUrl,
              rimLock: normalizeRimLock(session.rimLock),
              participationWindow: sessionParticipationWindow,
              clipContinuityContext: createClipContinuityContext(
                session.id,
                sessionMode,
                sessionCameraState,
                sessionCameraDirection,
                session.cameraAttachedAt,
                sessionParticipationWindow,
                sessionParticipants,
              ),
              participants: sessionParticipants,
              timeline,
              timelineSummary,
              rawMeasurements,
              summaryLayer,
              ballTimeline: normalizeBallTimeline(session.ballTimeline),
              replayAnchors,
              replayClips,
              replayEvents,
              review: normalizeSessionReview(session.review),
              shotEvents,
              shotSummary: session.shotSummary ?? summarizeShots(shotEvents),
            };
          })
        : [],
    };
  } catch {
    return defaultSave;
  }
}

function writeSave(save: AxisSave) {
  window.localStorage.setItem(storageKey, JSON.stringify(save));
}

function readIdentity(): AxisIdentity | null {
  try {
    const stored = window.localStorage.getItem(identityStorageKey);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<AxisIdentity>;
    if (!parsed.email || !parsed.restoredAt) return null;

    return {
      email: parsed.email,
      id: parsed.id ?? parsed.email,
      restoredAt: parsed.restoredAt,
      calibrationStatus: normalizeCalibrationStatus(parsed.calibrationStatus),
      calibratedAt: parsed.calibratedAt,
      calibrationSessionId: parsed.calibrationSessionId,
    };
  } catch {
    return null;
  }
}

function writeIdentity(identity: AxisIdentity) {
  window.localStorage.setItem(identityStorageKey, JSON.stringify(identity));
}

export function RitualHome() {
  const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
  const timelineCursorRef = useRef<TimelineCursor>({
    previousLostCount: 0,
    previousRecoveryCount: 0,
    totalDistanceTraveled: 0,
  });
  const latestBallTrackingRef = useRef<BallTrackingState>({
    confidence: 0,
    lostCount: 0,
    recoveryCount: 0,
    status: "lost",
    trajectory: [],
    visible: false,
  });
  const previousBallEventStateRef = useRef<"lost" | "tracked" | null>(null);
  const lastShotAttemptAtRef = useRef(0);
  const pendingShotAttemptRef = useRef<PendingShotAttempt | null>(null);
  const filmChunksRef = useRef<Blob[]>([]);
  const filmRecorderRef = useRef<MediaRecorder | null>(null);
  const filmRecordingSessionIdRef = useRef<string | null>(null);
  const [authPhase, setAuthPhase] = useState<AuthPhase>("checking");
  const [identity, setIdentity] = useState<AxisIdentity | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [save, setSave] = useState<AxisSave>(defaultSave);
  const [ritualState, setRitualState] = useState<RitualState>("idle");
  const [now, setNow] = useState(() => Date.now());
  const [latestSavedSessionId, setLatestSavedSessionId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("session");
  const [productSurface, setProductSurface] = useState<ProductSurface>("capture");
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(defaultOverlaySettings);
  const [workOperatorMode, setWorkOperatorMode] = useState<WorkOperatorMode>("player");
  const [isModePickerOpen, setIsModePickerOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<ParticipationMode>(defaultParticipationMode);
  const [selectedCalibrationAthleteId, setSelectedCalibrationAthleteId] = useState<string | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>("idle");
  const [visiblePeople, setVisiblePeople] = useState<number | null>(null);
  const [detectionDebug, setDetectionDebug] = useState<DetectionDebug>(defaultDetectionDebug);
  const [frameRate, setFrameRate] = useState(0);
  const [filmPreviewUrls, setFilmPreviewUrls] = useState<Record<string, string>>({});
  const [identityLocked, setIdentityLocked] = useState(false);
  const [calibrationEvidence, setCalibrationEvidence] = useState<CalibrationEvidence | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraDirection, setCameraDirection] = useState<CameraDirection>("back");
  const [cameraMessage, setCameraMessage] = useState("");
  const [movementInsights, setMovementInsights] = useState<MovementInterpretation[]>([]);
  const [movementInsightMessage, setMovementInsightMessage] = useState("");
  const [isInterpretingMovement, setIsInterpretingMovement] = useState(false);
  const [shotSuggestion, setShotSuggestion] = useState<ShotSuggestion | null>(null);
  const [shotFeedback, setShotFeedback] = useState<"make" | "miss" | null>(null);
  const shotFeedbackTimerRef = useRef<number | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState<{ text: string; subtext?: string; id: number; variant?: "shot" | "make" | "miss" } | null>(null);
  const broadcastTimerRef = useRef<number | null>(null);
  const [selectedReplayAnchor, setSelectedReplayAnchor] = useState<ReplayAnchor | null>(null);
  const [selectedFilmSessionId, setSelectedFilmSessionId] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [cameraPermissionState, setCameraPermissionState] = useState<"unknown" | "granted" | "denied" | "unavailable">("unknown");
  const [copiedFilmType, setCopiedFilmType] = useState<SessionExportType | null>(null);
  const lastShotSuggestionAtRef = useRef(0);
  const [rimEditMode, setRimEditMode] = useState(false);
  const [rimEditModeRim, setRimEditModeRim] = useState<RimLock | null>(null);
  const rimDragRef = useRef<{
    action: RimDragAction;
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startRimCenter: { x: number; y: number };
    startRimWidth: number;
    startRimHeight: number;
  } | null>(null);

  function triggerBroadcastMessage(text: string, subtext?: string, variant?: "shot" | "make" | "miss") {
    if (broadcastTimerRef.current) window.clearTimeout(broadcastTimerRef.current);
    setBroadcastMessage({ text, subtext, id: Date.now(), variant });
    broadcastTimerRef.current = window.setTimeout(() => setBroadcastMessage(null), 2000);
  }

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    async function restoreSession() {
      const storedSave = readSave();
      const savedIdentity = readIdentity();
      let storedIdentity: AxisIdentity | null = null;

      if (supabase) {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error("Unable to restore Supabase session", error);
        const user = data.session?.user;

        if (user) {
          storedIdentity = {
            email: user.email ?? "athlete@axis.local",
            id: user.id,
            restoredAt: new Date().toISOString(),
            calibrationStatus:
              savedIdentity?.id === user.id ? savedIdentity.calibrationStatus : normalizeCalibrationStatus(undefined),
            calibratedAt: savedIdentity?.id === user.id ? savedIdentity.calibratedAt : undefined,
            calibrationSessionId: savedIdentity?.id === user.id ? savedIdentity.calibrationSessionId : undefined,
          };
          writeIdentity(storedIdentity);
        }
      } else {
        storedIdentity = savedIdentity;
      }

      if (!isMounted) return;

      setIdentity(storedIdentity);
      setSave(storedSave);
      setRitualState(storedSave.activeSession ? "active" : "idle");
      setAuthPhase(storedIdentity ? "restoring" : "entry");
    }

    void restoreSession();

    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      if (!session?.user) {
        window.localStorage.removeItem(identityStorageKey);
        setIdentity(null);
        setAuthPhase("entry");
        return;
      }

      const nextIdentity = {
        email: session.user.email ?? "athlete@axis.local",
        id: session.user.id,
        restoredAt: new Date().toISOString(),
        calibrationStatus:
          readIdentity()?.id === session.user.id
            ? readIdentity()?.calibrationStatus
            : normalizeCalibrationStatus(undefined),
        calibratedAt: readIdentity()?.id === session.user.id ? readIdentity()?.calibratedAt : undefined,
        calibrationSessionId: readIdentity()?.id === session.user.id ? readIdentity()?.calibrationSessionId : undefined,
      };

      writeIdentity(nextIdentity);
      setIdentity(nextIdentity);
      setAuthPhase("restoring");
    });

    return () => {
      isMounted = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authPhase !== "restoring") return;

    const timeout = window.setTimeout(() => {
      setAuthPhase("authenticated");
    }, 950);

    return () => window.clearTimeout(timeout);
  }, [authPhase]);

  useEffect(() => {
    if (!save.activeSession) return;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [save.activeSession]);

  useEffect(() => {
    if (!identity || !save.activeSession || save.activeSession.participants?.length) return;

    const checkedInAthlete = identityFromAxisIdentity(identity);
    const participant = {
      ...checkedInAthlete,
      joinedAt: save.activeSession.startedAt,
      calibrationStatus: "required" as const,
    };
    const participationWindow = {
      ...normalizeParticipationWindow(
        save.activeSession.participationWindow,
        save.activeSession.startedAt,
        save.activeSession.mode ?? defaultParticipationMode,
        [participant],
      ),
      participantIds: [participant.id],
    };
    const cameraState = normalizeCameraState(save.activeSession.cameraState);
    const activeDirection = normalizeCameraDirection(save.activeSession.cameraDirection);
    const nextSave: AxisSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        participationWindow,
        clipContinuityContext: createClipContinuityContext(
          save.activeSession.id,
          save.activeSession.mode ?? defaultParticipationMode,
          cameraState,
          activeDirection,
          save.activeSession.cameraAttachedAt,
          participationWindow,
          [participant],
        ),
        participants: [participant],
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
  }, [identity, save]);

  useEffect(() => {
    if (cameraPreviewRef.current) {
      cameraPreviewRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    if (activeView !== "camera" || !cameraStream) {
      setFrameRate(0);
      return;
    }

    let animationFrame = 0;
    let frames = 0;
    let lastSample = performance.now();

    function sampleFrameRate(timestamp: number) {
      frames += 1;

      if (timestamp - lastSample >= 1000) {
        setFrameRate(Math.round((frames * 1000) / (timestamp - lastSample)));
        frames = 0;
        lastSample = timestamp;
      }

      animationFrame = requestAnimationFrame(sampleFrameRate);
    }

    animationFrame = requestAnimationFrame(sampleFrameRate);

    return () => cancelAnimationFrame(animationFrame);
  }, [activeView, cameraStream]);

  useEffect(() => {
    const activeDirection = save.activeSession?.cameraDirection;
    if (!activeDirection) return;

    setCameraDirection(normalizeCameraDirection(activeDirection));
  }, [save.activeSession?.cameraDirection]);

  useEffect(() => {
    const activeParticipants = save.activeSession?.participants?.filter((participant) => !participant.leftAt) ?? [];
    if (!activeParticipants.length) {
      setSelectedCalibrationAthleteId(null);
      setDetectionStatus("idle");
      setVisiblePeople(null);
      setDetectionDebug(defaultDetectionDebug);
      setIdentityLocked(false);
      setCalibrationEvidence(null);
      return;
    }

    if (!selectedCalibrationAthleteId || !activeParticipants.some((participant) => participant.id === selectedCalibrationAthleteId)) {
      setSelectedCalibrationAthleteId(activeParticipants[0].id);
      setDetectionStatus("idle");
      setVisiblePeople(null);
      setDetectionDebug(defaultDetectionDebug);
      setIdentityLocked(false);
      setCalibrationEvidence(null);
    }
  }, [save.activeSession?.participants, selectedCalibrationAthleteId]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      Object.values(filmPreviewUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [filmPreviewUrls]);

  useEffect(() => {
    if (authPhase !== "authenticated" || cameraStream || showAxisDebug) return;

    void requestCameraPreview(savedCameraDirection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authPhase, cameraStream]);

  useEffect(() => {
    if (!save.activeSession || !cameraStream) return;
    if (
      filmRecorderRef.current?.state === "recording" &&
      filmRecordingSessionIdRef.current === save.activeSession.id
    ) {
      return;
    }

    if (!startFilmRecording(save.activeSession.id, cameraStream)) return;
    if (save.activeSession.recordingAttached) return;

    const nextSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        recordingAttached: true,
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
  }, [cameraStream, save]);

  const participationLabel = useMemo(() => {
    if (ritualState === "active") return "Session live";
    if (ritualState === "saving") return "Saving history";
    if (ritualState === "complete") return "Session complete";
    return "Session active";
  }, [ritualState]);

  const latestSession = save.sessions[0] ?? null;
  const athleteLabel = identity?.email ? identity.email.split("@")[0] || "Athlete 01" : "Athlete 01";
  const signedInAthlete = identity ? identityFromAxisIdentity(identity) : null;
  const athleteMemory = buildAthleteMemory(signedInAthlete, save.sessions);
  const currentMode = save.activeSession?.mode ?? latestSession?.mode ?? pendingMode;
  const isRecordingAttached = Boolean(save.activeSession?.recordingAttached);
  const recordingLabel = isRecordingAttached ? "Recording attached" : "Recording off";
  const cameraState = normalizeCameraState(save.activeSession?.cameraState ?? latestSession?.cameraState);
  const cameraLabel = formatCameraState(cameraState);
  const savedCameraDirection = normalizeCameraDirection(
    save.activeSession?.cameraDirection ?? latestSession?.cameraDirection ?? cameraDirection,
  );
  const cameraDirectionLabel = formatCameraDirection(savedCameraDirection);
  const activeParticipants = save.activeSession?.participants ?? [];
  const presentParticipants = activeParticipants.filter((participant) => !participant.leftAt);
  const activeParticipantCount = presentParticipants.length;
  const participantCount = activeParticipants.length;
  const organizationRollups = useMemo(
    () =>
      summarizeOrganizationRollups(
        save.sessions,
        save.activeSession,
        activeParticipantCount,
        now,
        identity ? 1 : 0,
      ),
    [activeParticipantCount, identity, now, save.activeSession, save.sessions],
  );
  const organizationResults = useMemo(() => {
    const athleteIds = new Set<string>();
    let attendance = save.activeSession ? activeParticipantCount : 0;
    let makes = 0;
    let misses = 0;
    let attempts = 0;
    let totalSeconds = save.activeSession
      ? Math.max(0, Math.floor((now - new Date(save.activeSession.startedAt).getTime()) / 1000))
      : 0;

    if (save.activeSession) {
      const activeSummary = summarizeShots(save.activeSession.shotEvents ?? []);
      makes += activeSummary.makes;
      misses += activeSummary.misses;
      attempts += activeSummary.attempts;
    }

    activeParticipants.forEach((participant) => athleteIds.add(participant.id));
    save.sessions.forEach((session) => {
      const shotSummary = session.shotSummary ?? summarizeShots(normalizeShotEvents(session.shotEvents));
      makes += shotSummary.makes;
      misses += shotSummary.misses;
      attempts += shotSummary.attempts;
      totalSeconds += session.durationSeconds;
      attendance += session.activeParticipantCount || session.participantCount || session.participants?.length || 1;
      (session.participants ?? []).forEach((participant) => athleteIds.add(participant.id));
    });

    return {
      attendance,
      attempts,
      athletes: athleteIds.size || (identity ? 1 : 0),
      coaches: save.sessions.length || save.activeSession ? 1 : 0,
      fg: attempts ? Math.round((makes / attempts) * 100) : 0,
      film: organizationRollups.director.film,
      hours: totalSeconds / 3600,
      makes,
      misses,
      sessions: save.sessions.length + (save.activeSession ? 1 : 0),
    };
  }, [activeParticipantCount, activeParticipants, identity, now, organizationRollups.director.film, save.activeSession, save.sessions]);
  const calibratedParticipantCount = presentParticipants.filter(
    (participant) => normalizeCalibrationStatus(participant.calibrationStatus) === "calibrated",
  ).length;
  const calibrationProgressTotal = save.activeSession ? activeParticipantCount : 0;
  const calibrationProgressLabel = `${calibratedParticipantCount} / ${calibrationProgressTotal} athletes identified`;
  const selectedCalibrationAthlete =
    presentParticipants.find((participant) => participant.id === selectedCalibrationAthleteId) ?? presentParticipants[0] ?? null;
  const selectedAthleteCalibrationStatus = selectedCalibrationAthlete
    ? normalizeCalibrationStatus(selectedCalibrationAthlete.calibrationStatus)
    : "required";
  const isAthleteMatched =
    Boolean(calibrationEvidence?.athlete_id && calibrationEvidence.athlete_id === selectedCalibrationAthlete?.id) ||
    selectedAthleteCalibrationStatus === "calibrated" ||
    identityLocked;
  const isVisionTrackingEnabled = cameraState === "attached" && Boolean(cameraStream) && Boolean(save.activeSession);
  const personDetection = usePersonDetection(
    cameraPreviewRef,
    isVisionTrackingEnabled,
  );
  const ballTracking = useBallTracking(
    cameraPreviewRef,
    isVisionTrackingEnabled,
    personDetection.tracks,
  );
  const latestPersonDetectionRef = useRef(personDetection);
  const athleteDetected = personDetection.visiblePeople === 1;
  const calibrationWorkflowLabel = isAthleteMatched
    ? "IDENTITY LOCKED"
    : athleteDetected
      ? "ATHLETE DETECTED"
      : "LOOKING FOR ATHLETE";
  const cameraStatusSignals = isAthleteMatched
    ? ["ATHLETE DETECTED", "IDENTITY LOCKED", "READY TO RECORD"]
    : athleteDetected
      ? ["ATHLETE DETECTED"]
      : ["LOOKING FOR ATHLETE"];
  const primaryTrackingTrack =
    personDetection.tracks.find((track) => track.status === "visible" || track.status === "recovered") ??
    personDetection.tracks[0] ??
    null;
  const soloAthleteTrack =
    personDetection.tracks.find((track) => track.status !== "lost" && track.movement.moving) ??
    personDetection.tracks.find((track) => track.status !== "lost") ??
    null;
  const activeTrackBindings = new Map(
    (save.activeSession?.calibrationRecords ?? [])
      .filter((record) => record.track_id)
      .map((record) => [record.track_id as string, record.athlete_id]),
  );
  const primaryTrackingAthleteId = primaryTrackingTrack ? activeTrackBindings.get(primaryTrackingTrack.id) : undefined;
  const primaryTrackingAthlete = primaryTrackingAthleteId
    ? presentParticipants.find((participant) => participant.id === primaryTrackingAthleteId)
    : null;
  const getTrackAthlete = (trackId: string) => {
    const athleteId = activeTrackBindings.get(trackId);

    return athleteId ? presentParticipants.find((participant) => participant.id === athleteId) : undefined;
  };
  const activeShotSummary = summarizeShots(save.activeSession?.shotEvents ?? []);
  const latestLiveShot = save.activeSession?.shotEvents?.length
    ? save.activeSession.shotEvents[save.activeSession.shotEvents.length - 1]
    : null;
  const cameraOverlayShotSummary = save.activeSession
    ? activeShotSummary
    : latestSession?.shotSummary ?? summarizeShots(latestSession?.shotEvents ?? []);
  const canRecordShot = Boolean(save.activeSession && primaryTrackingTrack && primaryTrackingTrack.status !== "lost");
  const shotActionLabel = shotSuggestion ? "Possible shot detected" : formatShotSummary(activeShotSummary);
  const workDetectionState = getWorkDetectionState({
    athleteDetected,
    isShooting: Boolean(shotSuggestion),
    track: primaryTrackingTrack,
  });
  const filmSession = save.sessions.find((session) => session.id === selectedFilmSessionId) ?? latestSession;
  const latestReviewEvents = filmSession?.replayEvents?.slice(0, 6) ?? [];
  const latestReviewAnchors = filmSession?.replayAnchors?.slice(0, 6) ?? [];
  const latestFilmTimelineAnchors = filmSession?.replayAnchors?.filter(shouldShowFilmTimelineAnchor) ?? [];
  const latestReviewClips = filmSession?.replayClips?.slice(0, 4) ?? [];
  const latestClipAnchors = latestReviewClips
    .map((clip) => filmSession?.replayAnchors?.find((anchor) => anchor.eventId === clip.eventId))
    .filter((anchor): anchor is ReplayAnchor => Boolean(anchor));
  const filmOverlayAnchors = latestFilmTimelineAnchors.filter(shouldShowFilmOverlayAnchor).slice(0, 12);
  const latestSessionReview = filmSession?.review;
  const latestFilmPlaybackId = getFilmPlaybackId(filmSession);
  const latestFilmPreviewUrl = filmSession ? filmPreviewUrls[filmSession.id] : undefined;
  const selectedFilmTime =
    selectedReplayAnchor && filmSession && selectedReplayAnchor.sessionId === filmSession.id
      ? selectedReplayAnchor.videoTimestamp
      : 0;
  const localFilmSrc = latestFilmPreviewUrl ? `${latestFilmPreviewUrl}#t=${Math.max(0, selectedFilmTime).toFixed(1)}` : undefined;
  const latestFilmThumbnailUrl = filmSession?.thumbnailUrl ?? getMuxThumbnailUrl(latestFilmPlaybackId);
  const latestFilmAvailability = getFilmAvailability(filmSession);
  const latestExportObject = filmSession ? createSessionExportObject(filmSession) : null;
  const exportCenterFilms = latestSession
    ? exportFilmTypes.map(({ type, label }) => {
        let playbackId: string | undefined;
        let status: SessionExportOutput["status"];

        if (type === "raw_video") {
          playbackId = latestFilmPlaybackId;
          status = latestFilmPlaybackId ? "available" : latestSession.muxAssetId ? "processing" : "waiting";
        } else if (type === "overlay_video") {
          playbackId = latestSession.overlayMuxPlaybackId;
          status = latestSession.overlayMuxPlaybackId
            ? "available"
            : latestFilmPlaybackId
              ? "processing"
              : "waiting";
        } else if (type === "shot_science_video") {
          const hasMakes = (latestSession.highlightClips ?? []).some((c) => c.type === "make");
          playbackId = hasMakes ? latestFilmPlaybackId : undefined;
          status = hasMakes && latestFilmPlaybackId ? "available" : hasMakes ? "processing" : "waiting";
        } else {
          // vertical_social_clip: uses overlay film
          playbackId = latestSession.overlayMuxPlaybackId;
          status = latestSession.overlayMuxPlaybackId
            ? "available"
            : latestFilmPlaybackId
              ? "processing"
              : "waiting";
        }

        const shareUrl = getMuxStreamUrl(playbackId);
        const downloadUrl = getMuxDownloadUrl(playbackId);
        const statusLabel = status === "available" ? "READY" : status === "processing" ? "PROCESSING" : "PREPARING";
        const readinessLabel = `${label} ${statusLabel}`;
        return { type, label, status, shareUrl, downloadUrl, readinessLabel };
      })
    : [];
  const resultsSession = filmSession ?? save.activeSession ?? null;
  const resultsShotEvents = resultsSession?.shotEvents ?? [];
  const resultsShotSummary =
    latestExportObject?.metrics.shotSummary ?? (save.activeSession ? activeShotSummary : summarizeShots(resultsShotEvents));
  const resultsModeLabel = resultsSession?.mode ?? pendingMode;
  const resultsTimeLabel = filmSession
    ? formatTime(filmSession.endedAt)
    : save.activeSession
      ? formatTime(save.activeSession.startedAt)
      : "--";
  const resultsLongestMakeStreak = latestExportObject?.metrics.longestMakeStreak ?? getLongestMakeStreak(resultsShotEvents);
  const resultsShotScience = resultsShotEvents.find((event) => event.shotScience)?.shotScience;
  const shouldShowPrimaryFilm =
    !showAxisDebug && productSurface === "overlay" && Boolean(filmSession && (latestFilmPlaybackId || localFilmSrc));
  const findShotAnchor = (session: SavedSession, shot?: ShotEvent) =>
    shot
      ? normalizeReplayAnchors(session.replayAnchors).find(
          (anchor) => anchor.eventType === shot.type && Math.abs(anchor.videoTimestamp - shot.replayTimestamp) <= 1,
        )
      : undefined;
  const filmShots = normalizeShotEvents(filmSession?.shotEvents);
  const longestStreakShot = filmShots.reduce<ShotEvent | undefined>(
    (best, shot) => (!best || shot.makeStreak > best.makeStreak ? shot : best),
    undefined,
  );
  const fastestReleaseShot = filmShots.reduce<ShotEvent | undefined>(
    (best, shot) =>
      !best || (shot.shotScience?.releaseTime ?? Number.POSITIVE_INFINITY) < (best.shotScience?.releaseTime ?? Number.POSITIVE_INFINITY)
        ? shot
        : best,
    undefined,
  );
  const highestArcShot = filmShots.reduce<ShotEvent | undefined>(
    (best, shot) => (!best || (shot.shotScience?.arcHeightFeet ?? 0) > (best.shotScience?.arcHeightFeet ?? 0) ? shot : best),
    undefined,
  );
  const filmSessionIndex = filmSession ? save.sessions.findIndex((session) => session.id === filmSession.id) : -1;
  const previousPerformanceSession = filmSessionIndex >= 0 ? save.sessions[filmSessionIndex + 1] : undefined;
  const previousShotSummary = previousPerformanceSession
    ? previousPerformanceSession.shotSummary ?? summarizeShots(previousPerformanceSession.shotEvents ?? [])
    : null;
  const performanceImprovement =
    previousShotSummary && previousShotSummary.attempts > 0 && resultsShotSummary.attempts > 0
      ? resultsShotSummary.fieldGoalPercentage - previousShotSummary.fieldGoalPercentage
      : null;
  const performanceImprovementLabel =
    performanceImprovement === null ? "Baseline" : `${performanceImprovement >= 0 ? "+" : ""}${performanceImprovement}% FG`;
  const latestClipAnchor = latestClipAnchors[0] ?? latestFilmTimelineAnchors[0];
  const getShotForMoment = (anchor: ReplayAnchor) =>
    filmShots.find(
      (shot) =>
        shot.sessionId === anchor.sessionId &&
        (anchor.eventType === shot.type || anchor.eventType === "shot_attempt") &&
        Math.abs(anchor.videoTimestamp - shot.replayTimestamp) <= 1.5,
    );
  const momentCards = latestFilmTimelineAnchors
    .filter((anchor) => ["assist", "block", "foul", "make", "miss", "rebound", "shot_attempt", "steal", "turnover"].includes(anchor.eventType))
    .map((anchor) => {
      const shot = getShotForMoment(anchor);
      const metrics = shot?.shotScience
        ? [
            `${shot.shotScience.releaseAngle}\u00b0`,
            formatShotScienceReleaseTime(shot.shotScience),
            formatShotScienceDistance(shot.shotScience),
          ]
        : [];

      return {
        anchor,
        metrics,
        thumbnailUrl: latestFilmThumbnailUrl,
        title: formatHumanMomentLabel(anchor),
      };
    });
  const sessionCameraStatusLabel = cameraState === "attached" ? "Camera attached" : "Camera ready";
  const currentRimLock = save.activeSession?.rimLock ?? latestSession?.rimLock;
  const rimLockLabel = currentRimLock ? "Rim locked" : save.activeSession ? "Tap rim once" : "Rim waiting";
  const sessionPrimaryActionLabel = "Record";
  const bridgeSessionLabel = save.activeSession ? "Session live" : "Session active";
  const bridgeRosterLabel = save.activeSession
    ? `${formatCount(activeParticipantCount, "athlete", "athletes")} active`
    : "No active check-in";
  const participationWindowLabel = save.activeSession
    ? "Window open"
    : latestSession?.participationWindow?.status === "closed"
      ? "Window saved"
      : "Window waiting";
  const currentStreak = calculateStreak(save.sessions);
  const lastCheckIn = save.activeSession
    ? formatTime(save.activeSession.startedAt)
    : latestSession
      ? formatTime(latestSession.endedAt)
      : "None";
  const elapsedSeconds = save.activeSession
    ? Math.max(0, Math.floor((now - new Date(save.activeSession.startedAt).getTime()) / 1000))
    : latestSession?.durationSeconds ?? 0;
  const sessionSummary = save.activeSession
    ? `Started ${formatTime(save.activeSession.startedAt)}`
    : latestSession
      ? `${formatDuration(latestSession.durationSeconds)} saved`
      : "Session waiting";
  const isCoachMode = workOperatorMode === "coach";
  const isDirectorMode = workOperatorMode === "director";
  const isParentMode = workOperatorMode === "parent";
  const shouldShowReviewPanel = Boolean(latestSession && showAxisDebug && isReviewOpen);
  const shouldShowFilmSurface = true;
  const shouldShowResultsSurface = true;
  const activeTimerLabel = save.activeSession ? `${formatDuration(elapsedSeconds)} preserved` : null;
  const cameraOperatingState = save.activeSession ? (isRecordingAttached ? "Recording" : "Ready") : "Camera";
  const cameraOperatingContext = save.activeSession ? `${currentMode} / ${formatDuration(elapsedSeconds)}` : "Film";
  const cameraTimeLabel = save.activeSession
    ? formatDuration(elapsedSeconds)
    : latestSession
      ? formatDuration(latestSession.durationSeconds)
      : "0:00";
  const cameraMakes = save.activeSession ? activeShotSummary.makes : latestSession?.shotSummary?.makes ?? 0;
  const cameraMisses = save.activeSession ? activeShotSummary.misses : latestSession?.shotSummary?.misses ?? 0;
  const cameraAttempts = save.activeSession ? activeShotSummary.attempts : latestSession?.shotSummary?.attempts ?? 0;
  const cameraFieldGoalPercentage = save.activeSession
    ? activeShotSummary.fieldGoalPercentage
    : latestSession?.shotSummary?.fieldGoalPercentage ?? 0;
  const overlayPlayerName =
    (soloAthleteTrack ? getTrackAthlete(soloAthleteTrack.id)?.name : undefined) ??
    selectedCalibrationAthlete?.name ??
    athleteLabel;
  const overlayShot = latestLiveShot ?? latestSession?.shotEvents?.[0] ?? null;
  const availableParticipationModes = isCoachMode || isDirectorMode || isParentMode ? coachParticipationModes : participationModes;
  const isGameMode = (save.activeSession?.mode ?? pendingMode) === "Game";
  const visibleWorkActions = gameActions;
  const compactPresence = `BRIDGE • ${currentStreak} ${currentStreak === 1 ? "DAY" : "DAYS"} • ${lastCheckIn.toUpperCase()} • ${currentMode.toUpperCase()}`;
  const historyStatus =
    ritualState === "complete" && latestSession
      ? `History grew / ${formatDuration(latestSession.durationSeconds)}`
      : `${save.sessions.length} sessions saved`;
  const activeWeekDays = new Set(
    save.sessions
      .filter((session) => {
        const endedAt = new Date(session.endedAt);
        const diff = Date.now() - endedAt.getTime();
        return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
      })
      .map((session) => dayKey(session.endedAt)),
  );

  useEffect(() => {
    latestPersonDetectionRef.current = personDetection;
  }, [personDetection]);

  useEffect(() => {
    latestBallTrackingRef.current = ballTracking;
  }, [ballTracking]);

  useEffect(() => {
    if (!save.activeSession || !isVisionTrackingEnabled) {
      previousBallEventStateRef.current = null;
      return;
    }

    const nextBallState = ballTracking.visible ? "tracked" : "lost";
    const previousBallState = previousBallEventStateRef.current;

    if (previousBallState === nextBallState) return;

    previousBallEventStateRef.current = nextBallState;

    if (previousBallState === null && nextBallState === "lost") return;

    const eventType: ReplayEventType =
      nextBallState === "tracked"
        ? previousBallState === "lost"
          ? "ball_recovered"
          : "ball_visible"
        : "ball_lost";
    const timestamp = new Date().toISOString();
    const label =
      eventType === "ball_lost" ? "Ball lost" : eventType === "ball_recovered" ? "Ball recovered" : "Ball visible";
    const cameraDirection = savedCameraDirection;

    setSave((currentSave) => {
      if (!currentSave.activeSession) return currentSave;

      const replayEvent: ReplayEvent = {
        athleteName: "Ball",
        cameraDirection,
        cameraId: getCameraId(cameraDirection),
        id: `replay:${timestamp}:${eventType}`,
        label,
        timestamp,
        trackState: {
          status: eventType === "ball_lost" ? "interrupted" : eventType === "ball_recovered" ? "recovered" : "tracked",
          tracked: ballTracking.visible,
          visible: ballTracking.visible,
        },
        type: eventType,
      };
      const replayAnchor = createReplayAnchor(
        replayEvent.id,
        replayEvent.type,
        replayEvent.timestamp,
        currentSave.activeSession.id,
        currentSave.activeSession.startedAt,
        currentSave.activeSession.muxAssetId,
        replayEvent.label,
        {
          cameraDirection: replayEvent.cameraDirection,
          cameraId: replayEvent.cameraId,
        },
      );
      const nextSave = {
        ...currentSave,
        activeSession: {
          ...currentSave.activeSession,
          replayAnchors: [...(currentSave.activeSession.replayAnchors ?? []), replayAnchor],
          replayClips: [...(currentSave.activeSession.replayClips ?? []), createReplayClip(replayAnchor)],
          replayEvents: [...(currentSave.activeSession.replayEvents ?? []), replayEvent],
        },
      };

      writeSave(nextSave);
      return nextSave;
    });
  }, [ballTracking.visible, isVisionTrackingEnabled, save.activeSession, savedCameraDirection]);

  useEffect(() => {
    if (!save.activeSession || !primaryTrackingTrack || primaryTrackingTrack.status === "lost") {
      setShotSuggestion(null);
      return;
    }

    const attemptConfidence = getShotAttemptConfidence(primaryTrackingTrack, ballTracking, save.activeSession.rimLock);
    const movement = primaryTrackingTrack.movement;
    const isLikelyShotMotion =
      attemptConfidence >= lowConfidenceShotThreshold ||
      (movement.moving &&
        movement.direction === "up" &&
        movement.distanceTraveled >= 0.035 &&
        primaryTrackingTrack.visibleTimeMs >= 900);

    if (!isLikelyShotMotion) return;

    const nowMs = Date.now();
    if (nowMs - lastShotSuggestionAtRef.current < 4500) return;

    const trackedAthlete = getTrackAthlete(primaryTrackingTrack.id);
    const fallbackAthlete = selectedCalibrationAthlete ?? presentParticipants[0] ?? identityFromAxisIdentity(identity ?? {
      email: "athlete@axis.local",
      id: "axis-athlete",
      restoredAt: new Date().toISOString(),
    });
    const athlete = trackedAthlete ?? fallbackAthlete;
    const replayTimestamp = Math.max(
      0,
      Math.floor((nowMs - new Date(save.activeSession.startedAt).getTime()) / 1000),
    );
    const shotScience = createShotScience(primaryTrackingTrack, ballTracking, save.activeSession.rimLock);
    const activeSession = save.activeSession;
    const shotId = `shot:${save.activeSession.id}:${primaryTrackingTrack.id}:${nowMs}`;

    lastShotSuggestionAtRef.current = nowMs;
    if (attemptConfidence >= highConfidenceShotThreshold && nowMs - lastShotAttemptAtRef.current >= 4500) {
      const gatherTimestamp = getShotPhaseTimestamp(nowMs, -520);
      const releaseTimestamp = getShotPhaseTimestamp(nowMs, -120);
      const arcTimestamp = getShotPhaseTimestamp(nowMs, 260);
      const timestamp = new Date(nowMs).toISOString();
      const attemptId = `shot-attempt:${shotId}`;
      const shotPhaseEvents = [
        createShotPhaseReplayEvent("shot_gather", gatherTimestamp, athlete, primaryTrackingTrack, savedCameraDirection, attemptConfidence),
        createShotPhaseReplayEvent("shot_release", releaseTimestamp, athlete, primaryTrackingTrack, savedCameraDirection, attemptConfidence),
        createShotPhaseReplayEvent("shot_arc", arcTimestamp, athlete, primaryTrackingTrack, savedCameraDirection, attemptConfidence),
        createShotPhaseReplayEvent("shot_attempt", timestamp, athlete, primaryTrackingTrack, savedCameraDirection, attemptConfidence),
      ];
      const replayAnchors = shotPhaseEvents.map((event) =>
        createReplayAnchor(
          event.id,
          event.type,
          event.timestamp,
          activeSession.id,
          activeSession.startedAt,
          activeSession.muxAssetId,
          event.label,
          {
            athleteId: event.athleteId,
            athleteName: event.athleteName,
            cameraDirection: event.cameraDirection,
            cameraId: event.cameraId,
          },
        ),
      );
      const nextSave = {
        ...save,
        activeSession: {
          ...activeSession,
          replayAnchors: [...(activeSession.replayAnchors ?? []), ...replayAnchors],
          replayClips: [...(activeSession.replayClips ?? []), ...replayAnchors.map((anchor) => createReplayClip(anchor))],
          replayEvents: [...(activeSession.replayEvents ?? []), ...shotPhaseEvents],
        },
      };

      lastShotAttemptAtRef.current = nowMs;
      pendingShotAttemptRef.current = {
        athleteId: athlete.id,
        athleteName: athlete.name,
        attemptId,
        confidence: attemptConfidence,
        createdAtMs: nowMs,
        id: attemptId,
        reason: "Shot attempt",
        replayTimestamp,
        resultSaved: false,
        needsConfirmation: false,
        shotId,
        shotScience,
        timestamp,
        trackId: primaryTrackingTrack.id,
      };
      writeSave(nextSave);
      setSave(nextSave);
    }
    const nextSuggestion = {
      athleteId: athlete.id,
      athleteName: athlete.name,
      confidence: Math.max(attemptConfidence, Math.min(0.96, 0.72 + movement.distanceTraveled * 3)),
      id: `shot-suggestion:${save.activeSession.id}:${primaryTrackingTrack.id}:${nowMs}`,
      needsConfirmation: attemptConfidence < highConfidenceShotThreshold,
      reason: attemptConfidence >= highConfidenceShotThreshold ? "Shot detected" : "Confirm shot result",
      replayTimestamp,
      shotId,
      shotScience: shotScience ?? createShotScience(primaryTrackingTrack, ballTracking, save.activeSession.rimLock),
      timestamp: new Date(nowMs).toISOString(),
      trackId: primaryTrackingTrack.id,
    };
    setShotSuggestion(nextSuggestion);
    triggerBroadcastMessage("SHOT DETECTED", undefined, "shot");
  }, [
    identity,
    primaryTrackingTrack,
    primaryTrackingTrack?.id,
    primaryTrackingTrack?.movement.direction,
    primaryTrackingTrack?.movement.distanceTraveled,
    primaryTrackingTrack?.movement.moving,
    primaryTrackingTrack?.status,
    primaryTrackingTrack?.visibleTimeMs,
    save.activeSession,
    savedCameraDirection,
    selectedCalibrationAthlete,
    presentParticipants,
    ballTracking,
    ballTracking.confidence,
    ballTracking.position,
    ballTracking.velocity,
    ballTracking.visible,
  ]);

  useEffect(() => {
    if (!save.activeSession || !pendingShotAttemptRef.current || pendingShotAttemptRef.current.resultSaved) return;

    const pendingAttempt = pendingShotAttemptRef.current;
    const nowMs = Date.now();
    const automaticResult = getShotResultFromBall(ballTracking, save.activeSession.rimLock);
    const timedOut = nowMs - pendingAttempt.createdAtMs >= 2600;

    if (!automaticResult && !timedOut) return;

    const resultType: ShotType = automaticResult?.type ?? "miss";
    const confidence = automaticResult?.confidence ?? Math.max(0.52, pendingAttempt.confidence - 0.16);
    pendingShotAttemptRef.current = {
      ...pendingAttempt,
      resultSaved: true,
    };

    recordShot(resultType, {
      athleteId: pendingAttempt.athleteId,
      athleteName: pendingAttempt.athleteName,
      confidence,
      id: `${pendingAttempt.attemptId}:${resultType}`,
      reason: automaticResult ? "Ball crossed rim area" : "Shot attempt ended",
      replayTimestamp: Math.max(0, Math.floor((nowMs - new Date(save.activeSession.startedAt).getTime()) / 1000)),
      shotId: pendingAttempt.shotId,
      shotScience: pendingAttempt.shotScience ?? createShotScience(primaryTrackingTrack, ballTracking, save.activeSession.rimLock),
      timestamp: new Date(nowMs).toISOString(),
      trackId: pendingAttempt.trackId,
    });
  }, [
    ballTracking.confidence,
    ballTracking.position,
    ballTracking.velocity,
    ballTracking.visible,
    save.activeSession,
  ]);

  useEffect(() => {
    if (!save.activeSession) {
      timelineCursorRef.current = {
        previousLostCount: 0,
        previousRecoveryCount: 0,
        totalDistanceTraveled: 0,
      };
      return;
    }

    const intervalId = window.setInterval(() => {
      setSave((currentSave) => {
        if (!currentSave.activeSession) return currentSave;

        const sampledAt = new Date();
        const timestampKey = sampledAt.toISOString().slice(0, 19);
        if (timelineCursorRef.current.lastTimestampKey === timestampKey) return currentSave;

        const detection = latestPersonDetectionRef.current;
        const ballSample = createBallTimelineSample(sampledAt.toISOString(), latestBallTrackingRef.current);
        const track =
          detection.tracks.find((candidate) => candidate.status === "visible" || candidate.status === "recovered") ??
          detection.tracks[0] ??
          null;
        const trackBinding = track?.id
          ? currentSave.activeSession.calibrationRecords?.find((record) => record.track_id === track.id)
          : undefined;
        const tracked = Boolean(track && track.status !== "lost");
        const visible = detection.visiblePeople > 0;
        const x = track ? track.boundingBox.x + track.boundingBox.width / 2 : undefined;
        const y = track ? track.boundingBox.y + track.boundingBox.height / 2 : undefined;
        const hasPreviousPosition =
          typeof timelineCursorRef.current.previousX === "number" &&
          typeof timelineCursorRef.current.previousY === "number" &&
          typeof x === "number" &&
          typeof y === "number";
        const deltaX = hasPreviousPosition ? x - timelineCursorRef.current.previousX! : 0;
        const deltaY = hasPreviousPosition ? y - timelineCursorRef.current.previousY! : 0;
        const movementDistance = Math.hypot(deltaX, deltaY);
        const moving = tracked && movementDistance > 0.015;
        const entered = visible && timelineCursorRef.current.previousVisible !== true;
        const exited = timelineCursorRef.current.previousVisible === true && !visible;
        const totalDistanceTraveled = timelineCursorRef.current.totalDistanceTraveled + (tracked ? movementDistance : 0);
        const stationary = tracked && !moving;
        const direction =
          moving && Math.abs(deltaX) > Math.abs(deltaY)
            ? deltaX > 0
              ? "right"
              : "left"
            : moving
              ? deltaY > 0
                ? "down"
                : "up"
              : timelineCursorRef.current.previousDirection;
        const directionChanges =
          moving && timelineCursorRef.current.previousDirection && direction !== timelineCursorRef.current.previousDirection ? 1 : 0;
        const lostCount = track?.lostCount ?? timelineCursorRef.current.previousLostCount;
        const recoveryCount = track?.recoveryCount ?? timelineCursorRef.current.previousRecoveryCount;
        const trackingLost = lostCount > timelineCursorRef.current.previousLostCount;
        const trackingRecovered = recoveryCount > timelineCursorRef.current.previousRecoveryCount;
        const sample: SessionTimelineSample = {
          athleteId: trackBinding?.athlete_id,
          directionChanges,
          distanceTraveled: tracked ? movementDistance : 0,
          entered,
          exited,
          lostCount,
          moving,
          recoveryCount,
          stationary,
          timestamp: sampledAt.toISOString(),
          totalDistanceTraveled,
          tracked,
          trackingLost,
          trackingRecovered,
          trackId: track?.id,
          visible,
          visibleTimeMs: track?.visibleTimeMs ?? 0,
          x,
          y,
        };

        timelineCursorRef.current = {
          lastTimestampKey: timestampKey,
          previousDirection: direction,
          previousLostCount: lostCount,
          previousRecoveryCount: recoveryCount,
          previousTracked: tracked,
          previousVisible: visible,
          previousX: x,
          previousY: y,
          totalDistanceTraveled,
        };

        const nextSave = {
          ...currentSave,
          activeSession: {
            ...currentSave.activeSession,
            ballTimeline: [...(currentSave.activeSession.ballTimeline ?? []), ballSample],
            timeline: [...(currentSave.activeSession.timeline ?? []), sample],
          },
        };
        writeSave(nextSave);
        return nextSave;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [save.activeSession?.id]);

  useEffect(() => {
    const detectionEnabled = activeView === "camera" && cameraState === "attached" && Boolean(cameraStream);

    if (!detectionEnabled) {
      setIdentityLocked(false);
      return;
    }

    setVisiblePeople(personDetection.visiblePeople);
    setDetectionDebug({
      ...defaultDetectionDebug,
      failureReason:
        personDetection.visiblePeople === 1
          ? "One visible body detected."
          : personDetection.visiblePeople > 1
            ? `Expected one athlete, detected ${personDetection.visiblePeople}.`
            : "Looking for one visible body.",
      predictionCount: personDetection.detectionsReturned,
    });

    if (personDetection.visiblePeople === 1 && selectedCalibrationAthlete) {
      setIdentityLocked(true);
      setDetectionStatus("ready");
      return;
    }

    setIdentityLocked(false);
    setDetectionStatus(personDetection.visiblePeople > 1 ? "not_one" : "capturing");
  }, [activeView, cameraState, cameraStream, personDetection, selectedCalibrationAthlete]);

  async function enterAxis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage("");

    const trimmedEmail = email.trim();
    const supabase = getSupabaseBrowserClient();

    if (!trimmedEmail || !password) {
      setAuthMessage("Email and password required.");
      return;
    }

    if (!supabase) {
      const savedIdentity = readIdentity();
      const nextIdentity = {
        email: trimmedEmail,
        id: trimmedEmail,
        restoredAt: new Date().toISOString(),
        calibrationStatus:
          savedIdentity?.id === trimmedEmail ? savedIdentity.calibrationStatus : normalizeCalibrationStatus(undefined),
        calibratedAt: savedIdentity?.id === trimmedEmail ? savedIdentity.calibratedAt : undefined,
        calibrationSessionId: savedIdentity?.id === trimmedEmail ? savedIdentity.calibrationSessionId : undefined,
      };

      writeIdentity(nextIdentity);
      setIdentity(nextIdentity);
      setEmail("");
      setPassword("");
      setAuthPhase("restoring");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error || !data.user) {
      console.error("Unable to enter Axis", error);
      setAuthMessage("Unable to enter.");
      return;
    }

    const nextIdentity = {
      email: data.user.email ?? trimmedEmail,
      id: data.user.id,
      restoredAt: new Date().toISOString(),
      calibrationStatus:
        readIdentity()?.id === data.user.id ? readIdentity()?.calibrationStatus : normalizeCalibrationStatus(undefined),
      calibratedAt: readIdentity()?.id === data.user.id ? readIdentity()?.calibratedAt : undefined,
      calibrationSessionId: readIdentity()?.id === data.user.id ? readIdentity()?.calibrationSessionId : undefined,
    };

    writeIdentity(nextIdentity);
    setIdentity(nextIdentity);
    setEmail("");
    setPassword("");
    setAuthPhase("restoring");
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    const savedRitual = window.localStorage.getItem(storageKey);

    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) console.error("Unable to sign out", error);
    }

    if (savedRitual && !window.localStorage.getItem(storageKey)) {
      window.localStorage.setItem(storageKey, savedRitual);
    }

    window.localStorage.removeItem(identityStorageKey);
    setIdentity(null);
    setEmail("");
    setPassword("");
    setAuthMessage("");
    setRitualState(save.activeSession ? "active" : "idle");
    setAuthPhase("entry");
  }

  function checkIn() {
    if (!identity) return;

    timelineCursorRef.current = {
      previousLostCount: 0,
      previousRecoveryCount: 0,
      totalDistanceTraveled: 0,
    };
    const startedAt = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const startingMode = pendingMode;
    const startingCameraDirection: CameraDirection = "front";
    const checkedInAthlete = identityFromAxisIdentity(identity);
    const startingParticipants = [
      {
        ...checkedInAthlete,
        joinedAt: startedAt,
        calibrationStatus: "required" as const,
      },
    ];
    const participationWindow = {
      openedAt: startedAt,
      status: "open" as const,
      context: startingMode,
      participantIds: startingParticipants.map((participant) => participant.id),
    };
    const sessionStartAnchor = createReplayAnchor(
      `session:${sessionId}:start`,
      "session_start",
      startedAt,
      sessionId,
      startedAt,
      undefined,
      "Session start",
      { cameraDirection: startingCameraDirection, cameraId: getCameraId(startingCameraDirection) },
    );
    const nextSave: AxisSave = {
      ...save,
      activeSession: {
        id: sessionId,
        startedAt,
        mode: startingMode,
        recordingAttached: false,
        calibrationStatus: "required",
        cameraState: "offline",
        cameraDirection: startingCameraDirection,
        participationWindow,
        clipContinuityContext: createClipContinuityContext(
          sessionId,
          startingMode,
          "offline",
          startingCameraDirection,
          undefined,
          participationWindow,
          startingParticipants,
        ),
        participants: startingParticipants,
        ballTimeline: [],
        replayAnchors: [sessionStartAnchor],
        replayClips: [],
        replayEvents: [],
        rimLock: save.sessions[0]?.rimLock,
        shotEvents: [],
        timeline: [],
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
    setNow(Date.now());
    setRitualState("active");
    setRimEditMode(false);
    setRimEditModeRim(null);
    setLatestSavedSessionId(null);
    setActiveView("session");
    setIsReviewOpen(false);
    setIsModePickerOpen(false);
    setSelectedCalibrationAthleteId(checkedInAthlete.id);
    setDetectionStatus("idle");
    setVisiblePeople(null);
    setDetectionDebug(defaultDetectionDebug);
    setIdentityLocked(false);
    setCalibrationEvidence(null);
    setCameraDirection(startingCameraDirection);
    void requestCameraPresence(startingCameraDirection, nextSave);
  }

  function changeMode(mode: ParticipationMode) {
    if (!save.activeSession) return;

    const participationWindow = {
      ...normalizeParticipationWindow(
        save.activeSession.participationWindow,
        save.activeSession.startedAt,
        mode,
        activeParticipants,
      ),
      context: mode,
    };
    const cameraState = normalizeCameraState(save.activeSession.cameraState);
    const activeDirection = normalizeCameraDirection(save.activeSession.cameraDirection);
    const nextSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        mode,
        participationWindow,
        clipContinuityContext: createClipContinuityContext(
          save.activeSession.id,
          mode,
          cameraState,
          activeDirection,
          save.activeSession.cameraAttachedAt,
          participationWindow,
          activeParticipants,
        ),
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
    setIsModePickerOpen(false);
  }

  function changeWorkOperatorMode(mode: WorkOperatorMode) {
    setWorkOperatorMode(mode);

    if ((mode === "coach" || mode === "director" || mode === "parent") && !coachParticipationModes.includes(pendingMode)) {
      setPendingMode("Practice");
    }
  }

  function toggleRecordingAttachment() {
    if (!save.activeSession) return;

    const nextSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        recordingAttached: !isRecordingAttached,
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
  }

  function startFilmRecording(sessionId: string, stream: MediaStream) {
    if (typeof MediaRecorder === "undefined") return false;
    if (filmRecorderRef.current?.state === "recording") return true;

    try {
      const mimeType = getSupportedVideoMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      filmChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) filmChunksRef.current.push(event.data);
      };
      recorder.start(1000);
      filmRecorderRef.current = recorder;
      filmRecordingSessionIdRef.current = sessionId;

      return true;
    } catch (error) {
      console.error("Unable to start film recording", error);

      return false;
    }
  }

  function stopFilmRecording() {
    const recorder = filmRecorderRef.current;
    const sessionId = filmRecordingSessionIdRef.current;

    if (!recorder || !sessionId) return Promise.resolve(null);

    return new Promise<{ blob: Blob; sessionId: string } | null>((resolve) => {
      const finish = () => {
        const type = recorder.mimeType || getSupportedVideoMimeType() || "video/webm";
        const blob = filmChunksRef.current.length ? new Blob(filmChunksRef.current, { type }) : null;

        filmChunksRef.current = [];
        filmRecorderRef.current = null;
        filmRecordingSessionIdRef.current = null;

        resolve(blob?.size ? { blob, sessionId } : null);
      };

      recorder.onstop = finish;
      recorder.onerror = () => finish();

      if (recorder.state === "inactive") {
        finish();
        return;
      }

      recorder.requestData();
      recorder.stop();
    });
  }

  async function uploadBlobToMux(uploadUrl: string, blob: Blob) {
    return new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(blob, {
        endpoint: uploadUrl,
        metadata: {
          filetype: blob.type || "video/webm",
          filename: "axis-work.webm",
        },
        onError: reject,
        onSuccess: () => resolve(),
      });

      upload.start();
    });
  }

  function captureFilmThumbnail() {
    const video = cameraPreviewRef.current;
    if (!video?.videoWidth || !video.videoHeight) return undefined;

    try {
      const canvas = document.createElement("canvas");
      const width = Math.min(640, video.videoWidth);
      const height = Math.round((width / video.videoWidth) * video.videoHeight);
      const context = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;
      context?.drawImage(video, 0, 0, width, height);

      return canvas.toDataURL("image/jpeg", 0.72);
    } catch (error) {
      console.error("Unable to create film thumbnail", error);

      return undefined;
    }
  }

  async function pollFilmUpload(uploadId: string) {
    let latestFilm:
      | {
          muxAssetId?: string;
          playbackId?: string;
          status?: string;
          thumbnailUrl?: string;
        }
      | null = null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await fetch(`/api/film/uploads/${uploadId}`);
      const result = (await response.json().catch(() => null)) as
        | {
            muxAssetId?: string;
            playbackId?: string;
            status?: string;
            thumbnailUrl?: string;
          }
        | null;

      if (response.ok && result) latestFilm = result;
      if (response.ok && result?.playbackId) return result;
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
    }

    return latestFilm;
  }

  async function uploadSessionFilm(session: SavedSession, blob: Blob) {
    try {
      const uploadResponse = await fetch("/api/film/uploads", {
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const upload = (await uploadResponse.json().catch(() => null)) as { uploadId?: string; uploadUrl?: string } | null;

      if (!uploadResponse.ok || !upload?.uploadId || !upload.uploadUrl) {
        console.error("Unable to create film upload", { status: uploadResponse.status });
        return;
      }

      await uploadBlobToMux(upload.uploadUrl, blob);
      const film = await pollFilmUpload(upload.uploadId);
      const muxAssetId = film?.muxAssetId ?? session.muxAssetId;
      const updatedSession = {
        ...session,
        muxAssetId,
        muxPlaybackId: film?.playbackId ?? session.muxPlaybackId,
        recordingAttached: true,
        replayAnchors: (session.replayAnchors ?? []).map((anchor) => ({
          ...anchor,
          muxAssetId: muxAssetId ?? anchor.muxAssetId,
        })),
        replayClips: (session.replayClips ?? []).map((clip) => ({
          ...clip,
          muxAssetId: muxAssetId ?? clip.muxAssetId,
        })),
        thumbnailUrl: film?.thumbnailUrl ?? (film?.playbackId ? getMuxThumbnailUrl(film.playbackId) : session.thumbnailUrl),
      };
      const exportReadySession = {
        ...updatedSession,
        exportQueue: createSessionExportObject(updatedSession).exports,
      };

      setSave((currentSave) => {
        const nextSave = {
          ...currentSave,
          sessions: currentSave.sessions.map((session) =>
            session.id === exportReadySession.id ? { ...session, ...exportReadySession } : session,
          ),
        };

        writeSave(nextSave);
        return nextSave;
      });

      void queueFinalizeWork(exportReadySession);
    } catch (error) {
      console.error("Unable to upload film", error);
    }
  }

  async function uploadOverlayFilm(session: SavedSession, blob: Blob) {
    try {
      const uploadResponse = await fetch("/api/film/uploads", {
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const upload = (await uploadResponse.json().catch(() => null)) as { uploadId?: string; uploadUrl?: string } | null;

      if (!uploadResponse.ok || !upload?.uploadId || !upload.uploadUrl) {
        console.error("Unable to create overlay film upload");
        return;
      }

      await uploadBlobToMux(upload.uploadUrl, blob);
      const film = await pollFilmUpload(upload.uploadId);
      if (!film?.playbackId) return;

      setSave((currentSave) => {
        const nextSave = {
          ...currentSave,
          sessions: currentSave.sessions.map((s) =>
            s.id === session.id
              ? { ...s, overlayMuxAssetId: film.muxAssetId, overlayMuxPlaybackId: film.playbackId }
              : s,
          ),
        };
        writeSave(nextSave);
        return nextSave;
      });
    } catch (error) {
      console.error("Unable to upload overlay film", error);
    }
  }

  function buildCameraSessionState(
    activeSave: AxisSave,
    nextCameraState: CameraState,
    nextCameraDirection = cameraDirection,
    attachedAt?: string,
  ): AxisSave {
    if (!activeSave.activeSession) return activeSave;

    const cameraAttachedAt = attachedAt ?? activeSave.activeSession.cameraAttachedAt;
    const normalizedDirection = normalizeCameraDirection(nextCameraDirection);
    const activeSessionParticipants = activeSave.activeSession.participants ?? [];
    const participationWindow = normalizeParticipationWindow(
      activeSave.activeSession.participationWindow,
      activeSave.activeSession.startedAt,
      activeSave.activeSession.mode ?? currentMode,
      activeSessionParticipants,
    );

    return {
      ...activeSave,
      activeSession: {
        ...activeSave.activeSession,
        cameraState: nextCameraState,
        cameraDirection: normalizedDirection,
        cameraAttachedAt,
        clipContinuityContext: createClipContinuityContext(
          activeSave.activeSession.id,
          activeSave.activeSession.mode ?? currentMode,
          nextCameraState,
          normalizedDirection,
          cameraAttachedAt,
          participationWindow,
          activeSessionParticipants,
        ),
      },
    };
  }

  function updateCameraSessionState(
    nextCameraState: CameraState,
    nextCameraDirection = cameraDirection,
    attachedAt?: string,
  ) {
    if (!save.activeSession) return;

    const nextSave = buildCameraSessionState(save, nextCameraState, nextCameraDirection, attachedAt);

    writeSave(nextSave);
    setSave(nextSave);
  }

  async function requestCameraPreview(nextDirection = cameraDirection) {
    const normalizedDirection = normalizeCameraDirection(nextDirection);
    setCameraMessage("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraPermissionState("unavailable");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: normalizedDirection === "front" ? "user" : "environment",
        },
      });

      setCameraStream((currentStream) => {
        currentStream?.getTracks().forEach((track) => track.stop());
        return stream;
      });
      setCameraDirection(normalizedDirection);
      setCameraPermissionState("granted");
      setCameraMenuOpen(false);

      return true;
    } catch (error) {
      const isPermissionDenied =
        error instanceof Error && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      setCameraPermissionState(isPermissionDenied ? "denied" : "unavailable");
      setCameraMessage("Camera unavailable.");

      return false;
    }
  }

  async function requestCameraPresence(nextDirection = cameraDirection, activeSave = save) {
    if (!activeSave.activeSession) return;

    const normalizedDirection = normalizeCameraDirection(nextDirection);
    setCameraMessage("");

    try {
      const cameraReady = cameraStream ? true : await requestCameraPreview(normalizedDirection);
      if (!cameraReady) {
        updateCameraSessionState("offline", normalizedDirection);
        return;
      }

      const nextSave = buildCameraSessionState(
        activeSave,
        showAxisDebug ? "ready" : "attached",
        normalizedDirection,
        showAxisDebug ? undefined : new Date().toISOString(),
      );
      writeSave(nextSave);
      setSave(nextSave);
    } catch (error) {
      console.error("Unable to start camera presence", error);
      setCameraMessage("Camera unavailable.");
      updateCameraSessionState("offline", normalizedDirection);
    }
  }

  function attachCameraPresence() {
    if (!save.activeSession || !cameraStream) return;

    updateCameraSessionState("attached", cameraDirection, new Date().toISOString());
  }

  function changeCameraDirection(nextDirection: CameraDirection) {
    const normalizedDirection = normalizeCameraDirection(nextDirection);

    setCameraDirection(normalizedDirection);
    if (!save.activeSession) return;

    if (cameraStream) {
      void requestCameraPresence(normalizedDirection);
      return;
    }

    updateCameraSessionState(cameraState === "attached" ? "ready" : cameraState, normalizedDirection);
  }

  function switchCamera() {
    const next: CameraDirection = savedCameraDirection === "front" ? "back" : "front";
    setCameraDirection(next);
    void requestCameraPreview(next);
  }

  function handleSessionPrimaryAction() {
    if (!save.activeSession) return;

    const nextSave = createAutomaticIdentityLock(
      buildCameraSessionState(save, "attached", savedCameraDirection, save.activeSession.cameraAttachedAt ?? new Date().toISOString()),
    );

    writeSave(nextSave);
    setSave(nextSave);
    setIdentityLocked(true);
    if (showAxisDebug) setActiveView("camera");
    if (!cameraStream) void requestCameraPresence(savedCameraDirection, nextSave);
  }

  async function startCameraCalibration() {
    console.log("Calibration started");

    if (!save.activeSession) {
      console.log("Calibration aborted", { reason: "missing_active_session" });
      setDetectionDebug({ ...defaultDetectionDebug, failureReason: "No active session." });
      return;
    }

    if (cameraState !== "attached") {
      console.log("Calibration aborted", { cameraState, reason: "camera_not_attached" });
      setDetectionDebug({ ...defaultDetectionDebug, failureReason: "Camera is not attached." });
      return;
    }

    if (!selectedCalibrationAthlete) {
      console.log("Calibration aborted", { reason: "missing_selected_athlete" });
      setDetectionDebug({ ...defaultDetectionDebug, failureReason: "No athlete selected." });
      return;
    }

    console.log("Athlete selected", {
      athleteId: selectedCalibrationAthlete.id,
      athleteName: selectedCalibrationAthlete.name,
    });
    console.log("Camera attached", {
      cameraDirection: savedCameraDirection,
      cameraState,
    });

    const people = personDetection.visiblePeople;
    setVisiblePeople(people);
    setDetectionDebug({
      ...defaultDetectionDebug,
      failureReason: people === 1 ? "One visible body detected." : `Expected one athlete, detected ${people}.`,
      predictionCount: personDetection.detectionsReturned,
    });

    if (people !== 1) {
      console.log("Calibration validation failed", { visiblePeople: people });
      setIdentityLocked(false);
      setDetectionStatus("not_one");
      return;
    }

    console.log("Calibration validation passed", { visiblePeople: people });
    setIdentityLocked(true);
    setDetectionStatus("ready");
  }

  function captureCalibrationEvidence() {
    if (!save.activeSession || !identity || !selectedCalibrationAthlete || visiblePeople !== 1) {
      console.log("Calibration aborted", {
        hasActiveSession: Boolean(save.activeSession),
        hasIdentity: Boolean(identity),
        hasSelectedAthlete: Boolean(selectedCalibrationAthlete),
        reason: "capture_evidence_guard",
        visiblePeople,
      });
      setDetectionDebug({
        ...detectionDebug,
        failureReason: "Identity lock cannot be saved until one athlete is detected and selected.",
      });
      return;
    }

    const completedAt = new Date().toISOString();
    const lockedTrack =
      primaryTrackingTrack && primaryTrackingTrack.status !== "lost"
        ? primaryTrackingTrack
        : personDetection.tracks.find((track) => track.status === "visible" || track.status === "recovered");
    const evidence: CalibrationEvidence = {
      athlete_id: selectedCalibrationAthlete.id,
      camera_id: getCameraId(savedCameraDirection),
      session_id: save.activeSession.id,
      lockTimestamp: completedAt,
      timestamp: completedAt,
      camera_type: savedCameraDirection,
      calibration_status: "calibrated",
      track_id: lockedTrack?.id,
      visible_people: visiblePeople,
    };
    const identityAnchor = createReplayAnchor(
      `identity:${evidence.session_id}:${evidence.athlete_id}:${completedAt}`,
      "identity_locked",
      completedAt,
      save.activeSession.id,
      save.activeSession.startedAt,
      save.activeSession.muxAssetId,
      "Identity locked",
      {
        athleteId: evidence.athlete_id,
        athleteName: selectedCalibrationAthlete.name,
        cameraDirection: evidence.camera_type,
        cameraId: evidence.camera_id,
      },
    );
    const nextParticipants = activeParticipants.map((participant) =>
      participant.leftAt || participant.id !== selectedCalibrationAthlete.id
        ? participant
        : {
            ...participant,
            calibrationStatus: "calibrated" as const,
            calibratedAt: completedAt,
            calibrationEvidence: evidence,
          },
    );
    const participationWindow = normalizeParticipationWindow(
      save.activeSession.participationWindow,
      save.activeSession.startedAt,
      currentMode,
      nextParticipants,
    );
    const allActiveParticipantsCalibrated = nextParticipants
      .filter((participant) => !participant.leftAt)
      .every((participant) => normalizeCalibrationStatus(participant.calibrationStatus) === "calibrated");
    const nextSave: AxisSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        calibrationStatus: allActiveParticipantsCalibrated ? "calibrated" : "required",
        calibrationRecords: [...(save.activeSession.calibrationRecords ?? []), evidence],
        replayAnchors: [...(save.activeSession.replayAnchors ?? []), identityAnchor],
        replayClips: [...(save.activeSession.replayClips ?? []), createReplayClip(identityAnchor)],
        participationWindow,
        clipContinuityContext: createClipContinuityContext(
          save.activeSession.id,
          currentMode,
          cameraState,
          savedCameraDirection,
          save.activeSession.cameraAttachedAt,
          participationWindow,
          nextParticipants,
        ),
        participants: nextParticipants,
      },
    };
    const nextIdentity =
      selectedCalibrationAthlete.id === identity.id
        ? {
            ...identity,
            calibrationStatus: "calibrated" as const,
            calibratedAt: completedAt,
            calibrationSessionId: save.activeSession.id,
          }
        : identity;

    writeSave(nextSave);
    if (nextIdentity !== identity) writeIdentity(nextIdentity);
    setSave(nextSave);
    setIdentity(nextIdentity);
    setCalibrationEvidence(evidence);
    setDetectionStatus("idle");
    setVisiblePeople(null);
    setIdentityLocked(true);
    setDetectionDebug({
      ...detectionDebug,
      athleteMatchedName: selectedCalibrationAthlete.name,
      failureReason: "",
      identityConfidence: null,
    });
    console.log("Calibration completed", {
      athleteId: evidence.athlete_id,
      sessionId: evidence.session_id,
    });
  }

  function createAutomaticIdentityLock(activeSave: AxisSave): AxisSave {
    if (!activeSave.activeSession || !identity) return activeSave;

    const activeSessionParticipants = activeSave.activeSession.participants ?? [];
    const participant = activeSessionParticipants.find((candidate) => !candidate.leftAt) ?? activeSessionParticipants[0];
    if (!participant) return activeSave;

    const completedAt = new Date().toISOString();
    const activeDirection = normalizeCameraDirection(activeSave.activeSession.cameraDirection);
    const evidence: CalibrationEvidence = {
      athlete_id: participant.id,
      camera_id: getCameraId(activeDirection),
      session_id: activeSave.activeSession.id,
      lockTimestamp: completedAt,
      timestamp: completedAt,
      camera_type: activeDirection,
      calibration_status: "calibrated",
      visible_people: Math.max(1, visiblePeople ?? 1),
    };
    const identityAnchor = createReplayAnchor(
      `identity:${evidence.session_id}:${evidence.athlete_id}:${completedAt}`,
      "identity_locked",
      completedAt,
      activeSave.activeSession.id,
      activeSave.activeSession.startedAt,
      activeSave.activeSession.muxAssetId,
      "Identity locked",
      {
        athleteId: evidence.athlete_id,
        athleteName: participant.name,
        cameraDirection: evidence.camera_type,
        cameraId: evidence.camera_id,
      },
    );
    const nextParticipants = activeSessionParticipants.map((candidate) =>
      candidate.leftAt || candidate.id !== participant.id
        ? candidate
        : {
            ...candidate,
            calibrationStatus: "calibrated" as const,
            calibratedAt: completedAt,
            calibrationEvidence: evidence,
          },
    );
    const participationWindow = normalizeParticipationWindow(
      activeSave.activeSession.participationWindow,
      activeSave.activeSession.startedAt,
      activeSave.activeSession.mode ?? currentMode,
      nextParticipants,
    );

    return {
      ...activeSave,
      activeSession: {
        ...activeSave.activeSession,
        calibrationRecords: [...(activeSave.activeSession.calibrationRecords ?? []), evidence],
        calibrationStatus: "calibrated",
        clipContinuityContext: createClipContinuityContext(
          activeSave.activeSession.id,
          activeSave.activeSession.mode ?? currentMode,
          normalizeCameraState(activeSave.activeSession.cameraState),
          activeDirection,
          activeSave.activeSession.cameraAttachedAt,
          participationWindow,
          nextParticipants,
        ),
        participants: nextParticipants,
        participationWindow,
        replayAnchors: [...(activeSave.activeSession.replayAnchors ?? []), identityAnchor],
        replayClips: [...(activeSave.activeSession.replayClips ?? []), createReplayClip(identityAnchor)],
        recordingAttached: true,
        muxPlaybackId: activeSave.activeSession.muxPlaybackId,
        thumbnailUrl: activeSave.activeSession.thumbnailUrl,
      },
    };
  }

  function removeParticipant(participantId: string) {
    if (!save.activeSession) return;

    const nextParticipants = activeParticipants.map((participant) =>
      participant.id === participantId
        ? {
            ...participant,
            leftAt: new Date().toISOString(),
          }
        : participant,
    );
    const participationWindow = {
      ...normalizeParticipationWindow(
        save.activeSession.participationWindow,
        save.activeSession.startedAt,
        currentMode,
        nextParticipants,
      ),
      participantIds: nextParticipants.filter((participant) => !participant.leftAt).map((participant) => participant.id),
    };
    const cameraState = normalizeCameraState(save.activeSession.cameraState);
    const activeDirection = normalizeCameraDirection(save.activeSession.cameraDirection);
    const nextSave: AxisSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        participationWindow,
        clipContinuityContext: createClipContinuityContext(
          save.activeSession.id,
          currentMode,
          cameraState,
          activeDirection,
          save.activeSession.cameraAttachedAt,
          participationWindow,
          nextParticipants,
        ),
        participants: nextParticipants,
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
  }

  async function interpretLatestMovement() {
    const session = save.sessions[0];
    if (!session) return;

    setIsInterpretingMovement(true);
    setMovementInsightMessage("");
    setMovementInsights([]);

    try {
      const response = await fetch("/api/axis/interpret-session", {
        body: JSON.stringify({
          durationSeconds: session.durationSeconds,
          sessionId: session.id,
          timeline: session.timeline ?? [],
          timelineSummary: session.timelineSummary ?? summarizeTimeline(session.timeline ?? []),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        insights?: MovementInterpretation[];
      };

      if (!response.ok) {
        console.error("Unable to interpret movement", result.error);
        setMovementInsightMessage("Movement interpretation unavailable.");
        return;
      }

      setMovementInsights(Array.isArray(result.insights) ? result.insights : []);
    } catch (error) {
      console.error("Unable to interpret movement", error);
      setMovementInsightMessage("Movement interpretation unavailable.");
    } finally {
      setIsInterpretingMovement(false);
    }
  }

  async function generateLatestReview() {
    const session = save.sessions[0];
    if (!session) return;

    setIsGeneratingReview(true);
    setReviewMessage("");

    try {
      const response = await fetch("/api/axis/review-session", {
        body: JSON.stringify({
          eventTimeline: session.replayEvents ?? [],
          movementTimeline: session.timeline ?? [],
          replayClips: session.replayClips ?? [],
          sessionDuration: session.durationSeconds,
          sessionId: session.id,
          trackingTimeline: (session.timeline ?? []).filter(
            (sample) => sample.entered || sample.exited || sample.trackingLost || sample.trackingRecovered,
          ),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as ReviewEngineResponse;

      if (!response.ok || !result.review) {
        console.error("Unable to generate Axis review", result.error);
        setReviewMessage("Review unavailable.");
        return;
      }

      const nextSessions = save.sessions.map((savedSession) =>
        savedSession.id === session.id
          ? {
              ...savedSession,
              review: result.review,
            }
          : savedSession,
      );
      const nextSave = {
        ...save,
        sessions: nextSessions,
      };

      writeSave(nextSave);
      setSave(nextSave);
      setReviewMessage("Review ready.");
    } catch (error) {
      console.error("Unable to generate Axis review", error);
      setReviewMessage("Review unavailable.");
    } finally {
      setIsGeneratingReview(false);
    }
  }

  function recordShot(type: ShotType, suggestion = shotSuggestion) {
    if (!save.activeSession || !identity) return;

    const activeSession = save.activeSession;
    const activeTrack = primaryTrackingTrack?.status !== "lost" ? primaryTrackingTrack : null;
    const trackedAthlete = activeTrack ? getTrackAthlete(activeTrack.id) : undefined;
    const fallbackAthlete = selectedCalibrationAthlete ?? presentParticipants[0] ?? identityFromAxisIdentity(identity);
    const athlete = suggestion?.athleteId
      ? { id: suggestion.athleteId, name: suggestion.athleteName }
      : trackedAthlete ?? fallbackAthlete;
    const timestamp = new Date().toISOString();
    const replayTimestamp = Math.max(
      0,
      Math.floor((new Date(timestamp).getTime() - new Date(activeSession.startedAt).getTime()) / 1000),
    );
    const existingShotEvents = normalizeShotEvents(activeSession.shotEvents);
    const shotScience = suggestion?.shotScience ?? createShotScience(activeTrack, ballTracking, activeSession.rimLock);
    const startFrame = shotScience?.shotStartFrame ?? 0;
    const releaseFrame = shotScience?.releaseFrame ?? startFrame;
    const apexFrame = shotScience?.apexFrame ?? releaseFrame;
    const rimFrame = shotScience?.rimEntryFrame ?? apexFrame;
    const resultFrame = shotScience?.shotEndFrame ?? rimFrame;
    const shotEndTimestamp = timestamp;
    const shotStartTimestamp = getShotPhaseTimestamp(
      new Date(timestamp).getTime(),
      -Math.round((shotScience?.releaseTime ?? 0.7) * 1000),
    );
    const shotEvent: ShotEvent = {
      attemptNumber: existingShotEvents.length + 1,
      apexFrame,
      arcHeight: shotScience?.arcHeightFeet ?? shotScience?.arcHeight ?? 0,
      athleteId: athlete.id,
      athleteName: athlete.name,
      cameraDirection: savedCameraDirection,
      cameraId: getCameraId(savedCameraDirection),
      distance: shotScience?.shotDistance ?? 0,
      entryAngle: shotScience?.entryAngle ?? 0,
      flightTime: shotScience?.flightTime ?? 0,
      makeStreak: getNextMakeStreak(existingShotEvents, type),
      movementState: activeTrack?.movement.moving
        ? "moving"
        : activeTrack?.movement.stationary
          ? "stationary"
          : "unknown",
      replayTimestamp: suggestion?.replayTimestamp ?? replayTimestamp,
      releaseFrame,
      releaseTime: shotScience?.releaseTime ?? 0,
      resultFrame,
      rimFrame,
      sessionId: activeSession.id,
      shotId: suggestion?.shotId ?? suggestion?.id ?? `shot:${activeSession.id}:${new Date(timestamp).getTime()}`,
      suggestionConfidence: suggestion?.confidence,
      suggestionId: suggestion?.id,
      suggestionReason: suggestion?.reason,
      suggested: Boolean(suggestion),
      shotScience,
      shotEndTimestamp,
      startFrame,
      shotStartTimestamp,
      timestamp,
      trackId: suggestion?.trackId ?? activeTrack?.id,
      trackedTimeSeconds: activeTrack ? activeTrack.visibleTimeMs / 1000 : 0,
      type,
      visibleTimeSeconds: activeTrack ? activeTrack.visibleTimeMs / 1000 : 0,
    };
    const replayEvent = createShotReplayEvent(shotEvent, activeSession.replayEvents?.length ?? 0);
    const replayAnchor = createReplayAnchor(
      replayEvent.id,
      replayEvent.type,
      replayEvent.timestamp,
      activeSession.id,
      activeSession.startedAt,
      activeSession.muxAssetId,
      replayEvent.label,
      {
        athleteId: replayEvent.athleteId,
        athleteName: replayEvent.athleteName,
        cameraDirection: replayEvent.cameraDirection,
        cameraId: replayEvent.cameraId,
      },
    );
    const extraReplayEvents: ReplayEvent[] = [];

    if (activeTrack && suggestion) {
      extraReplayEvents.push(
        createShotPhaseReplayEvent(
          "rim_contact",
          timestamp,
          { id: athlete.id, name: athlete.name },
          activeTrack,
          savedCameraDirection,
          suggestion.confidence,
        ),
      );
    }

    if (
      type === "miss" &&
      activeTrack &&
      ballTracking.visible &&
      ballTracking.position &&
      getPointDistance(ballTracking.position, activeTrack.location) <= 0.34
    ) {
      extraReplayEvents.push({
        athleteId: athlete.id,
        athleteName: athlete.name,
        cameraDirection: savedCameraDirection,
        cameraId: getCameraId(savedCameraDirection),
        confidence: Math.max(0.62, ballTracking.confidence),
        id: `replay:${timestamp}:rebound:${activeTrack.id}`,
        label: "Rebound",
        timestamp,
        trackState: {
          status: "tracked",
          trackId: activeTrack.id,
          tracked: true,
          visible: true,
        },
        type: "rebound",
      });
    }

    const extraReplayAnchors = extraReplayEvents.map((event) =>
      createReplayAnchor(
        event.id,
        event.type,
        event.timestamp,
        activeSession.id,
        activeSession.startedAt,
        activeSession.muxAssetId,
        event.label,
        {
          athleteId: event.athleteId,
          athleteName: event.athleteName,
          cameraDirection: event.cameraDirection,
          cameraId: event.cameraId,
        },
      ),
    );
    const nextSave = {
      ...save,
      activeSession: {
          ...activeSession,
        replayAnchors: [...(activeSession.replayAnchors ?? []), ...extraReplayAnchors, replayAnchor],
        replayClips: [
          ...(activeSession.replayClips ?? []),
          ...[...extraReplayAnchors, replayAnchor].filter(shouldCreateClip).map((anchor) => createReplayClip(anchor)),
        ],
        replayEvents: [...(activeSession.replayEvents ?? []), ...extraReplayEvents, replayEvent],
        shotEvents: [...existingShotEvents, shotEvent],
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
    setShotSuggestion(null);
    if (shotFeedbackTimerRef.current) window.clearTimeout(shotFeedbackTimerRef.current);
    setShotFeedback(type === "make" ? "make" : "miss");
    shotFeedbackTimerRef.current = window.setTimeout(() => setShotFeedback(null), 2200);
    triggerBroadcastMessage(type === "make" ? "MAKE" : "MISS", "SHOT SAVED", type === "make" ? "make" : "miss");
  }

  function recordGameAction(type: GameActionType) {
    if (type === "make" || type === "miss") {
      recordShot(type);
      return;
    }

    if (!save.activeSession || !identity) return;

    const activeTrack = primaryTrackingTrack?.status !== "lost" ? primaryTrackingTrack : null;
    const trackedAthlete = activeTrack ? getTrackAthlete(activeTrack.id) : undefined;
    const athlete = trackedAthlete ?? selectedCalibrationAthlete ?? presentParticipants[0] ?? identityFromAxisIdentity(identity);
    const timestamp = new Date().toISOString();
    const replayEvent: ReplayEvent = {
      athleteId: athlete.id,
      athleteName: athlete.name,
      cameraDirection: savedCameraDirection,
      cameraId: getCameraId(savedCameraDirection),
      id: `replay:${timestamp}:${type}:${activeTrack?.id ?? athlete.id}`,
      label: formatGameActionLabel(type),
      timestamp,
      trackState: {
        status: activeTrack ? "tracked" : "visible",
        trackId: activeTrack?.id,
        tracked: Boolean(activeTrack),
        visible: Boolean(activeTrack),
      },
      type,
    };
    const replayAnchor = createReplayAnchor(
      replayEvent.id,
      replayEvent.type,
      replayEvent.timestamp,
      save.activeSession.id,
      save.activeSession.startedAt,
      save.activeSession.muxAssetId,
      replayEvent.label,
      {
        athleteId: replayEvent.athleteId,
        athleteName: replayEvent.athleteName,
        cameraDirection: replayEvent.cameraDirection,
        cameraId: replayEvent.cameraId,
      },
    );
    const nextSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        replayAnchors: [...(save.activeSession.replayAnchors ?? []), replayAnchor],
        replayClips: [...(save.activeSession.replayClips ?? []), createReplayClip(replayAnchor)],
        replayEvents: [...(save.activeSession.replayEvents ?? []), replayEvent],
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
    triggerBroadcastMessage(formatGameActionLabel(type).toUpperCase());
  }

  function jumpToReplayAnchor(anchor: ReplayAnchor) {
    setSelectedReplayAnchor(anchor);
    setProductSurface("overlay");
  }

  function jumpToFilmAnchor(sessionId: string, anchor?: ReplayAnchor | null) {
    setSelectedFilmSessionId(sessionId);
    if (anchor) setSelectedReplayAnchor(anchor);
    setProductSurface("overlay");
  }

  function toggleOverlay(key: OverlayKey) {
    setOverlaySettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function handleCameraPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!save.activeSession || shouldShowPrimaryFilm) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const normX = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const normY = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));

    // No rim at all — place a new draft rim at tap position
    if (!rimEditModeRim && !save.activeSession.rimLock) {
      const center = { x: normX, y: normY };
      const newRim: RimLock = {
        cameraDirection: savedCameraDirection,
        center,
        createdAt: new Date().toISOString(),
        height: rimGuideBox.height,
        id: `rim:draft:${Date.now()}`,
        polygon: buildRimPolygon(center, rimGuideBox.width, rimGuideBox.height),
        sessionId: save.activeSession.id,
        width: rimGuideBox.width,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      rimDragRef.current = {
        action: "move",
        pointerId: event.pointerId,
        startPointerX: normX,
        startPointerY: normY,
        startRimCenter: center,
        startRimWidth: rimGuideBox.width,
        startRimHeight: rimGuideBox.height,
      };
      setRimEditMode(true);
      setRimEditModeRim(newRim);
      return;
    }

    // In edit mode — detect drag zone (corner handles vs body)
    if (!rimEditMode || !rimEditModeRim) return;

    const rim = rimEditModeRim;
    const cx = rim.center.x;
    const cy = rim.center.y;
    const hw = rim.width / 2;
    const hh = rim.height / 2;
    const handleThreshold = Math.max(0.04, rim.width * 0.22);

    const corners: Array<[RimDragAction, number, number]> = [
      ["resize-nw", cx - hw, cy - hh],
      ["resize-ne", cx + hw, cy - hh],
      ["resize-sw", cx - hw, cy + hh],
      ["resize-se", cx + hw, cy + hh],
    ];

    for (const [action, cornerX, cornerY] of corners) {
      if (Math.abs(normX - cornerX) < handleThreshold && Math.abs(normY - cornerY) < handleThreshold) {
        event.currentTarget.setPointerCapture(event.pointerId);
        rimDragRef.current = {
          action,
          pointerId: event.pointerId,
          startPointerX: normX,
          startPointerY: normY,
          startRimCenter: rim.center,
          startRimWidth: rim.width,
          startRimHeight: rim.height,
        };
        return;
      }
    }

    // Hit the rim body — drag to move
    const bodyPad = 0.025;
    if (
      normX > cx - hw - bodyPad &&
      normX < cx + hw + bodyPad &&
      normY > cy - hh - bodyPad &&
      normY < cy + hh + bodyPad
    ) {
      event.currentTarget.setPointerCapture(event.pointerId);
      rimDragRef.current = {
        action: "move",
        pointerId: event.pointerId,
        startPointerX: normX,
        startPointerY: normY,
        startRimCenter: rim.center,
        startRimWidth: rim.width,
        startRimHeight: rim.height,
      };
    }
  }

  function handleCameraPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!rimDragRef.current || rimDragRef.current.pointerId !== event.pointerId) return;
    if (!rimEditModeRim) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const normX = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const normY = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    const { action, startPointerX, startPointerY, startRimCenter, startRimWidth, startRimHeight } = rimDragRef.current;
    const dx = normX - startPointerX;
    const dy = normY - startPointerY;

    let newCenter = { ...startRimCenter };
    let newWidth = startRimWidth;
    let newHeight = startRimHeight;

    if (action === "move") {
      newCenter = {
        x: Math.max(newWidth / 2, Math.min(1 - newWidth / 2, startRimCenter.x + dx)),
        y: Math.max(newHeight / 2, Math.min(1 - newHeight / 2, startRimCenter.y + dy)),
      };
    } else if (action === "resize-se") {
      newWidth = Math.max(0.04, Math.min(0.5, startRimWidth + dx * 2));
      newHeight = Math.max(0.02, Math.min(0.3, startRimHeight + dy * 2));
    } else if (action === "resize-sw") {
      newWidth = Math.max(0.04, Math.min(0.5, startRimWidth - dx * 2));
      newHeight = Math.max(0.02, Math.min(0.3, startRimHeight + dy * 2));
    } else if (action === "resize-nw") {
      newWidth = Math.max(0.04, Math.min(0.5, startRimWidth - dx * 2));
      newHeight = Math.max(0.02, Math.min(0.3, startRimHeight - dy * 2));
    } else if (action === "resize-ne") {
      newWidth = Math.max(0.04, Math.min(0.5, startRimWidth + dx * 2));
      newHeight = Math.max(0.02, Math.min(0.3, startRimHeight - dy * 2));
    }

    setRimEditModeRim({
      ...rimEditModeRim,
      center: newCenter,
      width: newWidth,
      height: newHeight,
      polygon: buildRimPolygon(newCenter, newWidth, newHeight),
    });
  }

  function handleCameraPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (rimDragRef.current?.pointerId === event.pointerId) {
      rimDragRef.current = null;
    }
  }

  function lockRim() {
    if (!rimEditModeRim || !save.activeSession) return;
    const rim = rimEditModeRim;
    const rimLock: RimLock = {
      cameraDirection: savedCameraDirection,
      center: rim.center,
      createdAt: new Date().toISOString(),
      height: rim.height,
      id: `rim:${save.activeSession.id}:${Date.now()}`,
      polygon: buildRimPolygon(rim.center, rim.width, rim.height),
      sessionId: save.activeSession.id,
      width: rim.width,
    };
    const nextSave = { ...save, activeSession: { ...save.activeSession, rimLock } };
    writeSave(nextSave);
    setSave(nextSave);
    setRimEditModeRim(null);
    setRimEditMode(false);
    triggerBroadcastMessage("RIM LOCATED");
  }

  function adjustRim() {
    const rim = save.activeSession?.rimLock;
    if (!rim) return;
    setRimEditModeRim({ ...rim });
    setRimEditMode(true);
  }

  function clearRim() {
    rimDragRef.current = null;
    setRimEditModeRim(null);
    setRimEditMode(false);
    if (!save.activeSession) return;
    const nextSave = { ...save, activeSession: { ...save.activeSession, rimLock: undefined } };
    writeSave(nextSave);
    setSave(nextSave);
  }

  function renderAxisOverlayLayer(surface: OverlaySurface) {
    const isReplaySurface = surface === "replay";
    const isLiveSurface = surface === "live";
    const sessionLabel = save.activeSession?.mode ?? resultsModeLabel;

    return (
      <div className="axis-overlay-engine" data-surface={surface}>
        {/* Replay: film moment navigation buttons */}
        {isReplaySurface && filmOverlayAnchors.length ? (
          <div className="axis-film-event-overlay axis-overlay-layer" aria-label="Film events">
            {filmOverlayAnchors.map((anchor, index) => (
              <button
                data-selected={selectedReplayAnchor?.eventId === anchor.eventId}
                key={anchor.eventId}
                onClick={() => jumpToReplayAnchor(anchor)}
                style={{ top: `${14 + (index % 6) * 11}%` }}
                type="button"
              >
                <strong>{formatFilmTimestamp(anchor.videoTimestamp)}</strong>
                <em>{formatHumanMomentLabel(anchor)}</em>
              </button>
            ))}
          </div>
        ) : null}

        {/* Player tracking box \u2014 live only, no label */}
        {isLiveSurface && isVisionTrackingEnabled && soloAthleteTrack ? (
          <div className="axis-player-tracking-overlay axis-player-tracking-overlay-live axis-overlay-layer" aria-label="Player tracking">
            <div
              className="axis-player-track-box axis-player-track-box-broadcast"
              data-status={soloAthleteTrack.status}
              style={{
                height: `${soloAthleteTrack.boundingBox.height * 100}%`,
                left: `${soloAthleteTrack.boundingBox.x * 100}%`,
                top: `${soloAthleteTrack.boundingBox.y * 100}%`,
                width: `${soloAthleteTrack.boundingBox.width * 100}%`,
              }}
            />
          </div>
        ) : null}

        {/* Ball dot \u2014 live only, no label */}
        {isLiveSurface && isVisionTrackingEnabled && ballTracking.visible && ballTracking.boundingBox ? (
          <div className="axis-ball-tracking-overlay axis-overlay-layer" aria-label="Ball tracking">
            <div
              className="axis-ball-track-dot"
              data-status={ballTracking.status}
              style={{
                height: `${ballTracking.boundingBox.height * 100}%`,
                left: `${ballTracking.boundingBox.x * 100}%`,
                top: `${ballTracking.boundingBox.y * 100}%`,
                width: `${ballTracking.boundingBox.width * 100}%`,
              }}
            />
          </div>
        ) : null}

        {/* Rim ring \u2014 three states: not-set / ready (editing) / locked */}
        {isLiveSurface && (() => {
          const displayRim = rimEditMode && rimEditModeRim ? rimEditModeRim : currentRimLock;

          if (!displayRim && save.activeSession) {
            return (
              <div className="axis-rim-lock-prompt axis-overlay-layer" aria-label="Rim">
                RIM NOT SET
              </div>
            );
          }

          if (!displayRim) return null;

          return (
            <div className="axis-rim-tracking-overlay axis-overlay-layer" aria-label="Rim">
              <div
                className="axis-rim-track-ring"
                data-edit={rimEditMode ? "true" : undefined}
                data-locked={!rimEditMode ? "true" : undefined}
                style={{
                  height: `${displayRim.height * 100}%`,
                  left: `${(displayRim.center.x - displayRim.width / 2) * 100}%`,
                  top: `${(displayRim.center.y - displayRim.height / 2) * 100}%`,
                  width: `${displayRim.width * 100}%`,
                }}
              >
                {rimEditMode ? (
                  <>
                    <span className="axis-rim-handle axis-rim-handle-nw" />
                    <span className="axis-rim-handle axis-rim-handle-ne" />
                    <span className="axis-rim-handle axis-rim-handle-sw" />
                    <span className="axis-rim-handle axis-rim-handle-se" />
                  </>
                ) : null}
              </div>
            </div>
          );
        })()}

        {/* Replay: shot trajectory */}
        {isReplaySurface &&
        overlayShot?.shotScience?.trajectorySpline &&
        overlayShot.shotScience.trajectorySpline.length > 1 ? (
          <svg className="axis-ball-flight-overlay axis-overlay-layer" aria-label="Ball flight path" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              points={overlayShot.shotScience.trajectorySpline
                .map((point) => `${Math.max(0, Math.min(100, point.x * 100))},${Math.max(0, Math.min(100, point.y * 100))}`)
                .join(" ")}
            />
            <circle cx={overlayShot.shotScience.releasePoint.x * 100} cy={overlayShot.shotScience.releasePoint.y * 100} r="1.1" />
            <circle cx={overlayShot.shotScience.apexPoint.x * 100} cy={overlayShot.shotScience.apexPoint.y * 100} r="1.1" />
            <circle cx={overlayShot.shotScience.entryPoint.x * 100} cy={overlayShot.shotScience.entryPoint.y * 100} r="1.1" />
          </svg>
        ) : null}

        {/* Broadcast HUD \u2014 top left: time + stats */}
        {isLiveSurface && save.activeSession ? (
          <div className="axis-broadcast-hud-left axis-overlay-layer" aria-label="Live stats">
            <span className="axis-broadcast-timer">{cameraTimeLabel}</span>
            <span className="axis-broadcast-stat"><em>ATT</em><strong>{cameraAttempts}</strong></span>
            <span className="axis-broadcast-stat"><em>M</em><strong>{cameraMakes}</strong></span>
            <span className="axis-broadcast-stat"><em>MS</em><strong>{cameraMisses}</strong></span>
            {cameraAttempts > 0 ? (
              <span className="axis-broadcast-stat"><em>FG%</em><strong>{cameraFieldGoalPercentage}%</strong></span>
            ) : null}
          </div>
        ) : null}

        {/* Broadcast HUD \u2014 top right: session name */}
        {isLiveSurface && sessionLabel ? (
          <div className="axis-broadcast-hud-right axis-overlay-layer" aria-label="Session">
            <span>{sessionLabel.toUpperCase()}</span>
          </div>
        ) : null}

        {/* Bottom left: player name */}
        {isLiveSurface && overlayPlayerName ? (
          <div className="axis-broadcast-player-label axis-overlay-layer" aria-label="Player">
            <strong>{overlayPlayerName}</strong>
          </div>
        ) : null}

        {/* Bottom center: temporary detection messages */}
        {isLiveSurface && broadcastMessage ? (
          <div
            className="axis-broadcast-message axis-overlay-layer"
            key={broadcastMessage.id}
            data-variant={broadcastMessage.variant ?? undefined}
            aria-live="polite"
            aria-label="Detection event"
          >
            <strong>{broadcastMessage.text}</strong>
            {broadcastMessage.subtext ? <em>{broadcastMessage.subtext}</em> : null}
          </div>
        ) : null}

        {/* Shot result flash — fills camera when make/miss confirmed */}
        {isLiveSurface && shotFeedback ? (
          <div className="axis-shot-result axis-overlay-layer" data-result={shotFeedback} key={`shot-result-${shotFeedback}`} aria-live="assertive">
            <strong className="axis-shot-result-label">{shotFeedback === "make" ? "MAKE" : "MISS"}</strong>
            <span className="axis-shot-result-sub">SHOT SAVED</span>
          </div>
        ) : null}

        {/* Shot confirmation panel — slides up when confirmation needed */}
        {isLiveSurface && shotSuggestion?.needsConfirmation ? (
          <div className="axis-shot-panel axis-overlay-layer" aria-label="Shot confirmation">
            <span className="axis-shot-panel-label">SHOT DETECTED</span>
            <div className="axis-shot-panel-actions">
              <button
                className="axis-shot-panel-btn axis-shot-panel-btn-make"
                onClick={(e) => { e.stopPropagation(); recordShot("make"); }}
                type="button"
              >
                MAKE
              </button>
              <button
                className="axis-shot-panel-btn axis-shot-panel-btn-miss"
                onClick={(e) => { e.stopPropagation(); recordShot("miss"); }}
                type="button"
              >
                MISS
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function createFinalizeWorkPayload(session: SavedSession) {
    const exportObject = createSessionExportObject(session);
    const filmMoments = exportObject.overlays.map((anchor) => ({
      filmTimeSeconds: anchor.videoTimestamp,
      id: anchor.eventId,
      label: formatHumanMomentLabel(anchor),
      type: anchor.eventType,
    }));
    const events = exportObject.events.map((event) => ({
      filmTimeSeconds: getVideoTimestamp(event.timestamp, session.startedAt),
      id: event.id,
      label: event.label,
      participantId: event.athleteId,
      timestamp: event.timestamp,
      type: event.type,
    }));

    return {
      events,
      exportQueue: exportObject.exports,
      film: {
        clips: exportObject.clips.map((clip) => ({
          clipEnd: clip.clipEnd,
          clipKind: clip.clipKind,
          clipStart: clip.clipStart,
          eventId: clip.eventId,
          id: clip.id,
          leadInSeconds: clip.leadInSeconds,
          leadOutSeconds: clip.leadOutSeconds,
          playlistOrder: clip.playlistOrder,
          sourceLabel: clip.sourceLabel,
          type: clip.eventType,
        })),
        id: session.muxAssetId ? `film:${session.muxAssetId}` : undefined,
        moments: filmMoments,
        muxAssetId: exportObject.video.muxAssetId,
        overlays: filmMoments,
        playbackId: exportObject.video.playbackId,
        playlist: exportObject.clips
          .slice()
          .sort((a, b) => (a.playlistOrder ?? 0) - (b.playlistOrder ?? 0))
          .map((clip) => ({
            clipEnd: clip.clipEnd,
            clipKind: clip.clipKind,
            clipStart: clip.clipStart,
            eventId: clip.eventId,
            id: clip.id,
            label: clip.sourceLabel ?? clip.replayLabel,
            order: clip.playlistOrder ?? 0,
          })),
        status: exportObject.video.playbackId ? ("ready" as const) : exportObject.video.muxAssetId ? ("processing" as const) : ("unavailable" as const),
        thumbnailUrl: exportObject.video.thumbnailUrl,
        timeline: filmMoments,
        workId: session.id,
      },
      overlayProfile: {
        ...overlaySettings,
        hasOverlayFilm: Boolean(session.overlayMuxPlaybackId),
        hasHighlights: Boolean((session.highlightClips ?? []).some((c) => c.type === "make")),
      },
      pipeline: exportObject.pipeline,
      playerReport: exportObject.playerReport,
      results: {
        attempts: exportObject.metrics.shotSummary.attempts,
        durationSeconds: exportObject.metrics.workTimeSeconds,
        eventsCount: events.length,
        fieldGoalPercentage: exportObject.metrics.shotSummary.attempts ? exportObject.metrics.shotSummary.fieldGoalPercentage : null,
        filmMomentsCount: filmMoments.length,
        makes: exportObject.metrics.shotSummary.makes,
        misses: exportObject.metrics.shotSummary.misses,
      },
      shots: exportObject.shots.map((shot) => ({
        attemptNumber: shot.attemptNumber,
        apexFrame: shot.apexFrame,
        athleteId: shot.athleteId,
        athleteName: shot.athleteName,
        arcHeight: shot.arcHeight,
        entryAngle: shot.shotScience?.entryAngle,
        apexPoint: shot.shotScience?.apexPoint,
        distance: shot.distance,
        entryPoint: shot.shotScience?.entryPoint,
        flightTime: shot.flightTime,
        filmTimeSeconds: shot.replayTimestamp,
        makeStreak: shot.makeStreak,
        releaseFrame: shot.releaseFrame,
        releaseAngle: shot.shotScience?.releaseAngle,
        releasePoint: shot.shotScience?.releasePoint,
        releaseSpeed: shot.shotScience?.releaseSpeed,
        releaseTime: shot.shotScience?.releaseTime,
        resultFrame: shot.resultFrame,
        rimFrame: shot.rimFrame,
        shotArcFeet: shot.shotScience?.arcHeightFeet,
        shotDistance: shot.shotScience?.shotDistance,
        shotEndTimestamp: shot.shotEndTimestamp,
        shotId: shot.shotId,
        shotStartTimestamp: shot.shotStartTimestamp,
        startFrame: shot.startFrame,
        timestamp: shot.timestamp,
        trajectorySpline: shot.shotScience?.trajectorySpline,
        type: shot.type,
      })),
      work: {
        endedAt: exportObject.session.endedAt,
        id: exportObject.session.id,
        overlayMuxPlaybackId: session.overlayMuxPlaybackId,
        participantIds: (session.participants ?? []).map((participant) => participant.id),
        rimLock: session.rimLock,
        startedAt: exportObject.session.startedAt,
        status: "complete" as const,
        type: exportObject.session.type,
      },
    };
  }

  async function handleFilmAction(
    action: "share" | "save" | "copy" | "download",
    filmType: SessionExportType,
    shareUrl: string | undefined,
    downloadUrl: string | undefined,
  ) {
    if ((action === "share" || action === "save") && shareUrl) {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "Axis Film", url: shareUrl });
        } catch {
          // user cancelled
        }
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedFilmType(filmType);
        window.setTimeout(() => setCopiedFilmType(null), 2000);
      }
    } else if (action === "copy" && shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedFilmType(filmType);
        window.setTimeout(() => setCopiedFilmType(null), 2000);
      } catch {
        // clipboard unavailable
      }
    } else if (action === "download" && downloadUrl) {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  async function queueFinalizeWork(session: SavedSession) {
    try {
      const response = await fetch("/api/work/finalize", {
        body: JSON.stringify(createFinalizeWorkPayload(session)),
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        method: "POST",
      });

      if (!response.ok) console.error("Unable to queue finalizeWork", { status: response.status });
    } catch (error) {
      console.error("Unable to queue finalizeWork", error);
    }
  }

  async function checkOut() {
    if (!save.activeSession) return;

    setRitualState("saving");
    const localThumbnailUrl = captureFilmThumbnail();
    const filmCapture = await stopFilmRecording();
    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(
      0,
      Math.floor((new Date(endedAt).getTime() - new Date(save.activeSession.startedAt).getTime()) / 1000),
    );
    const sessionMode = save.activeSession.mode ?? defaultParticipationMode;
    const sessionCameraState = normalizeCameraState(save.activeSession.cameraState);
    const sessionCameraDirection = normalizeCameraDirection(save.activeSession.cameraDirection);
    const timeline = normalizeTimeline(save.activeSession.timeline);
    const ballTimeline = normalizeBallTimeline(save.activeSession.ballTimeline);
    const shotEvents = normalizeShotEvents(save.activeSession.shotEvents);
    const timelineSummary = summarizeTimeline(timeline);
    const rawMeasurements = createRawMeasurements(timelineSummary);
    const summaryLayer = createSessionSummaryLayer(durationSeconds, rawMeasurements);
    const sessionParticipants = activeParticipants.map((participant) => ({
      ...participant,
      activeAtCheckout: !participant.leftAt,
    }));
    const participationWindow = {
      ...normalizeParticipationWindow(
        save.activeSession.participationWindow,
        save.activeSession.startedAt,
        sessionMode,
        activeParticipants,
      ),
      closedAt: endedAt,
      status: "closed" as const,
      participantIds: activeParticipants.filter((participant) => !participant.leftAt).map((participant) => participant.id),
    };
    const replayEvents = [
      ...normalizeReplayEvents(save.activeSession.replayEvents),
      ...createReplayEvents(timeline, sessionParticipants, sessionCameraDirection),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const shotSummary = summarizeShots(shotEvents);
    const replayAnchors = createReplayAnchorsForSession({
      calibrationRecords: save.activeSession.calibrationRecords,
      cameraDirection: sessionCameraDirection,
      endedAt,
      id: save.activeSession.id,
      muxAssetId: save.activeSession.muxAssetId,
      participants: sessionParticipants,
      replayEvents,
      shotEvents,
      startedAt: save.activeSession.startedAt,
    });
    const replayClips = createAutomaticReplayClips({
      anchors: replayAnchors,
      muxAssetId: save.activeSession.muxAssetId,
      sessionId: save.activeSession.id,
      sessionStartedAt: save.activeSession.startedAt,
      shotEvents,
      timeline,
    });
    const completedSession = {
      id: save.activeSession.id,
      startedAt: save.activeSession.startedAt,
      endedAt,
      durationSeconds,
      mode: sessionMode,
      recordingAttached: Boolean(save.activeSession.recordingAttached || filmCapture?.blob.size),
      calibrationStatus: normalizeCalibrationStatus(save.activeSession.calibrationStatus),
      cameraState: sessionCameraState,
      cameraDirection: sessionCameraDirection,
      cameraAttachedAt: save.activeSession.cameraAttachedAt,
      muxAssetId: save.activeSession.muxAssetId,
      muxPlaybackId: save.activeSession.muxPlaybackId,
      thumbnailUrl: save.activeSession.thumbnailUrl ?? localThumbnailUrl,
      rimLock: save.activeSession.rimLock,
      participationWindow,
      clipContinuityContext: createClipContinuityContext(
        save.activeSession.id,
        sessionMode,
        sessionCameraState,
        sessionCameraDirection,
        save.activeSession.cameraAttachedAt,
        participationWindow,
        sessionParticipants,
      ),
      participants: sessionParticipants,
      participantCount,
      activeParticipantCount,
      ballTimeline,
      timeline,
      timelineSummary,
      rawMeasurements,
      summaryLayer,
      replayAnchors,
      replayClips,
      replayEvents,
      review: {
        generatedAt: endedAt,
        largestInterruption: replayEvents.some((event) => event.type === "tracking_interruption")
          ? "Tracking interruption recorded."
          : "No interruption recorded.",
        mostActiveMoment: replayEvents.find((event) => event.type === "movement_spike")?.label ?? "Session recorded.",
        notableEvents: replayEvents.slice(0, 5).map((event) => `${event.label} / ${formatTime(event.timestamp)}`),
        reviewNotes: [
          replayClips.length ? `${replayClips.length} replay clips created.` : "Session saved without replay clips.",
          `${replayEvents.length} events saved.`,
        ],
        sessionSummary: `${formatDuration(durationSeconds)} recorded.`,
      },
      shotEvents,
      shotSummary,
      highlightClips: buildHighlightClips(shotEvents),
    };
    const completedSessionWithExportQueue = {
      ...completedSession,
      exportQueue: createSessionExportObject(completedSession).exports,
    };
    const nextSave = {
      activeSession: null,
      sessions: [completedSessionWithExportQueue, ...save.sessions].slice(0, 40),
    };

    writeSave(nextSave);
    setSave(nextSave);
    setLatestSavedSessionId(completedSessionWithExportQueue.id);
    setActiveView("session");
    setIsReviewOpen(false);
    setDetectionStatus("idle");
    setVisiblePeople(null);
    setCalibrationEvidence(null);
    setCameraStream(null);
    setCameraMessage("");

    window.setTimeout(() => {
      setRitualState("complete");
    }, 520);
    if (filmCapture?.blob.size) {
      const filmPreviewUrl = URL.createObjectURL(filmCapture.blob);
      setFilmPreviewUrls((current) => ({
        ...current,
        [completedSessionWithExportQueue.id]: filmPreviewUrl,
      }));
      void queueFinalizeWork(completedSessionWithExportQueue);
      void uploadSessionFilm(completedSessionWithExportQueue, filmCapture.blob);
      const capturedBlob = filmCapture.blob;
      const capturedSession = completedSessionWithExportQueue;
      void generateOverlayFilm(capturedBlob, capturedSession).then((overlayBlob) => {
        if (overlayBlob) void uploadOverlayFilm(capturedSession, overlayBlob);
      });
    } else {
      void queueFinalizeWork(completedSessionWithExportQueue);
    }
  }

  if (authPhase === "checking" || authPhase === "restoring") {
    return (
      <main className="axis-shell axis-entry-shell">
        <section className="axis-restore" aria-label="Opening Axis">
          <p className="axis-meta">Axis</p>
          <h1>Opening your work...</h1>
          <div className="axis-restore-line" aria-hidden="true" />
          <div className="axis-restore-rail" aria-label="Axis steps">
            <span>Start</span>
            <span>Record</span>
            <span>Review</span>
          </div>
        </section>
      </main>
    );
  }

  if (authPhase === "entry" || !identity) {
    return (
      <main className="axis-shell axis-entry-shell">
        <section className="axis-entry" aria-label="Axis entry">
          <header className="axis-entry-top">
            <span>Axis</span>
            <span>Start</span>
            <span>Record</span>
            <span>Review</span>
          </header>

          <section className="axis-entry-center">
            <p className="axis-meta">{isSupabaseConfigured() ? "Save your work" : "Local mode"}</p>
            <h1>Start. Record. Review.</h1>
            <p className="axis-entry-copy">Axis saves what happened so you can come back to it.</p>
          </section>

          <form className="axis-entry-form" onSubmit={enterAxis}>
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@email.com"
                type="email"
                value={email}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="password"
                type="password"
                value={password}
              />
            </label>
            <button type="submit">Enter</button>
          </form>
          {authMessage ? <p className="axis-auth-message">{authMessage}</p> : null}
        </section>
      </main>
    );
  }

  if (activeView === "camera" && save.activeSession) {
    return (
      <main className="axis-shell">
        <section className="axis-surface axis-camera-page" aria-label="Camera page">
          <header className="axis-top">
            <div className="axis-identity">
              <p className="axis-meta">Axis</p>
              <h1>Record</h1>
              <button className="axis-sign-out" onClick={() => setActiveView("session")} type="button">
                Back
              </button>
            </div>

            {showAxisDebug ? (
              <p className="axis-presence-row" aria-label="Camera state">
              {`${currentMode.toUpperCase()} • ${formatCount(activeParticipantCount, "ATHLETE", "ATHLETES").toUpperCase()} • ${cameraDirectionLabel.toUpperCase()} • ${cameraLabel.toUpperCase()}`}
              </p>
            ) : null}
          </header>

          <section className="axis-camera-page-main" aria-label="Live camera">
            <div className="axis-camera-preview axis-camera-preview-large" data-state={cameraState}>
              <video aria-label="Live camera preview" autoPlay muted playsInline ref={cameraPreviewRef} />
              {cameraStream ? null : <span>Camera offline</span>}
              {!showAxisDebug && soloAthleteTrack ? (
                <div className="axis-player-tracking-overlay axis-player-tracking-overlay-live" aria-label="Player tracking">
                  <div
                    className="axis-player-track-box axis-player-track-box-simple"
                    data-status={soloAthleteTrack.status}
                    style={{
                      height: `${soloAthleteTrack.boundingBox.height * 100}%`,
                      left: `${soloAthleteTrack.boundingBox.x * 100}%`,
                      top: `${soloAthleteTrack.boundingBox.y * 100}%`,
                      width: `${soloAthleteTrack.boundingBox.width * 100}%`,
                    }}
                  >
                    <div className="axis-player-track-label axis-player-track-label-simple">
                      <strong>{getTrackAthlete(soloAthleteTrack.id)?.name ?? selectedCalibrationAthlete?.name ?? "ATHLETE"}</strong>
                    </div>
                  </div>
                </div>
              ) : null}
              {!showAxisDebug && ballTracking.visible && ballTracking.boundingBox ? (
                <div className="axis-ball-tracking-overlay" aria-label="Ball tracking">
                  <div
                    className="axis-ball-track-box"
                    data-status={ballTracking.status}
                    style={{
                      height: `${ballTracking.boundingBox.height * 100}%`,
                      left: `${ballTracking.boundingBox.x * 100}%`,
                      top: `${ballTracking.boundingBox.y * 100}%`,
                      width: `${ballTracking.boundingBox.width * 100}%`,
                    }}
                  >
                    <div className="axis-ball-track-label">
                      <strong>{formatBallTrackStatus(ballTracking)}</strong>
                    </div>
                  </div>
                </div>
              ) : null}
              {isVisionTrackingEnabled ? (
                <div className="axis-rim-tracking-overlay" aria-label="Rim tracking">
                  <div
                    className="axis-rim-track-box"
                    style={{
                      height: `${rimGuideBox.height * 100}%`,
                      left: `${rimGuideBox.x * 100}%`,
                      top: `${rimGuideBox.y * 100}%`,
                      width: `${rimGuideBox.width * 100}%`,
                    }}
                  >
                    <div className="axis-rim-track-label">
                      <strong>RIM</strong>
                    </div>
                  </div>
                </div>
              ) : null}
              {showAxisDebug ? (
                <div className="axis-player-tracking-overlay" aria-label="Player tracking overlay">
                  {personDetection.tracks.map((track) => (
                    <div
                      className="axis-player-track-box"
                      data-status={track.status}
                      key={track.id}
                      style={{
                        height: `${track.boundingBox.height * 100}%`,
                        left: `${track.boundingBox.x * 100}%`,
                        top: `${track.boundingBox.y * 100}%`,
                        width: `${track.boundingBox.width * 100}%`,
                      }}
                    >
                      <div className="axis-player-track-label">
                        <strong>{getTrackAthlete(track.id)?.name ?? track.displayName}</strong>
                        <span>{`${track.id} / ${formatTrackingStatus(track.status)}`}</span>
                      </div>
                      <div className="axis-player-track-metrics">
                        <span>{`VISIBLE ${formatDuration(track.visibleTimeMs / 1000)}`}</span>
                        <span>{`DIR ${track.movement.direction.toUpperCase()}`}</span>
                        <span>{`DIST ${track.movement.distanceTraveled.toFixed(2)}`}</span>
                        <span>{track.movement.moving ? "MOVING" : "STATIONARY"}</span>
                        <span>{`LOST COUNT ${track.lostCount}`}</span>
                        <span>{`RECOVERED COUNT ${track.recoveryCount}`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {showAxisDebug ? (
                <div className="axis-outdoor-tracking-readout" aria-label="Outdoor tracking test">
                  <span>
                    <strong>TRACKED</strong>
                    <em>{primaryTrackingTrack && primaryTrackingTrack.status !== "lost" ? "YES" : "NO"}</em>
                  </span>
                  <span>
                    <strong>TRACK ID</strong>
                    <em>{primaryTrackingTrack ? `${primaryTrackingTrack.displayName} / ${primaryTrackingTrack.id}` : "NONE"}</em>
                  </span>
                  <span>
                    <strong>ATHLETE</strong>
                    <em>{primaryTrackingAthlete?.name ?? "UNBOUND"}</em>
                  </span>
                  <span>
                    <strong>VISIBLE TIME</strong>
                    <em>{primaryTrackingTrack ? formatDuration(primaryTrackingTrack.visibleTimeMs / 1000) : "0s"}</em>
                  </span>
                  <span>
                    <strong>TRACK LOSSES</strong>
                    <em>{primaryTrackingTrack?.lostCount ?? 0}</em>
                  </span>
                  <span>
                    <strong>TRACK RECOVERIES</strong>
                    <em>{primaryTrackingTrack?.recoveryCount ?? 0}</em>
                  </span>
                  {personDetection.tracks.map((track) => (
                    <span key={`track-readout-${track.id}`}>
                      <strong>{track.displayName.toUpperCase()}</strong>
                      <em>{getTrackAthlete(track.id)?.name ?? track.id}</em>
                    </span>
                  ))}
                </div>
              ) : null}
              {showAxisDebug ? (
                <div className="axis-camera-debug-overlay" aria-label="Camera debug state">
                  <span>
                    <strong>MODEL LOADED</strong>
                    <em>{personDetection.modelLoaded ? "YES" : "NO"}</em>
                  </span>
                  <span>
                    <strong>INFERENCE RUNNING</strong>
                    <em>{personDetection.inferenceRunning ? "YES" : "NO"}</em>
                  </span>
                  <span>
                    <strong>BODY DETECTED</strong>
                    <em>{visiblePeople !== null && visiblePeople > 0 ? "YES" : "NO"}</em>
                  </span>
                  <span>
                    <strong>VISIBLE PEOPLE</strong>
                    <em>{visiblePeople ?? 0}</em>
                  </span>
                  <span>
                    <strong>DETECTIONS RETURNED</strong>
                    <em>{personDetection.detectionsReturned}</em>
                  </span>
                  <span>
                    <strong>IDENTITY LOCK</strong>
                    <em>{isAthleteMatched ? "YES" : "NO"}</em>
                  </span>
                  <span>
                    <strong>FRAME RATE</strong>
                    <em>{`${frameRate} FPS`}</em>
                  </span>
                  <span>
                    <strong>VIDEO WIDTH</strong>
                    <em>{personDetection.videoWidth}</em>
                  </span>
                  <span>
                    <strong>VIDEO HEIGHT</strong>
                    <em>{personDetection.videoHeight}</em>
                  </span>
                  <span>
                    <strong>BALL VISIBLE</strong>
                    <em>{ballTracking.visible ? "YES" : "NO"}</em>
                  </span>
                  <span>
                    <strong>BALL POSITION</strong>
                    <em>
                      {ballTracking.position
                        ? `${ballTracking.position.x.toFixed(2)}, ${ballTracking.position.y.toFixed(2)}`
                        : "NONE"}
                    </em>
                  </span>
                  <span>
                    <strong>BALL VELOCITY</strong>
                    <em>
                      {ballTracking.velocity
                        ? `${ballTracking.velocity.x.toFixed(2)}, ${ballTracking.velocity.y.toFixed(2)}`
                        : "NONE"}
                    </em>
                  </span>
                </div>
              ) : null}
              {showAxisDebug ? (
                <div className="axis-camera-status-overlay" aria-label="Camera identity state">
                  {cameraStatusSignals.map((signal) => (
                    <span data-active={signal !== "LOOKING FOR ATHLETE"} key={signal}>
                      {signal}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <section className="axis-camera-page-controls" aria-label="Camera controls">
              {showAxisDebug ? (
                <div className="axis-camera-selector" aria-label="Camera direction">
                  <button
                    aria-pressed={cameraDirection === "front"}
                    onClick={() => changeCameraDirection("front")}
                    type="button"
                  >
                    Front camera
                  </button>
                  <button
                    aria-pressed={cameraDirection === "back"}
                    onClick={() => changeCameraDirection("back")}
                    type="button"
                  >
                    Back camera
                  </button>
                </div>
              ) : null}
              <div className="axis-camera-actions">
                <button onClick={() => requestCameraPresence()} type="button">
                  Record
                </button>
                {showAxisDebug ? (
                  <button disabled={!cameraStream || cameraState === "attached"} onClick={attachCameraPresence} type="button">
                    {cameraState === "attached" ? "Camera attached" : "Attach camera"}
                  </button>
                ) : null}
              </div>
              {cameraMessage ? <span className="axis-camera-message">{cameraMessage}</span> : null}
            </section>
          </section>

          {showAxisDebug ? (
            <section className="axis-camera-page-grid" aria-label="Camera session state">
            <section className="axis-session-module" aria-label="Active roster">
              <header>
                <span>Active roster</span>
                <strong>{formatCount(activeParticipantCount, "active")}</strong>
              </header>
              <div className="axis-participant-list axis-active-roster-list">
                {presentParticipants.length ? (
                  presentParticipants.map((participant) => (
                    <span
                      className="axis-participant-token"
                      data-athlete-id={participant.id}
                      data-selected={selectedCalibrationAthlete?.id === participant.id}
                      key={participant.id}
                    >
                      <span>{participant.name}</span>
                      <em>{normalizeCalibrationStatus(participant.calibrationStatus) === "calibrated" ? "Locked" : "Needs identity"}</em>
                      <button
                        onClick={() => {
                          setSelectedCalibrationAthleteId(participant.id);
                          setDetectionStatus("idle");
                          setVisiblePeople(null);
                          setDetectionDebug(defaultDetectionDebug);
                          setCalibrationEvidence(null);
                        }}
                        type="button"
                      >
                        Choose athlete
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="axis-roster-empty">Roster waiting</span>
                )}
              </div>
            </section>

            <section className="axis-session-module axis-camera-calibration-module" aria-label="Athlete identity">
              <header>
                <span>Athlete identity</span>
                <strong>{calibrationWorkflowLabel}</strong>
              </header>
              <span className="axis-window-state">{calibrationProgressLabel}</span>
              <span className="axis-window-state">
                {selectedCalibrationAthlete ? selectedCalibrationAthlete.name : "Choose athlete"}
              </span>
              {visiblePeople !== null ? (
                <span className="axis-window-state">{`${visiblePeople} ${visiblePeople === 1 ? "athlete" : "athletes"} detected`}</span>
              ) : null}
              <button
                className="axis-calibration-action"
                disabled={
                  cameraState !== "attached" ||
                  !selectedCalibrationAthlete ||
                  selectedAthleteCalibrationStatus === "calibrated" ||
                  detectionStatus === "capturing" ||
                  detectionStatus === "sending"
                }
                onClick={startCameraCalibration}
                type="button"
              >
                {detectionStatus === "capturing" || detectionStatus === "sending"
                  ? "Looking for athlete"
                  : selectedAthleteCalibrationStatus === "calibrated"
                    ? "Identity locked"
                    : "Identify athlete"}
              </button>
              {detectionStatus === "ready" ? (
                <button className="axis-calibration-action" onClick={captureCalibrationEvidence} type="button">
                  Lock identity
                </button>
              ) : null}
              {calibrationEvidence?.athlete_id === selectedCalibrationAthlete?.id ? (
                <section className="axis-calibration-screen" aria-label="Athlete confirmed">
                  <header>
                    <span>Athlete confirmed</span>
                    <strong>Identity locked</strong>
                  </header>
                  <p>{calibrationEvidence.camera_type === "front" ? "Front camera" : "Back camera"}</p>
                  <p>{calibrationEvidence.track_id ? `${calibrationEvidence.track_id} / ${selectedCalibrationAthlete?.name}` : selectedCalibrationAthlete?.name}</p>
                  <span className="axis-window-state">{new Date(calibrationEvidence.timestamp).toLocaleTimeString()}</span>
                </section>
              ) : null}
            </section>

            <section className="axis-session-module axis-recording-module" aria-label="Video">
              <header>
                <span>Video</span>
                <strong>{recordingLabel}</strong>
              </header>
              <button
                className="axis-recording-toggle axis-recording-primary"
                data-attached={isRecordingAttached}
                onClick={toggleRecordingAttachment}
                type="button"
              >
                {isRecordingAttached ? "Recording attached" : "Recording off"}
              </button>
            </section>
            </section>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="axis-shell">
        <section className="axis-surface" aria-label="Axis ritual home">
        {showAxisDebug ? (
        <header className="axis-top">
          <div className="axis-identity">
            <p className="axis-meta">Axis</p>
            <h1>{athleteLabel}</h1>
            <button className="axis-sign-out" onClick={signOut} type="button">
              Sign out
            </button>
          </div>

          <p className="axis-presence-row" aria-label="Participation data">
            {compactPresence}
          </p>
        </header>
        ) : (
          <header className="axis-app-store-intro">
            <div>
              <p className="axis-meta">Axis</p>
              <h1>Camera</h1>
              <span>Record. Axis sees.</span>
            </div>
            <button className="axis-sign-out" onClick={signOut} type="button">
              Sign out
            </button>
          </header>
        )}

        {!showAxisDebug ? (
          <section className="axis-camera-home" aria-label="Camera">
            <div
              className="axis-camera-preview axis-camera-broadcast"
              data-rim-lock={rimEditMode ? "editing" : currentRimLock ? "locked" : save.activeSession ? "waiting" : "off"}
              data-state={cameraStream ? "attached" : "offline"}
              onPointerDown={handleCameraPointerDown}
              onPointerMove={handleCameraPointerMove}
              onPointerUp={handleCameraPointerUp}
              onPointerCancel={handleCameraPointerUp}
            >
              {shouldShowPrimaryFilm && latestFilmPlaybackId && filmSession ? (
                <MuxPlayer
                  className="axis-primary-film-player"
                  key={`${latestFilmPlaybackId}:${selectedReplayAnchor?.eventId ?? "start"}`}
                  metadata={{
                    video_id: filmSession.id,
                    video_title: `${filmSession.mode ?? defaultParticipationMode} film`,
                    viewer_user_id: identity.id,
                  }}
                  playbackId={latestFilmPlaybackId}
                  poster={latestFilmThumbnailUrl}
                  primaryColor="#a8d933"
                  secondaryColor="#030303"
                  startTime={Math.max(0, selectedFilmTime)}
                  streamType="on-demand"
                />
              ) : shouldShowPrimaryFilm && localFilmSrc ? (
                <video
                  className="axis-primary-film-player"
                  controls
                  key={`${filmSession?.id ?? "film"}:${selectedReplayAnchor?.eventId ?? "start"}`}
                  playsInline
                  src={localFilmSrc}
                />
              ) : (
                <video aria-label="Camera preview" autoPlay muted playsInline ref={cameraPreviewRef} />
              )}
              {!shouldShowPrimaryFilm && !cameraStream ? (
                <div className="axis-camera-menu axis-overlay-layer" aria-label="Camera">
                  <span className="axis-camera-menu-status">
                    {cameraPermissionState === "denied" || cameraPermissionState === "unavailable"
                      ? "CAMERA UNAVAILABLE"
                      : "CAMERA READY"}
                  </span>
                  {cameraPermissionState === "denied" ? (
                    <span className="axis-camera-menu-hint">Enable camera access in device settings.</span>
                  ) : cameraPermissionState === "unavailable" ? (
                    <span className="axis-camera-menu-hint">Camera not available on this device.</span>
                  ) : (
                    <div className="axis-camera-menu-options">
                      <button
                        className="axis-camera-menu-btn"
                        data-active={savedCameraDirection === "front"}
                        onClick={(e) => { e.stopPropagation(); void requestCameraPreview("front"); }}
                        type="button"
                      >
                        Front Camera
                      </button>
                      <button
                        className="axis-camera-menu-btn"
                        data-active={savedCameraDirection === "back"}
                        onClick={(e) => { e.stopPropagation(); void requestCameraPreview("back"); }}
                        type="button"
                      >
                        Rear Camera
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
              {!shouldShowPrimaryFilm && cameraStream ? (
                cameraMenuOpen ? (
                  <div className="axis-camera-menu axis-camera-menu-live axis-overlay-layer" aria-label="Camera">
                    <span className="axis-camera-menu-status">CAMERA ACTIVE</span>
                    <div className="axis-camera-menu-options">
                      <button
                        className="axis-camera-menu-btn"
                        data-active={savedCameraDirection === "front"}
                        onClick={(e) => { e.stopPropagation(); void requestCameraPreview("front"); }}
                        type="button"
                      >
                        Front Camera
                      </button>
                      <button
                        className="axis-camera-menu-btn"
                        data-active={savedCameraDirection === "back"}
                        onClick={(e) => { e.stopPropagation(); void requestCameraPreview("back"); }}
                        type="button"
                      >
                        Rear Camera
                      </button>
                      <button
                        className="axis-camera-menu-btn"
                        onClick={(e) => { e.stopPropagation(); switchCamera(); }}
                        type="button"
                      >
                        Switch Camera
                      </button>
                    </div>
                    <button
                      className="axis-camera-live-dismiss"
                      onClick={(e) => { e.stopPropagation(); setCameraMenuOpen(false); }}
                      type="button"
                    >
                      CAMERA ACTIVE
                    </button>
                  </div>
                ) : (
                  <button
                    className="axis-camera-live-control"
                    onClick={(e) => { e.stopPropagation(); setCameraMenuOpen(true); }}
                    type="button"
                  >
                    CAMERA ACTIVE
                  </button>
                )
              ) : null}
              {renderAxisOverlayLayer(shouldShowPrimaryFilm ? "replay" : "live")}
            </div>
            <section className="axis-broadcast-dock" aria-label="Actions">
              {save.activeSession ? (
                <div className="axis-rim-strip">
                  <span
                    className="axis-rim-strip-label"
                    data-state={rimEditMode ? "ready" : currentRimLock ? "locked" : "not-set"}
                  >
                    {rimEditMode ? "RIM READY" : currentRimLock ? "RIM LOCKED" : "RIM NOT SET"}
                  </span>
                  <div className="axis-rim-strip-actions">
                    {rimEditMode ? (
                      <>
                        <button className="axis-rim-strip-btn axis-rim-strip-btn-primary" onClick={lockRim} type="button">
                          Lock Rim
                        </button>
                        <button className="axis-rim-strip-btn" onClick={clearRim} type="button">
                          Clear
                        </button>
                      </>
                    ) : currentRimLock ? (
                      <button className="axis-rim-strip-btn" onClick={adjustRim} type="button">
                        Adjust
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="axis-broadcast-event-bar" data-shot-pending={shotSuggestion?.needsConfirmation ? "true" : undefined}>
                {visibleWorkActions.map((action) => (
                  <button
                    data-shot-action={shotSuggestion?.needsConfirmation && (action === "make" || action === "miss") ? action : undefined}
                    disabled={!save.activeSession}
                    key={action}
                    onClick={() => recordGameAction(action)}
                    type="button"
                  >
                    {formatGameActionLabel(action)}
                  </button>
                ))}
              </div>
              {ritualState === "active" ? (
                isRecordingAttached ? (
                  <button className="axis-broadcast-primary" onClick={checkOut} type="button">
                    End
                  </button>
                ) : (
                  <button className="axis-broadcast-primary" onClick={handleSessionPrimaryAction} type="button">
                    Record
                  </button>
                )
              ) : (
                <button
                  className="axis-broadcast-primary"
                  disabled={ritualState === "saving"}
                  onClick={ritualState === "saving" ? undefined : checkIn}
                  type="button"
                >
                  {ritualState === "saving" ? "Saving" : "Start"}
                </button>
              )}
            </section>

            {/* Export Center */}
            {exportCenterFilms.length > 0 ? (
              <section className="axis-export-center" aria-label="Export">
                <header className="axis-export-center-header">
                  <span className="axis-export-center-label">EXPORT</span>
                  {latestSession ? (
                    <span className="axis-export-center-meta">
                      {latestSession.mode ?? "Training"} · {formatDuration(latestSession.durationSeconds)}
                    </span>
                  ) : null}
                </header>
                <div className="axis-export-grid">
                  {exportCenterFilms.map((film) => (
                    <article
                      className="axis-export-card"
                      data-status={film.status}
                      key={film.type}
                    >
                      <span className="axis-export-card-readiness">{film.readinessLabel}</span>
                      {film.status === "available" ? (
                        <div className="axis-export-card-actions">
                          <button
                            className="axis-export-action"
                            onClick={() => void handleFilmAction("save", film.type, film.shareUrl, film.downloadUrl)}
                            type="button"
                          >
                            Save to Device
                          </button>
                          <button
                            className="axis-export-action"
                            onClick={() => void handleFilmAction("share", film.type, film.shareUrl, film.downloadUrl)}
                            type="button"
                          >
                            Share
                          </button>
                          <button
                            className="axis-export-action"
                            onClick={() => void handleFilmAction("copy", film.type, film.shareUrl, film.downloadUrl)}
                            type="button"
                          >
                            {copiedFilmType === film.type ? "Copied" : "Copy Link"}
                          </button>
                          <button
                            className="axis-export-action"
                            onClick={() => void handleFilmAction("download", film.type, film.shareUrl, film.downloadUrl)}
                            type="button"
                          >
                            Download
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        ) : null}

        {showAxisDebug ? (
        <section className="axis-ritual" aria-label="Work" data-state={ritualState}>
          {showAxisDebug ? <p className="axis-meta">Axis</p> : null}
          {save.activeSession ? (
            <section className="axis-live-command" aria-label="Session live">
              <span>{currentMode}</span>
              <strong>{isRecordingAttached ? "Recording" : "Ready to record"}</strong>
              {isRecordingAttached ? (
                <em>End when your work is done.</em>
              ) : (
                <button onClick={handleSessionPrimaryAction} type="button">
                  {sessionPrimaryActionLabel}
                </button>
              )}
            </section>
          ) : (
            <>
              {!showAxisDebug ? (
                <>
                  <p className="axis-start-line">
                    {isDirectorMode
                      ? "Organization results update from work."
                      : isCoachMode
                        ? "Choose the session. Press Start."
                        : "Choose the work. Press Start."}
                  </p>
                  <div className="axis-operator-strip" aria-label="Work mode">
                    <button
                      aria-pressed={workOperatorMode === "player"}
                      onClick={() => changeWorkOperatorMode("player")}
                      type="button"
                    >
                      Player
                    </button>
                    <button
                      aria-pressed={workOperatorMode === "coach"}
                      onClick={() => changeWorkOperatorMode("coach")}
                      type="button"
                    >
                      Coach
                    </button>
                    <button
                      aria-pressed={workOperatorMode === "parent"}
                      onClick={() => changeWorkOperatorMode("parent")}
                      type="button"
                    >
                      Parent
                    </button>
                    <button
                      aria-pressed={workOperatorMode === "director"}
                      onClick={() => changeWorkOperatorMode("director")}
                      type="button"
                    >
                      Director
                    </button>
                  </div>
                  <div className="axis-kind-picker" aria-label="Choose activity">
                    {availableParticipationModes.map((mode) => (
                      <button
                        aria-pressed={pendingMode === mode}
                        key={mode}
                        onClick={() => setPendingMode(mode)}
                        type="button"
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <button
                className="axis-check-button"
                onClick={ritualState === "saving" ? undefined : checkIn}
                disabled={ritualState === "saving"}
                type="button"
              >
                {ritualState === "saving" ? "Saving" : "Start"}
              </button>
              {showAxisDebug ? (
                <section className="axis-bridge-state" aria-label="Camera state">
                  <span>{bridgeSessionLabel}</span>
                  <strong>{bridgeRosterLabel}</strong>
                  <em>{cameraLabel}</em>
                  <em>{cameraDirectionLabel}</em>
                </section>
              ) : null}
            </>
          )}
          {showAxisDebug && save.activeSession ? (
            <section className="axis-session-object" aria-label="Session continuity object">
              <details className="axis-session-drawer">
                <summary>
                  <span>Active roster</span>
                  <strong>{formatCount(activeParticipantCount, "active")}</strong>
                </summary>
                <section className="axis-session-module" aria-label="Available athlete">
                  <header>
                    <span>Available athlete</span>
                    <strong>{athleteLabel}</strong>
                  </header>
                  <span className="axis-window-state">Checked in</span>
                </section>
                <section className="axis-roster-object" aria-label="Active roster">
                  <header>
                    <span>Active roster</span>
                    <strong>{formatCount(activeParticipantCount, "active")}</strong>
                  </header>
                  <div className="axis-participant-list axis-active-roster-list">
                    {presentParticipants.length ? (
                      presentParticipants.map((participant) => (
                        <span
                          className="axis-participant-token"
                          data-athlete-id={participant.id}
                          key={participant.id}
                        >
                          <span>{participant.name}</span>
                          <button onClick={() => removeParticipant(participant.id)} type="button">
                            Remove
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="axis-roster-empty">Roster waiting</span>
                    )}
                  </div>
                </section>
              </details>

              <details className="axis-session-drawer">
                <summary>
                  <span>Session details</span>
                  <strong>{`${currentMode} / ${formatCount(activeParticipantCount, "active")}`}</strong>
                </summary>
                <section className="axis-session-module axis-mode-module" aria-label="Current mode control">
                  <header>
                    <span>Current mode</span>
                    <strong>{currentMode}</strong>
                  </header>
                  <button className="axis-mode-toggle" onClick={() => setIsModePickerOpen((isOpen) => !isOpen)} type="button">
                    Change mode
                  </button>
                  {isModePickerOpen ? (
                    <div className="axis-mode-list" aria-label="Participation modes">
                      {availableParticipationModes.map((mode) => (
                        <button
                          aria-pressed={currentMode === mode}
                          key={mode}
                          onClick={() => changeMode(mode)}
                          type="button"
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
                <section className="axis-session-module axis-window-module" aria-label="Participation window">
                  <header>
                    <span>Participation window</span>
                    <strong>{participationWindowLabel}</strong>
                  </header>
                  <span className="axis-window-state">{`${currentMode} / ${formatCount(activeParticipantCount, "active")}`}</span>
                </section>
              </details>
            </section>
          ) : null}
          {ritualState === "active" ? (
            <section className="axis-shot-bar" aria-label="Shot confirmation">
              <span>{shotActionLabel}</span>
              <p className="axis-layer-value">
                {`Player ${primaryTrackingTrack?.status !== "lost" ? "tracked" : "waiting"} / Ball ${
                  ballTracking.visible ? "tracked" : "waiting"
                } / Shot ${shotSuggestion ? "detected" : "waiting"}`}
              </p>
              <div>
                {visibleWorkActions.map((action) => (
                  <button
                    disabled={!save.activeSession}
                    key={action}
                    onClick={() => recordGameAction(action)}
                    type="button"
                  >
                    {formatGameActionLabel(action)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          {ritualState === "active" ? (
            <button className="axis-checkout-button" onClick={checkOut} type="button">
              End
            </button>
          ) : null}
          {ritualState === "complete" && latestSession ? (
            <section className="axis-review-entry" aria-label="Session complete">
              {showAxisDebug ? (
                <div>
                <strong>Session complete</strong>
                </div>
              ) : (
                <div>
                  <span>Done</span>
                  <strong>Review your work</strong>
                </div>
              )}
              <div className="axis-complete-actions">
                <button
                  aria-expanded={showAxisDebug ? isReviewOpen : true}
                  aria-controls="axis-session-review"
                  onClick={() => {
                    if (showAxisDebug) {
                      setIsReviewOpen((isOpen) => !isOpen);
                    }
                  }}
                  type="button"
                >
                  Review
                </button>
                {showAxisDebug ? (
                  <>
                    <button type="button">Share</button>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}
        </section>
        ) : null}

        {showAxisDebug && isDirectorMode ? (
          <section className="axis-review-panel" aria-label="Organization results">
            <div className="axis-review-grid">
              <section className="axis-review-block axis-results-stage" aria-label="Director results">
                <span>Organization</span>
                <div className="axis-results-grid">
                  <article>
                    <strong>{organizationResults.fg}%</strong>
                    <em>FG%</em>
                  </article>
                  <article>
                    <strong>{organizationResults.makes}</strong>
                    <em>Makes</em>
                  </article>
                  <article>
                    <strong>{organizationResults.misses}</strong>
                    <em>Misses</em>
                  </article>
                  <article>
                    <strong>{organizationResults.attempts}</strong>
                    <em>Attempts</em>
                  </article>
                  <article>
                    <strong>{formatShotScienceReleaseTime(resultsShotScience)}</strong>
                    <em>Release</em>
                  </article>
                  <article>
                    <strong>{formatShotScienceArc(resultsShotScience)}</strong>
                    <em>Arc</em>
                  </article>
                  <article>
                    <strong>{resultsLongestMakeStreak}</strong>
                    <em>Streak</em>
                  </article>
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {showAxisDebug ? (
          <section className="axis-review-panel" aria-label="Organization rollups">
            <div className="axis-role-rollups">
              <section className="axis-review-block axis-results-stage" aria-label="Player rollup">
                <span>Player</span>
                <div className="axis-results-grid">
                  <article>
                    <strong>{organizationRollups.player.makes}</strong>
                    <em>Makes</em>
                  </article>
                  <article>
                    <strong>{organizationRollups.player.misses}</strong>
                    <em>Misses</em>
                  </article>
                  <article>
                    <strong>{resultsShotSummary.attempts}</strong>
                    <em>Attempts</em>
                  </article>
                  <article>
                    <strong>{resultsShotSummary.fieldGoalPercentage}%</strong>
                    <em>FG%</em>
                  </article>
                </div>
              </section>

              <section className="axis-review-block axis-results-stage" aria-label="Coach rollup">
                <span>Coach</span>
                <div className="axis-results-grid">
                  <article>
                    <strong>{resultsShotSummary.fieldGoalPercentage}%</strong>
                    <em>FG%</em>
                  </article>
                  <article>
                    <strong>{resultsShotSummary.attempts}</strong>
                    <em>Attempts</em>
                  </article>
                  <article>
                    <strong>{resultsLongestMakeStreak}</strong>
                    <em>Streak</em>
                  </article>
                  <article>
                    <strong>{formatShotScienceReleaseTime(fastestReleaseShot?.shotScience)}</strong>
                    <em>Fastest Shot</em>
                  </article>
                </div>
              </section>

              <section className="axis-review-block axis-results-stage" aria-label="Parent rollup">
                <span>Parent</span>
                <div className="axis-results-grid">
                  <article>
                    <strong>{organizationRollups.parent.makes}</strong>
                    <em>Makes</em>
                  </article>
                  <article>
                    <strong>{organizationRollups.parent.misses}</strong>
                    <em>Misses</em>
                  </article>
                  <article>
                    <strong>{resultsShotSummary.attempts}</strong>
                    <em>Attempts</em>
                  </article>
                  <article>
                    <strong>{resultsShotSummary.fieldGoalPercentage}%</strong>
                    <em>FG%</em>
                  </article>
                </div>
              </section>

              <section className="axis-review-block axis-results-stage" aria-label="Director rollup">
                <span>Director</span>
                <div className="axis-results-grid">
                  <article>
                    <strong>{organizationResults.fg}%</strong>
                    <em>FG%</em>
                  </article>
                  <article>
                    <strong>{organizationResults.makes}</strong>
                    <em>Makes</em>
                  </article>
                  <article>
                    <strong>{organizationResults.misses}</strong>
                    <em>Misses</em>
                  </article>
                  <article>
                    <strong>{organizationResults.attempts}</strong>
                    <em>Attempts</em>
                  </article>
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {shouldShowReviewPanel && latestSession ? (
          <section className="axis-review-panel" id="axis-session-review" aria-label="Session review">
            {showAxisDebug ? (
              <header>
              <span>Replay</span>
              <strong>Show me</strong>
              </header>
            ) : null}

            <div className="axis-review-grid">
              {shouldShowFilmSurface ? (
              <section className="axis-review-block axis-replay-stage axis-film-stage" aria-label="Film">
                <span>Film</span>
                {latestFilmPlaybackId && filmSession ? (
                  <MuxPlayer
                    className="axis-film-player"
                    key={`${latestFilmPlaybackId}:${selectedReplayAnchor?.eventId ?? "start"}`}
                    metadata={{
                      video_id: filmSession.id,
                      video_title: `${filmSession.mode ?? defaultParticipationMode} film`,
                      viewer_user_id: identity.id,
                    }}
                    playbackId={latestFilmPlaybackId}
                    poster={latestFilmThumbnailUrl}
                    primaryColor="#a8d933"
                    secondaryColor="#030303"
                    startTime={Math.max(0, selectedFilmTime)}
                    streamType="on-demand"
                  />
                ) : localFilmSrc ? (
                  <video
                    className="axis-film-player"
                    controls
                    key={`${filmSession?.id ?? "film"}:${selectedReplayAnchor?.eventId ?? "start"}`}
                    playsInline
                    src={localFilmSrc}
                  />
                ) : (
                  <div className="axis-film-empty">
                    <strong>{latestFilmAvailability}</strong>
                    <em>Film will appear here when recording is available.</em>
                  </div>
                )}
                <div className="axis-film-meta" aria-label="Latest clip">
                  <strong>Latest Clip</strong>
                  <em>{latestClipAnchor ? formatHumanMomentLabel(latestClipAnchor) : latestFilmAvailability}</em>
                </div>
                <section className="axis-moment-card-grid" aria-label="Moments">
                  {momentCards.length ? (
                    momentCards.map((moment) => (
                      <button
                        className="axis-moment-card"
                        data-selected={selectedReplayAnchor?.eventId === moment.anchor.eventId}
                        key={moment.anchor.eventId}
                        onClick={() => jumpToFilmAnchor(moment.anchor.sessionId, moment.anchor)}
                        type="button"
                      >
                        <span className="axis-moment-thumb">
                          {moment.thumbnailUrl ? <img alt="" src={moment.thumbnailUrl} /> : <span aria-hidden="true" />}
                        </span>
                        <span className="axis-moment-body">
                          <strong>{moment.title}</strong>
                          <em>{formatFilmTimestamp(moment.anchor.videoTimestamp)}</em>
                          {moment.metrics.length ? (
                            <span className="axis-moment-metrics">
                              {moment.metrics.map((metric) => (
                                <small key={metric}>{metric}</small>
                              ))}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))
                  ) : (
                    <article className="axis-moment-empty">
                      <strong>No moments yet</strong>
                      <em>Confirmed events become film cards.</em>
                    </article>
                  )}
                </section>
                {showAxisDebug ? (
                  <em>
                  {selectedReplayAnchor
                    ? `${formatDuration(selectedReplayAnchor.videoTimestamp)} / ${selectedReplayAnchor.athleteName ?? "Session"}`
                    : latestReviewAnchors[0]
                      ? `${formatDuration(latestReviewAnchors[0].videoTimestamp)} / ${latestReviewAnchors[0].athleteName ?? "Session"}`
                      : "Replay waiting"}
                  </em>
                ) : null}
              </section>
              ) : null}

              {shouldShowResultsSurface ? (
                <section className="axis-review-block axis-results-stage" aria-label="Intelligent film">
                  <span>Intelligent Film</span>
                  <div className="axis-results-grid">
                    {!showAxisDebug ? (
                      <>
                        <article>
                          <strong>{resultsShotSummary.fieldGoalPercentage}%</strong>
                          <em>FG%</em>
                        </article>
                        <article>
                          <strong>{resultsShotSummary.makes}</strong>
                          <em>Makes</em>
                        </article>
                        <article>
                          <strong>{resultsShotSummary.misses}</strong>
                          <em>Misses</em>
                        </article>
                        <article>
                          <strong>{resultsShotSummary.attempts}</strong>
                          <em>Attempts</em>
                        </article>
                        <article>
                          <strong>{formatShotScienceReleaseTime(resultsShotScience)}</strong>
                          <em>Release</em>
                        </article>
                        <article>
                          <strong>{formatShotScienceArc(resultsShotScience)}</strong>
                          <em>Arc</em>
                        </article>
                        <article>
                          <strong>{formatShotScienceDistance(resultsShotScience)}</strong>
                          <em>Distance</em>
                        </article>
                        <article>
                          <strong>{resultsLongestMakeStreak}</strong>
                          <em>Streak</em>
                        </article>
                        <article>
                          <strong>{performanceImprovementLabel}</strong>
                          <em>Most Improved</em>
                        </article>
                        <article>
                          <strong>{formatShotScienceReleaseTime(fastestReleaseShot?.shotScience)}</strong>
                          <em>Fastest Shot</em>
                        </article>
                        <article>
                          <strong>{formatShotScienceArc(highestArcShot?.shotScience)}</strong>
                          <em>Highest Arc</em>
                        </article>
                      </>
                    ) : (
                      <>
                        <article>
                          <strong>{resultsShotSummary.fieldGoalPercentage}%</strong>
                          <em>FG%</em>
                        </article>
                        <article>
                          <strong>{resultsShotSummary.makes}</strong>
                          <em>Makes</em>
                        </article>
                        <article>
                          <strong>{resultsShotSummary.misses}</strong>
                          <em>Misses</em>
                        </article>
                        <article>
                          <strong>{resultsShotSummary.attempts}</strong>
                          <em>Attempts</em>
                        </article>
                        <article>
                          <strong>{formatShotScienceReleaseTime(resultsShotScience)}</strong>
                          <em>Release</em>
                        </article>
                        <article>
                          <strong>{formatShotScienceArc(resultsShotScience)}</strong>
                          <em>Arc</em>
                        </article>
                        <article>
                          <strong>{formatShotScienceDistance(resultsShotScience)}</strong>
                          <em>Distance</em>
                        </article>
                        <article>
                          <strong>{resultsLongestMakeStreak}</strong>
                          <em>Streak</em>
                        </article>
                        <article>
                          <strong>{performanceImprovementLabel}</strong>
                          <em>Most Improved</em>
                        </article>
                        <article>
                          <strong>{formatShotScienceReleaseTime(fastestReleaseShot?.shotScience)}</strong>
                          <em>Fastest Shot</em>
                        </article>
                        <article>
                          <strong>{formatShotScienceArc(highestArcShot?.shotScience)}</strong>
                          <em>Highest Arc</em>
                        </article>
                      </>
                    )}
                  </div>
                </section>
              ) : null}

              {showAxisDebug ? (
              <section className="axis-review-block axis-review-engine" aria-label="Review notes">
                <span>What happened</span>
                {latestSessionReview ? (
                  <div>
                    <article className="axis-review-row">
                      <strong>Session summary</strong>
                      <em>{latestSessionReview.sessionSummary}</em>
                    </article>
                    <article className="axis-review-row">
                      <strong>Most active moment</strong>
                      <em>{latestSessionReview.mostActiveMoment}</em>
                    </article>
                    <article className="axis-review-row">
                      <strong>Largest interruption</strong>
                      <em>{latestSessionReview.largestInterruption}</em>
                    </article>
                    {latestSessionReview.notableEvents.map((event, index) => (
                      <article className="axis-review-row" key={`review-event-${index}`}>
                        <strong>Notable event</strong>
                        <em>{event}</em>
                      </article>
                    ))}
                    {latestSessionReview.reviewNotes.map((note, index) => (
                      <article className="axis-review-row" key={`review-note-${index}`}>
                        <strong>Note</strong>
                        <em>{note}</em>
                      </article>
                    ))}
                  </div>
                ) : (
                  <article className="axis-review-row">
                    <strong>Review waiting</strong>
                    <em>Generate notes from recorded replay events</em>
                  </article>
                )}
                <button className="axis-review-action" disabled={isGeneratingReview} onClick={generateLatestReview} type="button">
                  {isGeneratingReview ? "Reading replay" : latestSessionReview ? "Update review" : "Generate review"}
                </button>
                {reviewMessage ? <em className="axis-review-message">{reviewMessage}</em> : null}
              </section>
              ) : null}

              {showAxisDebug ? (
              <section className="axis-review-block" aria-label="Session summary">
                <span>Session summary</span>
                <article>
                  <strong>{formatDuration(latestSession.durationSeconds)}</strong>
                  <em>{`${latestSession.mode ?? defaultParticipationMode} / ${formatCount(
                    latestSession.activeParticipantCount || latestSession.participantCount || 1,
                    "athlete",
                    "athletes",
                  )}`}</em>
                </article>
                <article>
                  <strong>{`${latestReviewEvents.length} events / ${latestReviewClips.length} clips`}</strong>
                  <em>{`Ended ${formatStamp(latestSession.endedAt)}`}</em>
                </article>
              </section>
              ) : null}

              {showAxisDebug && shouldShowFilmSurface ? (
              <section className="axis-review-block" aria-label="Review moments">
                <span>{showAxisDebug ? "Moments" : "Watch Film"}</span>
                {showAxisDebug ? (
                  <div>
                    {latestReviewAnchors.length ? (
                      latestReviewAnchors.map((anchor) => (
                        <button
                          className="axis-review-row"
                          key={anchor.eventId}
                          onClick={() => jumpToReplayAnchor(anchor)}
                          type="button"
                        >
                          <strong>{formatDuration(anchor.videoTimestamp)}</strong>
                          <em>{anchor.replayLabel}</em>
                        </button>
                      ))
                    ) : (
                      <article className="axis-review-row">
                        <strong>Review waiting</strong>
                        <em>Finish work to see what happened</em>
                      </article>
                    )}
                  </div>
                ) : (
                  <div className="axis-watch-list">
                    {filmWatchGroups.map((group) => {
                      const anchors = getFilmAnchorsByType(latestFilmTimelineAnchors, group.type);

                      return (
                        <section className="axis-watch-group" key={group.type}>
                          <header>
                            <strong>{group.label}</strong>
                            <em>{anchors.length}</em>
                          </header>
                          <div>
                            {anchors.length ? (
                              anchors.map((anchor) => (
                                <button
                                  className="axis-review-row"
                                  data-selected={selectedReplayAnchor?.eventId === anchor.eventId}
                                  key={anchor.eventId}
                                  onClick={() => jumpToReplayAnchor(anchor)}
                                  type="button"
                                >
                                  <strong>{formatDuration(anchor.videoTimestamp)}</strong>
                                  <em>{anchor.athleteName ?? formatHumanMomentLabel(anchor)}</em>
                                </button>
                              ))
                            ) : (
                              <article className="axis-review-row">
                                <strong>--</strong>
                                <em>None yet</em>
                              </article>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>
              ) : null}

              {showAxisDebug && shouldShowFilmSurface ? (
              <section className="axis-review-block" aria-label="Moment cards">
                <span>Moment Cards</span>
                <div>
                  {latestFilmTimelineAnchors.length ? (
                    (showAxisDebug ? latestReviewAnchors : latestFilmTimelineAnchors).map((anchor) => (
                      <button
                        className="axis-review-row"
                        key={anchor.eventId}
                        onClick={() => jumpToReplayAnchor(anchor)}
                        type="button"
                      >
                        <strong>{formatDuration(anchor.videoTimestamp)}</strong>
                        <em>{showAxisDebug ? anchor.replayLabel : formatHumanMomentLabel(anchor)}</em>
                      </button>
                    ))
                  ) : (
                    <article className="axis-review-row">
                      <strong>Review waiting</strong>
                      <em>Finish work to see what happened</em>
                    </article>
                  )}
                </div>
              </section>
              ) : null}

              {showAxisDebug ? (
              <section className="axis-review-block" aria-label="Who did it">
                <span>Who</span>
                <div>
                  {latestReviewEvents.length ? (
                    latestReviewEvents.map((event) => (
                      <article className="axis-review-row" key={event.id}>
                        <strong>{event.athleteName}</strong>
                        <em>{`${event.label} / ${formatTime(event.timestamp)}`}</em>
                      </article>
                    ))
                  ) : (
                    <article className="axis-review-row">
                      <strong>Session</strong>
                      <em>No player moments yet</em>
                    </article>
                  )}
                </div>
              </section>
              ) : null}

              {showAxisDebug ? (
              <section className="axis-review-block" aria-label="Replay clips">
                <span>Clips</span>
                <div>
                  {latestReviewClips.length ? (
                    latestReviewClips.map((clip) => (
                      <article className="axis-review-row" key={clip.id}>
                        <strong>{clip.replayLabel}</strong>
                        <em>{formatReplayClip(clip)}</em>
                      </article>
                    ))
                  ) : (
                    <article className="axis-review-row">
                      <strong>No clips yet</strong>
                      <em>Replay saved</em>
                    </article>
                  )}
                </div>
              </section>
              ) : null}
            </div>
          </section>
        ) : null}

        {showAxisDebug ? (
          <footer className="axis-bottom" aria-label="Continuity records">
          <details className="axis-history-drawer">
            <summary>
              <span>History</span>
              <strong>{historyStatus}</strong>
            </summary>
            <section className="axis-history" aria-label="Axis History">
            <header className="axis-history-header">
              <p className="axis-meta">Axis History</p>
              <strong>{historyStatus}</strong>
            </header>

            <section className="axis-athlete-memory" aria-label="Athlete Timeline">
              <header>
                <div>
                  <span>Athlete Timeline</span>
                  <strong>{athleteMemory.athleteName}</strong>
                </div>
                <em>{formatAthleteGrowth(athleteMemory)}</em>
              </header>

              <div className="axis-athlete-memory-grid">
                <section className="axis-memory-block" aria-label="Intelligent film history">
                  <span>Intelligent Film</span>
                  <div>
                    {athleteMemory.sessions.length ? (
                      athleteMemory.sessions.map((session) => (
                        <article className="axis-memory-row" key={`memory-session-${session.id}`}>
                          <strong>{`${(session.shotSummary ?? summarizeShots(session.shotEvents ?? [])).fieldGoalPercentage}% FG`}</strong>
                          <em>{`${(session.shotSummary ?? summarizeShots(session.shotEvents ?? [])).makes} makes / ${
                            (session.shotSummary ?? summarizeShots(session.shotEvents ?? [])).attempts
                          } attempts`}</em>
                        </article>
                      ))
                    ) : (
                      <article className="axis-memory-row">
                        <strong>No attempts yet</strong>
                        <em>Start recording to begin</em>
                      </article>
                    )}
                  </div>
                </section>

                <section className="axis-memory-block" aria-label="All clips">
                  <span>Clips</span>
                  <div>
                    {athleteMemory.clips.length ? (
                      athleteMemory.clips.map((clip) => (
                        <article className="axis-memory-row" key={`memory-clip-${clip.id}`}>
                          <strong>{clip.replayLabel}</strong>
                          <em>{formatReplayClip(clip)}</em>
                        </article>
                      ))
                    ) : (
                      <article className="axis-memory-row">
                        <strong>No clips yet</strong>
                        <em>Clips attach after replay events</em>
                      </article>
                    )}
                  </div>
                </section>

                <section className="axis-memory-block" aria-label="Movement history">
                  <span>Movement</span>
                  <div>
                    {athleteMemory.sessions.length ? (
                      athleteMemory.sessions.map((session) => (
                        <article className="axis-memory-row" key={`memory-movement-${session.id}`}>
                          <strong>{formatStamp(session.endedAt)}</strong>
                          <em>{session.summaryLayer?.movement ?? "Movement saved"}</em>
                        </article>
                      ))
                    ) : (
                      <article className="axis-memory-row">
                        <strong>Movement waiting</strong>
                        <em>History grows after sessions</em>
                      </article>
                    )}
                  </div>
                </section>

                <section className="axis-memory-block" aria-label="Tracking history">
                  <span>Tracking</span>
                  <div>
                    {athleteMemory.trackingEvents.length ? (
                      athleteMemory.trackingEvents.slice(0, 12).map((sample, index) => (
                        <article className="axis-memory-row" key={`memory-track-${sample.timestamp}-${index}`}>
                          <strong>{formatTrackingTimelineEvent(sample)}</strong>
                          <em>{formatTime(sample.timestamp)}</em>
                        </article>
                      ))
                    ) : (
                      <article className="axis-memory-row">
                        <strong>No tracking events</strong>
                        <em>Visible movement will appear here</em>
                      </article>
                    )}
                  </div>
                </section>
              </div>
            </section>

            <div className="axis-history-grid">
              <section className="axis-rail" aria-label="Streak progression">
                <span>Streak progression</span>
                <div>
                  {streakDays.map((day, index) => (
                    <span
                      className={index < activeWeekDays.size ? "axis-day axis-day-active" : "axis-day"}
                      key={`${day}-${index}`}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </section>

              <section className="axis-session-ledger" aria-label="Recent sessions">
                <span>Recent sessions</span>
                <div>
                  {save.sessions.length ? (
                    save.sessions.slice(0, 4).map((session, index) => (
                      <article
                        className={
                          index === 0 || session.id === latestSavedSessionId
                            ? "axis-session-row axis-session-row-latest"
                            : "axis-session-row"
                        }
                        key={session.id}
                      >
                        <span>{formatStamp(session.endedAt)}</span>
                        <strong>{formatDuration(session.durationSeconds)}</strong>
                        <em>
                          {session.participantCount
                            ? formatSummaryLayer(session.summaryLayer) ||
                              `${formatCount(session.participantCount, "athlete")} / ${session.recordingAttached ? "Memory attached" : "Memory off"} / ${formatCameraState(session.cameraState)} / ${
                                session.participationWindow?.status === "closed" ? "Window saved" : "Window open"
                              }`
                            : session.mode
                              ? session.mode
                              : index === 0
                                ? "Latest participation"
                                : "Session memory"}
                        </em>
                        <em>{`${formatShotSummary(session.shotSummary)} / ${formatReplaySummary(session.replayEvents)}`}</em>
                        {showAxisDebug && session.rawMeasurements ? <em>{formatRawMeasurements(session.rawMeasurements)}</em> : null}
                        {showAxisDebug ? <em>{formatBallTimeline(session.ballTimeline)}</em> : null}
                      </article>
                    ))
                  ) : (
                    <article className="axis-session-row">
                      <span>No sessions yet</span>
                      <strong>History waiting</strong>
                      <em>Check in to begin</em>
                    </article>
                  )}
                </div>
              </section>

              <section className="axis-session-ledger" aria-label="Session shot chart">
                <span>Session shots</span>
                <div>
                  {latestSession?.shotEvents?.length ? (
                    latestSession.shotEvents.slice(0, 10).map((event, index) => (
                      <article className="axis-session-row" key={`${event.timestamp}-${event.type}-${index}`}>
                        <span>{event.type === "make" ? "Make" : "Miss"}</span>
                        <strong>{event.type.toUpperCase()}</strong>
                        <em>{formatShotEvent(event)}</em>
                      </article>
                    ))
                  ) : (
                    <article className="axis-session-row">
                      <span>Shots waiting</span>
                      <strong>No shots yet</strong>
                      <em>Tap Make or Miss during a live session</em>
                    </article>
                  )}
                </div>
              </section>

              <section className="axis-session-ledger" aria-label="Replay timeline">
                <span>Replay timeline</span>
                <div>
                  {latestSession?.replayAnchors?.length ? (
                    latestSession.replayAnchors.slice(0, 12).map((anchor) => (
                      <article
                        className={
                          selectedReplayAnchor?.eventId === anchor.eventId
                            ? "axis-session-row axis-replay-anchor-row axis-session-row-latest"
                            : "axis-session-row axis-replay-anchor-row"
                        }
                        key={anchor.eventId}
                      >
                        <span>{anchor.replayLabel}</span>
                        <strong>{formatDuration(anchor.videoTimestamp)}</strong>
                        <button className="axis-row-action" onClick={() => jumpToReplayAnchor(anchor)} type="button">
                          Jump
                        </button>
                        <em>{formatReplayAnchor(anchor)}</em>
                      </article>
                    ))
                  ) : (
                    <article className="axis-session-row">
                      <span>Replay timeline waiting</span>
                      <strong>No anchors yet</strong>
                      <em>Events become video jump points after a session</em>
                    </article>
                  )}
                </div>
                {selectedReplayAnchor ? (
                  <em className="axis-replay-jump-state">
                    {`Selected ${selectedReplayAnchor.replayLabel} at ${formatDuration(selectedReplayAnchor.videoTimestamp)}`}
                  </em>
                ) : null}
              </section>

              <section className="axis-session-ledger" aria-label="Replay clips">
                <span>Replay clips</span>
                <div>
                  {latestSession?.replayClips?.length ? (
                    latestSession.replayClips.slice(0, 8).map((clip) => (
                      <article className="axis-session-row" key={clip.id}>
                        <span>{clip.replayLabel}</span>
                        <strong>{clip.eventType.replaceAll("_", " ")}</strong>
                        <em>{formatReplayClip(clip)}</em>
                      </article>
                    ))
                  ) : (
                    <article className="axis-session-row">
                      <span>Clips waiting</span>
                      <strong>No clips yet</strong>
                      <em>Movement and tracking events become clips after a session</em>
                    </article>
                  )}
                </div>
              </section>

              <section className="axis-session-ledger" aria-label="Session review">
                <span>Session review</span>
                <div>
                  {latestSession?.replayEvents?.length ? (
                    latestSession.replayEvents.slice(0, 8).map((event) => (
                      <article className="axis-session-row" key={event.id}>
                        <span>{event.label}</span>
                        <strong>{event.type.replaceAll("_", " ")}</strong>
                        <em>{formatReplayEvent(event)}</em>
                      </article>
                    ))
                  ) : (
                    <article className="axis-session-row">
                      <span>Session review waiting</span>
                      <strong>No events yet</strong>
                      <em>Frame exits, recoveries, and movement changes appear here after a session</em>
                    </article>
                  )}
                </div>
              </section>
            </div>

            {save.sessions.length ? (
              <section className="axis-interpretation-panel" aria-label="Movement interpretation">
                <header>
                  <span>Movement interpretation</span>
                  <button disabled={isInterpretingMovement} onClick={interpretLatestMovement} type="button">
                    {isInterpretingMovement ? "Reading movement" : "Interpret latest"}
                  </button>
                </header>
                {movementInsightMessage ? <em>{movementInsightMessage}</em> : null}
                {movementInsights.length ? (
                  <div>
                    {movementInsights.map((insight, index) => (
                      <article key={`${insight.evidence.metric}-${index}`}>
                        <strong>{insight.text}</strong>
                        <span>{`${insight.evidence.metric} / ${insight.evidence.value}`}</span>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="axis-archive-strip" aria-label="Session history">
              <div>
                <span>Session review</span>
                <strong>{save.sessions.length ? "Review ready" : "No sessions yet"}</strong>
              </div>
              <div>
                <span>Last workout</span>
                <strong>{latestSession ? formatStamp(latestSession.endedAt) : "Waiting"}</strong>
              </div>
              <div>
                <span>Saved sessions</span>
                <strong>{save.sessions.length ? `${save.sessions.length} saved` : "Waiting"}</strong>
              </div>
            </section>
            </section>
          </details>
          </footer>
        ) : null}
      </section>
    </main>
  );
}
