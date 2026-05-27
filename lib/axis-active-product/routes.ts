export const AXIS_ARCHIVED_UX_SEGMENTS = [
  "axis-shell",
  "cv-demo",
  "game-day",
  "games",
  "measures",
  "replay-native",
  "rf-test",
] as const

export const AXIS_ACTIVE_ROUTE_SEGMENTS = [
  "auth",
  "check-in",
  "identity-token",
  "join",
  "leaderboard",
  "memory",
  "org",
  "player",
  "profile",
  "sign-in",
  "sign-up",
  "t",
] as const

export function isArchivedAxisUxSegment(segment: string) {
  return AXIS_ARCHIVED_UX_SEGMENTS.includes(
    segment.toLowerCase() as (typeof AXIS_ARCHIVED_UX_SEGMENTS)[number]
  )
}
