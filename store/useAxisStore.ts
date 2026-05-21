"use client"

import { create } from "zustand"
import { parseAxisQueryIntent, type AxisQueryIntent } from "@/lib/axis/intent"
import type { AxisIntelligenceResponse } from "@/lib/axis/intelligence"
import { buildPoseOverlay, type AxisMemoryOverlayEnrichment, type AxisOverlayState } from "@/lib/axis/overlays"
import { createAxisEvent, type AxisChronologyEvent } from "@/lib/axis/state/eventLog"
import { rebuildState, type AxisRebuiltState } from "@/lib/axis/state/rebuildState"
import { createReplayAnchorEvent } from "@/lib/axis/state/replayChronology"
import { parseRewindTransition, rewindTransition } from "@/lib/axis/state/rewindTransition"
import type { AxisMemoryObject } from "@/lib/axis/types"

export type AxisMode = "live" | "memory" | "replay" | "inspect"

export type AxisMemoryMoment = {
  id: string
  label: string
  time: string
  score: string
  context: string
  tags: string[]
}

export type AxisMemoryNode = AxisMemoryMoment & {
  replayLinked: boolean
  continuity: string
  query: string
  enrichments: AxisMemoryOverlayEnrichment[]
}

export type AxisReplayState = {
  status: "idle" | "ready" | "anchored"
  title: string
  timestamp: string
  memoryId: string | null
}

export type AxisMemoryState = {
  filter: string
  query: string
  nodes: AxisMemoryNode[]
  output: AxisIntelligenceResponse | null
  loading: boolean
}

export type AxisRailSegment = {
  id: string
  text: string
  intent: string
  createdAt: string
}

export type AxisRailState = {
  value: string
  segments: AxisRailSegment[]
  focused: boolean
}

export type AxisSessionState = {
  label: string
  quarter: string
  possession: "HOME" | "AWAY"
  continuity: string
  score: {
    home: number
    away: number
  }
}

type AxisState = {
  mode: AxisMode
  eventLog: AxisChronologyEvent[]
  replayState: AxisReplayState
  memoryState: AxisMemoryState
  selectedReplay: AxisMemoryNode | null
  activeOverlay: AxisOverlayState | null
  railState: AxisRailState
  sessionState: AxisSessionState
  setMode: (mode: AxisMode) => void
  setRailValue: (value: string) => void
  setRailFocused: (focused: boolean) => void
  dismissOverlay: () => void
  submitRail: () => Promise<void>
  lastIntent: AxisQueryIntent | null
}

const initialNodes: AxisMemoryNode[] = [
  {
    id: "m-1",
    label: "Nae rebound, quick outlet",
    time: "02:14",
    score: "8-6",
    context: "possession stayed alive",
    tags: ["rebound", "continuity"],
    replayLinked: true,
    continuity: "replay",
    query: "show rebounds",
    enrichments: [],
  },
  {
    id: "m-2",
    label: "Home 3 from the right side",
    time: "03:02",
    score: "11-6",
    context: "run started to open",
    tags: ["scoring", "run"],
    replayLinked: true,
    continuity: "replay",
    query: "they scored",
    enrichments: [],
  },
  {
    id: "m-3",
    label: "Steal into early replay anchor",
    time: "04:18",
    score: "11-8",
    context: "pressure changed the floor",
    tags: ["stop", "replay"],
    replayLinked: true,
    continuity: "replay",
    query: "where was the steal?",
    enrichments: [],
  },
]

function nextId(prefix = "m") {
  return `${prefix}-${Date.now().toString(36)}`
}

function segmentLabel(intent: AxisQueryIntent) {
  if (intent.kind === "rewind") return "memory"
  if (intent.kind === "memory") return "memory"
  if (intent.kind === "retrieval") return "memory"
  if (intent.kind === "analytics") return "memory"
  if (intent.kind === "replay") return intent.action === "anchor" ? "anchor" : "replay"
  if (intent.kind === "inspect") return "inspect"
  return "axis"
}

function toMemoryObject(node: AxisMemoryNode): AxisMemoryObject {
  return {
    id: node.id,
    label: node.label,
    timestamp: node.time,
    scoreState: node.score,
    playerIds: inferPlayers(node.label),
    eventLabel: node.tags[0] ?? "memory",
    replayAnchor: node.replayLinked ? node.id : null,
    tags: node.tags,
  }
}

function inferPlayers(label: string) {
  const ids = new Set<string>()
  if (/\bnae\b/i.test(label)) ids.add("Nae")
  const jerseyMatches = label.match(/#\d+/g) ?? []
  for (const match of jerseyMatches) ids.add(match)
  if (!ids.size && /\bhome\b/i.test(label)) ids.add("Home")
  return Array.from(ids)
}

function inferTags(text: string) {
  const normalized = text.toLowerCase()
  const tags = new Set<string>(["memory"])
  if (/\brebounds?\b|\bboards?\b/.test(normalized)) tags.add("rebound")
  if (/\bassist\b/.test(normalized)) tags.add("assist")
  if (/\bturnover\b/.test(normalized)) tags.add("turnover")
  if (/\bfoul\b/.test(normalized)) tags.add("foul")
  if (/\bsteal|block|stop\b/.test(normalized)) tags.add("stop")
  if (/\bscored|score|bucket|three|3\b/.test(normalized)) tags.add("scoring")
  if (/\breplay|clip|anchor\b/.test(normalized)) tags.add("replay")
  return Array.from(tags)
}

function toTeamPossession(team: AxisRebuiltState["possession"]): AxisSessionState["possession"] {
  return team === "home" ? "HOME" : "AWAY"
}

function continuityLabel(rebuilt: AxisRebuiltState) {
  if (rebuilt.continuity.stabilizationMoment) return rebuilt.continuity.stabilizationMoment
  if (rebuilt.continuity.pressure === "rising") return "pressure rising"
  if (rebuilt.continuity.pressure === "swinging") return "momentum moving"
  return "settled"
}

function fromMemoryObject(memory: AxisMemoryObject): AxisMemoryNode {
  return {
    id: memory.id,
    label: memory.label,
    time: memory.timestamp,
    score: memory.scoreState,
    context: memory.eventLabel,
    tags: memory.tags,
    replayLinked: Boolean(memory.replayAnchor),
    continuity: memory.tags.includes("replay") ? "replay" : "memory",
    query: memory.label,
    enrichments: [],
  }
}

function applyRebuiltState(state: AxisState, eventLog: AxisChronologyEvent[], mode = state.mode) {
  const enrichmentById = new Map(state.memoryState.nodes.map((node) => [node.id, node.enrichments]))
  const rebuilt = rebuildState(eventLog, {
    mode,
    initialScore: {
      home: 0,
      away: 0,
    },
    initialPossession: "home",
  })
  const nodes = rebuilt.memories
    .map((memory) => ({
      ...fromMemoryObject(memory),
      enrichments: enrichmentById.get(memory.id) ?? [],
    }))
    .reverse()
    .slice(0, 16)
  const selectedReplay = nodes.find((node) => node.replayLinked) ?? nodes[0] ?? null

  return {
    eventLog,
    mode,
    selectedReplay,
    sessionState: {
      ...state.sessionState,
      possession: toTeamPossession(rebuilt.possession),
      continuity: continuityLabel(rebuilt),
      score: rebuilt.score,
    },
    replayState: {
      ...state.replayState,
      title: rebuilt.replayChronology.latestAnchor?.label ?? state.replayState.title,
      timestamp: rebuilt.replayChronology.latestAnchor?.timestamp ?? state.replayState.timestamp,
      memoryId: rebuilt.replayChronology.latestAnchor?.memoryId ?? state.replayState.memoryId,
    },
    memoryState: {
      ...state.memoryState,
      nodes,
      output: null,
    },
  }
}

const initialEvents: AxisChronologyEvent[] = [
  createAxisEvent(
    {
      type: "score.initialized",
      score: {
        home: 11,
        away: 8,
      },
    },
    {
      createdAt: "2026-01-01T00:00:00.000Z",
      gameTime: "00:00",
      period: "Q1",
      source: "system",
      query: "session score",
    },
  ),
  createAxisEvent(
    {
      type: "memory.recorded",
      label: "Nae rebound, quick outlet",
      scoreState: "8-6",
      playerIds: ["Nae"],
      tags: ["memory", "rebound", "continuity", "replay"],
    },
    {
      createdAt: "2026-01-01T00:02:14.000Z",
      gameTime: "02:14",
      period: "Q1",
      source: "system",
      query: "show rebounds",
    },
  ),
  createAxisEvent(
    {
      type: "memory.recorded",
      label: "Home 3 from the right side",
      scoreState: "11-6",
      playerIds: ["Home"],
      tags: ["memory", "scoring", "run", "replay"],
    },
    {
      createdAt: "2026-01-01T00:03:02.000Z",
      gameTime: "03:02",
      period: "Q1",
      source: "system",
      query: "they scored",
    },
  ),
  createAxisEvent(
    {
      type: "memory.recorded",
      label: "Steal into early replay anchor",
      scoreState: "11-8",
      playerIds: [],
      tags: ["memory", "stop", "replay"],
    },
    {
      createdAt: "2026-01-01T00:04:18.000Z",
      gameTime: "04:18",
      period: "Q1",
      source: "system",
      query: "where was the steal?",
    },
  ),
]

const initialRebuilt = rebuildState(initialEvents, {
  initialScore: {
    home: 0,
    away: 0,
  },
  initialPossession: "home",
})
const initialMemoryNodes = initialRebuilt.memories.map(fromMemoryObject).reverse()

export const useAxisStore = create<AxisState>((set, get) => ({
  mode: "memory",
  eventLog: initialEvents,
  replayState: {
    status: "ready",
    title: initialMemoryNodes[0]?.label ?? "Latest replay memory",
    timestamp: initialMemoryNodes[0]?.time ?? "04:18",
    memoryId: initialMemoryNodes[0]?.id ?? "m-3",
  },
  memoryState: {
    filter: "all",
    query: "session flow",
    nodes: initialMemoryNodes,
    output: null,
    loading: false,
  },
  selectedReplay: initialMemoryNodes[0] ?? initialNodes[2],
  activeOverlay: null,
  railState: {
    value: "",
    segments: [
      {
        id: "s-1",
        text: "show last run",
        intent: "memory",
        createdAt: "now",
      },
    ],
    focused: false,
  },
  sessionState: {
    label: "Open run",
    quarter: "Q1",
    possession: "HOME",
    continuity: "pressure rising",
    score: {
      home: 11,
      away: 8,
    },
  },
  lastIntent: null,

  setMode: (mode) =>
    set({
      mode,
      activeOverlay: null,
    }),
  dismissOverlay: () => set({ activeOverlay: null }),
  setRailFocused: (focused) =>
    set((state) => ({
      railState: {
        ...state.railState,
        focused,
      },
    })),
  setRailValue: (value) =>
    set((state) => ({
      railState: {
        ...state.railState,
        value,
      },
    })),
  submitRail: async () => {
    const state = get()
    const value = state.railState.value
    const intent = parseAxisQueryIntent(value, state.mode)
    if (!intent) return

    const nextSegment: AxisRailSegment = {
      id: nextId("s"),
      text: value.trim(),
      intent: segmentLabel(intent),
      createdAt: "now",
    }

    if (intent.kind === "memory") {
      const event = createAxisEvent(
        {
          type: "memory.recorded",
          label: intent.text,
          scoreState: `${state.sessionState.score.home}-${state.sessionState.score.away}`,
          playerIds: inferPlayers(intent.text),
          tags: inferTags(intent.text),
        },
        {
          gameTime: "now",
          period: state.sessionState.quarter,
          source: "rail",
          query: intent.text,
        },
      )
      const eventLog = [...state.eventLog, event]
      set({
        ...applyRebuiltState(state, eventLog),
        lastIntent: intent,
        memoryState: {
          ...applyRebuiltState(state, eventLog).memoryState,
          query: intent.text,
        },
        railState: {
          ...state.railState,
          value: "",
          segments: [nextSegment, ...state.railState.segments].slice(0, 5),
        },
      })
      return
    }

    if (intent.kind === "rewind") {
      const transition = parseRewindTransition(intent.query)
      const result = transition ? rewindTransition(state.eventLog, transition) : null
      const eventLog = result?.events ?? state.eventLog

      set({
        ...applyRebuiltState(state, eventLog),
        lastIntent: intent,
        railState: {
          ...state.railState,
          value: "",
          segments: [nextSegment, ...state.railState.segments].slice(0, 5),
        },
      })
      return
    }

    if (intent.kind === "retrieval" || intent.kind === "analytics") {
      const query = intent.query
      set({
        mode: "memory",
        lastIntent: intent,
        memoryState: {
          ...state.memoryState,
          filter: intent.kind === "retrieval" ? intent.filter : state.memoryState.filter,
          query,
          loading: true,
        },
        railState: {
          ...state.railState,
          value: "",
          segments: [nextSegment, ...state.railState.segments].slice(0, 5),
        },
      })

      const latest = get()
      try {
        const response = await fetch("/api/axis/query", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            mode: latest.mode,
            query,
            session: latest.sessionState,
            eventLog: latest.eventLog,
            memories: latest.memoryState.nodes.map(toMemoryObject),
          }),
        })
        const output = (await response.json()) as AxisIntelligenceResponse
        set((current) => ({
          memoryState: {
            ...current.memoryState,
            output,
            loading: false,
          },
        }))
      } catch {
        set((current) => ({
          memoryState: {
            ...current.memoryState,
            loading: false,
          },
        }))
      }
      return
    }

    if (intent.kind === "replay") {
      const selectedReplay = state.memoryState.nodes.find((node) => node.replayLinked) ?? state.memoryState.nodes[0] ?? null
      const replayEvent = selectedReplay ? createReplayAnchorEvent(toMemoryObject(selectedReplay)) : null
      const eventLog = replayEvent ? [...state.eventLog, replayEvent] : state.eventLog
      set({
        eventLog,
        mode: "replay",
        lastIntent: intent,
        selectedReplay,
        replayState: {
          status: intent.action === "anchor" ? "anchored" : "ready",
          title: intent.query || selectedReplay?.label || "Replay memory",
          timestamp: selectedReplay?.time ?? "now",
          memoryId: selectedReplay?.id ?? null,
        },
        railState: {
          ...state.railState,
          value: "",
          segments: [nextSegment, ...state.railState.segments].slice(0, 5),
        },
      })
      return
    }

    if (intent.kind === "inspect") {
      const targetMemory = state.selectedReplay ?? state.memoryState.nodes[0] ?? null
      const overlay = buildPoseOverlay(targetMemory ? toMemoryObject(targetMemory) : null, intent.query)
      const nodes = targetMemory
        ? state.memoryState.nodes.map((node) =>
            node.id === targetMemory.id
              ? {
                  ...node,
                  enrichments: [
                    {
                      overlayId: overlay.id,
                      label: overlay.label,
                      output: overlay.output,
                    },
                    ...node.enrichments,
                  ].slice(0, 4),
                }
              : node,
          )
        : state.memoryState.nodes

      set({
        lastIntent: intent,
        activeOverlay: overlay,
        memoryState: {
          ...state.memoryState,
          nodes,
        },
        railState: {
          ...state.railState,
          value: "",
          segments: [nextSegment, ...state.railState.segments].slice(0, 5),
        },
      })
      return
    }

    set({
      mode: intent.view,
      lastIntent: intent,
      activeOverlay: null,
      railState: {
        ...state.railState,
        value: "",
        segments: [nextSegment, ...state.railState.segments].slice(0, 5),
      },
    })
  },
}))
