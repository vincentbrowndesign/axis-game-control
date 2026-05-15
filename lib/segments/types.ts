export type SegmentType =
  | "dribble_cycle"
  | "activity_window"
  | "pause"
  | "reset"
  | "movement_burst"
  | "repeated_motion"
  | "unknown"

export type Segment = {
  id: string
  type: SegmentType
  startTime: number
  endTime: number
  confidence: number
  label: string
}

export type CadenceEstimate = {
  intervalSeconds: number | null
  cyclesPerMinute: number | null
  consistency: number | null
  state: "stable" | "uneven" | "waiting"
}

export type SegmentedMemory = {
  missionId: string
  clipDuration: number
  segments: Segment[]
  cadenceEstimate: CadenceEstimate
  confidence: number
  summary: string
}
