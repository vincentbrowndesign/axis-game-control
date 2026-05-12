import {
  SessionEvent,
  SessionEventType,
  TeamSide,
} from "./sessionTypes";

interface CreateEventParams {
  type: SessionEventType;

  team?: TeamSide;

  points?: number;

  timestamp: number;

  gameTime: number;

  homeScore: number;

  awayScore: number;

  inferredState?: string;
}

export function createEvent({
  type,
  team,
  points,
  timestamp,
  gameTime,
  homeScore,
  awayScore,
  inferredState,
}: CreateEventParams): SessionEvent {
  return {
    id: crypto.randomUUID(),

    type,

    team,

    points,

    timestamp,

    gameTime,

    homeScore,

    awayScore,

    inferredState,
  };
}