import { SpurtsSession } from "./types";

export function createSession(
  homeTeam: string,
  awayTeam: string
): SpurtsSession {
  return {
    id: crypto.randomUUID(),
    homeTeam,
    awayTeam,
    createdAt: Date.now(),

    events: [],
    snapshots: [],
    markers: [],
  };
}