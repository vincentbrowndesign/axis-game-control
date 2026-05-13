import { AxisEvent } from "./types"

export function shouldEndPossession(
  event: AxisEvent
) {
  return (
    event.type === "SHOT" ||
    event.type === "TURNOVER" ||
    event.type === "STOP"
  )
}