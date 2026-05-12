export type AxisTeam = "HOME" | "AWAY";

export type AxisEventType = "SCORE" | "TIMEOUT" | "TURNOVER";

export type AxisEvent = {
  id: string;
  type: AxisEventType;
  team?: AxisTeam;
  points?: number;
  timestamp: number;
  gameTime: number;
  homeScore: number;
  awayScore: number;
  inferredState?: string;
};

export type AxisSession = {
  id: string;
  muxUploadId?: string;
  muxAssetId?: string;
  playbackId?: string;
  homeScore: number;
  awayScore: number;
  duration: number;
  events: AxisEvent[];
  createdAt: string;
  status: "local" | "uploaded" | "ready";
};

export function createSessionId() {
  return crypto.randomUUID();
}

export function saveAxisSession(session: AxisSession) {
  const existing = getAxisSessions();

  const next = [
    session,
    ...existing.filter((item) => item.id !== session.id),
  ];

  localStorage.setItem("axis-sessions", JSON.stringify(next));
  localStorage.setItem(`axis-session-${session.id}`, JSON.stringify(session));
}

export function getAxisSessions(): AxisSession[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem("axis-sessions");

  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getAxisSession(id: string): AxisSession | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(`axis-session-${id}`);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}