import { getCalibrationMissions } from "@/lib/missions/getCalibrationMissions"
import type { CalibrationMission } from "@/lib/missions/types"
import { getActiveTwin } from "@/lib/twin/getOrCreateTwin"
import { getWarmupChainProgress } from "@/lib/twin/warmupChains"

type StoredReplaySession = {
  id?: string
  createdAt?: number
  mission?: string | null
  title?: string | null
}

export type ActiveContinuityState = {
  eyebrow: string
  title: string
  line: string
  href: string
  actionLabel: string
}

const SESSION_PREFIX = "axis-session-"

function canReadStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage)
}

function safeParseSession(value: string | null): StoredReplaySession | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as StoredReplaySession

    if (!parsed || typeof parsed !== "object") return null

    return parsed
  } catch {
    return null
  }
}

function sessionsFromStorage() {
  if (!canReadStorage()) return []

  const sessions: StoredReplaySession[] = []

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)

    if (!key?.startsWith(SESSION_PREFIX)) continue

    const session = safeParseSession(window.localStorage.getItem(key))

    if (session?.createdAt) {
      sessions.push(session)
    }
  }

  return sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

function missionTitle(mission?: string | null) {
  if (!mission || mission === "None") return null

  return mission.replace(/^WARMUP\s+\d+\s+-\s+/i, "").trim() || null
}

function missionFromTitle(title?: string | null) {
  if (!title) return null

  return (
    getCalibrationMissions().find((mission) => title.includes(mission.title)) ||
    null
  )
}

function missionById(warmupId?: string | null) {
  if (!warmupId) return null

  return (
    getCalibrationMissions().find((mission) => mission.id === warmupId) || null
  )
}

function relativeDays(timestamp?: number) {
  if (!timestamp) return null

  const elapsed = Math.max(Date.now() - timestamp, 0)
  const day = 24 * 60 * 60 * 1000
  const days = Math.floor(elapsed / day)

  if (days <= 0) return "today"
  if (days === 1) return "1 day ago"

  return `${days} days ago`
}

function progressLine(mission: CalibrationMission) {
  try {
    const twin = getActiveTwin()
    const progress = getWarmupChainProgress({
      twinId: twin.id,
      twinName: twin.displayName,
      warmupId: mission.id,
      unlockAfter: mission.unlockAfter,
    })

    if (progress.completedCount > 1) {
      return `${progress.completedCount} linked sessions found.`
    }
  } catch {
    return null
  }

  return null
}

function playerName(fallbackName?: string | null) {
  try {
    return getActiveTwin(fallbackName).displayName
  } catch {
    return fallbackName?.trim() || "Local Player"
  }
}

export function getActiveContinuity({
  preferredWarmupId,
  fallbackName,
}: {
  preferredWarmupId?: string | null
  fallbackName?: string | null
} = {}): ActiveContinuityState {
  const latestSession = sessionsFromStorage()[0]
  const latestMissionTitle = missionTitle(latestSession?.mission)
  const latestMission = missionFromTitle(latestMissionTitle)
  const preferredMission = missionById(preferredWarmupId)
  const activeMission = latestMission || preferredMission
  const href = activeMission ? `/?warmup=${activeMission.id}` : "/practice"
  const name = playerName(fallbackName)

  if (latestSession) {
    const lastSeen = relativeDays(latestSession.createdAt)
    const chainLine = activeMission ? progressLine(activeMission) : null
    const line =
      chainLine ||
      (activeMission && lastSeen
        ? `Last memory: ${lastSeen}. ${activeMission.title} continuity active.`
        : lastSeen
          ? `Last memory: ${lastSeen}. Continuity active.`
          : "Previous memory found.")

    return {
      eyebrow: "Continue Now",
      title: `${name} returning`,
      line,
      href,
      actionLabel: "Continue",
    }
  }

  if (preferredMission) {
    return {
      eyebrow: "Continue Now",
      title: `${name} returning`,
      line: `${preferredMission.title} continuity ready.`,
      href,
      actionLabel: "Continue",
    }
  }

  return {
    eyebrow: "Continue Now",
    title: `${name} returning`,
    line: "Continuity ready.",
    href,
    actionLabel: "Continue",
  }
}
