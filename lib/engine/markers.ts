import { PossessionEvent } from "../session/types";

export function detectMarkers(events: PossessionEvent[]) {
  const recent = events.slice(-4);

  const homeRun = recent.every(
    (e) => e.team === "HOME" && e.value > 0
  );

  const awayRun = recent.every(
    (e) => e.team === "AWAY" && e.value > 0
  );

  if (homeRun) {
    return "HOME RUN BUILDING";
  }

  if (awayRun) {
    return "AWAY RUN BUILDING";
  }

  return null;
}