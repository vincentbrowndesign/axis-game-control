import { PossessionEvent } from "../session/types";

export function buildEvidence(events: PossessionEvent[]) {
  const recent = events.slice(-6);

  const homeScored = recent.filter(
    (e) => e.team === "HOME" && e.value > 0
  ).length;

  const awayScored = recent.filter(
    (e) => e.team === "AWAY" && e.value > 0
  ).length;

  return [
    `HOME SCORED ${homeScored}/${recent.length}`,
    `AWAY SCORED ${awayScored}/${recent.length}`,
  ];
}