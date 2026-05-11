import { PossessionEvent } from "./types";

export function buildTimeline(events: PossessionEvent[]) {
  return events.map((event) => ({
    id: event.id,
    label:
      event.value === 0
        ? `${event.team} EMPTY`
        : `${event.team} +${event.value}`,
  }));
}