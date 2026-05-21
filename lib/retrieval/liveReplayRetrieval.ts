import type {
  TemporalEventRecord,
  TemporalSessionRecord,
} from "@/lib/temporalEventGraph"
import {
  buildContextualMemoryPackage,
  planContextualMemoryOperation,
} from "@/lib/contextualMemoryLanguage"

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
  clusterTags: ReplayMemoryClusterKind[]
  contextStack: ReplayRetrievalContextStack
  continuityStates: ReplayContinuityState[]
  memoryLoop: ReplayMemoryLoopState
}

export type ReplayMemoryClusterKind =
  | "last-run"
  | "player-sequence"
  | "collapse-window"
  | "pressure-sequence"
  | "momentum-shift"
  | "turnover-chain"
  | "rebound-sequence"
  | "transition-window"

export type ReplayRetrievalContextStack = {
  previousLabel: string | null
  nextLabel: string | null
  nearbyCount: number
  scoreState: string
  possessionState: string
}

export type ReplayContinuityState =
  | "unanswered-run"
  | "collapse-window"
  | "stabilization-sequence"
  | "pressure-escalation"
  | "recovery-moment"

export type ReplayMemoryLoopState = {
  createdInLive: boolean
  findVisible: boolean
  replayReady: boolean
  continuityLinked: boolean
  streamPosition: number
}

export type ReplayRetrievalCluster = {
  id: string
  kind: ReplayMemoryClusterKind
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
  if (/\bstops?\b|\bsteals?\b|\bstrips?\b|\bblocks?\b/.test(normalized)) return "stops"

  return null
}

function clusterKindFromQuery(query?: string | null): ReplayMemoryClusterKind | null {
  const normalized = (query || "").toLowerCase()
  if (/\bplayer\s+sequence\b|\bnae\s+sequence\b/.test(normalized)) return "player-sequence"
  if (/\bcollapse\b/.test(normalized)) return "collapse-window"
  if (/\bpressure\b/.test(normalized)) return "pressure-sequence"
  if (/\bmomentum\b/.test(normalized)) return "momentum-shift"
  if (/\bstabiliz(e|ation)|settle|reset\b/.test(normalized)) return "pressure-sequence"
  if (/\bturnover\s+chain\b/.test(normalized)) return "turnover-chain"
  if (/\brebound\s+sequence\b/.test(normalized)) return "rebound-sequence"
  if (/\btransition\b/.test(normalized)) return "transition-window"

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

function continuityStateFromPayload(payload: Record<string, unknown>) {
  const training = asRecord(payload.training_rep)
  const memory = asRecord(payload.memory_object)
  const continuity = asRecord(training.continuity)
  const memoryContinuity = asRecord(memory.continuityState)

  return {
    pressure: number(continuity.pressure) || number(memoryContinuity.pressure),
    density: number(continuity.density) || number(memoryContinuity.density),
    attentionState: text(continuity.attentionState) || text(memoryContinuity.attentionState),
  }
}

function inferContinuityStates(clip: ReplayRetrievalClip): ReplayContinuityState[] {
  const states = new Set<ReplayContinuityState>()

  if (clip.hiddenContinuityScore > 0.28) states.add("pressure-escalation")
  if (clip.eventType === "TURNOVER") states.add("collapse-window")
  if (["STEAL", "BLOCK", "REBOUND"].includes(clip.eventType)) states.add("recovery-moment")
  if (clip.eventType === "MAKE" && clip.contextStack.nearbyCount > 1) states.add("unanswered-run")
  if (clip.contextStack.previousLabel && clip.contextStack.nextLabel) states.add("stabilization-sequence")

  return [...states]
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
  const continuityState = continuityStateFromPayload(payload)
  const hiddenScore = hiddenContinuityScore(payload)

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
    relevance: 1 + hiddenScore,
    hiddenContinuityScore: hiddenScore,
    retrievalRole: "match",
    clusterTags: [],
    contextStack: {
      previousLabel: null,
      nextLabel: null,
      nearbyCount: 0,
      scoreState: score,
      possessionState: text(memory.possessionAfter) || text(payload.possession).toUpperCase() || "LIVE",
    },
    continuityStates: continuityState.pressure > 0.28 ? ["pressure-escalation"] : [],
    memoryLoop: {
      createdInLive: event.type === "BASKETBALL_EVENT" || event.type === "LIVE_MEMORY_COMMAND",
      findVisible: true,
      replayReady: Boolean(session.playback_url),
      continuityLinked: false,
      streamPosition: 0,
    },
  }
}

function queryParts(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => ![
      "show",
      "find",
      "replay",
      "open",
      "get",
      "clips",
      "clip",
      "plays",
      "play",
      "moments",
      "moment",
      "sequence",
      "window",
      "chain",
    ].includes(part))
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

function withClusterTag(clip: ReplayRetrievalClip, tag: ReplayMemoryClusterKind) {
  if (clip.clusterTags.includes(tag)) return clip

  return {
    ...clip,
    clusterTags: [...clip.clusterTags, tag],
  }
}

function markCluster(clips: ReplayRetrievalClip[], tag: ReplayMemoryClusterKind) {
  const ids = new Set(clips.map((clip) => clip.id))
  return (clip: ReplayRetrievalClip) => (ids.has(clip.id) ? withClusterTag(clip, tag) : clip)
}

function chronological(clips: ReplayRetrievalClip[]) {
  return [...clips].sort((a, b) => {
    const sessionDelta = a.createdAt.localeCompare(b.createdAt)
    if (sessionDelta !== 0) return sessionDelta

    return a.sessionTime - b.sessionTime
  })
}

function sameSessionWindow(clips: ReplayRetrievalClip[], source: ReplayRetrievalClip, seconds: number) {
  return clips.filter((clip) => (
    clip.sessionId === source.sessionId &&
    Math.abs(clip.sessionTime - source.sessionTime) <= seconds &&
    clip.id !== source.id
  ))
}

function strongestPlayerSequence(clips: ReplayRetrievalClip[]) {
  const byPlayer = new Map<string, ReplayRetrievalClip[]>()
  clips.forEach((clip) => {
    if (!clip.player) return
    byPlayer.set(clip.player, [...(byPlayer.get(clip.player) || []), clip])
  })

  return [...byPlayer.values()]
    .filter((group) => group.length > 1)
    .sort((a, b) => b.length - a.length)[0] || []
}

function relatedSequence(
  clips: ReplayRetrievalClip[],
  predicate: (clip: ReplayRetrievalClip) => boolean,
  windowSeconds = 42
) {
  const matches = clips.filter(predicate)
  const related = new Map<string, ReplayRetrievalClip>()
  matches.forEach((match) => {
    related.set(match.id, match)
    sameSessionWindow(clips, match, windowSeconds).forEach((clip) => related.set(clip.id, clip))
  })

  return chronological([...related.values()])
}

function buildNaturalClusters(sourceClips: ReplayRetrievalClip[]): ReplayRetrievalCluster[] {
  const newest = [...sourceClips]
    .sort((a, b) => {
      const sessionDelta = b.createdAt.localeCompare(a.createdAt)
      if (sessionDelta !== 0) return sessionDelta

      return b.sessionTime - a.sessionTime
    })
    .slice(0, 6)
  const playerSequence = strongestPlayerSequence(sourceClips)
  const turnoverChain = relatedSequence(sourceClips, (clip) => clip.eventType === "TURNOVER")
  const reboundSequence = relatedSequence(sourceClips, (clip) => clip.eventType === "REBOUND")
  const pressureSequence = relatedSequence(sourceClips, (clip) => clip.hiddenContinuityScore > 0.18)
  const transitionWindow = relatedSequence(sourceClips, (clip) => ["STEAL", "BLOCK"].includes(clip.eventType), 28)
  const collapseWindow = relatedSequence(sourceClips, (clip) => (
    clip.eventType === "TURNOVER" || clip.hiddenContinuityScore > 0.28
  ), 36)
  const momentumShift = relatedSequence(sourceClips, (clip) => (
    ["MAKE", "STEAL", "BLOCK", "TURNOVER"].includes(clip.eventType)
  ), 24)

  return [
    cluster("last-run", "last-run", "Last run", "Newest tagged possessions", newest),
    cluster("player-sequence", "player-sequence", "Player sequence", "Repeated player memory", playerSequence),
    cluster("collapse-window", "collapse-window", "Collapse window", "Turnovers and pressure nearby", collapseWindow),
    cluster("pressure-sequence", "pressure-sequence", "Pressure sequence", "Moments carrying stronger context", pressureSequence),
    cluster("momentum-shift", "momentum-shift", "Momentum shift", "Score and possession changes together", momentumShift),
    cluster("turnover-chain", "turnover-chain", "Turnover chain", "Possessions connected by giveaways", turnoverChain),
    cluster("rebound-sequence", "rebound-sequence", "Rebound sequence", "Boards with nearby possessions", reboundSequence),
    cluster("transition-window", "transition-window", "Transition window", "Stops and open-floor chances", transitionWindow),
  ].filter((item): item is ReplayRetrievalCluster => Boolean(item))
}

function stackContext(sourceClips: ReplayRetrievalClip[]) {
  const byMemoryId = new Map(sourceClips.map((clip) => [clip.memoryEventId, clip]))
  const clusters = buildNaturalClusters(sourceClips)
  let tagged = sourceClips

  clusters.forEach((clusterItem) => {
    tagged = tagged.map(markCluster(clusterItem.clips, clusterItem.kind))
  })

  return tagged.map((clip) => {
    const previous = clip.previousEventId ? byMemoryId.get(clip.previousEventId) : null
    const next = clip.nextEventId ? byMemoryId.get(clip.nextEventId) : null
    const contextStack = {
      previousLabel: previous?.label || null,
      nextLabel: next?.label || null,
      nearbyCount: sameSessionWindow(tagged, clip, 24).length,
      scoreState: clip.score,
      possessionState: clip.possession,
    }
    const stackedClip = {
      ...clip,
      contextStack,
    }
    const continuityStates = inferContinuityStates(stackedClip)

    return {
      ...stackedClip,
      continuityStates,
      memoryLoop: {
        ...clip.memoryLoop,
        continuityLinked: Boolean(
          previous ||
          next ||
          continuityStates.length ||
          clip.clusterTags.length
        ),
      },
    }
  })
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
  kind: ReplayMemoryClusterKind,
  title: string,
  subtitle: string,
  clips: ReplayRetrievalClip[]
): ReplayRetrievalCluster | null {
  if (!clips.length) return null

  return {
    id,
    kind,
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
  const queryClusterKind = preset ? null : clusterKindFromQuery(query)
  const hasReorganizationQuery = Boolean(queryPreset || queryClusterKind || queryParts(effectiveQuery).length)
  const sessionsById = new Map(sessions.map((session) => [session.id, session]))
  const sourceClips = events
    .map((event) => clipFromEvent(event, sessionsById.get(event.session_id)))
    .filter((clip): clip is ReplayRetrievalClip => Boolean(clip))
  const contextualClips = stackContext(sourceClips)
  const clusters = buildNaturalClusters(contextualClips)
  const clusterClips = queryClusterKind
    ? clusters.find((clusterItem) => clusterItem.kind === queryClusterKind)?.clips || []
    : null
  const matchedClips = clusterClips || contextualClips
      .filter((clip) => eventMatchesPreset(clip.eventType, selectedPreset))
      .filter((clip) => queryMatches(clip, effectiveQuery))

  const clips = (hasReorganizationQuery
    ? expandWithMemoryContext(contextualClips, matchedClips)
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
    .map((clip, index) => ({
      ...clip,
      memoryLoop: {
        ...clip.memoryLoop,
        streamPosition: index,
      },
    }))
  const contextPackage = buildContextualMemoryPackage({
    raw: query || preset || "all moments",
    mode: "find",
    score: null,
    possession: null,
    quarter: null,
    replayState: clips.some((clip) => clip.playbackUrl) ? "anchored" : "idle",
    recentMoments: [],
    continuityFlow: clips
      .map((clip) => clip.eventType)
      .filter((eventType): eventType is "MAKE" | "MISS" | "SHOT" | "REBOUND" | "ASSIST" | "TURNOVER" | "STEAL" | "BLOCK" | "FOUL" =>
        ["MAKE", "MISS", "SHOT", "REBOUND", "ASSIST", "TURNOVER", "STEAL", "BLOCK", "FOUL"].includes(eventType)
      )
      .slice(-8),
    activePlayers: clips.flatMap((clip) => clip.player ? [clip.player] : []),
  })

  return {
    preset: selectedPreset,
    queryMode: hasReorganizationQuery ? "reorganized" : "chronological",
    clips,
    clusters,
    contextPackage,
    plannerDecision: planContextualMemoryOperation(contextPackage),
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
