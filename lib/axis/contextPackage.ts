import { parseAxisQueryIntent } from "@/lib/axis/intent"
import type { AxisChronologyEvent } from "@/lib/axis/state/eventLog"
import { AXIS_PRIMITIVE_BOUNDARY, type AxisPrimitiveBoundary } from "@/lib/axis/state/primitives"
import { rebuildState, type AxisRebuiltState } from "@/lib/axis/state/rebuildState"
import type {
  AxisContextualOutputs,
  AxisIntelligenceOutput,
  AxisMemoryObject,
  AxisMode,
  AxisStaticOutputs,
  AxisToolAvailability,
} from "@/lib/axis/types"

export type AxisContextPackageInput = {
  mode: AxisMode
  query: string
  eventLog?: AxisChronologyEvent[]
  session: {
    label: string
    quarter: string
    possession: "HOME" | "AWAY"
    score: {
      home: number
      away: number
    }
  }
  memories: AxisMemoryObject[]
}

export type AxisContextPackage = {
  kernel: {
    source: "chronology" | "memory_snapshot"
    primitiveBoundary: AxisPrimitiveBoundary
  }
  currentState: AxisContextPackageInput["session"] & {
    mode: AxisMode
  }
  recentChronology: AxisChronologyEvent[]
  recentMemory: {
    lastEvents: AxisMemoryObject[]
    recentRun: string | null
    recentPlayers: string[]
  }
  continuityState: AxisContextualOutputs
  replayContext: AxisRebuiltState["replayChronology"] | null
  playerContext: {
    activePlayers: string[]
    playerMemory: AxisStaticOutputs["players"]
  }
  staticAnalytics: AxisStaticOutputs
  retrievalIntent: ReturnType<typeof parseAxisQueryIntent>
  queryIntent: ReturnType<typeof parseAxisQueryIntent>
  availableTools: AxisToolAvailability
}

export function buildAxisContextPackage(input: AxisContextPackageInput): AxisContextPackage {
  const rebuiltState = input.eventLog?.length
    ? rebuildState(input.eventLog, {
        mode: input.mode,
        initialScore: {
          home: 0,
          away: 0,
        },
        initialPossession: input.session.possession === "HOME" ? "home" : "away",
      })
    : null
  const memories = rebuiltState?.memories ?? input.memories
  const staticAnalytics =
    rebuiltState?.staticOutputs ?? extractStaticOutputs(memories, input.session.score, input.session.possession)
  const contextualOutputs = rebuiltState?.continuity ?? extractContextualOutputs(memories)
  const queryIntent = parseAxisQueryIntent(input.query, input.mode)

  return {
    kernel: {
      source: rebuiltState ? "chronology" : "memory_snapshot",
      primitiveBoundary: AXIS_PRIMITIVE_BOUNDARY,
    },
    currentState: {
      ...input.session,
      possession: rebuiltState?.possession === "home" ? "HOME" : rebuiltState?.possession === "away" ? "AWAY" : input.session.possession,
      score: rebuiltState?.score ?? input.session.score,
      mode: input.mode,
    },
    recentChronology: input.eventLog?.slice(-8) ?? [],
    recentMemory: {
      lastEvents: memories.slice(-5).reverse(),
      recentRun: contextualOutputs.lastRun,
      recentPlayers: Array.from(new Set(memories.flatMap((memory) => memory.playerIds))).slice(0, 8),
    },
    continuityState: contextualOutputs,
    replayContext: rebuiltState?.replayChronology ?? null,
    playerContext: {
      activePlayers: Array.from(new Set(memories.flatMap((memory) => memory.playerIds))).slice(0, 8),
      playerMemory: staticAnalytics.players,
    },
    staticAnalytics,
    retrievalIntent: queryIntent,
    queryIntent,
    availableTools: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      mux: Boolean(process.env.MUX_TOKEN_ID || process.env.MUX_TOKEN_SECRET),
      mediapipe: true,
      roboflow: Boolean(process.env.ROBOFLOW_API_KEY),
      deepgram: Boolean(process.env.DEEPGRAM_API_KEY),
    },
  }
}

export function extractStaticOutputs(
  memories: AxisMemoryObject[],
  score: AxisStaticOutputs["score"],
  possession: "HOME" | "AWAY",
): AxisStaticOutputs {
  const players = new Map<string, AxisStaticOutputs["players"][number]>()

  for (const memory of memories) {
    for (const playerId of memory.playerIds) {
      const line =
        players.get(playerId) ??
        {
          id: playerId,
          label: playerId,
          points: 0,
          rebounds: 0,
          assists: 0,
          turnovers: 0,
          fouls: 0,
        }

      if (memory.tags.includes("scoring")) line.points += inferPointValue(memory.label)
      if (memory.tags.includes("rebound")) line.rebounds += 1
      if (memory.tags.includes("assist")) line.assists += 1
      if (memory.tags.includes("turnover")) line.turnovers += 1
      if (memory.tags.includes("foul")) line.fouls += 1
      players.set(playerId, line)
    }
  }

  return {
    score,
    possession: possession === "HOME" ? "home" : "away",
    possessionCount: Math.max(memories.length, 1),
    eventCount: memories.length,
    players: Array.from(players.values()),
  }
}

export function extractContextualOutputs(memories: AxisMemoryObject[]): AxisContextualOutputs {
  const scoring = memories.filter((memory) => memory.tags.includes("scoring"))
  const stops = memories.filter((memory) => memory.tags.includes("stop") || memory.tags.includes("turnover"))
  const rebounds = memories.filter((memory) => memory.tags.includes("rebound"))

  return {
    lastRun: scoring.length >= 2 ? `${scoring.at(-2)?.timestamp} to ${scoring.at(-1)?.timestamp}` : null,
    collapseWindow: stops.length >= 2 ? `${stops[0].timestamp} to ${stops.at(-1)?.timestamp}` : null,
    stabilizationMoment: rebounds[0]?.label ?? stops[0]?.label ?? null,
    pressureShift: stops[0]?.label ?? null,
    playerSequence: memories.find((memory) => memory.playerIds.length)?.playerIds.join(", ") ?? null,
    continuityChain: memories.slice(0, 5).map((memory) => memory.label),
  }
}

export function extractAxisIntelligence(query: string, contextPackage: AxisContextPackage): AxisIntelligenceOutput {
  const memories = contextPackage.recentMemory.lastEvents
  const normalized = query.toLowerCase()
  const contextualOutputs = extractContextualOutputs(memories)

  let answer = memories[0]?.label ?? "No memory yet."

  if (/\b#?4\b/.test(normalized)) {
    const player = contextPackage.staticAnalytics.players.find((line) => line.id === "#4")
    answer = player
      ? `#4: ${player.points} ${plural("point", player.points)}, ${player.rebounds} ${plural("rebound", player.rebounds)}, ${player.turnovers} ${plural("turnover", player.turnovers)}.`
      : "#4 has not appeared in the current memory."
  } else if (/\brebounds?\b|boards?/.test(normalized)) {
    answer = memories.filter((memory) => memory.tags.includes("rebound")).map((memory) => memory.label).join(" / ") || "No rebounds yet."
  } else if (/\blast run|caused the run|momentum|changed/.test(normalized)) {
    answer = contextualOutputs.pressureShift ?? contextualOutputs.stabilizationMoment ?? contextualOutputs.continuityChain[0] ?? answer
  } else if (/\bwhat should we review|review\b/.test(normalized)) {
    answer = contextualOutputs.stabilizationMoment ?? memories.find((memory) => memory.replayAnchor)?.label ?? answer
  } else if (/\bwho scored|points|scored\b/.test(normalized)) {
    answer = memories.filter((memory) => memory.tags.includes("scoring")).map((memory) => memory.label).join(" / ") || "No scoring memory yet."
  }

  return {
    query,
    answer,
    supportingMemoryIds: memories.map((memory) => memory.id),
    staticOutputs: contextPackage.staticAnalytics,
    contextualOutputs,
    memoryOutputs: memories,
  }
}

function inferPointValue(label: string) {
  return /\b3\b|three|right side/i.test(label) ? 3 : 2
}

function plural(label: string, count: number) {
  return count === 1 ? label : `${label}s`
}
