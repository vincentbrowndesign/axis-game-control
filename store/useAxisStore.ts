"use client"

import { create } from "zustand"
import { parseAxisQueryIntent, type AxisQueryIntent, type AxisViewState } from "@/lib/axis/intent"

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

export type AxisOverlayState = null | {
  kind: "inspect" | "continuity" | "replay"
  label: string
}

type AxisState = {
  mode: AxisMode
  replayState: AxisReplayState
  memoryState: AxisMemoryState
  selectedReplay: AxisMemoryNode | null
  activeOverlay: AxisOverlayState
  railState: AxisRailState
  sessionState: AxisSessionState
  setMode: (mode: AxisMode) => void
  setRailValue: (value: string) => void
  setRailFocused: (focused: boolean) => void
  submitRail: () => void

  // Compatibility with the first V2 shell while /axis-shell becomes the new root.
  view: AxisViewState
  score: AxisSessionState["score"]
  possession: AxisSessionState["possession"]
  railValue: string
  lastIntent: AxisQueryIntent | null
  memoryFilter: string
  replayFocus: string
  moments: AxisMemoryMoment[]
  setView: (view: AxisViewState) => void
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
    continuity: "kept the possession connected",
    query: "show rebounds",
  },
  {
    id: "m-2",
    label: "Home 3 from the right side",
    time: "03:02",
    score: "11-6",
    context: "run started to open",
    tags: ["scoring", "run"],
    replayLinked: true,
    continuity: "shifted the floor into a run",
    query: "they scored",
  },
  {
    id: "m-3",
    label: "Steal into early replay anchor",
    time: "04:18",
    score: "11-8",
    context: "pressure changed the floor",
    tags: ["stop", "replay"],
    replayLinked: true,
    continuity: "pressure became retrieval context",
    query: "where was the steal?",
  },
]

function nextId(prefix = "m") {
  return `${prefix}-${Date.now().toString(36)}`
}

function viewFromMode(mode: AxisMode): AxisViewState {
  return mode
}

function segmentLabel(intent: AxisQueryIntent) {
  if (intent.kind === "memory") return "remember"
  if (intent.kind === "retrieval") return "retrieve"
  if (intent.kind === "replay") return intent.action === "anchor" ? "anchor" : "replay"
  if (intent.kind === "inspect") return "inspect"
  return "state"
}

function toMoment(node: AxisMemoryNode): AxisMemoryMoment {
  return {
    id: node.id,
    label: node.label,
    time: node.time,
    score: node.score,
    context: node.context,
    tags: node.tags,
  }
}

export const useAxisStore = create<AxisState>((set, get) => ({
  mode: "memory",
  replayState: {
    status: "ready",
    title: "Latest replay memory",
    timestamp: "04:18",
    memoryId: "m-3",
  },
  memoryState: {
    filter: "all",
    query: "session flow",
    nodes: initialNodes,
  },
  selectedReplay: initialNodes[2],
  activeOverlay: null,
  railState: {
    value: "",
    segments: [
      {
        id: "s-1",
        text: "show last run",
        intent: "retrieve",
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

  view: "memory",
  score: {
    home: 11,
    away: 8,
  },
  possession: "HOME",
  railValue: "",
  lastIntent: null,
  memoryFilter: "all",
  replayFocus: "latest memory",
  moments: initialNodes.map(toMoment),

  setMode: (mode) => set({ mode, view: viewFromMode(mode), activeOverlay: mode === "inspect" ? { kind: "inspect", label: "Form context" } : null }),
  setView: (view) => set({ view, mode: view }),
  setRailFocused: (focused) =>
    set((state) => ({
      railState: {
        ...state.railState,
        focused,
      },
    })),
  setRailValue: (value) =>
    set((state) => ({
      railValue: value,
      railState: {
        ...state.railState,
        value,
      },
    })),
  submitRail: () => {
    const state = get()
    const value = state.railState.value || state.railValue
    const intent = parseAxisQueryIntent(value, state.mode)
    if (!intent) return

    const nextSegment: AxisRailSegment = {
      id: nextId("s"),
      text: value.trim(),
      intent: segmentLabel(intent),
      createdAt: "now",
    }

    if (intent.kind === "memory") {
      const node: AxisMemoryNode = {
        id: nextId(),
        label: intent.text,
        time: "now",
        score: `${state.sessionState.score.home}-${state.sessionState.score.away}`,
        context: "captured from the rail",
        tags: ["memory"],
        replayLinked: false,
        continuity: "new memory waiting for reinforcement",
        query: intent.text,
      }

      const nodes = [node, ...state.memoryState.nodes].slice(0, 16)
      set({
        railValue: "",
        lastIntent: intent,
        moments: nodes.map(toMoment),
        memoryState: {
          ...state.memoryState,
          nodes,
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

    if (intent.kind === "retrieval") {
      set({
        mode: "memory",
        view: "memory",
        railValue: "",
        lastIntent: intent,
        memoryFilter: intent.filter,
        memoryState: {
          ...state.memoryState,
          filter: intent.filter,
          query: intent.query,
        },
        railState: {
          ...state.railState,
          value: "",
          segments: [nextSegment, ...state.railState.segments].slice(0, 5),
        },
      })
      return
    }

    if (intent.kind === "replay") {
      const selectedReplay = state.memoryState.nodes.find((node) => node.replayLinked) ?? state.memoryState.nodes[0] ?? null
      set({
        mode: "replay",
        view: "replay",
        railValue: "",
        lastIntent: intent,
        replayFocus: intent.query,
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
      set({
        mode: "inspect",
        view: "inspect",
        railValue: "",
        lastIntent: intent,
        activeOverlay: {
          kind: "inspect",
          label: intent.query,
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
      view: intent.view,
      railValue: "",
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
