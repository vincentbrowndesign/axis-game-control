import type { MemoryArchiveItem } from "@/lib/archive/types"
import type { MemoryConnection } from "@/lib/connections/types"

export type ArchiveRetrievalIntent =
  | "strongest_reps"
  | "rhythm_stabilization"
  | "repeated_resets"
  | "tomorrow_repeats"
  | "continuity_streaks"
  | "transfer_clips"
  | "current_issue"

export type RetrievedMemory = {
  memory: MemoryArchiveItem
  relevance: number
  reasons: string[]
  connections: MemoryConnection[]
}

export type ArchiveRetrievalQuery = {
  intent: ArchiveRetrievalIntent
  playerId?: string | null
  warmupId?: string | null
  limit?: number
}
