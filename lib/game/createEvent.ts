import { v4 as uuid } from "uuid"
import { AxisEvent, AxisEventType } from "./types"

export function createEvent(
  type: AxisEventType,
  timestamp: number,
  previousTimestamp: number,
  possessionId: string
): AxisEvent {
  return {
    id: uuid(),
    type,
    timestamp,
    gapFromPrevious:
      timestamp - previousTimestamp,
    possessionId,
  }
}