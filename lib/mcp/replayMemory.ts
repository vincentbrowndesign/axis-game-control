import type { AxisVoiceNote } from "@/types/memory"

export type ReplayMemoryEvent = {
  eventType: string
  at: string
}

export type ReplayMemoryState = {
  replayCount: number
  lastReplayedAt: string | null
  replayEvents: ReplayMemoryEvent[]
}

export type ReplayPriorityInput = {
  replayCount: number
  recurrenceCount: number
  hasPlayerMention: boolean
  ageHours: number
}

function metadataNumber(
  metadata: Record<string, unknown> | null,
  key: string
) {
  const value = metadata?.[key]

  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function metadataText(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key]

  return typeof value === "string" && value.trim() ? value.trim() : null
}

function replayEvents(metadata: Record<string, unknown> | null) {
  const events = metadata?.replayEvents

  if (!Array.isArray(events)) return []

  return events
    .map((event) => {
      if (!event || typeof event !== "object") return null

      const current = event as Record<string, unknown>
      const eventType =
        typeof current.eventType === "string" ? current.eventType : "play"
      const at = typeof current.at === "string" ? current.at : null

      if (!at) return null

      return {
        eventType,
        at,
      }
    })
    .filter((event): event is ReplayMemoryEvent => Boolean(event))
}

export function getReplayMemory(note: AxisVoiceNote): ReplayMemoryState {
  return {
    replayCount: metadataNumber(note.metadata, "replayCount"),
    lastReplayedAt: metadataText(note.metadata, "lastReplayedAt"),
    replayEvents: replayEvents(note.metadata),
  }
}

export function updateReplayMemory({
  metadata,
  eventType,
  at = new Date().toISOString(),
}: {
  metadata: Record<string, unknown> | null
  eventType: string
  at?: string
}) {
  const current = metadata && typeof metadata === "object" ? metadata : {}
  const replayCount = metadataNumber(current, "replayCount") + 1
  const events = replayEvents(current)

  return {
    metadata: {
      ...current,
      replayCount,
      lastReplayedAt: at,
      replayEvents: [
        ...events,
        {
          eventType,
          at,
        },
      ].slice(-24),
    },
    replayCount,
  }
}

export function scoreReplayPriority({
  replayCount,
  recurrenceCount,
  hasPlayerMention,
  ageHours,
}: ReplayPriorityInput) {
  const recencyScore = Math.max(0, 24 - Math.min(ageHours, 24)) / 24

  return (
    replayCount * 3 +
    recurrenceCount * 2 +
    (hasPlayerMention ? 2 : 0) +
    recencyScore
  )
}

export function replayReason({
  replayCount,
  recurrenceCount,
  playerMention,
  ageHours,
}: {
  replayCount: number
  recurrenceCount: number
  playerMention?: string
  ageHours: number
}) {
  if (replayCount > 0) return `replayed ${replayCount}x`
  if (recurrenceCount > 1) return `repeated ${recurrenceCount}x`
  if (playerMention) return `${playerMention} mention`
  if (ageHours < 24) return "recent session"

  return "saved landmark"
}
