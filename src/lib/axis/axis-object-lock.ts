import type { AxisVisionTrack } from "./axis-vision-types";
import type {
  AxisVisionObjectEvent,
  AxisVisionObjectEventType,
  VisionBox,
  VisionObject,
  VisionRelationship,
} from "./axis-object-lock-types";

const objectEvents: AxisVisionObjectEvent[] = [];

export function recordAxisVisionObjectEvent(
  type: AxisVisionObjectEventType,
  payload: Record<string, unknown> = {},
) {
  const event: AxisVisionObjectEvent = {
    id: `vision-event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    createdAt: new Date().toISOString(),
    payload,
  };

  objectEvents.push(event);
  return event;
}

export function getAxisVisionObjectEvents() {
  return [...objectEvents];
}

export function trackToBox(track: AxisVisionTrack): VisionBox {
  const [x, y, width, height] = track.bbox;
  return { height, width, x, y };
}

export function smoothBox(previous: VisionBox | undefined, next: VisionBox, amount = 0.32): VisionBox {
  if (!previous) return next;

  return {
    height: lerp(previous.height, next.height, amount),
    width: lerp(previous.width, next.width, amount),
    x: lerp(previous.x, next.x, amount),
    y: lerp(previous.y, next.y, amount),
  };
}

export function calculateVisionRelationships(objects: VisionObject[], timestamp: number): VisionRelationship[] {
  const players = objects.filter((object) => object.type === "player" && object.state !== "lost");
  const ball = objects.find((object) => object.type === "ball");
  const rim = objects.find((object) => object.type === "rim" && object.state !== "lost");
  const relationships: VisionRelationship[] = [];

  if (!ball || ball.state === "lost" || ball.confidence < 0.22) {
    relationships.push({
      confidence: 1,
      id: `rel-lost-ball-${timestamp}`,
      objectIds: ball ? [ball.id] : [],
      startedAt: timestamp,
      type: "lost_ball",
    });
    return relationships;
  }

  const nearbyPlayers = players
    .map((player) => ({
      distance: centerDistance(ball.bbox, handArea(player.bbox)),
      player,
    }))
    .filter((item) => item.distance < Math.max(item.player.bbox.width, item.player.bbox.height) * 0.45)
    .sort((a, b) => a.distance - b.distance);

  if (nearbyPlayers[0]) {
    relationships.push({
      confidence: clamp(1 - nearbyPlayers[0].distance / 180),
      id: `rel-possession-${nearbyPlayers[0].player.id}-${timestamp}`,
      objectIds: [nearbyPlayers[0].player.id, ball.id],
      startedAt: timestamp,
      type: "possible_possession",
    });
  }

  if (nearbyPlayers.length >= 2) {
    relationships.push({
      confidence: 0.72,
      id: `rel-contested-${timestamp}`,
      objectIds: [ball.id, ...nearbyPlayers.slice(0, 2).map((item) => item.player.id)],
      startedAt: timestamp,
      type: "contested_window",
    });
  }

  if (rim) {
    const ballRimDistance = centerDistance(ball.bbox, rim.bbox);
    const playerNearRim = nearbyPlayers[0] && centerDistance(nearbyPlayers[0].player.bbox, rim.bbox) < 260;

    if (nearbyPlayers[0] && playerNearRim) {
      relationships.push({
        confidence: 0.58,
        id: `rel-drive-${nearbyPlayers[0].player.id}-${timestamp}`,
        objectIds: [nearbyPlayers[0].player.id, rim.id],
        startedAt: timestamp,
        type: "drive_window",
      });
    }

    if (!nearbyPlayers[0] && ballRimDistance < 320) {
      relationships.push({
        confidence: clamp(1 - ballRimDistance / 320),
        id: `rel-shot-${timestamp}`,
        objectIds: [ball.id, rim.id],
        startedAt: timestamp,
        type: "shot_window",
      });
    }

    if (ballRimDistance < Math.max(rim.bbox.width, rim.bbox.height) * 1.2) {
      relationships.push({
        confidence: 0.7,
        id: `rel-finish-${timestamp}`,
        objectIds: [ball.id, rim.id],
        startedAt: timestamp,
        type: "finish_window",
      });
    }
  }

  return relationships;
}

function centerDistance(a: VisionBox, b: VisionBox) {
  const ac = center(a);
  const bc = center(b);
  return Math.hypot(ac.x - bc.x, ac.y - bc.y);
}

function center(box: VisionBox) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

function handArea(box: VisionBox): VisionBox {
  return {
    height: box.height * 0.55,
    width: box.width * 1.25,
    x: box.x - box.width * 0.125,
    y: box.y + box.height * 0.12,
  };
}

function lerp(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
