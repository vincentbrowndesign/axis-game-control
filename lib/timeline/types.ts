export type TimelineEvent = {
  id: string
  type: "INCREMENT" | "DECREMENT"
  streamId: string
  streamLabel: string
  timestampMs: number
  elapsedLabel: string
  replayTimestamp: number
  replayRef?: string
  sessionId: string
  createdAt: number
}
