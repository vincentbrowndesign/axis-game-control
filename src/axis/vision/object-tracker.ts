import type { AxisDetectedObject, AxisMotionHint, AxisObjectTrack } from "../core/types";

export function updateAxisObjectTracks(previousTracks: AxisObjectTrack[], objects: AxisDetectedObject[], timestampMs = Date.now()): AxisObjectTrack[] {
  const nextTracks = [...previousTracks];

  objects.forEach((object) => {
    if (object.kind === "unknown") return;
    const point = objectCenter(object);
    if (!point) return;
    const existingIndex = nextTracks.findIndex((track) => track.kind === object.kind);
      const nextPoint = { timestampMs, ...point };

    if (existingIndex >= 0) {
      const track = nextTracks[existingIndex];
      nextTracks[existingIndex] = {
        ...track,
        confidence: Math.max(track.confidence, object.confidence),
        lastSeenMs: timestampMs,
        points: [...track.points, nextPoint].slice(-12),
      };
    } else {
      nextTracks.push({
        confidence: object.confidence,
        id: `axis-track-${object.kind}-${timestampMs}`,
        kind: object.kind,
        label: labelForKind(object.kind),
        lastSeenMs: timestampMs,
        points: [nextPoint],
      });
    }
  });

  return nextTracks.filter((track) => objects.some((object) => object.kind === track.kind) || track.points.length > 1).slice(0, 3);
}

function labelForKind(kind: AxisObjectTrack["kind"]) {
  if (kind === "player") return "Player";
  if (kind === "ball") return "Ball";
  return "Rim";
}

export function buildAxisMotionHints(tracks: AxisObjectTrack[]): AxisMotionHint[] {
  return tracks.map((track) => {
    const first = track.points.at(0);
    const last = track.points.at(-1);
    if (!first || !last || track.points.length < 2) {
      return {
        confidence: track.confidence,
        kind: "unknown",
        objectKind: track.kind,
        summary: `${track.label} observed`,
      };
    }

    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const distance = Math.hypot(dx, dy);
    const kind = distance < 16 ? "stationary" : Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? "rising" : "falling") : "moving";

    return {
      confidence: Math.min(track.confidence, Math.max(0.35, distance / 120)),
      kind,
      objectKind: track.kind,
      summary: `${track.label} ${kind}`,
    };
  });
}

function objectCenter(object: AxisDetectedObject) {
  if (object.point) return object.point;
  if (!object.box) return null;
  return {
    x: object.box.x + object.box.width / 2,
    y: object.box.y + object.box.height / 2,
  };
}
