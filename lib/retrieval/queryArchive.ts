import { qualifyMemory } from "@/lib/archive/qualifyMemory"
import type { MemoryArchiveItem } from "@/lib/archive/types"
import type { MemoryConnection } from "@/lib/connections/types"
import type {
  ArchiveRetrievalQuery,
  RetrievedMemory,
} from "./types"

function markerRelevance(item: MemoryArchiveItem, types: string[]) {
  return (item.markers || [])
    .filter((marker) => types.includes(marker.type))
    .reduce((relevance, marker) => relevance + marker.confidence, 0)
}

function relatedConnections(
  memoryId: string,
  connections: MemoryConnection[]
) {
  return connections.filter(
    (connection) =>
      connection.fromMemoryId === memoryId ||
      connection.toMemoryId === memoryId
  )
}

function rankMemory({
  item,
  query,
  connections,
}: {
  item: MemoryArchiveItem
  query: ArchiveRetrievalQuery
  connections: MemoryConnection[]
}) {
  const qualification = qualifyMemory(item)
  const related = relatedConnections(item.session.id, connections)
  const reasons: string[] = []
  let relevance = qualification.confidence

  if (query.playerId && item.twinId === query.playerId) {
    relevance += 0.2
    reasons.push("same player memory")
  }

  if (query.warmupId && item.warmupId === query.warmupId) {
    relevance += 0.2
    reasons.push("same warmup chain")
  }

  if (query.intent === "strongest_reps") {
    const value = markerRelevance(item, ["repetition", "rhythm", "cadence"])
    relevance += value
    if (value > 0) reasons.push("repeated movement returned")
  }

  if (query.intent === "rhythm_stabilization") {
    const value = markerRelevance(item, [
      "rhythm",
      "cadence",
      "stabilization",
    ])
    relevance += value
    if (value > 0) reasons.push("rhythm or stabilization marker found")
  }

  if (query.intent === "repeated_resets") {
    const value = markerRelevance(item, ["reset"])
    const resetLinks = related.filter(
      (connection) => connection.type === "recurring_reset"
    )
    relevance += value + resetLinks.length * 0.35
    if (value > 0 || resetLinks.length) reasons.push("reset returned")
  }

  if (query.intent === "tomorrow_repeats") {
    relevance += markerRelevance(item, ["rhythm", "repetition", "continuity"])
    if (qualification.action === "mark_useful") {
      relevance += 0.4
      reasons.push("useful memory candidate")
    }
  }

  if (query.intent === "continuity_streaks") {
    const continuityLinks = related.filter((connection) =>
      [
        "same_warmup",
        "repeated_rhythm",
        "recurring_cadence",
        "repeated_structure",
      ].includes(connection.type)
    )
    relevance += continuityLinks.length * 0.42
    if (continuityLinks.length) reasons.push("continuity link returned")
  }

  if (query.intent === "transfer_clips") {
    const transferLinks = related.filter(
      (connection) => connection.type === "practice_to_game_transfer"
    )
    relevance += transferLinks.length * 0.6
    if (transferLinks.length) reasons.push("practice-to-game link")
  }

  if (query.intent === "current_issue") {
    relevance += markerRelevance(item, ["reset", "stabilization", "continuity"])
    if (related.length) reasons.push("connected to existing pattern")
  }

  return {
    memory: item,
    relevance,
    reasons: reasons.length ? reasons : ["memory available"],
    connections: related,
  }
}

export function queryArchive({
  memories,
  connections,
  query,
}: {
  memories: MemoryArchiveItem[]
  connections: MemoryConnection[]
  query: ArchiveRetrievalQuery
}): RetrievedMemory[] {
  const limit = query.limit || 8

  return memories
    .map((item) => rankMemory({ item, query, connections }))
    .filter((item) => item.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit)
}
