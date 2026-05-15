export type ReplayMarkerType =
  | "cadence"
  | "rhythm"
  | "reset"
  | "burst"
  | "repetition"
  | "continuity"
  | "stabilization"

export type ReplayMarker = {
  id: string
  label: string
  startTime: number
  endTime: number
  confidence: number
  type: ReplayMarkerType
}
