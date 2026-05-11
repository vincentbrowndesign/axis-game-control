import { SpurtsEvent } from "./events/eventTypes";

import { buildEventMemory } from "./events/eventMemory";

export function getGameMemory(
  events: SpurtsEvent[]
) {
  const memory =
    buildEventMemory(events);

  const runTeam =
    memory.homeRun > memory.awayRun
      ? "HOME"
      : memory.awayRun > memory.homeRun
      ? "AWAY"
      : null;

  const activeRun = Math.max(
    memory.homeRun,
    memory.awayRun
  );

  let state = "GAME STABLE";

  if (
    memory.pressure ===
      "BUILDING" &&
    runTeam
  ) {
    state = `${runTeam} BUILDING PRESSURE`;
  }

  if (
    memory.pressure ===
      "BREAKING" &&
    runTeam
  ) {
    state = `${runTeam} BREAKING GAME`;
  }

  return {
    ...memory,

    runTeam,
    activeRun,

    state,
  };
}