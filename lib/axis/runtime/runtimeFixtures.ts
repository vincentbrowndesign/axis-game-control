import { createAxisEvent, type AxisChronologyEvent } from "@/lib/axis/state/eventLog"

export const axisRuntimeFixtureEvents: AxisChronologyEvent[] = [
  createAxisEvent(
    {
      type: "score.initialized",
      score: {
        home: 11,
        away: 8,
      },
    },
    {
      createdAt: "2026-01-01T00:00:00.000Z",
      gameTime: "00:00",
      period: "Q1",
      source: "system",
      query: "runtime fixture score",
    },
  ),
  createAxisEvent(
    {
      type: "memory.recorded",
      label: "Nae rebound, quick outlet",
      scoreState: "8-6",
      playerIds: ["Nae"],
      tags: ["memory", "rebound", "transition", "replay"],
    },
    {
      createdAt: "2026-01-01T00:02:14.000Z",
      gameTime: "02:14",
      period: "Q1",
      source: "system",
      query: "show rebounds",
    },
  ),
  createAxisEvent(
    {
      type: "memory.recorded",
      label: "Home 3 from the right side",
      scoreState: "11-6",
      playerIds: ["Home"],
      tags: ["memory", "scoring", "run", "transition", "replay"],
    },
    {
      createdAt: "2026-01-01T00:03:02.000Z",
      gameTime: "03:02",
      period: "Q1",
      source: "system",
      query: "they scored",
    },
  ),
  createAxisEvent(
    {
      type: "memory.recorded",
      label: "Turnover against pressure before the run",
      scoreState: "11-8",
      playerIds: ["#4"],
      tags: ["memory", "turnover", "pressure", "run", "replay"],
    },
    {
      createdAt: "2026-01-01T00:03:48.000Z",
      gameTime: "03:48",
      period: "Q1",
      source: "system",
      query: "find turnover chains",
    },
  ),
  createAxisEvent(
    {
      type: "memory.recorded",
      label: "#4 stop, rebound, possession reset",
      scoreState: "11-8",
      playerIds: ["#4"],
      tags: ["memory", "stop", "rebound", "reset", "stabilization", "replay"],
    },
    {
      createdAt: "2026-01-01T00:04:18.000Z",
      gameTime: "04:18",
      period: "Q1",
      source: "system",
      query: "who stabilized the game?",
    },
  ),
]

export const axisRuntimeTestQueries = [
  "show rebounds",
  "who stabilized the game?",
  "show pressure possessions",
  "show transition rebounds",
  "what caused the collapse?",
  "show possessions before the run",
  "show #4 impact",
  "find turnover chains",
  "what should we review?",
  "show unstable possessions",
] as const
