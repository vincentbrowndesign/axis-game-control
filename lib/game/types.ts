export type AxisEventType =
  | "PASS"
  | "DRIVE"
  | "SHOT"
  | "TURNOVER"
  | "REBOUND"
  | "STOP"

export interface AxisEvent {
  id: string
  type: AxisEventType
  timestamp: number
  gapFromPrevious: number
  possessionId: string
}

export interface AxisPossession {
  id: string
  startedAt: number
  endedAt: number
  events: AxisEvent[]
}

export interface AxisGameState {
  momentum: number
  pressure: number
  pace: number
  liveState: string
}