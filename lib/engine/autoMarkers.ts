import { SpurtsEvent } from "../events/eventTypes";

export function shouldTriggerRunMarker(
  events: SpurtsEvent[]
) {
  let homeRun = 0;
  let awayRun = 0;

  for (
    let i = events.length - 1;
    i >= 0;
    i--
  ) {
    const event = events[i];

    if (event.type !== "MAKE") {
      continue;
    }

    if (event.team === "HOME") {
      if (awayRun > 0) break;

      homeRun += event.value;
    }

    if (event.team === "AWAY") {
      if (homeRun > 0) break;

      awayRun += event.value;
    }
  }

  return (
    homeRun >= 8 || awayRun >= 8
  );
}