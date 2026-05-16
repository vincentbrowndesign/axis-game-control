import { normalizeReplay } from "@/lib/normalizeReplay"
import type { AxisReplaySession, ReplaySessionView } from "@/types/memory"

export function normalizeSessions(rows: AxisReplaySession[] | null | undefined) {
  return (rows || []).map((session) => normalizeReplay(session))
}

export function playerName(session: ReplaySessionView) {
  return session.player && session.player !== "Unassigned"
    ? session.player
    : "Local player"
}

export function drillName(session: ReplaySessionView) {
  return session.mission && session.mission !== "None"
    ? session.mission
    : "Open session"
}

export function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)

  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`

  const hours = Math.floor(mins / 60)

  if (hours < 24) return `${hours}h ago`

  return `${Math.floor(hours / 24)}d ago`
}

export function dateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function isRecent(session: ReplaySessionView) {
  return Date.now() - session.createdAt <= 1000 * 60 * 60 * 24 * 14
}

export function tagCounts(sessions: ReplaySessionView[]) {
  return sessions.reduce<Record<string, number>>((counts, session) => {
    for (const tag of session.tags) {
      const key = tag.toLowerCase()
      counts[key] = (counts[key] || 0) + 1
    }

    return counts
  }, {})
}

export function repeatKey(session: ReplaySessionView) {
  return `${playerName(session).toLowerCase()}::${drillName(session).toLowerCase()}`
}

export function repeatCounts(sessions: ReplaySessionView[]) {
  return sessions.reduce<Record<string, number>>((counts, session) => {
    const key = repeatKey(session)
    counts[key] = (counts[key] || 0) + 1

    return counts
  }, {})
}

export function isRepeated(
  session: ReplaySessionView,
  sessionRepeats: Record<string, number>,
  tags: Record<string, number>
) {
  return (
    sessionRepeats[repeatKey(session)] > 1 ||
    session.tags.some((tag) => tags[tag.toLowerCase()] > 1) ||
    session.coachNote?.toLowerCase().includes("repeat")
  )
}

function practiceDateKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

export function practiceStreak(sessions: ReplaySessionView[]) {
  const practiceDays = new Set(
    sessions
      .filter((session) => session.environment === "practice")
      .map((session) => practiceDateKey(session.createdAt))
  )
  let streak = 0
  const day = new Date()

  for (;;) {
    const key = day.toISOString().slice(0, 10)

    if (!practiceDays.has(key)) break

    streak += 1
    day.setDate(day.getDate() - 1)
  }

  return streak
}

export function playerSummaries(sessions: ReplaySessionView[]) {
  const players = new Map<string, ReplaySessionView[]>()

  for (const session of sessions) {
    const name = playerName(session)
    players.set(name, [...(players.get(name) || []), session])
  }

  return [...players.entries()]
    .map(([name, playerSessions]) => {
      const ordered = [...playerSessions].sort((a, b) => b.createdAt - a.createdAt)
      const recentTags = [
        ...new Set(ordered.flatMap((session) => session.tags).filter(Boolean)),
      ].slice(0, 4)
      const lastPractice = ordered.find(
        (session) => session.environment === "practice"
      )

      return {
        name,
        sessions: ordered.length,
        recentSessions: ordered.filter(isRecent).length,
        recentTags,
        lastPractice: lastPractice ? relativeTime(lastPractice.createdAt) : "None",
        streak: practiceStreak(ordered),
      }
    })
    .sort((a, b) => b.sessions - a.sessions)
}
