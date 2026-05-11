import { SpurtsEvent } from "./eventTypes";

export type EventMemory = {
  homeScore: number;
  awayScore: number;

  homeRun: number;
  awayRun: number;

  pressure:
    | "STABLE"
    | "BUILDING"
    | "BREAKING";

  lastScoringTeam:
    | "HOME"
    | "AWAY"
    | null;
};

export function buildEventMemory(
  events: SpurtsEvent[]
): EventMemory {
  let homeScore = 0;
  let awayScore = 0;

  let homeRun = 0;
  let awayRun = 0;

  let lastScoringTeam:
    | "HOME"
    | "AWAY"
    | null = null;

  for (const event of events) {
    if (event.type !== "MAKE") {
      continue;
    }

    if (event.team === "HOME") {
      homeScore += event.value;

      homeRun += event.value;
      awayRun = 0;

      lastScoringTeam = "HOME";
    }

    if (event.team === "AWAY") {
      awayScore += event.value;

      awayRun += event.value;
      homeRun = 0;

      lastScoringTeam = "AWAY";
    }
  }

  const biggestRun = Math.max(
    homeRun,
    awayRun
  );

  const pressure =
    biggestRun >= 10
      ? "BREAKING"
      : biggestRun >= 6
      ? "BUILDING"
      : "STABLE";

  return {
    homeScore,
    awayScore,

    homeRun,
    awayRun,

    pressure,

    lastScoringTeam,
  };
}