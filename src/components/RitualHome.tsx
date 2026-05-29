"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase-browser";

type RitualState = "idle" | "active" | "saving" | "complete";
type AuthPhase = "checking" | "entry" | "restoring" | "authenticated";
type CalibrationStatus = "required" | "calibrated";
type CalibrationWorkflowStatus = "not_calibrated" | "calibrating" | "complete";
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
type ParticipationMode =
  | "Training"
  | "Station Work"
  | "Shooting"
  | "Conditioning"
  | "Small Group"
  | "Scrimmage"
  | "Open Gym";

const streakDays = ["M", "T", "W", "T", "F", "S", "S"];
const participationModes: ParticipationMode[] = [
  "Training",
  "Station Work",
  "Shooting",
  "Conditioning",
  "Small Group",
  "Scrimmage",
  "Open Gym",
];
const defaultParticipationMode: ParticipationMode = "Training";
const storageKey = "axis-ritual-save";
const identityStorageKey = "axis-identity-save";
const organizationSlug = "bridge";

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
  participationWindow?: ParticipationWindow;
  clipContinuityContext?: ClipContinuityContext;
  participants?: SessionParticipant[];
  participantCount?: number;
  activeParticipantCount?: number;
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
  session_id: string;
  timestamp: string;
  camera_type: CameraDirection;
  calibration_status: CalibrationStatus;
  visible_people: number;
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
    calibrationRecords?: CalibrationEvidence[];
    participationWindow?: ParticipationWindow;
    clipContinuityContext?: ClipContinuityContext;
    participants?: ActiveParticipant[];
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

function identityFromAxisIdentity(identity: AxisIdentity): AthleteIdentity {
  const label = identity.email.split("@")[0] || "Athlete";

  return {
    id: identity.id,
    name: label,
    rosterCode: identity.id.slice(0, 8).toUpperCase(),
    calibrationAnchorId: `calibration:${organizationSlug}:${identity.id}`,
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

            return {
              ...session,
              mode: sessionMode,
              calibrationStatus: normalizeCalibrationStatus(session.calibrationStatus),
              cameraState: sessionCameraState,
              cameraDirection: sessionCameraDirection,
              cameraAttachedAt: session.cameraAttachedAt,
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
  const [isModePickerOpen, setIsModePickerOpen] = useState(false);
  const [selectedCalibrationAthleteId, setSelectedCalibrationAthleteId] = useState<string | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>("idle");
  const [visiblePeople, setVisiblePeople] = useState<number | null>(null);
  const [calibrationEvidence, setCalibrationEvidence] = useState<CalibrationEvidence | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraDirection, setCameraDirection] = useState<CameraDirection>("back");
  const [cameraMessage, setCameraMessage] = useState("");

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
      setCalibrationEvidence(null);
      return;
    }

    if (!selectedCalibrationAthleteId || !activeParticipants.some((participant) => participant.id === selectedCalibrationAthleteId)) {
      setSelectedCalibrationAthleteId(activeParticipants[0].id);
      setDetectionStatus("idle");
      setVisiblePeople(null);
      setCalibrationEvidence(null);
    }
  }, [save.activeSession?.participants, selectedCalibrationAthleteId]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  const participationLabel = useMemo(() => {
    if (ritualState === "active") return "Session live";
    if (ritualState === "saving") return "Saving history";
    if (ritualState === "complete") return "History grew";
    return "Session active";
  }, [ritualState]);

  const latestSession = save.sessions[0] ?? null;
  const athleteLabel = identity?.email ? identity.email.split("@")[0] || "Athlete 01" : "Athlete 01";
  const currentMode = save.activeSession?.mode ?? latestSession?.mode ?? defaultParticipationMode;
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
  const calibratedParticipantCount = presentParticipants.filter(
    (participant) => normalizeCalibrationStatus(participant.calibrationStatus) === "calibrated",
  ).length;
  const calibrationProgressTotal = save.activeSession ? activeParticipantCount : 0;
  const calibrationProgressLabel = `${calibratedParticipantCount} / ${calibrationProgressTotal} calibrated`;
  const selectedCalibrationAthlete =
    presentParticipants.find((participant) => participant.id === selectedCalibrationAthleteId) ?? presentParticipants[0] ?? null;
  const selectedAthleteCalibrationStatus = selectedCalibrationAthlete
    ? normalizeCalibrationStatus(selectedCalibrationAthlete.calibrationStatus)
    : "required";
  const calibrationWorkflowStatus: CalibrationWorkflowStatus =
    detectionStatus === "capturing" ||
    detectionStatus === "frame_captured" ||
    detectionStatus === "sending" ||
    detectionStatus === "response_received"
    ? "calibrating"
    : selectedAthleteCalibrationStatus === "calibrated"
      ? "complete"
      : "not_calibrated";
  const detectionStatusLabel =
    detectionStatus === "capturing"
      ? "CAPTURING FRAME"
      : detectionStatus === "camera_not_ready"
        ? "CAMERA NOT READY"
        : detectionStatus === "capture_failed"
          ? "FRAME CAPTURE FAILED"
          : detectionStatus === "frame_captured"
            ? "FRAME CAPTURED"
            : detectionStatus === "sending"
              ? "SENDING TO ROBOFLOW"
              : detectionStatus === "request_failed"
                ? "ROBOFLOW REQUEST FAILED"
                : detectionStatus === "response_received"
                  ? "ROBOFLOW RESPONSE RECEIVED"
                  : detectionStatus === "invalid_response"
                    ? "ROBOFLOW RESPONSE INVALID"
                    : detectionStatus === "not_one"
                      ? "VISIBLE PEOPLE != 1"
                      : detectionStatus === "ready"
                        ? "CALIBRATION READY"
                        : "";
  const calibrationWorkflowLabel = detectionStatusLabel
    ? detectionStatusLabel
    : calibrationWorkflowStatus === "calibrating"
      ? "CALIBRATING"
      : calibrationWorkflowStatus === "complete"
        ? "COMPLETE"
        : "NOT CALIBRATED";
  const sessionCameraStatusLabel = cameraState === "attached" ? "Camera attached" : "Camera ready";
  const sessionPrimaryActionLabel = "Open camera";
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
  const activeTimerLabel = save.activeSession ? `${formatDuration(elapsedSeconds)} preserved` : null;
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

    const startedAt = new Date().toISOString();
    const sessionId = crypto.randomUUID();
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
      context: defaultParticipationMode,
      participantIds: startingParticipants.map((participant) => participant.id),
    };
    const nextSave: AxisSave = {
      ...save,
      activeSession: {
        id: sessionId,
        startedAt,
        mode: defaultParticipationMode,
        recordingAttached: false,
        calibrationStatus: "required",
        cameraState: "offline",
        cameraDirection: startingCameraDirection,
        participationWindow,
        clipContinuityContext: createClipContinuityContext(
          sessionId,
          defaultParticipationMode,
          "offline",
          startingCameraDirection,
          undefined,
          participationWindow,
          startingParticipants,
        ),
        participants: startingParticipants,
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
    setNow(Date.now());
    setRitualState("active");
    setLatestSavedSessionId(null);
    setActiveView("session");
    setIsModePickerOpen(false);
    setSelectedCalibrationAthleteId(checkedInAthlete.id);
    setDetectionStatus("idle");
    setVisiblePeople(null);
    setCalibrationEvidence(null);
    setCameraDirection(startingCameraDirection);
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

  function updateCameraSessionState(
    nextCameraState: CameraState,
    nextCameraDirection = cameraDirection,
    attachedAt?: string,
  ) {
    if (!save.activeSession) return;

    const cameraAttachedAt = attachedAt ?? save.activeSession.cameraAttachedAt;
    const normalizedDirection = normalizeCameraDirection(nextCameraDirection);
    const participationWindow = normalizeParticipationWindow(
      save.activeSession.participationWindow,
      save.activeSession.startedAt,
      currentMode,
      activeParticipants,
    );
    const nextSave: AxisSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        cameraState: nextCameraState,
        cameraDirection: normalizedDirection,
        cameraAttachedAt,
        clipContinuityContext: createClipContinuityContext(
          save.activeSession.id,
          currentMode,
          nextCameraState,
          normalizedDirection,
          cameraAttachedAt,
          participationWindow,
          activeParticipants,
        ),
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
  }

  async function requestCameraPresence(nextDirection = cameraDirection) {
    if (!save.activeSession) return;

    const normalizedDirection = normalizeCameraDirection(nextDirection);
    setCameraMessage("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("Camera unavailable.");
      updateCameraSessionState("offline");
      return;
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
      updateCameraSessionState("ready", normalizedDirection);
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

    setActiveView("camera");
  }

  function captureCameraFrame() {
    const video = cameraPreviewRef.current;
    console.log("Calibration video dimensions", {
      videoHeight: video?.videoHeight ?? 0,
      videoWidth: video?.videoWidth ?? 0,
    });
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function startCameraCalibration() {
    console.log("Calibration started");

    if (!save.activeSession) {
      console.log("Calibration aborted", { reason: "missing_active_session" });
      return;
    }

    if (cameraState !== "attached") {
      console.log("Calibration aborted", { cameraState, reason: "camera_not_attached" });
      return;
    }

    if (!selectedCalibrationAthlete) {
      console.log("Calibration aborted", { reason: "missing_selected_athlete" });
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

    setDetectionStatus("capturing");
    const image = captureCameraFrame();
    if (!image) {
      const video = cameraPreviewRef.current;
      console.log("Calibration aborted", {
        reason: video && (!video.videoWidth || !video.videoHeight) ? "camera_not_ready" : "frame_capture_failed",
      });
      setDetectionStatus(video && (!video.videoWidth || !video.videoHeight) ? "camera_not_ready" : "capture_failed");
      setVisiblePeople(null);
      return;
    }

    console.log("Frame captured");
    console.log("Frame dimensions", {
      videoHeight: cameraPreviewRef.current?.videoHeight ?? 0,
      videoWidth: cameraPreviewRef.current?.videoWidth ?? 0,
    });
    console.log("Frame byte size", {
      bytes: Math.ceil((image.split(",")[1] ?? image).length * 0.75),
    });

    setDetectionStatus("frame_captured");
    setVisiblePeople(null);
    setCalibrationEvidence(null);
    setDetectionStatus("sending");

    try {
      console.log("Request built", {
        endpoint: "/api/roboflow/person-detection",
        hasImage: Boolean(image),
      });
      console.log("Request sent");
      const response = await fetch("/api/roboflow/person-detection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image }),
      });
      const result = (await response.json()) as { visiblePeople?: number; error?: string };
      console.log("Response received", {
        ok: response.ok,
        status: response.status,
      });
      setDetectionStatus("response_received");

      if (!response.ok) {
        console.error("Roboflow person detection failed", result.error);
        console.log("Calibration aborted", { reason: "roboflow_request_failed", status: response.status });
        setDetectionStatus("request_failed");
        return;
      }

      if (typeof result.visiblePeople !== "number" || !Number.isFinite(result.visiblePeople)) {
        console.log("Calibration aborted", { reason: "invalid_visible_people", visiblePeople: result.visiblePeople });
        setDetectionStatus("invalid_response");
        return;
      }

      const people = result.visiblePeople;
      console.log("Prediction count", { visiblePeople: people });
      setVisiblePeople(people);

      if (people !== 1) {
        console.log("Calibration validation failed", { visiblePeople: people });
        setDetectionStatus("not_one");
        return;
      }

      console.log("Calibration validation passed", { visiblePeople: people });
      setDetectionStatus("ready");
    } catch (error) {
      console.error("Unable to run person detection", error);
      console.log("Calibration aborted", { error, reason: "request_exception" });
      setDetectionStatus("request_failed");
    }
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
      return;
    }

    const completedAt = new Date().toISOString();
    const evidence: CalibrationEvidence = {
      athlete_id: selectedCalibrationAthlete.id,
      session_id: save.activeSession.id,
      timestamp: completedAt,
      camera_type: savedCameraDirection,
      calibration_status: "calibrated",
      visible_people: visiblePeople,
    };
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
    console.log("Calibration completed", {
      athleteId: evidence.athlete_id,
      sessionId: evidence.session_id,
    });
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

  function checkOut() {
    if (!save.activeSession) return;

    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(
      0,
      Math.floor((new Date(endedAt).getTime() - new Date(save.activeSession.startedAt).getTime()) / 1000),
    );
    const sessionMode = save.activeSession.mode ?? defaultParticipationMode;
    const sessionCameraState = normalizeCameraState(save.activeSession.cameraState);
    const sessionCameraDirection = normalizeCameraDirection(save.activeSession.cameraDirection);
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
    const completedSession = {
      id: save.activeSession.id,
      startedAt: save.activeSession.startedAt,
      endedAt,
      durationSeconds,
      mode: sessionMode,
      recordingAttached: Boolean(save.activeSession.recordingAttached),
      calibrationStatus: normalizeCalibrationStatus(save.activeSession.calibrationStatus),
      cameraState: sessionCameraState,
      cameraDirection: sessionCameraDirection,
      cameraAttachedAt: save.activeSession.cameraAttachedAt,
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
    };
    const nextSave = {
      activeSession: null,
      sessions: [completedSession, ...save.sessions].slice(0, 40),
    };

    setRitualState("saving");
    writeSave(nextSave);
    setSave(nextSave);
    setLatestSavedSessionId(completedSession.id);
    setActiveView("session");
    setDetectionStatus("idle");
    setVisiblePeople(null);
    setCalibrationEvidence(null);
    setCameraStream(null);
    setCameraMessage("");

    window.setTimeout(() => {
      setRitualState("complete");
    }, 520);
  }

  if (authPhase === "checking" || authPhase === "restoring") {
    return (
      <main className="axis-shell axis-entry-shell">
        <section className="axis-restore" aria-label="Restoring continuity">
          <p className="axis-meta">Identity restored</p>
          <h1>Restoring continuity...</h1>
          <div className="axis-restore-line" aria-hidden="true" />
          <div className="axis-restore-rail" aria-label="Continuity restoration steps">
            <span>Loading session...</span>
            <span>Restoring history...</span>
            <span>Return ready</span>
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
            <span>Continuity system</span>
            <span>Athletic history</span>
          </header>

          <section className="axis-entry-center">
            <p className="axis-meta">{isSupabaseConfigured() ? "Identity required" : "Local mode"}</p>
            <h1>Enter Axis</h1>
          </section>

          <form className="axis-entry-form" onSubmit={enterAxis}>
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="athlete@axis"
                type="email"
                value={email}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="save data key"
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
              <p className="axis-meta">Axis camera</p>
              <h1>Live camera</h1>
              <button className="axis-sign-out" onClick={() => setActiveView("session")} type="button">
                Back to session
              </button>
            </div>

            <p className="axis-presence-row" aria-label="Camera state">
              {`${currentMode.toUpperCase()} • ${formatCount(activeParticipantCount, "ATHLETE", "ATHLETES").toUpperCase()} • ${cameraDirectionLabel.toUpperCase()} • ${cameraLabel.toUpperCase()}`}
            </p>
          </header>

          <section className="axis-camera-page-main" aria-label="Live camera">
            <div className="axis-camera-preview axis-camera-preview-large" data-state={cameraState}>
              <video aria-label="Live camera preview" autoPlay muted playsInline ref={cameraPreviewRef} />
              {cameraStream ? null : <span>Camera offline</span>}
            </div>

            <section className="axis-camera-page-controls" aria-label="Camera controls">
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
              <div className="axis-camera-actions">
                <button onClick={() => requestCameraPresence()} type="button">
                  {cameraState === "offline" ? "Start camera" : "Refresh camera"}
                </button>
                <button disabled={!cameraStream || cameraState === "attached"} onClick={attachCameraPresence} type="button">
                  {cameraState === "attached" ? "Camera attached" : "Attach camera"}
                </button>
              </div>
              {cameraMessage ? <span className="axis-camera-message">{cameraMessage}</span> : null}
            </section>
          </section>

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
                      <em>{normalizeCalibrationStatus(participant.calibrationStatus) === "calibrated" ? "Complete" : "Not calibrated"}</em>
                      <button
                        onClick={() => {
                          setSelectedCalibrationAthleteId(participant.id);
                          setDetectionStatus("idle");
                          setVisiblePeople(null);
                          setCalibrationEvidence(null);
                        }}
                        type="button"
                      >
                        Select athlete
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="axis-roster-empty">Roster waiting</span>
                )}
              </div>
            </section>

            <section className="axis-session-module axis-camera-calibration-module" aria-label="Calibration status">
              <header>
                <span>Calibration status</span>
                <strong>{calibrationWorkflowLabel}</strong>
              </header>
              <span className="axis-window-state">{calibrationProgressLabel}</span>
              <span className="axis-window-state">
                {selectedCalibrationAthlete ? selectedCalibrationAthlete.name : "Select athlete"}
              </span>
              {visiblePeople !== null ? <span className="axis-window-state">{`VISIBLE PEOPLE = ${visiblePeople}`}</span> : null}
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
                  ? "Checking frame"
                  : selectedAthleteCalibrationStatus === "calibrated"
                    ? "Calibration complete"
                    : "Start calibration"}
              </button>
              {detectionStatus === "ready" ? (
                <button className="axis-calibration-action" onClick={captureCalibrationEvidence} type="button">
                  Capture calibration
                </button>
              ) : null}
              {calibrationEvidence?.athlete_id === selectedCalibrationAthlete?.id ? (
                <section className="axis-calibration-screen" aria-label="Calibration evidence">
                  <header>
                    <span>Calibration evidence</span>
                    <strong>Calibrated</strong>
                  </header>
                  <p>{calibrationEvidence.camera_type === "front" ? "Front camera" : "Back camera"}</p>
                  <span className="axis-window-state">{new Date(calibrationEvidence.timestamp).toLocaleTimeString()}</span>
                </section>
              ) : null}
            </section>

            <section className="axis-session-module axis-recording-module" aria-label="Recording state">
              <header>
                <span>Recording state</span>
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
        </section>
      </main>
    );
  }

  return (
    <main className="axis-shell">
      <section className="axis-surface" aria-label="Axis ritual home">
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

        <section className="axis-ritual" aria-label="Check in ritual" data-state={ritualState}>
          <p className="axis-meta">Participation ritual</p>
          {save.activeSession ? (
            <section className="axis-live-command" aria-label="Session live">
              <span>Session live</span>
              <strong>{formatCount(activeParticipantCount, "athlete", "athletes")} active</strong>
              <em>{currentMode}</em>
              <em>{`${cameraDirectionLabel} / ${sessionCameraStatusLabel}`}</em>
              <button onClick={handleSessionPrimaryAction} type="button">
                {sessionPrimaryActionLabel}
              </button>
            </section>
          ) : (
            <>
              <button
                className="axis-check-button"
                onClick={ritualState === "saving" ? undefined : checkIn}
                disabled={ritualState === "saving"}
                type="button"
              >
                {ritualState === "saving" ? "Saving" : "Start session"}
              </button>
              <section className="axis-bridge-state" aria-label="Camera state">
                <span>{bridgeSessionLabel}</span>
                <strong>{bridgeRosterLabel}</strong>
                <em>{cameraLabel}</em>
                <em>{cameraDirectionLabel}</em>
              </section>
            </>
          )}
          {save.activeSession ? (
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
                      {participationModes.map((mode) => (
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
            <button className="axis-checkout-button" onClick={checkOut} type="button">
              End session
            </button>
          ) : null}
        </section>

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
                            ? `${formatCount(session.participantCount, "athlete")} / ${session.recordingAttached ? "Memory attached" : "Memory off"} / ${formatCameraState(session.cameraState)} / ${
                                session.participationWindow?.status === "closed" ? "Window saved" : "Window open"
                              }`
                            : session.mode
                              ? session.mode
                              : index === 0
                                ? "Latest participation"
                                : "Session memory"}
                        </em>
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
            </div>

            <section className="axis-archive-strip" aria-label="Replay memory archive">
              <div>
                <span>Replay memory</span>
                <strong>{save.sessions.length ? "Continuity archive" : "No memory yet"}</strong>
              </div>
              <div>
                <span>Participation proof</span>
                <strong>{latestSession ? formatStamp(latestSession.endedAt) : "Waiting"}</strong>
              </div>
              <div>
                <span>Historical persistence</span>
                <strong>{save.sessions.length ? "Saved locally" : "Waiting"}</strong>
              </div>
            </section>
            </section>
          </details>
        </footer>
      </section>
    </main>
  );
}
