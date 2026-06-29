export type AxisSessionType = "shooting" | "handle" | "finish" | "defense";

export type AxisStatus = "EMPTY" | "READY" | "UPLOADED" | "READING" | "REVIEWED" | "SAVED" | "NEXT REP";

export type AxisRead = {
  summary: string;
  nextAction: string;
};

export type AxisRep = {
  id: string;
  playerName: string;
  sessionType: AxisSessionType;
  fileName?: string;
  fileSize?: number;
  status: AxisStatus;
  read?: AxisRead;
  savedAt?: string;
};

export const AXIS_REP_STORAGE_KEY = "axis-measure-current-rep";

export const sessionTypes: AxisSessionType[] = ["shooting", "handle", "finish", "defense"];

export function createAxisRep(playerName: string, sessionType: AxisSessionType): AxisRep {
  return {
    id: createId(),
    playerName: playerName.trim(),
    sessionType,
    status: "READY",
  };
}

export function createAxisRead(sessionType: AxisSessionType): AxisRead {
  if (sessionType === "handle") {
    return {
      summary: "Ball was picked up before shoulder advantage was created.",
      nextAction: "Attack the outside hip before picking the ball up.",
    };
  }

  if (sessionType === "finish") {
    return {
      summary: "Finish angle was flat and contact was avoided.",
      nextAction: "Get shoulder to defender and extend through the rim.",
    };
  }

  if (sessionType === "defense") {
    return {
      summary: "First slide opened the hips too early.",
      nextAction: "Keep chest square for the first two slides.",
    };
  }

  return {
    summary: "Base drifted left and release timing was late.",
    nextAction: "Freeze the landing for one second.",
  };
}

export function readStoredRep(): AxisRep | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AXIS_REP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AxisRep>;
    if (!isAxisRep(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredRep(rep: AxisRep) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AXIS_REP_STORAGE_KEY, JSON.stringify(rep));
}

export function clearStoredRep() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AXIS_REP_STORAGE_KEY);
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `axis-rep-${Date.now()}`;
}

function isAxisRep(value: Partial<AxisRep>): value is AxisRep {
  return (
    typeof value.id === "string" &&
    typeof value.playerName === "string" &&
    isSessionType(value.sessionType) &&
    isStatus(value.status) &&
    (value.fileName === undefined || typeof value.fileName === "string") &&
    (value.fileSize === undefined || typeof value.fileSize === "number") &&
    (value.savedAt === undefined || typeof value.savedAt === "string") &&
    (value.read === undefined ||
      (typeof value.read.summary === "string" && typeof value.read.nextAction === "string"))
  );
}

function isSessionType(value: unknown): value is AxisSessionType {
  return value === "shooting" || value === "handle" || value === "finish" || value === "defense";
}

function isStatus(value: unknown): value is AxisStatus {
  return (
    value === "EMPTY" ||
    value === "READY" ||
    value === "UPLOADED" ||
    value === "READING" ||
    value === "REVIEWED" ||
    value === "SAVED" ||
    value === "NEXT REP"
  );
}
