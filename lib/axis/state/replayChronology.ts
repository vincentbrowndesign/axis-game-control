import type { AxisMemoryObject } from "@/lib/axis/types"
import type { AxisChronologyEvent, AxisSourceEvent } from "@/lib/axis/state/eventLog"

export type AxisReplayChronologyAnchor = {
  id: string
  memoryId: string
  label: string
  timestamp: string
  window: {
    start: string
    end: string
  }
  relationshipIds: string[]
}

export type AxisReplayChronology = {
  anchors: AxisReplayChronologyAnchor[]
  latestAnchor: AxisReplayChronologyAnchor | null
}

export function rebuildReplayChronology(
  events: AxisSourceEvent[],
  memories: AxisMemoryObject[],
): AxisReplayChronology {
  const memoryById = new Map(memories.map((memory) => [memory.id, memory]))
  const anchorEvents = events.filter((event) => event.type === "replay.anchor.created")

  const anchors = anchorEvents.flatMap((event) => {
    const memory = memoryById.get(event.memoryId)
    if (!memory) return []

    return [
      {
        id: event.id,
        memoryId: memory.id,
        label: memory.label,
        timestamp: memory.timestamp,
        window: event.window,
        relationshipIds: nearbyMemoryIds(memories, memory.id),
      },
    ]
  })

  return {
    anchors,
    latestAnchor: anchors.at(-1) ?? null,
  }
}

export function createReplayAnchorEvent(memory: AxisMemoryObject, createdAt?: string): AxisChronologyEvent {
  return {
    id: `replay-${memory.id}`,
    type: "replay.anchor.created",
    createdAt: createdAt ?? new Date().toISOString(),
    gameTime: memory.timestamp,
    period: "Q1",
    source: "system",
    memoryId: memory.id,
    window: {
      start: memory.timestamp,
      end: memory.timestamp,
    },
  }
}

function nearbyMemoryIds(memories: AxisMemoryObject[], memoryId: string) {
  const index = memories.findIndex((memory) => memory.id === memoryId)
  if (index < 0) return []
  return memories.slice(Math.max(0, index - 2), index + 3).filter((memory) => memory.id !== memoryId).map((memory) => memory.id)
}
