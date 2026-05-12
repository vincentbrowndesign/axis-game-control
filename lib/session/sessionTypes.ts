export type TeamSide =
  | "HOME"
  | "AWAY";

export type SessionEventType =
  | "SCORE"
  | "TIMEOUT"
  | "TURNOVER";

export interface SessionEvent {
  id: string;

  type: SessionEventType;

  team?: TeamSide;

  points?: number;

  timestamp: number;

  gameTime: number;

  homeScore: number;

  awayScore: number;

  inferredState?: string;
}