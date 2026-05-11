import { SpurtsEvent } from "../events/eventTypes";

type Team = "HOME" | "AWAY";

export function getRun(
  events: SpurtsEvent[],
  team: Team
) {
  let run = 0;

  for (
    let i = events.length - 1;
    i >= 0;
    i--
  ) {
    const event = events[i];

    if (event.type !== "MAKE") {
      continue;
    }

    if (event.team !== team) {
      break;
    }

    run += event.value;
  }

  return run;
}