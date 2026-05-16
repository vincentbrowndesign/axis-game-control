import type { MemoryArchiveItem } from "@/lib/archive/types"
import { buildMemoryConnections } from "@/lib/connections/buildMemoryConnections"
import { queryArchive } from "./queryArchive"
import type {
  ArchiveRetrievalIntent,
  ArchiveRetrievalQuery,
  RetrievedMemory,
} from "./types"

export function getRelevantMemories({
  memories,
  intent = "tomorrow_repeats",
  playerId,
  warmupId,
  limit,
}: {
  memories: MemoryArchiveItem[]
  intent?: ArchiveRetrievalIntent
  playerId?: string | null
  warmupId?: string | null
  limit?: number
}): RetrievedMemory[] {
  const connections = buildMemoryConnections(memories)
  const query: ArchiveRetrievalQuery = {
    intent,
    playerId,
    warmupId,
    limit,
  }

  return queryArchive({
    memories,
    connections,
    query,
  })
}
