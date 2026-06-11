import type { AxisMissionContext } from "./axis-context-engine";

export type MissionStatus = "ACTIVE" | "COMPLETE" | "FAILED" | "READY";

export type MissionMoment = "ALMOST" | "COMPLETE" | "FAILED" | "RECORD" | "STREAK" | null;

export type MissionAttempt = {
  audioContext?: AxisMissionContext["audioContext"];
  cameraContext?: AxisMissionContext["cameraContext"];
  constraint: string;
  id: string;
  moment: MissionMoment;
  notes?: AxisMissionContext["notes"];
  objective: string;
  playerId?: string;
  result: number;
  status: MissionStatus;
  target: number;
  timestamp: string;
};

export type MissionMemoryAdapter = {
  getLastAttempt: (objective: string, constraint: string) => MissionAttempt | null;
  getPersonalBest: (objective: string, constraint: string) => number;
  getStreak: (objective: string, constraint: string) => number;
  listAttempts: () => MissionAttempt[];
  listRecentAttempts: (objective: string, constraint: string, limit?: number) => MissionAttempt[];
  saveAttempt: (attempt: MissionAttempt) => MissionAttempt[];
};

const missionStorageKey = "axis.mission.attempts.v1";
const legacyMissionStorageKey = "axis.mission.v1.weak-hand-finishes";

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
        if (attempt.status !== "COMPLETE") break;
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
    saveAttempt(attempt) {
      const attempts = [attempt, ...readAttempts().filter((item) => item.id !== attempt.id)].slice(0, 100);
      writeAttempts(attempts);
      return attempts;
    },
  };
}

export function createMissionAttempt({
  audioContext = null,
  cameraContext = null,
  constraint,
  moment,
  notes = null,
  objective,
  playerId,
  result,
  status,
  target,
}: {
  audioContext?: AxisMissionContext["audioContext"];
  cameraContext?: AxisMissionContext["cameraContext"];
  constraint: string;
  moment: MissionMoment;
  notes?: AxisMissionContext["notes"];
  objective: string;
  playerId?: string;
  result: number;
  status: MissionStatus;
  target: number;
}): MissionAttempt {
  return {
    audioContext,
    cameraContext,
    constraint,
    id: createAttemptId(),
    moment,
    notes,
    objective,
    ...(playerId ? { playerId } : {}),
    result,
    status,
    target,
    timestamp: new Date().toISOString(),
  };
}

function readAttempts() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(missionStorageKey);
  const parsed = parseAttempts(raw);
  if (parsed.length) return parsed;

  const legacy = parseLegacyAttempts(window.localStorage.getItem(legacyMissionStorageKey));
  if (legacy.length) {
    writeAttempts(legacy);
    return legacy;
  }
  return [];
}

function writeAttempts(attempts: MissionAttempt[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(missionStorageKey, JSON.stringify(attempts));
}

function parseAttempts(raw: string | null) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isMissionAttempt).sort(sortNewestFirst) : [];
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
        const status = getStatus(record.status);
        const target = 50;
        return {
          constraint: getString(record.constraint) || "Weak Hand Only",
          id: createAttemptId(),
          moment: createMoment({ previousBest: 0, result, status, target }),
          objective: getString(record.objective) || "50 Weak-Hand Finishes",
          result,
          status,
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
  status,
  target,
}: {
  previousBest: number;
  result: number;
  status: MissionStatus;
  target: number;
}): MissionMoment {
  if (status === "FAILED") return "FAILED";
  if (status === "COMPLETE" && result > previousBest) return "RECORD";
  if (status === "COMPLETE") return "COMPLETE";
  if (result > 0 && result < target && target - result <= target * 0.1) return "ALMOST";
  return null;
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
      isOptionalNotes(record.notes) &&
      isMissionStatus(record.status) &&
      isMissionMoment(record.moment)
    );
}

function isMissionStatus(value: unknown): value is MissionStatus {
  return value === "ACTIVE" || value === "COMPLETE" || value === "FAILED" || value === "READY";
}

function isMissionMoment(value: unknown): value is MissionMoment {
  return value === null || value === "ALMOST" || value === "COMPLETE" || value === "FAILED" || value === "RECORD" || value === "STREAK";
}

function getStatus(value: unknown): MissionStatus {
  return isMissionStatus(value) ? value : "ACTIVE";
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

function isOptionalNotes(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}

function sortNewestFirst(a: MissionAttempt, b: MissionAttempt) {
  return Date.parse(b.timestamp) - Date.parse(a.timestamp);
}

function createAttemptId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `mission_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
