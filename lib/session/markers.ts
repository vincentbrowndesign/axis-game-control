import { MarkerEvent } from "../events/eventTypes";

export function createMarker(
  label: string
): MarkerEvent {
  return {
    id: crypto.randomUUID(),

    type: "MARKER",

    label,

    createdAt: Date.now(),
    sessionTime: Date.now(),
  };
}