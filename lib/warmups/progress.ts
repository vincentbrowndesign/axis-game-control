export type LocalMemoryOwner = {
  id: string
  name: string
  createdAt: number
}

export type WarmupChainProgress = {
  playerId: string
  playerName: string
  warmupId: string
  completedCount: number
  unlockAfter: number
  sessionIds: string[]
  latestSessionId: string | null
  updatedAt: number
}

const LOCAL_PLAYER_KEY = "axis-local-player-v1"
const WARMUP_CHAINS_KEY = "axis-warmup-chains-v1"
const DEFAULT_LOCAL_PLAYER: LocalMemoryOwner = {
  id: "local-player",
  name: "LOCAL PLAYER",
  createdAt: 0,
}

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

function normalizeName(value?: string | null) {
  const name = value?.trim()

  if (
    !name ||
    name === "Unassigned" ||
    name === "LOCAL PLAYER" ||
    name === "AXIS PLAYER"
  ) {
    return DEFAULT_LOCAL_PLAYER.name
  }

  return name
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function storageKey(playerId: string, warmupId: string) {
  return `${playerId}:${warmupId}`
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

export function getOrCreateLocalPlayer(
  playerName?: string | null
): LocalMemoryOwner {
  const name = normalizeName(playerName)

  if (name !== DEFAULT_LOCAL_PLAYER.name) {
    return {
      id: `player-${slug(name) || "local-player"}`,
      name,
      createdAt: Date.now(),
    }
  }

  if (!canUseStorage()) {
    return {
      ...DEFAULT_LOCAL_PLAYER,
      createdAt: Date.now(),
    }
  }

  const existing = safeParse<LocalMemoryOwner>(
    window.localStorage.getItem(LOCAL_PLAYER_KEY)
  )

  if (existing?.id && existing.name) return existing

  const player = {
    ...DEFAULT_LOCAL_PLAYER,
    createdAt: Date.now(),
  }

  window.localStorage.setItem(LOCAL_PLAYER_KEY, JSON.stringify(player))

  return player
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
  const chains = readChains()
  const key = storageKey(playerId, warmupId)

  return (
    chains[key] || {
      playerId,
      playerName,
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
  const chains = readChains()
  const key = storageKey(playerId, warmupId)
  const existing = getWarmupChainProgress({
    playerId,
    playerName,
    warmupId,
    unlockAfter,
  })
  const sessionIds = existing.sessionIds.includes(sessionId)
    ? existing.sessionIds
    : [...existing.sessionIds, sessionId]
  const progress: WarmupChainProgress = {
    playerId,
    playerName,
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
