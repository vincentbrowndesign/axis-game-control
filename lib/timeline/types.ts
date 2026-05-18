export type TimelineEvent = {
  id: string
  type: "MAKE" | "MISS"
  streamId: string
  streamLabel: string
  timestampMs: number
  elapsedLabel: string
  replayTimestamp: number
  replayRef?: string
  sessionId: string
  createdAt: number
}
