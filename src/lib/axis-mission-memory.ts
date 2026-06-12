import type { AxisMissionContext } from "./axis-context-engine";
import { type AxisEvidence } from "./axis-evidence";

export type MissionStatus = "READY";

export type SessionStatus = "ACTIVE" | "ENDED" | "EVALUATED" | "PAUSED";

export type MissionMoment = "ALMOST" | "COMPLETE" | "FAILED" | "RECORD" | "STREAK" | null;

export type MissionEventType =
  | "BREAK"
  | "COACH_NOTE"
  | "CORRECTION"
  | "FINISHED"
  | "PROGRESS_UPDATE"
  | "SESSION_STARTED";

export type MissionEvent = {
  id: string;
  payload: Record<string, unknown>;
  timestamp: string;
  type: MissionEventType;
};

export type MissionSession = {
  constraint: string;
  endedAt?: string;
  events: MissionEvent[];
  id: string;
  objective: string;
  result: number;
  startedAt: string;
  status: SessionStatus;
  target: number;
};

export type MissionAttempt = {
  audioContext?: AxisMissionContext["audioContext"];
  cameraContext?: AxisMissionContext["cameraContext"];
  constraint: string;
  evidence?: AxisEvidence;
  id: string;
  moment: MissionMoment;
  notes?: AxisMissionContext["notes"];
  objective: string;
  playerId?: string;
  result: number;
  sessionId?: string;
  status: SessionStatus;
  target: number;
  timestamp: string;
};

export type MissionMemoryAdapter = {
  getLastAttempt: (objective: string, constraint: string) => MissionAttempt | null;
  getPersonalBest: (objective: string, constraint: string) => number;
  getStreak: (objective: string, constraint: string) => number;
  listAttempts: () => MissionAttempt[];
  listRecentAttempts: (objective: string, constraint: string, limit?: number) => MissionAttempt[];
  listSessions: () => MissionSession[];
  saveAttempt: (attempt: MissionAttempt) => MissionAttempt[];
  saveSession: (session: MissionSession) => MissionSession[];
};

const missionStorageKey = "axis.mission.attempts.v2";
const sessionStorageKey = "axis.mission.sessions.v1";
const legacyMissionStorageKey = "axis.mission.attempts.v1";
const olderLegacyMissionStorageKey = "axis.mission.v1.weak-hand-finishes";

export function createLocalMissionMemoryAdapter(): MissionMemoryAdapter {
  return {
    getLastAttempt(objective, constraint) {
      return filterMission(readAttempts(), objective, constraint)[0] ?? null;
    },
    getPersonalBest(objective, constraint) {
      return filterMission(readAttempts(), objective, constraint).reduce((best, attempt) => Math.max(best, attempt.result), 0);
    },
    getStreak(objective, constraint) {
      let streak = 0;
      for (const attempt of filterMission(readAttempts(), objective, constraint)) {
        if (attempt.moment !== "COMPLETE" && attempt.moment !== "RECORD" && attempt.moment !== "STREAK") break;
        streak += 1;
      }
      return streak;
    },
    listAttempts() {
      return readAttempts();
    },
    listRecentAttempts(objective, constraint, limit = 5) {
      return filterMission(readAttempts(), objective, constraint).slice(0, Math.max(0, limit));
    },
    listSessions() {
      return readSessions();
    },
    saveAttempt(attempt) {
      const attempts = [attempt, ...readAttempts().filter((item) => item.id !== attempt.id)].slice(0, 100);
      writeAttempts(attempts);
      return attempts;
    },
    saveSession(session) {
      const sessions = [session, ...readSessions().filter((item) => item.id !== session.id)].slice(0, 50);
      writeSessions(sessions);
      return sessions;
    },
  };
}

export function createMissionSession({
  constraint,
  objective,
  target,
}: {
  constraint: string;
  objective: string;
  target: number;
}): MissionSession {
  const timestamp = new Date().toISOString();
  return {
    constraint,
    events: [
      createMissionEvent({
        payload: { constraint, objective, target },
        timestamp,
        type: "SESSION_STARTED",
      }),
    ],
    id: createMissionId("session"),
    objective,
    result: 0,
    startedAt: timestamp,
    status: "ACTIVE",
    target,
  };
}

export function createMissionEvent({
  payload = {},
  timestamp = new Date().toISOString(),
  type,
}: {
  payload?: Record<string, unknown>;
  timestamp?: string;
  type: MissionEventType;
}): MissionEvent {
  return {
    id: createMissionId("event"),
    payload,
    timestamp,
    type,
  };
}

export function appendMissionEvent(session: MissionSession, event: MissionEvent): MissionSession {
  const result = getNumber(event.payload.result) ?? session.result;
  return {
    ...session,
    events: [...session.events, event],
    result,
  };
}

export function endMissionSession(session: MissionSession): MissionSession {
  const timestamp = new Date().toISOString();
  return {
    ...appendMissionEvent(
      {
        ...session,
        endedAt: timestamp,
        status: "ENDED",
      },
      createMissionEvent({
        payload: { result: session.result },
        timestamp,
        type: "FINISHED",
      }),
    ),
    endedAt: timestamp,
    status: "ENDED",
  };
}

export function createMissionAttempt({
  audioContext = null,
  cameraContext = null,
  constraint,
  evidence,
  moment,
  notes = null,
  objective,
  playerId,
  result,
  sessionId,
  status = "EVALUATED",
  target,
}: {
  audioContext?: AxisMissionContext["audioContext"];
  cameraContext?: AxisMissionContext["cameraContext"];
  constraint: string;
  evidence?: AxisEvidence;
  moment: MissionMoment;
  notes?: AxisMissionContext["notes"];
  objective: string;
  playerId?: string;
  result: number;
  sessionId?: string;
  status?: SessionStatus;
  target: number;
}): MissionAttempt {
  return {
    audioContext,
    cameraContext,
    constraint,
    ...(evidence ? { evidence } : {}),
    id: createMissionId("attempt"),
    moment,
    notes,
    objective,
    ...(playerId ? { playerId } : {}),
    result,
    ...(sessionId ? { sessionId } : {}),
    status,
    target,
    timestamp: new Date().toISOString(),
  };
}

function readAttempts() {
  if (typeof window === "undefined") return [];
  const parsed = parseAttempts(window.localStorage.getItem(missionStorageKey));
  if (parsed.length) return parsed;

  const legacy = parseLegacyAttempts(window.localStorage.getItem(legacyMissionStorageKey));
  if (legacy.length) {
    writeAttempts(legacy);
    return legacy;
  }

  const olderLegacy = parseLegacyAttempts(window.localStorage.getItem(olderLegacyMissionStorageKey));
  if (olderLegacy.length) {
    writeAttempts(olderLegacy);
    return olderLegacy;
  }
  return [];
}

function readSessions() {
  if (typeof window === "undefined") return [];
  return parseSessions(window.localStorage.getItem(sessionStorageKey));
}

function writeAttempts(attempts: MissionAttempt[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(missionStorageKey, JSON.stringify(attempts));
}

function writeSessions(sessions: MissionSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(sessions));
}

function parseAttempts(raw: string | null) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isMissionAttempt).sort(sortNewestFirst) : [];
  } catch {
    return [];
  }
}

function parseSessions(raw: string | null) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isMissionSession).sort(sortSessionNewestFirst) : [];
  } catch {
    return [];
  }
}

function parseLegacyAttempts(raw: string | null): MissionAttempt[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value))
      .map((record) => {
        const result = getNumber(record.result) ?? 0;
        const target = 50;
        const moment = createMoment({ previousBest: 0, result, target });
        return {
          constraint: getString(record.constraint) || "Weak Hand Only",
          id: createMissionId("attempt"),
          moment,
          objective: getString(record.objective) || "50 Weak-Hand Finishes",
          result,
          status: "EVALUATED" as const,
          target,
          timestamp: getString(record.timestamp) || new Date().toISOString(),
        };
      })
      .filter(isMissionAttempt)
      .sort(sortNewestFirst);
  } catch {
    return [];
  }
}

function filterMission(attempts: MissionAttempt[], objective: string, constraint: string) {
  return attempts.filter((attempt) => attempt.objective === objective && attempt.constraint === constraint).sort(sortNewestFirst);
}

export function createMoment({
  previousBest,
  result,
  target,
}: {
  previousBest: number;
  result: number;
  target: number;
}): MissionMoment {
  if (result >= target && result > previousBest) return "RECORD";
  if (result >= target) return "COMPLETE";
  if (result > 0 && target - result <= target * 0.1) return "ALMOST";
  return "FAILED";
}

function isMissionAttempt(value: unknown): value is MissionAttempt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.objective === "string" &&
    typeof record.constraint === "string" &&
    typeof record.target === "number" &&
    typeof record.result === "number" &&
    typeof record.timestamp === "string" &&
    isOptionalAudioContext(record.audioContext) &&
    isOptionalCameraContext(record.cameraContext) &&
    isOptionalEvidence(record.evidence) &&
    isOptionalNotes(record.notes) &&
    isSessionStatus(record.status) &&
    isMissionMoment(record.moment)
  );
}

function isMissionSession(value: unknown): value is MissionSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.objective === "string" &&
    typeof record.constraint === "string" &&
    typeof record.target === "number" &&
    typeof record.result === "number" &&
    typeof record.startedAt === "string" &&
    isSessionStatus(record.status) &&
    Array.isArray(record.events) &&
    record.events.every(isMissionEvent)
  );
}

function isMissionEvent(value: unknown): value is MissionEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.timestamp === "string" &&
    isMissionEventType(record.type) &&
    Boolean(record.payload) &&
    typeof record.payload === "object" &&
    !Array.isArray(record.payload)
  );
}

function isMissionStatus(value: unknown): value is MissionStatus {
  return value === "READY";
}

function isSessionStatus(value: unknown): value is SessionStatus {
  return value === "ACTIVE" || value === "ENDED" || value === "EVALUATED" || value === "PAUSED";
}

function isMissionEventType(value: unknown): value is MissionEventType {
  return (
    value === "BREAK" ||
    value === "COACH_NOTE" ||
    value === "CORRECTION" ||
    value === "FINISHED" ||
    value === "PROGRESS_UPDATE" ||
    value === "SESSION_STARTED"
  );
}

function isMissionMoment(value: unknown): value is MissionMoment {
  return value === null || value === "ALMOST" || value === "COMPLETE" || value === "FAILED" || value === "RECORD" || value === "STREAK";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isOptionalAudioContext(value: unknown) {
  if (value === undefined || value === null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.transcript === undefined || typeof record.transcript === "string") &&
    (record.command === undefined || typeof record.command === "string") &&
    (record.confidence === undefined || typeof record.confidence === "number")
  );
}

function isOptionalCameraContext(value: unknown) {
  if (value === undefined || value === null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.calibrationState === undefined || record.calibrationState === "REFERENCE_SAVED" || record.calibrationState === "UNCALIBRATED") &&
    (record.frameId === undefined || typeof record.frameId === "string") &&
    (record.referenceFrameId === undefined || typeof record.referenceFrameId === "string") &&
    (record.source === undefined || record.source === "camera" || record.source === "none") &&
    (record.timestamp === undefined || typeof record.timestamp === "string")
  );
}

function isOptionalEvidence(value: unknown) {
  if (value === undefined || value === null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return isEvidenceKind(record.kind) && isEvidenceSource(record.source);
}

function isEvidenceKind(value: unknown) {
  return value === "COUNT" || value === "OBSERVATION" || value === "PRESENCE" || value === "COMPLETION";
}

function isEvidenceSource(value: unknown) {
  return (
    value === "VOICE" ||
    value === "CAMERA" ||
    value === "PRESENCE" ||
    value === "COACH" ||
    value === "USER" ||
    value === "SYSTEM"
  );
}

function isOptionalNotes(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}

function sortNewestFirst(a: MissionAttempt, b: MissionAttempt) {
  return Date.parse(b.timestamp) - Date.parse(a.timestamp);
}

function sortSessionNewestFirst(a: MissionSession, b: MissionSession) {
  return Date.parse(b.startedAt) - Date.parse(a.startedAt);
}

function createMissionId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
