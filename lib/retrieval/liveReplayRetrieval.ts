import type {
  TemporalEventRecord,
  TemporalSessionRecord,
} from "@/lib/temporalEventGraph"

export type ReplayRetrievalPreset =
  | "all"
  | "turnovers"
  | "makes"
  | "rebounds"
  | "assists"
  | "stops"
  | "last-run"

export type ReplayRetrievalClip = {
  id: string
  sessionId: string
  eventId: string
  memoryEventId: string
  sessionTime: number
  clipStart: number
  clipEnd: number
  eventType: string
  team: string
  player: string | null
  label: string
  score: string
  possession: string
  previousEventId: string | null
  nextEventId: string | null
  normalizedMeaning: string
  createdAt: string
  playbackUrl: string | null
  relevance: number
  hiddenContinuityScore: number
  retrievalRole: "match" | "context"
}

export type ReplayRetrievalCluster = {
  id: string
  title: string
  subtitle: string
  clips: ReplayRetrievalClip[]
}

type RetrievalInput = {
  sessions: TemporalSessionRecord[]
  events: TemporalEventRecord[]
  preset?: string | null
  query?: string | null
  limit?: number
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function scoreLabel(value: unknown) {
  const score = asRecord(value)
  const home = number(score.home)
  const away = number(score.away)

  return `${home}-${away}`
}

function compactEventLabel({
  eventType,
  team,
  player,
  points,
  fallback,
}: {
  eventType: string
  team: string
  player: string | null
  points: number
  fallback: string
}) {
  const owner = player || team
  if (eventType === "MAKE") return `${owner} ${points === 1 ? "FT" : `${points || 2}PT`}`
  if (eventType === "MISS" || eventType === "SHOT") return `${owner} MISS`
  if (eventType === "TURNOVER") return `${owner} TURNOVER`
  if (eventType === "REBOUND") return `${owner} REBOUND`
  if (eventType === "ASSIST") return `${owner} ASSIST`
  if (eventType === "STEAL") return `${owner} STEAL`
  if (eventType === "BLOCK") return `${owner} BLOCK`
  if (eventType === "FOUL") return `${owner} FOUL`
  if (fallback) return fallback.toUpperCase()

  return eventLabel(eventType).toUpperCase()
}

function eventLabel(eventType: string) {
  if (eventType === "MAKE") return "Made shot"
  if (eventType === "MISS" || eventType === "SHOT") return "Shot"
  if (eventType === "TURNOVER") return "Turnover"
  if (eventType === "REBOUND") return "Rebound"
  if (eventType === "ASSIST") return "Assist"
  if (eventType === "STEAL") return "Steal"
  if (eventType === "BLOCK") return "Block"
  if (eventType === "FOUL") return "Foul"
  if (eventType === "SNAPSHOT") return "Saved moment"

  return eventType.replaceAll("_", " ").toLowerCase()
}

function eventMatchesPreset(eventType: string, preset: ReplayRetrievalPreset) {
  if (preset === "all" || preset === "last-run") return true
  if (preset === "turnovers") return eventType === "TURNOVER"
  if (preset === "makes") return eventType === "MAKE"
  if (preset === "rebounds") return eventType === "REBOUND"
  if (preset === "assists") return eventType === "ASSIST"
  if (preset === "stops") return ["STEAL", "BLOCK", "TURNOVER"].includes(eventType)

  return true
}

function normalizedPreset(value?: string | null): ReplayRetrievalPreset {
  if (
    value === "turnovers" ||
    value === "makes" ||
    value === "rebounds" ||
    value === "assists" ||
    value === "stops" ||
    value === "last-run"
  ) {
    return value
  }

  return "all"
}

function presetFromQuery(query?: string | null): ReplayRetrievalPreset | null {
  const normalized = (query || "").toLowerCase()
  if (/\blast\s+run\b/.test(normalized)) return "last-run"
  if (/\bturnovers?\b|\bto\b/.test(normalized)) return "turnovers"
  if (/\brebounds?\b|\bboards?\b/.test(normalized)) return "rebounds"
  if (/\bassists?\b|\bast\b/.test(normalized)) return "assists"
  if (/\bmade\b|\bmakes?\b|\bscor(e|ing)\b/.test(normalized)) return "makes"
  if (/\bstops?\b/.test(normalized)) return "stops"

  return null
}

function hiddenContinuityScore(payload: Record<string, unknown>) {
  const training = asRecord(payload.training_rep)
  const memory = asRecord(payload.memory_object)
  const continuity = asRecord(training.continuity)
  const memoryContinuity = asRecord(memory.continuityState)
  const pressure = number(continuity.pressure) || number(memoryContinuity.pressure)
  const density = number(continuity.density) || number(memoryContinuity.density)
  const sequence = asRecord(payload.sequence)
  const previous = Array.isArray(sequence.previous) ? sequence.previous.length : 0

  return pressure * 0.42 + density * 0.36 + previous * 0.12
}

function clipFromEvent(
  event: TemporalEventRecord,
  session: TemporalSessionRecord | undefined
): ReplayRetrievalClip | null {
  if (!session) return null
  if (
    event.type !== "BASKETBALL_EVENT" &&
    event.type !== "LIVE_MEMORY_COMMAND" &&
    event.type !== "SNAPSHOT"
  ) {
    return null
  }

  const payload = asRecord(event.payload)
  const memory = asRecord(payload.memory_object)
  const anchor = {
    ...asRecord(memory.replayAnchor),
    ...asRecord(payload.replay_anchor),
  }
  const eventType =
    text(memory.eventType) ||
    text(payload.basketball_event) ||
    (event.type === "SNAPSHOT" ? "SNAPSHOT" : event.type)
  const sessionTime = number(event.session_time)
  const clipStart = Math.max(
    0,
    number(anchor.clipStart) || sessionTime - number(asRecord(payload.replay_window).before) || sessionTime - 4
  )
  const clipEnd =
    number(anchor.clipEnd) ||
    sessionTime + number(asRecord(payload.replay_window).after) ||
    sessionTime + 4
  const team = text(memory.team).toUpperCase() || text(payload.team).toUpperCase() || "TEAM"
  const player = text(memory.player) || text(payload.player) || null
  const playByPlay = text(payload.play_by_play)
  const normalizedMeaning = text(memory.normalizedMeaning) || text(payload.normalized_command)
  const rawInput = text(memory.rawInput) || text(payload.raw)
  const score = scoreLabel(memory.scoreAfter || payload.score_state)
  const points = number(payload.points)

  return {
    id: `${session.id}:${event.id}`,
    sessionId: session.id,
    eventId: event.id,
    memoryEventId: text(memory.eventId) || event.id,
    sessionTime,
    clipStart,
    clipEnd,
    eventType,
    team,
    player,
    label: compactEventLabel({
      eventType,
      team,
      player,
      points,
      fallback: playByPlay || rawInput || normalizedMeaning,
    }),
    score,
    possession: text(memory.possessionAfter) || text(payload.possession).toUpperCase() || "LIVE",
    previousEventId: text(memory.previousEventId) || null,
    nextEventId: text(memory.nextEventId) || null,
    normalizedMeaning,
    createdAt: session.created_at,
    playbackUrl: session.playback_url,
    relevance: 1 + hiddenContinuityScore(payload),
    hiddenContinuityScore: hiddenContinuityScore(payload),
    retrievalRole: "match",
  }
}

function queryParts(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !["show", "find", "replay", "open", "get", "clips", "clip", "plays", "play"].includes(part))
}

function queryMatches(clip: ReplayRetrievalClip, query: string) {
  const parts = queryParts(query)
  if (!parts.length) return true
  const haystack = [
    clip.label,
    clip.eventType,
    clip.team,
    clip.player,
    clip.score,
    clip.possession,
    clip.normalizedMeaning,
    `${Math.floor(clip.sessionTime)}`,
  ]
    .join(" ")
    .toLowerCase()

  return parts.every((part) => haystack.includes(part) || haystack.includes(part.replace(/s$/, "")))
}

function withRetrievalRole(clip: ReplayRetrievalClip, retrievalRole: ReplayRetrievalClip["retrievalRole"]) {
  return {
    ...clip,
    retrievalRole,
  }
}

function expandWithMemoryContext(
  sourceClips: ReplayRetrievalClip[],
  matchedClips: ReplayRetrievalClip[]
) {
  const byMemoryId = new Map(sourceClips.map((clip) => [clip.memoryEventId, clip]))
  const byId = new Map<string, ReplayRetrievalClip>()

  function append(clip: ReplayRetrievalClip, retrievalRole: ReplayRetrievalClip["retrievalRole"]) {
    const existing = byId.get(clip.id)
    if (existing?.retrievalRole === "match") return
    byId.set(clip.id, withRetrievalRole(clip, retrievalRole))
  }

  matchedClips.forEach((clip) => {
    append(clip, "match")

    const previous = clip.previousEventId ? byMemoryId.get(clip.previousEventId) : null
    const next = clip.nextEventId ? byMemoryId.get(clip.nextEventId) : null
    if (previous) append(previous, "context")
    if (next) append(next, "context")

    sourceClips
      .filter((candidate) => candidate.sessionId === clip.sessionId)
      .filter((candidate) => Math.abs(candidate.sessionTime - clip.sessionTime) <= 24)
      .forEach((candidate) => append(candidate, candidate.id === clip.id ? "match" : "context"))
  })

  return [...byId.values()]
}

function cluster(
  id: string,
  title: string,
  subtitle: string,
  clips: ReplayRetrievalClip[]
): ReplayRetrievalCluster | null {
  if (!clips.length) return null

  return {
    id,
    title,
    subtitle,
    clips: clips.slice(0, 5),
  }
}

export function buildReplayRetrieval({
  sessions,
  events,
  preset,
  query,
  limit = 18,
}: RetrievalInput) {
  const queryPreset = preset ? null : presetFromQuery(query)
  const selectedPreset = queryPreset || normalizedPreset(preset)
  const effectiveQuery = queryPreset ? "" : query || ""
  const hasReorganizationQuery = Boolean(queryPreset || queryParts(effectiveQuery).length)
  const sessionsById = new Map(sessions.map((session) => [session.id, session]))
  const sourceClips = events
    .map((event) => clipFromEvent(event, sessionsById.get(event.session_id)))
    .filter((clip): clip is ReplayRetrievalClip => Boolean(clip))
  const matchedClips = sourceClips
    .filter((clip) => eventMatchesPreset(clip.eventType, selectedPreset))
    .filter((clip) => queryMatches(clip, effectiveQuery))

  const clips = (hasReorganizationQuery
    ? expandWithMemoryContext(sourceClips, matchedClips)
    : matchedClips
  )
    .sort((a, b) => {
      if (selectedPreset === "last-run") return b.sessionTime - a.sessionTime
      if (hasReorganizationQuery) {
        const sessionDelta = b.createdAt.localeCompare(a.createdAt)
        if (sessionDelta !== 0) return sessionDelta

        return a.sessionTime - b.sessionTime
      }
      if (!effectiveQuery && selectedPreset === "all") {
        const sessionDelta = b.createdAt.localeCompare(a.createdAt)
        if (sessionDelta !== 0) return sessionDelta

        return a.sessionTime - b.sessionTime
      }

      const relevanceDelta = b.relevance - a.relevance
      if (Math.abs(relevanceDelta) > 0.01) return relevanceDelta

      return b.createdAt.localeCompare(a.createdAt)
    })
    .slice(0, limit)
  const clusters = [
    cluster(
      "last-run",
      "Last run",
      "Newest tagged possessions",
      [...sourceClips].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
    ),
    cluster(
      "turnovers",
      "Turnovers",
      "Possession changes ready to review",
      sourceClips.filter((clip) => clip.eventType === "TURNOVER")
    ),
    cluster(
      "scoring",
      "Made shots",
      "Scoring moments with score state",
      sourceClips.filter((clip) => clip.eventType === "MAKE")
    ),
    cluster(
      "pressure",
      "High-value moments",
      "Tagged plays with stronger game context",
      [...sourceClips]
        .filter((clip) => clip.hiddenContinuityScore > 0.18)
        .sort((a, b) => b.hiddenContinuityScore - a.hiddenContinuityScore)
    ),
  ].filter((item): item is ReplayRetrievalCluster => Boolean(item))

  return {
    preset: selectedPreset,
    queryMode: hasReorganizationQuery ? "reorganized" : "chronological",
    clips,
    clusters,
  }
}

export const replayRetrievalPresets: Array<{
  key: ReplayRetrievalPreset
  label: string
}> = [
  {
    key: "all",
    label: "All moments",
  },
  {
    key: "last-run",
    label: "Last run",
  },
  {
    key: "turnovers",
    label: "Turnovers",
  },
  {
    key: "makes",
    label: "Made shots",
  },
  {
    key: "rebounds",
    label: "Rebounds",
  },
  {
    key: "assists",
    label: "Assists",
  },
  {
    key: "stops",
    label: "Stops",
  },
]
