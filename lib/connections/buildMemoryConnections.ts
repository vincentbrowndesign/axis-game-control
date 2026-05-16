import type { MemoryArchiveItem } from "@/lib/archive/types"
import type { MemoryConnection, MemoryConnectionType } from "./types"

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(1, value))
}

function connection({
  from,
  to,
  type,
  confidence,
  evidence,
}: {
  from: MemoryArchiveItem
  to: MemoryArchiveItem
  type: MemoryConnectionType
  confidence: number
  evidence: string[]
}): MemoryConnection {
  return {
    id: `${from.session.id}:${to.session.id}:${type}`,
    fromMemoryId: from.session.id,
    toMemoryId: to.session.id,
    type,
    confidence: clamp01(confidence),
    evidence,
  }
}

function markerTypes(item: MemoryArchiveItem) {
  return new Set((item.markers || []).map((marker) => marker.type))
}

function cadenceDelta(a: MemoryArchiveItem, b: MemoryArchiveItem) {
  const cadenceA =
    a.segmentedMemory?.cadenceEstimate.cyclesPerMinute || null
  const cadenceB =
    b.segmentedMemory?.cadenceEstimate.cyclesPerMinute || null

  if (cadenceA == null || cadenceB == null) return null

  return Math.abs(cadenceA - cadenceB)
}

function samePracticeBlock(a: MemoryArchiveItem, b: MemoryArchiveItem) {
  const delta = Math.abs(a.session.createdAt - b.session.createdAt)

  return delta <= 1000 * 60 * 45
}

export function buildMemoryConnections(
  memories: MemoryArchiveItem[]
): MemoryConnection[] {
  const connections: MemoryConnection[] = []

  for (let i = 0; i < memories.length; i += 1) {
    for (let j = i + 1; j < memories.length; j += 1) {
      const from = memories[i]
      const to = memories[j]
      const fromTypes = markerTypes(from)
      const toTypes = markerTypes(to)
      const sameTwin =
        Boolean(from.twinId && to.twinId) && from.twinId === to.twinId
      const sameWarmup =
        Boolean(from.warmupId && to.warmupId) &&
        from.warmupId === to.warmupId
      const cadence = cadenceDelta(from, to)

      if (sameTwin) {
        connections.push(
          connection({
            from,
            to,
            type: "same_player",
            confidence: 0.7,
            evidence: ["same digital twin"],
          })
        )
      }

      if (sameWarmup) {
        connections.push(
          connection({
            from,
            to,
            type: "same_warmup",
            confidence: 0.76,
            evidence: ["same warmup chain"],
          })
        )
      }

      if (
        fromTypes.has("rhythm") &&
        toTypes.has("rhythm") &&
        sameWarmup
      ) {
        connections.push(
          connection({
            from,
            to,
            type: "repeated_rhythm",
            confidence: 0.78,
            evidence: ["rhythm markers returned"],
          })
        )
      }

      if (fromTypes.has("reset") && toTypes.has("reset")) {
        connections.push(
          connection({
            from,
            to,
            type: "recurring_reset",
            confidence: sameWarmup ? 0.78 : 0.58,
            evidence: ["reset markers returned"],
          })
        )
      }

      if (cadence != null && cadence <= 8) {
        connections.push(
          connection({
            from,
            to,
            type: "recurring_cadence",
            confidence: 0.82 - cadence / 40,
            evidence: ["cadence stayed within eight cycles per minute"],
          })
        )
      }

      if (
        (fromTypes.has("repetition") && toTypes.has("repetition")) ||
        (fromTypes.has("continuity") && toTypes.has("continuity"))
      ) {
        connections.push(
          connection({
            from,
            to,
            type: "repeated_structure",
            confidence: sameWarmup ? 0.74 : 0.56,
            evidence: ["movement structure returned"],
          })
        )
      }

      if (
        from.session.environment === "practice" &&
        to.session.environment === "game"
      ) {
        connections.push(
          connection({
            from,
            to,
            type: "practice_to_game_transfer",
            confidence: sameTwin ? 0.6 : 0.42,
            evidence: ["practice memory precedes game memory"],
          })
        )
      }

      if (samePracticeBlock(from, to)) {
        connections.push(
          connection({
            from,
            to,
            type: "same_practice_block",
            confidence: 0.52,
            evidence: ["recorded in the same practice block"],
          })
        )
      }
    }
  }

  return connections
    .filter((item) => item.confidence >= 0.42)
    .sort((a, b) => b.confidence - a.confidence)
}
