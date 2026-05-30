"use client";

import MuxPlayer from "@mux/mux-player-react/lazy";
import * as tus from "tus-js-client";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
type ProductSurface = "film" | "results" | "work";
type WorkOperatorMode = "coach" | "director" | "player";
type WorkDetectionState = "ACTIVE" | "IDLE" | "MOVING" | "SHOOTING";
type WatchEventType = "assist" | "make" | "miss" | "rebound" | "turnover";

const streakDays = ["M", "T", "W", "T", "F", "S", "S"];
const participationModes: ParticipationMode[] = ["Training", "Practice", "Game", "Workout", "Challenge"];
const coachParticipationModes: ParticipationMode[] = ["Practice", "Training", "Game"];
const defaultParticipationMode: ParticipationMode = "Training";
const filmWatchGroups: Array<{ label: string; type: WatchEventType }> = [
  { label: "WATCH MAKES", type: "make" },
  { label: "WATCH MISSES", type: "miss" },
  { label: "WATCH REBOUNDS", type: "rebound" },
  { label: "WATCH ASSISTS", type: "assist" },
  { label: "WATCH TURNOVERS", type: "turnover" },
];
const storageKey = "axis-ritual-save";
const identityStorageKey = "axis-identity-save";
const organizationSlug = "bridge";
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
  review?: SessionReview;
  shotEvents?: ShotEvent[];
  shotSummary?: ShotSummary;
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

type ShotType = "make" | "miss";
type ActionEventType = "assist" | "foul" | "rebound" | "turnover";
type GameActionType = ActionEventType | ShotType;
const gameActions: GameActionType[] = ["make", "miss", "rebound", "assist", "turnover", "foul"];

type ShotEvent = {
  athleteId?: string;
  athleteName: string;
  cameraDirection: CameraDirection;
  cameraId: string;
  movementState: "moving" | "stationary" | "unknown";
  replayTimestamp: number;
  sessionId: string;
  suggestionConfidence?: number;
  suggestionId?: string;
  suggestionReason?: string;
  suggested?: boolean;
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
  reason: string;
  replayTimestamp: number;
  timestamp: string;
  trackId?: string;
};

type ShotSummary = {
  attempts: number;
  fieldGoalPercentage: number;
  makes: number;
  misses: number;
};

type ReplayEventType =
  | "assist"
  | "coach_voice"
  | "foul"
  | "left_frame"
  | "make"
  | "miss"
  | "movement_spike"
  | "rebound"
  | "recovered"
  | "tracking_interruption"
  | "turnover";
type TrackingReplayEventType = Exclude<ReplayEventType, ActionEventType | "coach_voice" | "make" | "miss">;

type ReplayEvent = {
  athleteId?: string;
  athleteName: string;
  cameraDirection: CameraDirection;
  cameraId: string;
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
  clipStart: number;
  eventId: string;
  eventType: string;
  id: string;
  muxAssetId: string;
  replayLabel: string;
  sessionId: string;
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
      candidate.type === "coach_voice" ||
      candidate.type === "foul" ||
      candidate.type === "make" ||
      candidate.type === "miss" ||
      candidate.type === "movement_spike" ||
      candidate.type === "rebound" ||
      candidate.type === "recovered" ||
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
    clipStart: typeof candidate.clipStart === "number" ? candidate.clipStart : 0,
    eventId: candidate.eventId,
    eventType: candidate.eventType,
    id: candidate.id,
    muxAssetId: typeof candidate.muxAssetId === "string" ? candidate.muxAssetId : "pending",
    replayLabel: typeof candidate.replayLabel === "string" ? candidate.replayLabel : candidate.eventType,
    sessionId: candidate.sessionId,
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

  return {
    athleteId: typeof candidate.athleteId === "string" ? candidate.athleteId : undefined,
    athleteName: typeof candidate.athleteName === "string" ? candidate.athleteName : "Athlete",
    cameraDirection,
    cameraId: typeof candidate.cameraId === "string" ? candidate.cameraId : getCameraId(cameraDirection),
    movementState:
      candidate.movementState === "moving" || candidate.movementState === "stationary" ? candidate.movementState : "unknown",
    replayTimestamp: typeof candidate.replayTimestamp === "number" ? candidate.replayTimestamp : 0,
    sessionId: candidate.sessionId,
    suggestionConfidence: typeof candidate.suggestionConfidence === "number" ? candidate.suggestionConfidence : undefined,
    suggestionId: typeof candidate.suggestionId === "string" ? candidate.suggestionId : undefined,
    suggestionReason: typeof candidate.suggestionReason === "string" ? candidate.suggestionReason : undefined,
    suggested: Boolean(candidate.suggested),
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
    label: shot.type === "make" ? "Make" : "Miss",
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

  return "Foul";
}

function getVideoTimestamp(timestamp: string, sessionStartedAt: string) {
  return Math.max(0, (new Date(timestamp).getTime() - new Date(sessionStartedAt).getTime()) / 1000);
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
  return (
    anchor.eventType === "movement_spike" ||
    anchor.eventType === "tracking_interruption" ||
    anchor.eventType === "recovered" ||
    anchor.eventType === "identity_locked" ||
    anchor.eventType === "coach_voice" ||
    gameActions.includes(anchor.eventType as GameActionType)
  );
}

function createReplayClip(anchor: ReplayAnchor): ReplayClip {
  return {
    clipEnd: anchor.videoTimestamp + 10,
    clipStart: Math.max(0, anchor.videoTimestamp - 5),
    eventId: anchor.eventId,
    eventType: anchor.eventType,
    id: `clip:${anchor.eventId}`,
    muxAssetId: anchor.muxAssetId,
    replayLabel: anchor.replayLabel,
    sessionId: anchor.sessionId,
  };
}

function createReplayClips(anchors: ReplayAnchor[]) {
  return anchors.filter(shouldCreateClip).map(createReplayClip);
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
  if (anchor.eventType === "identity_locked") return "Ready";
  if (anchor.eventType === "make") return "Make";
  if (anchor.eventType === "miss") return "Miss";
  if (anchor.eventType === "rebound") return "Rebound";
  if (anchor.eventType === "assist") return "Assist";
  if (anchor.eventType === "turnover") return "Turnover";
  if (anchor.eventType === "foul") return "Foul";
  if (anchor.eventType === "coach_voice") return "Coach note";
  if (anchor.eventType === "recovered") return "Back in view";
  if (anchor.eventType === "left_frame") return "Left frame";

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
    anchor.eventType === "coach_voice"
  );
}

function getFilmAnchorsByType(anchors: ReplayAnchor[], type: WatchEventType) {
  return anchors.filter((anchor) => anchor.eventType === type);
}

function getMuxThumbnailUrl(playbackId?: string) {
  return playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : undefined;
}

function getFilmPlaybackId(session?: Pick<SavedSession, "muxPlaybackId" | "recordingAttached"> | null) {
  if (!session?.recordingAttached) return undefined;

  return session.muxPlaybackId;
}

function getFilmAvailability(session?: Pick<SavedSession, "muxPlaybackId" | "recordingAttached"> | null) {
  if (!session?.recordingAttached) return "Film unavailable";
  if (getFilmPlaybackId(session)) return "Film ready";

  return "Film processing";
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
  return `${formatDuration(event.replayTimestamp)} / ${event.athleteName} / ${event.cameraDirection} camera`;
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
                : createReplayClips(replayAnchors);

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
    trajectory: [],
    visible: false,
  });
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
  const [productSurface, setProductSurface] = useState<ProductSurface>("work");
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
  const [selectedReplayAnchor, setSelectedReplayAnchor] = useState<ReplayAnchor | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const lastShotSuggestionAtRef = useRef(0);

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

    void requestCameraPreview(cameraDirection);
  }, [authPhase, cameraDirection, cameraStream]);

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
  const organizationResults = useMemo(() => {
    const athleteIds = new Set<string>();
    let attendance = save.activeSession ? activeParticipantCount : 0;
    let makes = 0;
    let misses = 0;
    let totalSeconds = save.activeSession
      ? Math.max(0, Math.floor((now - new Date(save.activeSession.startedAt).getTime()) / 1000))
      : 0;

    activeParticipants.forEach((participant) => athleteIds.add(participant.id));
    save.sessions.forEach((session) => {
      const shotSummary = session.shotSummary ?? summarizeShots(normalizeShotEvents(session.shotEvents));
      makes += shotSummary.makes;
      misses += shotSummary.misses;
      totalSeconds += session.durationSeconds;
      attendance += session.activeParticipantCount || session.participantCount || session.participants?.length || 1;
      (session.participants ?? []).forEach((participant) => athleteIds.add(participant.id));
    });

    return {
      attendance,
      athletes: athleteIds.size || (identity ? 1 : 0),
      coaches: save.sessions.length || save.activeSession ? 1 : 0,
      hours: totalSeconds / 3600,
      makes,
      misses,
      sessions: save.sessions.length + (save.activeSession ? 1 : 0),
    };
  }, [activeParticipantCount, activeParticipants, identity, now, save.activeSession, save.sessions]);
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
  const personDetection = usePersonDetection(
    cameraPreviewRef,
    activeView === "camera" && cameraState === "attached" && Boolean(cameraStream),
  );
  const ballTracking = useBallTracking(
    cameraPreviewRef,
    activeView === "camera" && cameraState === "attached" && Boolean(cameraStream),
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
  const canRecordShot = Boolean(save.activeSession && primaryTrackingTrack && primaryTrackingTrack.status !== "lost");
  const shotActionLabel = shotSuggestion ? "Possible shot detected" : formatShotSummary(activeShotSummary);
  const workDetectionState = getWorkDetectionState({
    athleteDetected,
    isShooting: Boolean(shotSuggestion),
    track: primaryTrackingTrack,
  });
  const latestReviewEvents = latestSession?.replayEvents?.slice(0, 6) ?? [];
  const latestReviewAnchors = latestSession?.replayAnchors?.slice(0, 6) ?? [];
  const latestFilmTimelineAnchors = latestSession?.replayAnchors?.filter(shouldShowFilmTimelineAnchor) ?? [];
  const latestReviewClips = latestSession?.replayClips?.slice(0, 4) ?? [];
  const latestSessionReview = latestSession?.review;
  const latestFilmPlaybackId = getFilmPlaybackId(latestSession);
  const latestFilmPreviewUrl = latestSession ? filmPreviewUrls[latestSession.id] : undefined;
  const selectedFilmTime =
    selectedReplayAnchor && latestSession && selectedReplayAnchor.sessionId === latestSession.id
      ? selectedReplayAnchor.videoTimestamp
      : 0;
  const localFilmSrc = latestFilmPreviewUrl ? `${latestFilmPreviewUrl}#t=${Math.max(0, selectedFilmTime).toFixed(1)}` : undefined;
  const latestFilmThumbnailUrl = latestSession?.thumbnailUrl ?? getMuxThumbnailUrl(latestFilmPlaybackId);
  const latestFilmAvailability = getFilmAvailability(latestSession);
  const filmLibrary = save.sessions.slice(0, 5).map((session) => {
    const playbackId = getFilmPlaybackId(session);

    return {
      availability: getFilmAvailability(session),
      duration: formatDuration(session.durationSeconds),
      id: session.id,
      mode: session.mode ?? defaultParticipationMode,
      playbackId,
      thumbnailUrl: session.thumbnailUrl ?? getMuxThumbnailUrl(playbackId),
    };
  });
  const sessionCameraStatusLabel = cameraState === "attached" ? "Camera attached" : "Camera ready";
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
  const shouldShowReviewPanel = Boolean(
    latestSession && (showAxisDebug ? isReviewOpen : productSurface !== "work" && !(isDirectorMode && productSurface === "results")),
  );
  const shouldShowFilmSurface = showAxisDebug || productSurface === "film";
  const shouldShowResultsSurface = showAxisDebug || productSurface === "results";
  const activeTimerLabel = save.activeSession ? `${formatDuration(elapsedSeconds)} preserved` : null;
  const cameraOperatingState = save.activeSession ? (isRecordingAttached ? "Recording" : "Ready") : "Camera";
  const cameraOperatingContext = save.activeSession ? `${currentMode} / ${formatDuration(elapsedSeconds)}` : productSurface;
  const availableParticipationModes = isCoachMode || isDirectorMode ? coachParticipationModes : participationModes;
  const visibleWorkActions = showAxisDebug || isCoachMode ? gameActions : (["make", "miss"] as GameActionType[]);
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
    if (!save.activeSession || !primaryTrackingTrack || primaryTrackingTrack.status === "lost") {
      setShotSuggestion(null);
      return;
    }

    const movement = primaryTrackingTrack.movement;
    const isLikelyShotMotion =
      movement.moving &&
      movement.direction === "up" &&
      movement.distanceTraveled >= 0.035 &&
      primaryTrackingTrack.visibleTimeMs >= 900;

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

    lastShotSuggestionAtRef.current = nowMs;
    setShotSuggestion({
      athleteId: athlete.id,
      athleteName: athlete.name,
      confidence: Math.min(0.96, 0.72 + movement.distanceTraveled * 3),
      id: `shot-suggestion:${save.activeSession.id}:${primaryTrackingTrack.id}:${nowMs}`,
      reason: "Upward shooting motion",
      replayTimestamp,
      timestamp: new Date(nowMs).toISOString(),
      trackId: primaryTrackingTrack.id,
    });
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
    selectedCalibrationAthlete,
    presentParticipants,
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
        shotEvents: [],
        timeline: [],
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
    setNow(Date.now());
    setRitualState("active");
    setLatestSavedSessionId(null);
    setActiveView("session");
    setProductSurface("work");
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

    if ((mode === "coach" || mode === "director") && !coachParticipationModes.includes(pendingMode)) {
      setPendingMode("Practice");
    }

    if (mode === "director") {
      setProductSurface("results");
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

      if (response.ok && result?.playbackId) return result;
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
    }

    return null;
  }

  async function uploadSessionFilm(sessionId: string, blob: Blob) {
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
      if (!film?.playbackId) return;

      setSave((currentSave) => {
        const nextSave = {
          ...currentSave,
          sessions: currentSave.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  muxAssetId: film.muxAssetId,
                  muxPlaybackId: film.playbackId,
                  recordingAttached: true,
                  thumbnailUrl: film.thumbnailUrl ?? getMuxThumbnailUrl(film.playbackId),
                }
              : session,
          ),
        };

        writeSave(nextSave);
        return nextSave;
      });
    } catch (error) {
      console.error("Unable to upload film", error);
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
      setCameraMessage("Camera unavailable.");
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

      return true;
    } catch (error) {
      console.error("Unable to start camera", error);
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

    const activeTrack = primaryTrackingTrack?.status !== "lost" ? primaryTrackingTrack : null;
    const trackedAthlete = activeTrack ? getTrackAthlete(activeTrack.id) : undefined;
    const fallbackAthlete = selectedCalibrationAthlete ?? presentParticipants[0] ?? identityFromAxisIdentity(identity);
    const athlete = suggestion?.athleteId
      ? { id: suggestion.athleteId, name: suggestion.athleteName }
      : trackedAthlete ?? fallbackAthlete;
    const timestamp = new Date().toISOString();
    const replayTimestamp = Math.max(
      0,
      Math.floor((new Date(timestamp).getTime() - new Date(save.activeSession.startedAt).getTime()) / 1000),
    );
    const shotEvent: ShotEvent = {
      athleteId: athlete.id,
      athleteName: athlete.name,
      cameraDirection: savedCameraDirection,
      cameraId: getCameraId(savedCameraDirection),
      movementState: activeTrack?.movement.moving
        ? "moving"
        : activeTrack?.movement.stationary
          ? "stationary"
          : "unknown",
      replayTimestamp: suggestion?.replayTimestamp ?? replayTimestamp,
      sessionId: save.activeSession.id,
      suggestionConfidence: suggestion?.confidence,
      suggestionId: suggestion?.id,
      suggestionReason: suggestion?.reason,
      suggested: Boolean(suggestion),
      timestamp,
      trackId: suggestion?.trackId ?? activeTrack?.id,
      trackedTimeSeconds: activeTrack ? activeTrack.visibleTimeMs / 1000 : 0,
      type,
      visibleTimeSeconds: activeTrack ? activeTrack.visibleTimeMs / 1000 : 0,
    };
    const replayEvent = createShotReplayEvent(shotEvent, save.activeSession.replayEvents?.length ?? 0);
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
        replayEvents: [...(save.activeSession.replayEvents ?? []), replayEvent],
        shotEvents: [...(save.activeSession.shotEvents ?? []), shotEvent],
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
    setShotSuggestion(null);
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
        replayEvents: [...(save.activeSession.replayEvents ?? []), replayEvent],
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
  }

  function jumpToReplayAnchor(anchor: ReplayAnchor) {
    setSelectedReplayAnchor(anchor);
    setProductSurface("film");
  }

  function createFinalizeWorkPayload(session: SavedSession) {
    const shotSummary = summarizeShots(session.shotEvents ?? []);
    const filmMoments = (session.replayAnchors ?? []).map((anchor) => ({
      filmTimeSeconds: anchor.videoTimestamp,
      id: anchor.eventId,
      label: formatHumanMomentLabel(anchor),
      type: anchor.eventType,
    }));
    const events = (session.replayEvents ?? []).map((event) => ({
      filmTimeSeconds: getVideoTimestamp(event.timestamp, session.startedAt),
      id: event.id,
      label: event.label,
      participantId: event.athleteId,
      timestamp: event.timestamp,
      type: event.type,
    }));

    return {
      events,
      film: {
        id: session.muxAssetId ? `film:${session.muxAssetId}` : undefined,
        moments: filmMoments,
        muxAssetId: session.muxAssetId,
        playbackId: session.muxPlaybackId,
        status: session.muxPlaybackId ? ("ready" as const) : session.recordingAttached ? ("processing" as const) : ("unavailable" as const),
        thumbnailUrl: session.thumbnailUrl,
        workId: session.id,
      },
      results: {
        attempts: shotSummary.attempts,
        durationSeconds: session.durationSeconds,
        eventsCount: events.length,
        fieldGoalPercentage: shotSummary.attempts ? shotSummary.fieldGoalPercentage : null,
        filmMomentsCount: filmMoments.length,
        makes: shotSummary.makes,
        misses: shotSummary.misses,
      },
      work: {
        endedAt: session.endedAt,
        id: session.id,
        participantIds: (session.participants ?? []).map((participant) => participant.id),
        startedAt: session.startedAt,
        status: "complete" as const,
        type: session.mode ?? defaultParticipationMode,
      },
    };
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
    const replayClips = createReplayClips(replayAnchors);
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
    };
    const nextSave = {
      activeSession: null,
      sessions: [completedSession, ...save.sessions].slice(0, 40),
    };

    writeSave(nextSave);
    setSave(nextSave);
    setLatestSavedSessionId(completedSession.id);
    setActiveView("session");
    setProductSurface("film");
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
        [completedSession.id]: filmPreviewUrl,
      }));
      void uploadSessionFilm(completedSession.id, filmCapture.blob);
    }
    void queueFinalizeWork(completedSession);
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
              ) : (
                <div className="axis-work-state-overlay" aria-label="Work state">
                  <strong>{workDetectionState}</strong>
                </div>
              )}
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
              <span>Work. Film. Results.</span>
            </div>
            <button className="axis-sign-out" onClick={signOut} type="button">
              Sign out
            </button>
          </header>
        )}

        {!showAxisDebug ? (
          <section className="axis-camera-home" aria-label="Camera">
            <div className="axis-camera-preview axis-camera-home-preview" data-state={cameraStream ? "attached" : "offline"}>
              <video aria-label="Camera preview" autoPlay muted playsInline ref={cameraPreviewRef} />
              {cameraStream ? null : <span>Camera</span>}
              <div className="axis-camera-os-overlay" aria-label="Camera status">
                <strong>{cameraOperatingState}</strong>
                <em>{cameraOperatingContext}</em>
              </div>
            </div>
            <div className="axis-product-strip" aria-label="Axis product loop">
              <button
                aria-pressed={productSurface === "work"}
                onClick={() => setProductSurface("work")}
                type="button"
              >
                Work
              </button>
              <button
                aria-pressed={productSurface === "film"}
                onClick={() => setProductSurface("film")}
                type="button"
              >
                Film
              </button>
              <button
                aria-pressed={productSurface === "results"}
                onClick={() => setProductSurface("results")}
                type="button"
              >
                Results
              </button>
            </div>
          </section>
        ) : null}

        {(showAxisDebug || productSurface === "work") ? (
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
              <div>
                {visibleWorkActions.map((action) => (
                  <button
                    disabled={!save.activeSession}
                    key={action}
                    onClick={() => recordGameAction(action)}
                    type="button"
                  >
                    {shotSuggestion && action === "make"
                      ? "Confirm make"
                      : shotSuggestion && action === "miss"
                        ? "Confirm miss"
                        : formatGameActionLabel(action)}
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
                  aria-expanded={showAxisDebug ? isReviewOpen : productSurface === "film"}
                  aria-controls="axis-session-review"
                  onClick={() => {
                    if (showAxisDebug) {
                      setIsReviewOpen((isOpen) => !isOpen);
                      return;
                    }

                    setProductSurface("film");
                  }}
                  type="button"
                >
                  Review
                </button>
                {showAxisDebug ? (
                  <>
                    <button type="button">Export</button>
                    <button type="button">Share</button>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}
        </section>
        ) : null}

        {!showAxisDebug && productSurface === "results" && isDirectorMode ? (
          <section className="axis-review-panel" aria-label="Organization results">
            <div className="axis-review-grid">
              <section className="axis-review-block axis-results-stage" aria-label="Director results">
                <span>Organization</span>
                <div className="axis-results-grid">
                  <article>
                    <strong>{organizationResults.sessions}</strong>
                    <em>Sessions</em>
                  </article>
                  <article>
                    <strong>{organizationResults.athletes}</strong>
                    <em>Athletes</em>
                  </article>
                  <article>
                    <strong>{organizationResults.coaches}</strong>
                    <em>Coaches</em>
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
                    <strong>{organizationResults.hours.toFixed(1)}</strong>
                    <em>Hours</em>
                  </article>
                  <article>
                    <strong>{organizationResults.attendance}</strong>
                    <em>Attendance</em>
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
                {latestFilmPlaybackId ? (
                  <MuxPlayer
                    className="axis-film-player"
                    key={`${latestFilmPlaybackId}:${selectedReplayAnchor?.eventId ?? "start"}`}
                    metadata={{
                      video_id: latestSession.id,
                      video_title: `${latestSession.mode ?? defaultParticipationMode} film`,
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
                    key={`${latestSession.id}:${selectedReplayAnchor?.eventId ?? "start"}`}
                    playsInline
                    src={localFilmSrc}
                  />
                ) : (
                  <div className="axis-film-empty">
                    <strong>{latestFilmAvailability}</strong>
                    <em>Film will appear here when recording is available.</em>
                  </div>
                )}
                <div className="axis-film-meta" aria-label="Latest film">
                  <strong>Latest Film</strong>
                  <em>{`${latestFilmAvailability} / ${formatDuration(latestSession.durationSeconds)} / ${formatTime(
                    latestSession.endedAt,
                  )}`}</em>
                </div>
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
                <section className="axis-review-block axis-results-stage" aria-label="Results">
                  <span>Results</span>
                  <div className="axis-results-grid">
                    <article>
                      <strong>{formatDuration(latestSession.durationSeconds)}</strong>
                      <em>Work Time</em>
                    </article>
                    <article>
                      <strong>{`${latestReviewAnchors.length} moments`}</strong>
                      <em>Film</em>
                    </article>
                    <article>
                      <strong>{formatActivePeriod(latestSession)}</strong>
                      <em>Most Active Period</em>
                    </article>
                    <article>
                      <strong>{`${currentStreak} ${currentStreak === 1 ? "day" : "days"}`}</strong>
                      <em>Streaks</em>
                    </article>
                    <article>
                      <strong>{formatShotResults(latestSession.shotSummary)}</strong>
                      <em>Shot Results</em>
                    </article>
                    <article>
                      <strong>
                        {formatCount(
                          latestSession.activeParticipantCount || latestSession.participantCount || 1,
                          "athlete",
                          "athletes",
                        )}
                      </strong>
                      <em>Attendance</em>
                    </article>
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

              {shouldShowFilmSurface ? (
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
              <section className="axis-review-block" aria-label="Film Timeline">
                <span>Film Timeline</span>
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

              {shouldShowFilmSurface ? (
                <section className="axis-review-block" aria-label="Film library">
                  <span>Film Library</span>
                  <div className="axis-film-library">
                    {filmLibrary.length ? (
                      filmLibrary.map((film) => (
                        <article className="axis-film-library-row" key={film.id}>
                          {film.thumbnailUrl ? (
                            <img alt="" src={film.thumbnailUrl} />
                          ) : (
                            <div aria-hidden="true" />
                          )}
                          <strong>{film.mode}</strong>
                          <em>{`${film.availability} / ${film.duration}`}</em>
                        </article>
                      ))
                    ) : (
                      <article className="axis-review-row">
                        <strong>No film yet</strong>
                        <em>Finish work to build the library</em>
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
                <section className="axis-memory-block" aria-label="All sessions">
                  <span>Sessions</span>
                  <div>
                    {athleteMemory.sessions.length ? (
                      athleteMemory.sessions.map((session) => (
                        <article className="axis-memory-row" key={`memory-session-${session.id}`}>
                          <strong>{formatStamp(session.endedAt)}</strong>
                          <em>{`${formatDuration(session.durationSeconds)} / ${session.mode ?? defaultParticipationMode}`}</em>
                        </article>
                      ))
                    ) : (
                      <article className="axis-memory-row">
                        <strong>No sessions yet</strong>
                        <em>Start session to begin</em>
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
