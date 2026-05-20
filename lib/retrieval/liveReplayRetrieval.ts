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
  sessionTime: number
  clipStart: number
  clipEnd: number
  eventType: string
  team: string
  label: string
  score: string
  createdAt: string
  playbackUrl: string | null
  relevance: number
  hiddenContinuityScore: number
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

function eventLabel(eventType: string) {
  if (eventType === "MAKE") return "Made shot"
  if (eventType === "MISS" || eventType === "SHOT") return "Shot"
  if (eventType === "TURNOVER") return "Turnover"
  if (eventType === "REBOUND") return "Rebound"
  if (eventType === "ASSIST") return "Assist"
  if (eventType === "STEAL") return "Steal"
  if (eventType === "BLOCK") return "Block"
  if (eventType === "FOUL") return "Foul"
  if (eventType === "SNAPSHOT") return "Saved clip"

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

function hiddenContinuityScore(payload: Record<string, unknown>) {
  const training = asRecord(payload.training_rep)
  const continuity = asRecord(training.continuity)
  const pressure = number(continuity.pressure)
  const density = number(continuity.density)
  const sequence = asRecord(payload.sequence)
  const previous = Array.isArray(sequence.previous) ? sequence.previous.length : 0

  return pressure * 0.42 + density * 0.36 + previous * 0.12
}

function clipFromEvent(
  event: TemporalEventRecord,
  session: TemporalSessionRecord | undefined
): ReplayRetrievalClip | null {
  if (!session) return null
  if (event.type !== "BASKETBALL_EVENT" && event.type !== "SNAPSHOT") return null

  const payload = asRecord(event.payload)
  const anchor = asRecord(payload.replay_anchor)
  const eventType =
    text(payload.basketball_event) || (event.type === "SNAPSHOT" ? "SNAPSHOT" : event.type)
  const sessionTime = number(event.session_time)
  const clipStart = Math.max(
    0,
    number(anchor.clipStart) || sessionTime - number(asRecord(payload.replay_window).before) || sessionTime - 4
  )
  const clipEnd =
    number(anchor.clipEnd) ||
    sessionTime + number(asRecord(payload.replay_window).after) ||
    sessionTime + 4
  const team = text(payload.team).toUpperCase() || "TEAM"
  const playByPlay = text(payload.play_by_play)

  return {
    id: `${session.id}:${event.id}`,
    sessionId: session.id,
    eventId: event.id,
    sessionTime,
    clipStart,
    clipEnd,
    eventType,
    team,
    label: playByPlay || `${team} ${eventLabel(eventType)}`,
    score: scoreLabel(payload.score_state),
    createdAt: session.created_at,
    playbackUrl: session.playback_url,
    relevance: 1 + hiddenContinuityScore(payload),
    hiddenContinuityScore: hiddenContinuityScore(payload),
  }
}

function queryMatches(clip: ReplayRetrievalClip, query: string) {
  if (!query) return true
  const haystack = [
    clip.label,
    clip.eventType,
    clip.team,
    clip.score,
    `${Math.floor(clip.sessionTime)}`,
  ]
    .join(" ")
    .toLowerCase()

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part))
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
  const selectedPreset = normalizedPreset(preset)
  const sessionsById = new Map(sessions.map((session) => [session.id, session]))
  const clips = events
    .map((event) => clipFromEvent(event, sessionsById.get(event.session_id)))
    .filter((clip): clip is ReplayRetrievalClip => Boolean(clip))
    .filter((clip) => eventMatchesPreset(clip.eventType, selectedPreset))
    .filter((clip) => queryMatches(clip, query || ""))
    .sort((a, b) => {
      if (selectedPreset === "last-run") return b.sessionTime - a.sessionTime

      const relevanceDelta = b.relevance - a.relevance
      if (Math.abs(relevanceDelta) > 0.01) return relevanceDelta

      return b.createdAt.localeCompare(a.createdAt)
    })
    .slice(0, limit)
  const sourceClips = events
    .map((event) => clipFromEvent(event, sessionsById.get(event.session_id)))
    .filter((clip): clip is ReplayRetrievalClip => Boolean(clip))
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
      "Scoring clips with score state",
      sourceClips.filter((clip) => clip.eventType === "MAKE")
    ),
    cluster(
      "pressure",
      "High-value clips",
      "Tagged plays with stronger game context",
      [...sourceClips]
        .filter((clip) => clip.hiddenContinuityScore > 0.18)
        .sort((a, b) => b.hiddenContinuityScore - a.hiddenContinuityScore)
    ),
  ].filter((item): item is ReplayRetrievalCluster => Boolean(item))

  return {
    preset: selectedPreset,
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
    label: "All clips",
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
