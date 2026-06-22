import type { AxisVisionTrack } from "./axis-vision-types";

export type AxisBallTrailPoint = {
  x: number;
  y: number;
  score: number;
  timestamp: number;
  frameId: number;
};

export type AxisBallTrailState = {
  points: AxisBallTrailPoint[];
  visible: boolean;
  lastSeenAt?: number;
  velocity?: { vx: number; vy: number; speed: number };
  direction?: "up" | "down" | "left" | "right" | "still";
};

const MAX_TRAIL_POINTS = 60;
const VELOCITY_WINDOW = 5;
const STILL_THRESHOLD = 2;

export function getDetectionCenter(track: { bbox: [number, number, number, number] }): { x: number; y: number } {
  const [x, y, w, h] = track.bbox;
  return { x: x + w / 2, y: y + h / 2 };
}

export function updateBallTrail(
  prev: AxisBallTrailState,
  ballTrack: AxisVisionTrack | undefined,
  frameId: number,
  timestamp: number,
): AxisBallTrailState {
  if (!ballTrack) {
    return { ...prev, visible: false };
  }

  const { x, y } = getDetectionCenter(ballTrack);
  const newPoint: AxisBallTrailPoint = { frameId, score: ballTrack.score, timestamp, x, y };
  const points = [...prev.points, newPoint].slice(-MAX_TRAIL_POINTS);

  const window = points.slice(-VELOCITY_WINDOW);
  let velocity: AxisBallTrailState["velocity"];
  let direction: AxisBallTrailState["direction"] = "still";

  if (window.length >= 2) {
    const first = window[0];
    const last = window[window.length - 1];
    const dt = (last.timestamp - first.timestamp) / 1000;
    if (dt > 0) {
      const vx = (last.x - first.x) / dt;
      const vy = (last.y - first.y) / dt;
      const speed = Math.sqrt(vx * vx + vy * vy);
      velocity = { speed, vx, vy };

      if (speed > STILL_THRESHOLD) {
        if (Math.abs(vx) > Math.abs(vy)) {
          direction = vx > 0 ? "right" : "left";
        } else {
          direction = vy > 0 ? "down" : "up";
        }
      }
    }
  }

  return { direction, lastSeenAt: timestamp, points, velocity, visible: true };
}
