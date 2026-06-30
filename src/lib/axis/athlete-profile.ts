export type AthletePosition =
  | "point_guard"
  | "shooting_guard"
  | "small_forward"
  | "power_forward"
  | "center"
  | "unspecified";

export type AthleteBaseline = {
  testId: string;
  measurementId: string;
  value: number;
  recordedAt: string;
};

export type AthleteProfile = {
  id: string;
  name: string;
  position: AthletePosition;
  heightCm?: number;
  weightKg?: number;
  baselines: AthleteBaseline[];
  createdAt: string;
  updatedAt: string;
};

export const positionLabels: Record<AthletePosition, string> = {
  point_guard: "PG",
  shooting_guard: "SG",
  small_forward: "SF",
  power_forward: "PF",
  center: "C",
  unspecified: "—",
};

const storageKey = "axis.athletes.v0";

export function readAthletes(): AthleteProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAthlete(athlete: AthleteProfile) {
  const athletes = readAthletes().filter((a) => a.id !== athlete.id);
  const next = [athlete, ...athletes];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }
  return next;
}

export function deleteAthlete(id: string) {
  const next = readAthletes().filter((a) => a.id !== id);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }
  return next;
}

export function getAthleteBaseline(
  athlete: AthleteProfile,
  testId: string,
  measurementId: string,
): number | null {
  return (
    athlete.baselines.find((b) => b.testId === testId && b.measurementId === measurementId)?.value ??
    null
  );
}

export function newAthleteProfile(name: string): AthleteProfile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    position: "unspecified",
    baselines: [],
    createdAt: now,
    updatedAt: now,
  };
}
