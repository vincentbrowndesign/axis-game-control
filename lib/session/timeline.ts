import { SpurtsEvent } from "../events/eventTypes";
import { formatVideoTime } from "../video/sync";

export function buildTimeline(events: SpurtsEvent[]) {
  return events.map((event) => {
    if (event.type === "MAKE") {
      return {
        id: event.id,
        label: `${event.team} +${event.value}`,
        tone: event.team === "HOME" ? "cyan" : "yellow",
      };
    }

    if (event.type === "MISS") {
      return {
        id: event.id,
        label: `${event.team} MISS`,
        tone: "neutral",
      };
    }

    if (event.type === "TURNOVER") {
      return {
        id: event.id,
        label: `${event.team} TURNOVER`,
        tone: "danger",
      };
    }

    if (event.type === "MARKER") {
      return {
        id: event.id,
        label: event.label,
        tone: "marker",
      };
    }

    if (event.type === "CLIP") {
      return {
        id: event.id,
        label: `CLIP ${formatVideoTime(event.startTime || 0)}`,
        tone: "clip",
      };
    }

    return {
      id: event.id,
      label: "EVENT",
      tone: "neutral",
    };
  });
}