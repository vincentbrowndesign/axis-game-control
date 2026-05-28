"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase-browser";

type RitualState = "idle" | "active" | "saving" | "complete";
type AuthPhase = "checking" | "entry" | "restoring" | "authenticated";
type CalibrationStatus = "required" | "calibrated";
type CalibrationStep = "stand" | "hold" | "left" | "right";
type CameraState = "offline" | "ready" | "attached";
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
const calibrationSteps: CalibrationStep[] = ["stand", "hold", "left", "right"];
const calibrationStepCopy: Record<CalibrationStep, string> = {
  stand: "Stand in frame.",
  hold: "Hold still.",
  left: "Turn left.",
  right: "Turn right.",
};
const storageKey = "axis-ritual-save";
const identityStorageKey = "axis-identity-save";

type AthleteIdentity = {
  id: string;
  name: string;
  rosterCode: string;
  calibrationAnchorId: string;
};

const availableAthletes: AthleteIdentity[] = [
  { id: "bridge-vincent", name: "Vincent", rosterCode: "BR-01", calibrationAnchorId: "calibration:bridge:vincent" },
  { id: "bridge-cole", name: "Cole", rosterCode: "BR-02", calibrationAnchorId: "calibration:bridge:cole" },
  { id: "bridge-jalen", name: "Jalen", rosterCode: "BR-03", calibrationAnchorId: "calibration:bridge:jalen" },
  { id: "bridge-mason", name: "Mason", rosterCode: "BR-04", calibrationAnchorId: "calibration:bridge:mason" },
  { id: "bridge-rocket", name: "Rocket", rosterCode: "BR-05", calibrationAnchorId: "calibration:bridge:rocket" },
];

type SavedSession = {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  mode?: ParticipationMode;
  recordingAttached?: boolean;
  calibrationStatus?: CalibrationStatus;
  cameraState?: CameraState;
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
};

type SessionParticipant = AthleteIdentity & {
  joinedAt: string;
  leftAt?: string;
  calibrationStatus?: CalibrationStatus;
  calibratedAt?: string;
  activeAtCheckout: boolean;
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
    cameraAttachedAt?: string;
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

function identityForName(name: string): AthleteIdentity {
  const normalizedName = name.trim().toLowerCase();
  const rosterIdentity = availableAthletes.find((athlete) => athlete.name.toLowerCase() === normalizedName);

  if (rosterIdentity) return rosterIdentity;

  const fallbackId = normalizedName.replace(/[^a-z0-9]+/g, "-") || "athlete";

  return {
    id: `custom-${fallbackId}`,
    name: name.trim() || "Athlete",
    rosterCode: "CUSTOM",
    calibrationAnchorId: `calibration:custom:${fallbackId}`,
  };
}

function normalizeActiveParticipant(participant: unknown): ActiveParticipant | null {
  if (typeof participant === "string") {
    return {
      ...identityForName(participant),
      joinedAt: new Date().toISOString(),
    };
  }

  if (!participant || typeof participant !== "object") return null;

  const candidate = participant as Partial<ActiveParticipant>;
  const identity = identityForName(candidate.name ?? candidate.id ?? "Athlete");
  const isRosterIdentity = availableAthletes.some((athlete) => athlete.id === identity.id);

  return {
    ...identity,
    id: isRosterIdentity ? identity.id : (candidate.id ?? identity.id),
    rosterCode: candidate.rosterCode ?? identity.rosterCode,
    calibrationAnchorId: candidate.calibrationAnchorId ?? identity.calibrationAnchorId,
    joinedAt: candidate.joinedAt ?? new Date().toISOString(),
    leftAt: candidate.leftAt,
    calibrationStatus: normalizeCalibrationStatus(candidate.calibrationStatus),
    calibratedAt: candidate.calibratedAt,
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

function formatCameraState(state: unknown) {
  const normalizedState = normalizeCameraState(state);

  if (normalizedState === "attached") return "Camera attached";
  if (normalizedState === "ready") return "Camera ready";

  return "Camera offline";
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
          cameraAttachedAt: parsed.activeSession.cameraAttachedAt,
          participationWindow: activeParticipationWindow,
          clipContinuityContext: createClipContinuityContext(
            parsed.activeSession.id,
            activeMode,
            activeCameraState,
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
              cameraAttachedAt: session.cameraAttachedAt,
              participationWindow: sessionParticipationWindow,
              clipContinuityContext: createClipContinuityContext(
                session.id,
                sessionMode,
                sessionCameraState,
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
  const [isModePickerOpen, setIsModePickerOpen] = useState(false);
  const [calibrationStepIndex, setCalibrationStepIndex] = useState<number | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
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
    if (cameraPreviewRef.current) {
      cameraPreviewRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

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
  const calibrationStatus = normalizeCalibrationStatus(
    save.activeSession?.calibrationStatus ?? latestSession?.calibrationStatus,
  );
  const calibrationLabel = calibrationStatus === "calibrated" ? "Calibrated" : "Calibration required";
  const cameraState = normalizeCameraState(save.activeSession?.cameraState ?? latestSession?.cameraState);
  const cameraLabel = formatCameraState(cameraState);
  const activeCalibrationStep =
    calibrationStepIndex === null ? null : calibrationSteps[calibrationStepIndex] ?? null;
  const activeParticipants = save.activeSession?.participants ?? [];
  const presentParticipants = activeParticipants.filter((participant) => !participant.leftAt);
  const inactiveParticipants = activeParticipants.filter((participant) => participant.leftAt);
  const activeParticipantCount = presentParticipants.length;
  const participantCount = activeParticipants.length;
  const calibratedParticipantCount = presentParticipants.filter(
    (participant) => normalizeCalibrationStatus(participant.calibrationStatus) === "calibrated",
  ).length;
  const calibrationProgressTotal = save.activeSession ? Math.max(activeParticipantCount, 1) : availableAthletes.length;
  const calibrationPhase =
    calibratedParticipantCount >= calibrationProgressTotal
      ? "Complete"
      : calibratedParticipantCount > 0
        ? "Partial"
        : "Not calibrated";
  const calibrationProgressLabel = `${calibratedParticipantCount}/${calibrationProgressTotal} calibrated`;
  const bridgeSessionLabel = save.activeSession ? "Session live" : "Session active";
  const bridgeRosterLabel = save.activeSession
    ? `${formatCount(activeParticipantCount, "athlete", "athletes")} active`
    : `${formatCount(availableAthletes.length, "athlete", "athletes")} ready`;
  const participationWindowLabel = save.activeSession
    ? "Window open"
    : latestSession?.participationWindow?.status === "closed"
      ? "Window saved"
      : "Window waiting";
  const selectableAthletes = availableAthletes.filter(
    (athlete) => !presentParticipants.some((participant) => participant.id === athlete.id),
  );
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
    const startedAt = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const startingParticipants = availableAthletes.map((athlete) => ({
      ...athlete,
      joinedAt: startedAt,
      calibrationStatus: "required" as const,
    }));
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
        participationWindow,
        clipContinuityContext: createClipContinuityContext(
          sessionId,
          defaultParticipationMode,
          "offline",
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
    setIsModePickerOpen(false);
    setCalibrationStepIndex(null);
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

  function updateCameraSessionState(nextCameraState: CameraState, attachedAt?: string) {
    if (!save.activeSession) return;

    const cameraAttachedAt = attachedAt ?? save.activeSession.cameraAttachedAt;
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
        cameraAttachedAt,
        clipContinuityContext: createClipContinuityContext(
          save.activeSession.id,
          currentMode,
          nextCameraState,
          cameraAttachedAt,
          participationWindow,
          activeParticipants,
        ),
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
  }

  async function requestCameraPresence() {
    if (!save.activeSession) return;

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
          facingMode: "environment",
        },
      });

      setCameraStream((currentStream) => {
        currentStream?.getTracks().forEach((track) => track.stop());
        return stream;
      });
      updateCameraSessionState("ready");
    } catch (error) {
      console.error("Unable to start camera presence", error);
      setCameraMessage("Camera unavailable.");
      updateCameraSessionState("offline");
    }
  }

  function attachCameraPresence() {
    if (!save.activeSession || !cameraStream) return;

    updateCameraSessionState("attached", new Date().toISOString());
  }

  function startCalibration() {
    if (!save.activeSession || cameraState !== "attached") return;

    setCalibrationStepIndex(0);
  }

  function completeCalibration() {
    if (!save.activeSession || !identity) return;

    const completedAt = new Date().toISOString();
    const nextParticipants = activeParticipants.map((participant) =>
      participant.leftAt
        ? participant
        : {
            ...participant,
            calibrationStatus: "calibrated" as const,
            calibratedAt: completedAt,
          },
    );
    const nextSave: AxisSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        calibrationStatus: "calibrated",
        clipContinuityContext: createClipContinuityContext(
          save.activeSession.id,
          currentMode,
          cameraState,
          save.activeSession.cameraAttachedAt,
          normalizeParticipationWindow(
            save.activeSession.participationWindow,
            save.activeSession.startedAt,
            currentMode,
            nextParticipants,
          ),
          nextParticipants,
        ),
        participants: nextParticipants,
      },
    };
    const nextIdentity = {
      ...identity,
      calibrationStatus: "calibrated" as const,
      calibratedAt: completedAt,
      calibrationSessionId: save.activeSession.id,
    };

    writeSave(nextSave);
    writeIdentity(nextIdentity);
    setSave(nextSave);
    setIdentity(nextIdentity);
    setCalibrationStepIndex(null);
  }

  function advanceCalibration() {
    if (calibrationStepIndex === null) return;

    if (calibrationStepIndex >= calibrationSteps.length - 1) {
      completeCalibration();
      return;
    }

    setCalibrationStepIndex(calibrationStepIndex + 1);
  }

  function selectAthlete(athlete: AthleteIdentity) {
    if (!save.activeSession) return;

    const existingParticipant = activeParticipants.find((participant) => participant.id === athlete.id);

    if (existingParticipant && !existingParticipant.leftAt) {
      return;
    }

    const nextParticipants = existingParticipant
      ? activeParticipants.map((participant) =>
          participant.id === existingParticipant.id
            ? {
                ...participant,
                joinedAt: new Date().toISOString(),
                leftAt: undefined,
              }
            : participant,
        )
      : [
          ...activeParticipants,
          {
            ...athlete,
            joinedAt: new Date().toISOString(),
            calibrationStatus: "required" as const,
          },
        ];
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
    const nextSave: AxisSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        participationWindow,
        clipContinuityContext: createClipContinuityContext(
          save.activeSession.id,
          currentMode,
          cameraState,
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
    const nextSave: AxisSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        participationWindow,
        clipContinuityContext: createClipContinuityContext(
          save.activeSession.id,
          currentMode,
          cameraState,
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
      cameraAttachedAt: save.activeSession.cameraAttachedAt,
      participationWindow,
      clipContinuityContext: createClipContinuityContext(
        save.activeSession.id,
        sessionMode,
        sessionCameraState,
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
    setCalibrationStepIndex(null);
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
          <button
            className="axis-check-button"
            onClick={ritualState === "active" || ritualState === "saving" ? undefined : checkIn}
            disabled={ritualState === "active" || ritualState === "saving"}
            type="button"
          >
            {ritualState === "active" ? "Session live" : ritualState === "saving" ? "Saving" : "Start session"}
          </button>
          <section className="axis-bridge-state" aria-label="Camera calibration bridge">
            <span>{bridgeSessionLabel}</span>
            <strong>{bridgeRosterLabel}</strong>
            <em>{cameraLabel}</em>
            <em>{calibrationPhase}</em>
            <em>{calibrationProgressLabel}</em>
          </section>
          {save.activeSession ? (
            <section className="axis-session-object" aria-label="Session continuity object">
              <section className="axis-mode-focus" aria-label="Current mode">
                <span>Current mode</span>
                <strong>{currentMode}</strong>
                <button onClick={() => setIsModePickerOpen((isOpen) => !isOpen)} type="button">
                  Change mode
                </button>
              </section>
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

              <details className="axis-session-drawer">
                <summary>
                  <span>Roster</span>
                  <strong>{formatCount(activeParticipantCount, "active")}</strong>
                </summary>
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
                          data-calibrated={normalizeCalibrationStatus(participant.calibrationStatus) === "calibrated"}
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
                <section className="axis-session-module" aria-label="Available athletes">
                  <header>
                    <span>Roster pool</span>
                    <strong>{formatCount(selectableAthletes.length, "ready")}</strong>
                  </header>
                  <div className="axis-available-roster">
                    {selectableAthletes.map((athlete) => (
                      <button
                        data-athlete-id={athlete.id}
                        key={athlete.id}
                        onClick={() => selectAthlete(athlete)}
                        type="button"
                      >
                        {athlete.name}
                      </button>
                    ))}
                  </div>
                  {inactiveParticipants.length ? (
                    <div className="axis-participant-list axis-participant-list-inactive" aria-label="Inactive athletes">
                      {inactiveParticipants.map((participant) => (
                        <span
                          className="axis-participant-token"
                          data-athlete-id={participant.id}
                          key={participant.id}
                        >
                          <span>{participant.name}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </section>
              </details>

              <details className="axis-session-drawer" open={activeCalibrationStep ? true : undefined}>
                <summary>
                  <span>Calibration</span>
                  <strong>{calibrationProgressLabel}</strong>
                </summary>
                <section className="axis-session-module axis-calibration-module" aria-label="Calibration state">
                  <header>
                    <span>Calibration</span>
                    <strong>{calibrationPhase}</strong>
                  </header>
                  <button
                    className="axis-calibration-toggle"
                    data-calibrated={calibrationStatus === "calibrated"}
                    disabled={cameraState !== "attached" || calibrationStatus === "calibrated"}
                    onClick={startCalibration}
                    type="button"
                  >
                    {calibrationStatus === "calibrated"
                      ? "Complete"
                      : cameraState === "attached"
                        ? "Start calibration"
                        : "Camera required"}
                  </button>
                </section>
                {activeCalibrationStep ? (
                  <section className="axis-calibration-screen" aria-label="Identity calibration" aria-live="polite">
                    <header>
                      <span>Identity calibration</span>
                      <strong>{calibrationStepIndex === calibrationSteps.length - 1 ? "Complete" : "Active"}</strong>
                    </header>
                    <p>{calibrationStepCopy[activeCalibrationStep]}</p>
                    <div className="axis-calibration-steps" aria-label="Calibration steps">
                      {calibrationSteps.map((step, index) => (
                        <span
                          aria-current={index === calibrationStepIndex ? "step" : undefined}
                          data-complete={calibrationStepIndex !== null && index < calibrationStepIndex}
                          key={step}
                        >
                          {calibrationStepCopy[step]}
                        </span>
                      ))}
                    </div>
                    <button className="axis-calibration-action" onClick={advanceCalibration} type="button">
                      {calibrationStepIndex === calibrationSteps.length - 1 ? "Complete" : "Next"}
                    </button>
                  </section>
                ) : null}
              </details>

              <details className="axis-session-drawer">
                <summary>
                  <span>Recording details</span>
                  <strong>{`${cameraLabel} / ${recordingLabel}`}</strong>
                </summary>
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
                <section className="axis-session-module axis-camera-module" aria-label="Camera presence">
                  <header>
                    <span>Camera</span>
                    <strong>{cameraLabel}</strong>
                  </header>
                  <div className="axis-camera-preview" data-state={cameraState}>
                    <video aria-label="Live camera preview" autoPlay muted playsInline ref={cameraPreviewRef} />
                    {cameraStream ? null : <span>Camera offline</span>}
                  </div>
                  <div className="axis-camera-actions">
                    <button onClick={requestCameraPresence} type="button">
                      {cameraState === "offline" ? "Start camera" : "Refresh camera"}
                    </button>
                    <button disabled={!cameraStream || cameraState === "attached"} onClick={attachCameraPresence} type="button">
                      {cameraState === "attached" ? "Attached" : "Attach camera"}
                    </button>
                  </div>
                  {cameraMessage ? <span className="axis-camera-message">{cameraMessage}</span> : null}
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
                            ? `${formatCount(session.participantCount, "athlete")} / ${session.recordingAttached ? "Memory attached" : "Memory off"} / ${
                                normalizeCalibrationStatus(session.calibrationStatus) === "calibrated"
                                  ? "Calibrated"
                                  : "Calibration required"
                              } / ${formatCameraState(session.cameraState)} / ${
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
