// lib/engine/possession.ts

import type {
  AxisEvent,
  AxisOutcome,
  AxisTeam,
} from "./types";

export function getNextTeam(
  team: AxisTeam
): AxisTeam {
  return team === "HOME"
    ? "AWAY"
    : "HOME";
}

export function createAxisEvent({
  team,
  outcome,
  possessionNumber,
}: {
  team: AxisTeam;
  outcome: AxisOutcome;
  possessionNumber: number;
}): AxisEvent {

  const value =
    outcome === "EMPTY"
      ? 0
      : Number(outcome);

  return {
    id: Date.now(),

    team,

    outcome,

    value,

    possessionNumber,

    timestamp: Date.now(),
  };
}