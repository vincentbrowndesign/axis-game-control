import { buildReinforcementMemory } from "@/lib/mcp/reinforcementMemory"
import type { AxisVoiceNote } from "@/types/memory"

export type MemoryStreamNote = AxisVoiceNote & {
  audioUrl?: string | null
}

export type MemoryStreamItem = {
  note: MemoryStreamNote
  score: number
  replayCount: number
  recurrenceCount: number
  playerMention?: string
  reason: string
}

export function buildMemoryStream({
  notes,
  playerNames = [],
}: {
  notes: MemoryStreamNote[]
  playerNames?: string[]
}) {
  const memory = buildReinforcementMemory({
    notes,
    playerNames,
  })

  return {
    items: memory.items,
    clusters: memory.clusters,
    players: memory.players,
    sessions: memory.sessions,
  }
}
