import { getOrCreateLocalTwin } from "@/lib/twin/getOrCreateTwin"
import {
  getWarmupChainProgress as getTwinWarmupChainProgress,
  recordWarmupMemory as recordTwinWarmupMemory,
} from "@/lib/twin/warmupChains"
import type { WarmupChainProgress as TwinWarmupChainProgress } from "@/lib/twin/types"

export type LocalMemoryOwner = {
  id: string
  name: string
  createdAt: number
}

export type WarmupChainProgress = TwinWarmupChainProgress & {
  playerId: string
  playerName: string
}

function toOwnerProgress(
  progress: TwinWarmupChainProgress
): WarmupChainProgress {
  return {
    ...progress,
    playerId: progress.twinId,
    playerName: progress.twinName,
  }
}

export function getOrCreateLocalPlayer(
  playerName?: string | null
): LocalMemoryOwner {
  const twin = getOrCreateLocalTwin(playerName)

  return {
    id: twin.id,
    name: twin.displayName,
    createdAt: twin.createdAt,
  }
}

export function getWarmupChainProgress({
  playerId,
  playerName,
  warmupId,
  unlockAfter = 3,
}: {
  playerId: string
  playerName: string
  warmupId: string
  unlockAfter?: number
}): WarmupChainProgress {
  return toOwnerProgress(
    getTwinWarmupChainProgress({
      twinId: playerId,
      twinName: playerName,
      warmupId,
      unlockAfter,
    })
  )
}

export function recordWarmupMemory({
  playerId,
  playerName,
  warmupId,
  sessionId,
  unlockAfter = 3,
}: {
  playerId: string
  playerName: string
  warmupId: string
  sessionId: string
  unlockAfter?: number
}): WarmupChainProgress {
  return toOwnerProgress(
    recordTwinWarmupMemory({
      twinId: playerId,
      twinName: playerName,
      warmupId,
      sessionId,
      unlockAfter,
    })
  )
}
