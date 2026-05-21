"use client"

import { create } from "zustand"
import { parseAxisQueryIntent, type AxisQueryIntent, type AxisViewState } from "@/lib/axis/intent"

export type AxisMemoryMoment = {
  id: string
  label: string
  time: string
  score: string
  context: string
  tags: string[]
}

type AxisState = {
  view: AxisViewState
  score: {
    home: number
    away: number
  }
  possession: "HOME" | "AWAY"
  railValue: string
  lastIntent: AxisQueryIntent | null
  memoryFilter: string
  replayFocus: string
  moments: AxisMemoryMoment[]
  setRailValue: (value: string) => void
  submitRail: () => void
  setView: (view: AxisViewState) => void
}

const initialMoments: AxisMemoryMoment[] = [
  {
    id: "m-1",
    label: "Nae rebound, quick outlet",
    time: "02:14",
    score: "8-6",
    context: "possession stayed alive",
    tags: ["rebound", "continuity"],
  },
  {
    id: "m-2",
    label: "Home 3 from the right side",
    time: "03:02",
    score: "11-6",
    context: "run started to open",
    tags: ["scoring", "run"],
  },
  {
    id: "m-3",
    label: "Steal into early replay anchor",
    time: "04:18",
    score: "11-8",
    context: "pressure changed the floor",
    tags: ["stop", "replay"],
  },
]

function nextId() {
  return `m-${Date.now().toString(36)}`
}

export const useAxisStore = create<AxisState>((set, get) => ({
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
  moments: initialMoments,
  setRailValue: (value) => set({ railValue: value }),
  setView: (view) => set({ view }),
  submitRail: () => {
    const state = get()
    const intent = parseAxisQueryIntent(state.railValue, state.view)
    if (!intent) return

    if (intent.kind === "memory") {
      set({
        railValue: "",
        lastIntent: intent,
        moments: [
          {
            id: nextId(),
            label: intent.text,
            time: "now",
            score: `${state.score.home}-${state.score.away}`,
            context: "captured from rail",
            tags: ["memory"],
          },
          ...state.moments,
        ].slice(0, 12),
      })
      return
    }

    set({
      railValue: "",
      lastIntent: intent,
      view: intent.view,
      memoryFilter: intent.kind === "retrieval" ? intent.filter : state.memoryFilter,
      replayFocus: intent.kind === "replay" ? intent.query : state.replayFocus,
    })
  },
}))
