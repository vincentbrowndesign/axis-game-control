import { getCalibrationMissions } from "@/lib/missions/getCalibrationMissions"

const warmups = getCalibrationMissions()

export function getWarmupById(warmupId?: string | null) {
  if (!warmupId) return warmups[0] || null

  return warmups.find((warmup) => warmup.id === warmupId) || warmups[0] || null
}

export function getWarmupFromSession(mission?: string | null) {
  if (!mission || mission === "None") return warmups[0] || null

  return (
    warmups.find((warmup) => mission.includes(warmup.title)) ||
    warmups[0] ||
    null
  )
}

export function getNextWarmup(warmupId?: string | null) {
  const current = getWarmupById(warmupId)

  if (!current || !warmups.length) return null

  const index = warmups.findIndex((warmup) => warmup.id === current.id)
  const nextIndex = index >= 0 ? (index + 1) % warmups.length : 0

  return warmups[nextIndex]
}

export function getNextWarmupFromMission(mission?: string | null) {
  return getNextWarmup(getWarmupFromSession(mission)?.id)
}
