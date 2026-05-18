export type SpurtType =
  | "HOT_SPURT"
  | "EMPTY_SPURT"
  | "FAST_SPURT"
  | "LONGEST_STREAK"
  | "LONGEST_DROUGHT"

export type Spurt = {
  id: string
  type: SpurtType
  streamId: string
  streamLabel: string
  count: number
  seconds: number
  startMs: number
  endMs: number
  label: string
  replayRefs: string[]
}
