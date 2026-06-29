export type AxisSessionType = "shooting" | "handle" | "finish" | "defense";

export type AxisRep = {
  id: string;
  playerName: string;
  sessionType: AxisSessionType;
  clipUrl?: string;
  status: "empty" | "uploaded" | "reading" | "reviewed" | "saved";
  read: {
    summary: string;
    tags: string[];
    nextAction: string;
  };
  source: "mock" | "vision" | "manual";
  createdAt: string;
};

export const axisSessionTypes: { label: string; value: AxisSessionType }[] = [
  { label: "Shooting", value: "shooting" },
  { label: "Handle", value: "handle" },
  { label: "Finish", value: "finish" },
  { label: "Defense", value: "defense" },
];

export const AXIS_MEASURE_REP_KEY = "axis.measure.currentRep";

export function createAxisRep(input: { playerName: string; sessionType: AxisSessionType }): AxisRep {
  return {
    id: createId(),
    playerName: input.playerName.trim(),
    sessionType: input.sessionType,
    status: "empty",
    read: {
      summary: "",
      tags: [],
      nextAction: "",
    },
    source: "mock",
    createdAt: new Date().toISOString(),
  };
}

export function getAxisRead(sessionType: AxisSessionType): AxisRep["read"] {
  if (sessionType === "handle") {
    return {
      summary: "Ball was picked up before the shoulder advantage was created.",
      tags: ["early-pickup", "no-shoulder-advantage", "rushed-first-step"],
      nextAction: "Attack the outside hip before picking the ball up.",
    };
  }

  if (sessionType === "finish") {
    return {
      summary: "Finish angle was too flat and contact was avoided.",
      tags: ["avoided-contact", "bad-angle", "no-extension"],
      nextAction: "Get shoulder to defender and extend through the rim.",
    };
  }

  if (sessionType === "defense") {
    return {
      summary: "First slide opened the hips too early.",
      tags: ["opened-hips", "late-recovery", "balance-loss"],
      nextAction: "Hold the chest square for the first two slides.",
    };
  }

  return {
    summary: "Base drifted left and release timing was late.",
    tags: ["drifting-left", "late-release", "unstable-landing"],
    nextAction: "Freeze the landing for one second on the next rep.",
  };
}

export function getAxisMeasureStatus(rep: AxisRep | null, ready = false) {
  if (!rep) return ready ? "READY" : "NO SIGNAL";
  if (rep.status === "empty") return ready ? "READY" : "NO SIGNAL";
  if (rep.status === "uploaded") return "UPLOADED";
  if (rep.status === "reading") return "READING";
  if (rep.status === "reviewed") return "REVIEWED";
  return "SAVED";
}

export function readCurrentAxisRep(): AxisRep | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AXIS_MEASURE_REP_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AxisRep;
    if (!parsed || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCurrentAxisRep(rep: AxisRep) {
  if (typeof window === "undefined") return;
  // TODO: replace localStorage with the existing persistence layer when the AxisMeasure save path is unlocked.
  window.localStorage.setItem(AXIS_MEASURE_REP_KEY, JSON.stringify(rep));
}

export function clearCurrentAxisRep() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AXIS_MEASURE_REP_KEY);
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `rep-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
