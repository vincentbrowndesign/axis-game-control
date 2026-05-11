import { PossessionEvent } from "../session/types";

export function getRecentEvents(
  events: PossessionEvent[],
  count = 6
) {
  return events.slice(-count);
}