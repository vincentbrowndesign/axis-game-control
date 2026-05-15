import { getActiveTwin } from "./getOrCreateTwin"
import type { DigitalTwin, WarmupChainProgress } from "./types"

const WARMUP_CHAINS_KEY = "axis-warmup-chains-v2"

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage)
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function storageKey(twinId: string, warmupId: string) {
  return `${twinId}:${warmupId}`
}

function readChains() {
  if (!canUseStorage()) return {}

  return (
    safeParse<Record<string, WarmupChainProgress>>(
      window.localStorage.getItem(WARMUP_CHAINS_KEY)
    ) || {}
  )
}

function writeChains(chains: Record<string, WarmupChainProgress>) {
  if (!canUseStorage()) return

  window.localStorage.setItem(WARMUP_CHAINS_KEY, JSON.stringify(chains))
}

export function getWarmupChainProgress({
  twinId,
  twinName,
  warmupId,
  unlockAfter = 3,
}: {
  twinId: string
  twinName: string
  warmupId: string
  unlockAfter?: number
}): WarmupChainProgress {
  const chains = readChains()
  const key = storageKey(twinId, warmupId)

  return (
    chains[key] || {
      twinId,
      twinName,
      warmupId,
      completedCount: 0,
      unlockAfter,
      sessionIds: [],
      latestSessionId: null,
      updatedAt: Date.now(),
    }
  )
}

export function recordWarmupMemory({
  twinId,
  twinName,
  warmupId,
  sessionId,
  unlockAfter = 3,
}: {
  twinId: string
  twinName: string
  warmupId: string
  sessionId: string
  unlockAfter?: number
}): WarmupChainProgress {
  const chains = readChains()
  const key = storageKey(twinId, warmupId)
  const existing = getWarmupChainProgress({
    twinId,
    twinName,
    warmupId,
    unlockAfter,
  })
  const sessionIds = existing.sessionIds.includes(sessionId)
    ? existing.sessionIds
    : [...existing.sessionIds, sessionId]
  const progress: WarmupChainProgress = {
    twinId,
    twinName,
    warmupId,
    completedCount: sessionIds.length,
    unlockAfter,
    sessionIds,
    latestSessionId: sessionId,
    updatedAt: Date.now(),
  }

  chains[key] = progress
  writeChains(chains)

  return progress
}

export function getNextWarmupInChain({
  twin = getActiveTwin(),
  warmupId,
  unlockAfter = 3,
}: {
  twin?: DigitalTwin
  warmupId: string
  unlockAfter?: number
}) {
  const progress = getWarmupChainProgress({
    twinId: twin.id,
    twinName: twin.displayName,
    warmupId,
    unlockAfter,
  })

  return {
    progress,
    remaining: Math.max(progress.unlockAfter - progress.completedCount, 0),
    ready: progress.completedCount >= progress.unlockAfter,
  }
}
