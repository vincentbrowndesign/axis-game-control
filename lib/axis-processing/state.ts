export const AXIS_PROCESSING_STATES = [
  "IDLE",
  "UPLOADING",
  "QUEUED",
  "PROCESSING",
  "TRACKING",
  "GENERATING_REPLAY",
  "GENERATING_CLIPS",
  "GENERATING_STATS",
  "GENERATING_BROADCAST",
  "COMPLETE",
  "FAILED",
] as const

export type AxisProcessingState = (typeof AXIS_PROCESSING_STATES)[number]

export type AxisProcessingSnapshot = {
  completedAt?: string
  detail?: string
  failedAt?: string
  label: string
  progress: number
  queuedAt?: string
  startedAt?: string
  state: AxisProcessingState
  traceId?: string
  updatedAt: string
}

export function isAxisProcessingState(value: unknown): value is AxisProcessingState {
  return (
    typeof value === "string" &&
    AXIS_PROCESSING_STATES.includes(value as AxisProcessingState)
  )
}

export function processingLabel(state: AxisProcessingState) {
  switch (state) {
    case "IDLE":
      return "Ready for game film."
    case "UPLOADING":
      return "Uploading game..."
    case "QUEUED":
      return "Game queued."
    case "PROCESSING":
      return "Processing game..."
    case "TRACKING":
      return "Detecting moments..."
    case "GENERATING_REPLAY":
      return "Building replay memory..."
    case "GENERATING_CLIPS":
      return "Generating clips..."
    case "GENERATING_STATS":
      return "Generating stats..."
    case "GENERATING_BROADCAST":
      return "Creating broadcast..."
    case "COMPLETE":
      return "Game media ready."
    case "FAILED":
      return "Processing needs another try."
  }
}

export function processingProgress(state: AxisProcessingState) {
  switch (state) {
    case "IDLE":
      return 0
    case "UPLOADING":
      return 24
    case "QUEUED":
      return 42
    case "PROCESSING":
      return 50
    case "TRACKING":
      return 60
    case "GENERATING_REPLAY":
      return 70
    case "GENERATING_CLIPS":
      return 80
    case "GENERATING_STATS":
      return 88
    case "GENERATING_BROADCAST":
      return 94
    case "COMPLETE":
      return 100
    case "FAILED":
      return 100
  }
}

export function createProcessingSnapshot({
  detail,
  previous,
  state,
  traceId,
}: {
  detail?: string
  previous?: Record<string, unknown>
  state: AxisProcessingState
  traceId?: string
}): AxisProcessingSnapshot {
  const now = new Date().toISOString()
  const priorState = isAxisProcessingState(previous?.state)
    ? previous.state
    : null

  return {
    ...(previous || {}),
    ...(state === "QUEUED" && priorState !== "QUEUED" ? { queuedAt: now } : {}),
    ...(state === "PROCESSING" && !previous?.startedAt ? { startedAt: now } : {}),
    ...(state === "COMPLETE" ? { completedAt: now } : {}),
    ...(state === "FAILED" ? { failedAt: now } : {}),
    detail,
    label: processingLabel(state),
    progress: processingProgress(state),
    state,
    traceId,
    updatedAt: now,
  }
}

export function readProcessingSnapshot(value: unknown): AxisProcessingSnapshot {
  const record = value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
  const state = isAxisProcessingState(record.state) ? record.state : "IDLE"

  return {
    ...record,
    label:
      typeof record.label === "string"
        ? record.label
        : processingLabel(state),
    progress:
      typeof record.progress === "number"
        ? record.progress
        : processingProgress(state),
    state,
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date(0).toISOString(),
  }
}
