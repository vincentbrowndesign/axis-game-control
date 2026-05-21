import type { AxisMemoryObject, AxisMemoryScoreState, AxisMemoryTeam } from "@/lib/axisMemoryObject"
import type { BasketballEvent } from "@/lib/continuityAssistance"
import type { LiveStatTeam } from "@/lib/liveBasketballStats"

export type AxisMemoryMode =
  | "live"
  | "replay"
  | "find"
  | "upload"
  | "session"
  | "unknown"

export type AxisRetrievalIntent =
  | "create_state"
  | "retrieve_memory"
  | "open_replay"
  | "enrich_memory"
  | "state_transition"
  | "route_perception"
  | "correct_memory"
  | "contextual_analytics"

export type AxisPlannerRoute =
  | "memory_graph"
  | "replay"
  | "chronology"
  | "static_stats"
  | "contextual_stats"
  | "player_memory"
  | "vision_assist"
  | "semantic_memory"

export type AxisContextualMemoryPackage = {
  currentState: {
    mode: AxisMemoryMode
    score: AxisMemoryScoreState | null
    possession: AxisMemoryTeam | null
    quarter: number | null
    replayState: "idle" | "anchored" | "seeking" | "playing" | "unknown"
  }
  recentMemory: {
    moments: Array<{
      eventId: string
      timestamp: number
      eventType: string
      player: string | null
      team: AxisMemoryTeam | null
      meaning: string
    }>
    continuityFlow: BasketballEvent[]
    replayAnchors: Array<{
      eventId: string
      sessionTime: number
      clipStart: number
      clipEnd: number
    }>
  }
  playerContext: {
    activePlayers: string[]
    lastMention: string | null
    continuityInfluence: string[]
  }
  queryContext: {
    raw: string
    normalized: string
    retrievalIntent: AxisRetrievalIntent
    semanticMeaning: string[]
    ambiguity: "none" | "actor" | "team" | "shot_value" | "contextual"
  }
}

export type AxisPlannerDecision = {
  route: AxisPlannerRoute
  operation: AxisRetrievalIntent
  needsExecutor: boolean
  reason: string
}

type BuildContextPackageInput = {
  raw: string
  mode: AxisMemoryMode
  score?: AxisMemoryScoreState | null
  possession?: LiveStatTeam | AxisMemoryTeam | null
  quarter?: number | null
  replayState?: AxisContextualMemoryPackage["currentState"]["replayState"]
  recentMoments?: AxisMemoryObject[]
  continuityFlow?: BasketballEvent[]
  activePlayers?: string[]
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

function axisTeam(value: LiveStatTeam | AxisMemoryTeam | null | undefined): AxisMemoryTeam | null {
  if (!value) return null
  const normalized = value.toUpperCase()

  return normalized === "HOME" || normalized === "AWAY" ? normalized : null
}

function semanticMeaningForQuery(normalized: string) {
  const tags = new Set<string>()

  if (/\b(rebound|board|boards)\b/.test(normalized)) tags.add("rebound")
  if (/\b(assist|dime|dimes)\b/.test(normalized)) tags.add("assist")
  if (/\b(turnover|to|giveaway)\b/.test(normalized)) tags.add("turnover")
  if (/\b(steal|strip|stl)\b/.test(normalized)) tags.add("steal")
  if (/\b(score|scored|bucket|cash|make|made)\b/.test(normalized)) tags.add("scoring")
  if (/\b(last run|run)\b/.test(normalized)) tags.add("run")
  if (/\b(collapse|fell apart|lost it)\b/.test(normalized)) tags.add("collapse")
  if (/\b(stabilize|settle|calm|reset)\b/.test(normalized)) tags.add("stabilization")
  if (/\b(momentum|swing)\b/.test(normalized)) tags.add("momentum")
  if (/\b(pressure|trap|sped up)\b/.test(normalized)) tags.add("pressure")
  if (/\b(where|spot|side|corner|paint|arc)\b/.test(normalized)) tags.add("spatial_context")
  if (/\b(replay|clip|open|show|find)\b/.test(normalized)) tags.add("retrieval")
  if (/\b(track|watch|follow)\b/.test(normalized)) tags.add("perception_routing")

  return [...tags]
}

function retrievalIntentForQuery(normalized: string, tags: string[]): AxisRetrievalIntent {
  if (/\b(wrong|fix|correct|actually)\b/.test(normalized)) return "correct_memory"
  if (/\b(track|watch|follow)\b/.test(normalized)) return "route_perception"
  if (/\b(open replay|replay|clip)\b/.test(normalized)) return "open_replay"
  if (/\b(show|find|where|get|last run)\b/.test(normalized)) return "retrieve_memory"
  if (/\b(collapse|stabilize|momentum|pressure|run)\b/.test(normalized)) return "contextual_analytics"
  if (tags.length) return "enrich_memory"

  return "create_state"
}

function ambiguityForQuery(normalized: string) {
  if (/\b(they|he|she|someone)\b/.test(normalized)) return "actor"
  if (/\b(scored|made|hit|missed)\b/.test(normalized) && !/\b(1|2|3|ft|free throw|three|two)\b/.test(normalized)) {
    return "shot_value"
  }
  if (/\b(other side|them)\b/.test(normalized)) return "team"
  if (/\b(that|there|last one)\b/.test(normalized)) return "contextual"

  return "none"
}

export function buildContextualMemoryPackage({
  raw,
  mode,
  score = null,
  possession = null,
  quarter = null,
  replayState = "unknown",
  recentMoments = [],
  continuityFlow = [],
  activePlayers = [],
}: BuildContextPackageInput): AxisContextualMemoryPackage {
  const normalized = normalizeText(raw)
  const semanticMeaning = semanticMeaningForQuery(normalized)
  const recent = recentMoments.slice(-8)

  return {
    currentState: {
      mode,
      score,
      possession: axisTeam(possession),
      quarter,
      replayState,
    },
    recentMemory: {
      moments: recent.map((moment) => ({
        eventId: moment.eventId,
        timestamp: moment.timestamp,
        eventType: moment.eventType,
        player: moment.player,
        team: moment.team,
        meaning: moment.normalizedMeaning || moment.rawInput,
      })),
      continuityFlow: continuityFlow.slice(-8),
      replayAnchors: recent.flatMap((moment) =>
        moment.replayAnchor
          ? [
              {
                eventId: moment.eventId,
                sessionTime: moment.replayAnchor.sessionTime,
                clipStart: moment.replayAnchor.clipStart,
                clipEnd: moment.replayAnchor.clipEnd,
              },
            ]
          : []
      ),
    },
    playerContext: {
      activePlayers: activePlayers.filter(Boolean).slice(-6),
      lastMention: [...activePlayers].reverse().find(Boolean) || null,
      continuityInfluence: recent
        .filter((moment) => moment.continuityState)
        .map((moment) => moment.eventType)
        .slice(-6),
    },
    queryContext: {
      raw,
      normalized,
      retrievalIntent: retrievalIntentForQuery(normalized, semanticMeaning),
      semanticMeaning,
      ambiguity: ambiguityForQuery(normalized),
    },
  }
}

export function planContextualMemoryOperation(
  contextPackage: AxisContextualMemoryPackage
): AxisPlannerDecision {
  const { retrievalIntent, semanticMeaning } = contextPackage.queryContext

  if (retrievalIntent === "route_perception") {
    return {
      route: "vision_assist",
      operation: retrievalIntent,
      needsExecutor: true,
      reason: "rail language is asking Axis to watch or follow live play context",
    }
  }

  if (retrievalIntent === "open_replay") {
    return {
      route: "replay",
      operation: retrievalIntent,
      needsExecutor: true,
      reason: "rail language is asking for replay memory",
    }
  }

  if (retrievalIntent === "retrieve_memory") {
    return {
      route: "memory_graph",
      operation: retrievalIntent,
      needsExecutor: true,
      reason: "rail language should retrieve connected chronology, not an isolated clip",
    }
  }

  if (retrievalIntent === "contextual_analytics") {
    return {
      route: "contextual_stats",
      operation: retrievalIntent,
      needsExecutor: true,
      reason: "rail language is asking for continuity, pressure, or run context",
    }
  }

  if (semanticMeaning.some((tag) => ["rebound", "assist", "turnover", "steal", "scoring"].includes(tag))) {
    return {
      route: "static_stats",
      operation: retrievalIntent,
      needsExecutor: true,
      reason: "rail language carries stat truth that can enrich the memory graph",
    }
  }

  return {
    route: "semantic_memory",
    operation: retrievalIntent,
    needsExecutor: true,
    reason: "rail language should be stored as basketball phrasing for later retrieval",
  }
}
