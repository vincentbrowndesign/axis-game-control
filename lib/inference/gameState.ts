import { SessionEvent } from "../session/sessionTypes";

export function inferGameState(
  events: SessionEvent[]
) {
  if (events.length === 0) {
    return {
      state: "GAME STABLE",
      pressure: 10,
      volatility: 0,
    };
  }

  const recent = events.slice(-6);

  let pressure = 10;

  recent.forEach((event) => {
    if (event.type === "TIMEOUT") {
      pressure += 10;
    }

    if (event.points === 3) {
      pressure += 14;
    }

    if (event.points === 2) {
      pressure += 8;
    }
  });

  pressure = Math.min(100, pressure);

  let state = "GAME STABLE";

  if (pressure > 35) {
    state = "PRESSURE BUILDING";
  }

  if (pressure > 65) {
    state = "CONTROL SHIFTING";
  }

  if (pressure > 85) {
    state = "HIGH VOLATILITY";
  }

  return {
    state,
    pressure,
    volatility: pressure,
  };
}