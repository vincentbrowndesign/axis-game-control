import { PossessionEvent } from "../session/types";

export function calculateRun(events: PossessionEvent[]) {
  const recent = events.slice(-8);

  let home = 0;
  let away = 0;

  recent.forEach((event) => {
    if (event.team === "HOME") {
      home += event.value;
    }

    if (event.team === "AWAY") {
      away += event.value;
    }
  });

  return { home, away };
}