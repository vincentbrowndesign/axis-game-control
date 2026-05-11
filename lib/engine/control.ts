import { PossessionEvent } from "../session/types";
import { applyDecay } from "./decay";

export function calculateControl(events: PossessionEvent[]) {
  let home = 50;
  let away = 50;

  const reversed = [...events].reverse();

  reversed.forEach((event, index) => {
    const weight = applyDecay(12, index);

    if (event.team === "HOME") {
      if (event.value > 0) {
        home += weight;
        away -= weight * 0.4;
      } else {
        home -= weight * 0.6;
      }
    }

    if (event.team === "AWAY") {
      if (event.value > 0) {
        away += weight;
        home -= weight * 0.4;
      } else {
        away -= weight * 0.6;
      }
    }
  });

  home = Math.max(0, Math.min(100, home));
  away = Math.max(0, Math.min(100, away));

  return {
    home: Math.round(home),
    away: Math.round(away),
  };
}