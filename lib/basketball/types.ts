export type BasketballSignalLabel =
  | "MEMORY STORED"
  | "REPLAY READY"
  | "WARMUP ADDED"
  | "CLIP STORED"
  | "SHORT CLIP"
  | "ACTIVE MOTION"
  | "LOW ACTIVITY"
  | "CAMERA MOVING"
  | "CAMERA STABLE"
  | "AUDIO PRESENT"
  | "AUDIO QUIET"
  | "BASELINE STARTED"
  | "NOT ENOUGH MEMORY"

export type BasketballSignalState = {
  headline: string
  courtState: string
  activityState: string
  clipType: string
  evidence: string[]
  confidence: number
}
