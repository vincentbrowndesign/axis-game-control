import type { AxisDetectedObject, AxisMotionHint, AxisObjectTrack, AxisRimBox } from "../core/types";

export function detectBallRimMotionHints(input: {
  ball?: AxisDetectedObject;
  ballTrack?: AxisObjectTrack;
  rimBox?: AxisRimBox | null;
  videoHeight: number;
  videoWidth: number;
}): AxisMotionHint[] {
  if (!input.ball || !input.rimBox || !input.videoWidth || !input.videoHeight) return [];

  const ballPoint = objectCenter(input.ball);
  if (!ballPoint) return [];

  const rim = {
    height: input.rimBox.height * input.videoHeight,
    width: input.rimBox.width * input.videoWidth,
    x: input.rimBox.x * input.videoWidth,
    y: input.rimBox.y * input.videoHeight,
  };
  const rimCenter = { x: rim.x + rim.width / 2, y: rim.y + rim.height / 2 };
  const distance = Math.hypot(ballPoint.x - rimCenter.x, ballPoint.y - rimCenter.y);
  const nearThreshold = Math.max(rim.width, rim.height) * 1.8;
  const hints: AxisMotionHint[] = [];

  if (distance <= nearThreshold) {
    hints.push({
      confidence: Math.min(1, input.ball.confidence),
      kind: "ball_near_rim",
      objectKind: "ball",
      summary: "Ball near rim",
    });
  }

  if (pointInsideBox(ballPoint, rim)) {
    hints.push({
      confidence: Math.min(1, input.ball.confidence),
      kind: "ball_entered_rim_zone",
      objectKind: "ball",
      summary: "Ball entered rim zone",
    });
  }

  const first = input.ballTrack?.points.at(0);
  const last = input.ballTrack?.points.at(-1);
  if (first && last && input.ballTrack && input.ballTrack.points.length >= 2) {
    const startDistance = Math.hypot(first.x - rimCenter.x, first.y - rimCenter.y);
    const endDistance = Math.hypot(last.x - rimCenter.x, last.y - rimCenter.y);
    if (endDistance + 8 < startDistance) {
      hints.push({
        confidence: Math.min(1, input.ballTrack.confidence),
        kind: "ball_moving_toward_rim",
        objectKind: "ball",
        summary: "Ball moving toward rim",
      });
    }
  }

  if (hints.some((hint) => hint.kind === "ball_near_rim" || hint.kind === "ball_entered_rim_zone")) {
    hints.push({
      confidence: Math.min(1, input.ball.confidence),
      kind: "possible_shot_attempt",
      objectKind: "ball",
      summary: "Possible shot attempt",
    });
  }

  return hints;
}

function objectCenter(object: AxisDetectedObject) {
  if (object.point) return object.point;
  if (!object.box) return null;
  return {
    x: object.box.x + object.box.width / 2,
    y: object.box.y + object.box.height / 2,
  };
}

function pointInsideBox(point: { x: number; y: number }, box: { height: number; width: number; x: number; y: number }) {
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
}
