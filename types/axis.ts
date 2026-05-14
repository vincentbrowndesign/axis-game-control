export type AxisEventType =
  | "PASS"
  | "DRIVE"
  | "PAINT_TOUCH"
  | "SHOT"
  | "MAKE"
  | "MISS"
  | "TURNOVER"
  | "OPEN"
  | "HELP"
  | "RESET"

export type AxisEvent = {
  id: string
  type: AxisEventType
  label: string
  time: number
}

export type AxisObservation = {
  id: string
  title: string
  proof: string
  why: string
  confidence: number
}

export type AxisSession = {
  id: string
  playbackId: string | null
  playerName: string | null
  jersey: string | null
  createdAt: string
  events: AxisEvent[]
}