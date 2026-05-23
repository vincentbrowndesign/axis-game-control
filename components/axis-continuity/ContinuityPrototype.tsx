"use client"

import { buildAbstractReplayFrame, createAbstractReplayState, type AbstractReplayFrame, type AbstractReplayState } from "@/lib/axis/abstractReplay"
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

type PuckSymbol = "O" | "X"
type SpatialStateName = string
type TacticalCategory = "Offense" | "Defense" | "SLOB" | "ATO" | "Tempo" | "Emphasis"
type ActiveConditions = Partial<Record<TacticalCategory, string>>

type Point = {
  pressure: number
  t: number
  x: number
  y: number
}

type TrailPoint = {
  t: number
  x: number
  y: number
}

type Choreography = {
  delay: number
  duration: number
  from: Point
  startedAt: number
  to: Point
}

type MemoryEvent =
  | {
      at: number
      from: Point
      id: string
      kind: "move"
      puckId: string
      symbol: PuckSymbol
      to: Point
    }

type Puck = {
  baseX: number
  baseY: number
  bornAt: number
  choreography: Choreography | null
  id: string
  symbol: PuckSymbol
  targetX: number
  targetY: number
  trail: TrailPoint[]
  vx: number
  vy: number
  x: number
  y: number
}

type SpatialState = {
  category?: TacticalCategory
  id?: string
  name: SpatialStateName
  pucks: Record<string, { x: number; y: number }>
}

type ContinuityCell = {
  key: string
  lastSeen: number
  pressure: number
  symbol: PuckSymbol | "pressure"
  visits: number
  x: number
  y: number
}

type Engine = {
  activePointerId: number | null
  activePointerType: string | null
  abstractReplayFrames: AbstractReplayFrame[]
  abstractReplayState: AbstractReplayState
  advantageFlash: TrailPoint | null
  conditions: ActiveConditions
  draggingPuckId: string | null
  formationPulseAt: number
  lastAbstractReplayAt: number
  moved: boolean
  penActiveUntil: number
  pucks: Puck[]
  rafId: number
  rect: DOMRect | null
  continuityCells: ContinuityCell[]
  sessionMemory: MemoryEvent[]
  touchStart: Point | null
}

const initialPucks: Puck[] = [
  makePuck("o1", "O", 0.5, 0.24),
  makePuck("o2", "O", 0.37, 0.48),
  makePuck("o3", "O", 0.63, 0.48),
  makePuck("o4", "O", 0.18, 0.78),
  makePuck("o5", "O", 0.82, 0.78),
  makePuck("x1", "X", 0.5, 0.34),
  makePuck("x2", "X", 0.39, 0.56),
  makePuck("x3", "X", 0.61, 0.56),
  makePuck("x4", "X", 0.24, 0.8),
  makePuck("x5", "X", 0.76, 0.8),
]

const spatialStates: SpatialState[] = [
  {
    name: "Horns",
    pucks: {
      o1: { x: 0.5, y: 0.24 },
      o2: { x: 0.37, y: 0.48 },
      o3: { x: 0.63, y: 0.48 },
      o4: { x: 0.18, y: 0.78 },
      o5: { x: 0.82, y: 0.78 },
      x1: { x: 0.5, y: 0.34 },
      x2: { x: 0.39, y: 0.56 },
      x3: { x: 0.61, y: 0.56 },
      x4: { x: 0.24, y: 0.8 },
      x5: { x: 0.76, y: 0.8 },
    },
  },
  {
    name: "5-Out",
    pucks: {
      o1: { x: 0.5, y: 0.22 },
      o2: { x: 0.24, y: 0.42 },
      o3: { x: 0.76, y: 0.42 },
      o4: { x: 0.16, y: 0.78 },
      o5: { x: 0.84, y: 0.78 },
      x1: { x: 0.5, y: 0.34 },
      x2: { x: 0.29, y: 0.5 },
      x3: { x: 0.71, y: 0.5 },
      x4: { x: 0.23, y: 0.74 },
      x5: { x: 0.77, y: 0.74 },
    },
  },
  {
    name: "Delay",
    pucks: {
      o1: { x: 0.5, y: 0.3 },
      o2: { x: 0.24, y: 0.48 },
      o3: { x: 0.76, y: 0.48 },
      o4: { x: 0.34, y: 0.74 },
      o5: { x: 0.66, y: 0.74 },
      x1: { x: 0.5, y: 0.4 },
      x2: { x: 0.31, y: 0.54 },
      x3: { x: 0.69, y: 0.54 },
      x4: { x: 0.39, y: 0.76 },
      x5: { x: 0.61, y: 0.76 },
    },
  },
  {
    name: "Spain",
    pucks: {
      o1: { x: 0.5, y: 0.25 },
      o2: { x: 0.5, y: 0.52 },
      o3: { x: 0.5, y: 0.66 },
      o4: { x: 0.17, y: 0.78 },
      o5: { x: 0.83, y: 0.78 },
      x1: { x: 0.5, y: 0.35 },
      x2: { x: 0.48, y: 0.58 },
      x3: { x: 0.54, y: 0.72 },
      x4: { x: 0.24, y: 0.76 },
      x5: { x: 0.76, y: 0.76 },
    },
  },
  {
    category: "Defense",
    name: "Shell",
    pucks: {
      o1: { x: 0.5, y: 0.28 },
      o2: { x: 0.27, y: 0.48 },
      o3: { x: 0.73, y: 0.48 },
      o4: { x: 0.28, y: 0.76 },
      o5: { x: 0.72, y: 0.76 },
      x1: { x: 0.5, y: 0.4 },
      x2: { x: 0.35, y: 0.55 },
      x3: { x: 0.65, y: 0.55 },
      x4: { x: 0.39, y: 0.73 },
      x5: { x: 0.61, y: 0.73 },
    },
  },
  {
    name: "Princeton",
    pucks: {
      o1: { x: 0.5, y: 0.3 },
      o2: { x: 0.24, y: 0.48 },
      o3: { x: 0.76, y: 0.48 },
      o4: { x: 0.38, y: 0.72 },
      o5: { x: 0.62, y: 0.72 },
      x1: { x: 0.5, y: 0.39 },
      x2: { x: 0.32, y: 0.54 },
      x3: { x: 0.68, y: 0.54 },
      x4: { x: 0.42, y: 0.75 },
      x5: { x: 0.58, y: 0.75 },
    },
  },
  {
    name: "Flex",
    pucks: {
      o1: { x: 0.5, y: 0.24 },
      o2: { x: 0.18, y: 0.58 },
      o3: { x: 0.82, y: 0.58 },
      o4: { x: 0.36, y: 0.78 },
      o5: { x: 0.64, y: 0.78 },
      x1: { x: 0.5, y: 0.34 },
      x2: { x: 0.27, y: 0.62 },
      x3: { x: 0.73, y: 0.62 },
      x4: { x: 0.4, y: 0.8 },
      x5: { x: 0.6, y: 0.8 },
    },
  },
  {
    name: "Zoom",
    pucks: {
      o1: { x: 0.66, y: 0.28 },
      o2: { x: 0.34, y: 0.42 },
      o3: { x: 0.82, y: 0.72 },
      o4: { x: 0.2, y: 0.78 },
      o5: { x: 0.56, y: 0.58 },
      x1: { x: 0.64, y: 0.38 },
      x2: { x: 0.38, y: 0.5 },
      x3: { x: 0.76, y: 0.72 },
      x4: { x: 0.26, y: 0.76 },
      x5: { x: 0.55, y: 0.66 },
    },
  },
  {
    name: "Pistol",
    pucks: {
      o1: { x: 0.34, y: 0.28 },
      o2: { x: 0.22, y: 0.48 },
      o3: { x: 0.76, y: 0.44 },
      o4: { x: 0.18, y: 0.78 },
      o5: { x: 0.68, y: 0.76 },
      x1: { x: 0.38, y: 0.38 },
      x2: { x: 0.29, y: 0.53 },
      x3: { x: 0.71, y: 0.5 },
      x4: { x: 0.24, y: 0.77 },
      x5: { x: 0.64, y: 0.74 },
    },
  },
  {
    name: "Chin",
    pucks: {
      o1: { x: 0.5, y: 0.28 },
      o2: { x: 0.25, y: 0.54 },
      o3: { x: 0.75, y: 0.54 },
      o4: { x: 0.38, y: 0.74 },
      o5: { x: 0.62, y: 0.74 },
      x1: { x: 0.5, y: 0.38 },
      x2: { x: 0.32, y: 0.58 },
      x3: { x: 0.68, y: 0.58 },
      x4: { x: 0.42, y: 0.76 },
      x5: { x: 0.58, y: 0.76 },
    },
  },
  {
    name: "Split",
    pucks: {
      o1: { x: 0.42, y: 0.3 },
      o2: { x: 0.22, y: 0.58 },
      o3: { x: 0.78, y: 0.58 },
      o4: { x: 0.48, y: 0.76 },
      o5: { x: 0.62, y: 0.46 },
      x1: { x: 0.44, y: 0.4 },
      x2: { x: 0.3, y: 0.62 },
      x3: { x: 0.7, y: 0.62 },
      x4: { x: 0.5, y: 0.78 },
      x5: { x: 0.61, y: 0.54 },
    },
  },
  {
    name: "Motion",
    pucks: {
      o1: { x: 0.5, y: 0.24 },
      o2: { x: 0.26, y: 0.44 },
      o3: { x: 0.74, y: 0.44 },
      o4: { x: 0.3, y: 0.78 },
      o5: { x: 0.7, y: 0.78 },
      x1: { x: 0.5, y: 0.36 },
      x2: { x: 0.34, y: 0.51 },
      x3: { x: 0.66, y: 0.51 },
      x4: { x: 0.38, y: 0.76 },
      x5: { x: 0.62, y: 0.76 },
    },
  },
  {
    name: "UCLA",
    pucks: {
      o1: { x: 0.42, y: 0.26 },
      o2: { x: 0.23, y: 0.52 },
      o3: { x: 0.77, y: 0.52 },
      o4: { x: 0.5, y: 0.74 },
      o5: { x: 0.62, y: 0.44 },
      x1: { x: 0.44, y: 0.36 },
      x2: { x: 0.31, y: 0.57 },
      x3: { x: 0.69, y: 0.57 },
      x4: { x: 0.5, y: 0.76 },
      x5: { x: 0.59, y: 0.52 },
    },
  },
  {
    name: "Ghost",
    pucks: {
      o1: { x: 0.53, y: 0.24 },
      o2: { x: 0.36, y: 0.5 },
      o3: { x: 0.78, y: 0.48 },
      o4: { x: 0.18, y: 0.78 },
      o5: { x: 0.58, y: 0.56 },
      x1: { x: 0.52, y: 0.35 },
      x2: { x: 0.39, y: 0.56 },
      x3: { x: 0.72, y: 0.54 },
      x4: { x: 0.25, y: 0.76 },
      x5: { x: 0.57, y: 0.64 },
    },
  },
  {
    name: "Chicago",
    pucks: {
      o1: { x: 0.58, y: 0.28 },
      o2: { x: 0.24, y: 0.45 },
      o3: { x: 0.72, y: 0.48 },
      o4: { x: 0.2, y: 0.78 },
      o5: { x: 0.44, y: 0.58 },
      x1: { x: 0.58, y: 0.38 },
      x2: { x: 0.31, y: 0.52 },
      x3: { x: 0.68, y: 0.55 },
      x4: { x: 0.27, y: 0.77 },
      x5: { x: 0.45, y: 0.66 },
    },
  },
  {
    name: "Hammer",
    pucks: {
      o1: { x: 0.3, y: 0.32 },
      o2: { x: 0.16, y: 0.62 },
      o3: { x: 0.84, y: 0.78 },
      o4: { x: 0.72, y: 0.5 },
      o5: { x: 0.46, y: 0.74 },
      x1: { x: 0.34, y: 0.42 },
      x2: { x: 0.25, y: 0.63 },
      x3: { x: 0.78, y: 0.75 },
      x4: { x: 0.67, y: 0.56 },
      x5: { x: 0.48, y: 0.77 },
    },
  },
  ...buildGlossaryStates("Offense", ["Drag", "Elbow", "Empty", "Iverson", "Stagger", "Stack", "Wide", "Flow", "DHO", "Iso", "Post Split", "High-Low"], "Motion"),
  ...buildGlossaryStates(
    "Defense",
    [
      "Switch",
      "ICE",
      "Drop",
      "Hedge",
      "Blitz",
      "Show",
      "Gap",
      "Weak",
      "Strong",
      "Deny",
      "Pack",
      "Zone",
      "Matchup",
      "Press",
      "Full Court",
      "Half Court",
      "Trap",
      "Scramble",
      "Recover",
      "Nail Help",
      "Shrink",
      "Peel",
      "X-Out",
    ],
    "Shell",
  ),
  ...buildGlossaryStates("SLOB", ["Box", "Stack", "Elevator", "Screen-The-Screener", "Hammer", "Lob", "Slip", "Decoy", "Quick", "Safety", "BLOB Flow", "Wide Entry"], "Flex"),
  ...buildGlossaryStates(
    "ATO",
    ["Quick Hit", "Misdirection", "Delay Counter", "Empty Action", "Spain Counter", "Ghost Counter", "Late Clock", "Need 3", "Advance", "Last Shot", "Foul Up 3", "Kill Momentum", "Two-for-One"],
    "Spain",
  ),
  ...buildGlossaryStates("Tempo", ["Fast", "Controlled", "Flowing", "Patient", "Push", "Early", "Delay", "Organized", "Scramble", "Halfcourt", "Transition"], "5-Out"),
  ...buildGlossaryStates(
    "Emphasis",
    ["Keep Width", "Touch Paint", "Sprint Lanes", "Protect Nail", "Stay Connected", "Early Help", "Shrink Gaps", "Push Pace", "Win Glass", "No Empty Trips", "Paint Collapse", "Weakside Ready", "Shot Discipline", "Kill Middle"],
    "Shell",
  ),
]

function buildGlossaryStates(category: TacticalCategory, names: string[], template: "5-Out" | "Flex" | "Motion" | "Shell" | "Spain"): SpatialState[] {
  return names.map((name, index) => ({
    category,
    id: `${category}:${name}`,
    name,
    pucks: tacticalTemplate(template, index),
  }))
}

function tacticalTemplate(template: "5-Out" | "Flex" | "Motion" | "Shell" | "Spain", index: number) {
  const drift = ((index % 5) - 2) * 0.012
  const lift = ((index % 3) - 1) * 0.01
  const base =
    template === "5-Out"
      ? {
          o1: { x: 0.5, y: 0.22 },
          o2: { x: 0.24, y: 0.42 },
          o3: { x: 0.76, y: 0.42 },
          o4: { x: 0.16, y: 0.78 },
          o5: { x: 0.84, y: 0.78 },
          x1: { x: 0.5, y: 0.34 },
          x2: { x: 0.29, y: 0.5 },
          x3: { x: 0.71, y: 0.5 },
          x4: { x: 0.23, y: 0.74 },
          x5: { x: 0.77, y: 0.74 },
        }
      : template === "Flex"
        ? {
            o1: { x: 0.5, y: 0.24 },
            o2: { x: 0.18, y: 0.58 },
            o3: { x: 0.82, y: 0.58 },
            o4: { x: 0.36, y: 0.78 },
            o5: { x: 0.64, y: 0.78 },
            x1: { x: 0.5, y: 0.34 },
            x2: { x: 0.27, y: 0.62 },
            x3: { x: 0.73, y: 0.62 },
            x4: { x: 0.4, y: 0.8 },
            x5: { x: 0.6, y: 0.8 },
          }
        : template === "Spain"
          ? {
              o1: { x: 0.5, y: 0.25 },
              o2: { x: 0.5, y: 0.52 },
              o3: { x: 0.5, y: 0.66 },
              o4: { x: 0.17, y: 0.78 },
              o5: { x: 0.83, y: 0.78 },
              x1: { x: 0.5, y: 0.35 },
              x2: { x: 0.48, y: 0.58 },
              x3: { x: 0.54, y: 0.72 },
              x4: { x: 0.24, y: 0.76 },
              x5: { x: 0.76, y: 0.76 },
            }
          : template === "Motion"
            ? {
                o1: { x: 0.5, y: 0.24 },
                o2: { x: 0.26, y: 0.44 },
                o3: { x: 0.74, y: 0.44 },
                o4: { x: 0.3, y: 0.78 },
                o5: { x: 0.7, y: 0.78 },
                x1: { x: 0.5, y: 0.36 },
                x2: { x: 0.34, y: 0.51 },
                x3: { x: 0.66, y: 0.51 },
                x4: { x: 0.38, y: 0.76 },
                x5: { x: 0.62, y: 0.76 },
              }
            : {
                o1: { x: 0.5, y: 0.28 },
                o2: { x: 0.27, y: 0.48 },
                o3: { x: 0.73, y: 0.48 },
                o4: { x: 0.28, y: 0.76 },
                o5: { x: 0.72, y: 0.76 },
                x1: { x: 0.5, y: 0.4 },
                x2: { x: 0.35, y: 0.55 },
                x3: { x: 0.65, y: 0.55 },
                x4: { x: 0.39, y: 0.73 },
                x5: { x: 0.61, y: 0.73 },
              }

  return Object.fromEntries(Object.entries(base).map(([id, point]) => [id, { x: clamp(point.x + drift, 0.12, 0.88), y: clamp(point.y + lift, 0.16, 0.86) }]))
}

function stateKey(state: SpatialState) {
  return state.id ?? `${state.category ?? "Offense"}:${state.name}`
}

const initialConditions: ActiveConditions = {
  Defense: "Shell",
  Emphasis: "Keep Width",
  Offense: "Horns",
  Tempo: "Controlled",
}

function conditionSummary(conditions: ActiveConditions): Array<[TacticalCategory, string]> {
  return (["Offense", "Defense", "Emphasis", "Tempo"] as TacticalCategory[])
    .map((category) => [category, conditions[category]] as [TacticalCategory, string | undefined])
    .filter((item): item is [TacticalCategory, string] => Boolean(item[1]))
}

export function ContinuityPrototype() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const [activeConditions, setActiveConditions] = useState<ActiveConditions>(initialConditions)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasElement: HTMLCanvasElement = canvas

    const canvasContext = canvasElement.getContext("2d", { alpha: false })
    if (!canvasContext) return
    const context: CanvasRenderingContext2D = canvasContext

    const engine: Engine = {
      activePointerId: null,
      activePointerType: null,
      abstractReplayFrames: [],
      abstractReplayState: createAbstractReplayState(),
      advantageFlash: null,
      conditions: initialConditions,
      draggingPuckId: null,
      formationPulseAt: -10000,
      lastAbstractReplayAt: 0,
      moved: false,
      penActiveUntil: 0,
      pucks: clonePucks(initialPucks),
      rafId: 0,
      rect: null,
      continuityCells: [],
      sessionMemory: [],
      touchStart: null,
    }
    engineRef.current = engine

    function resize() {
      const rect = canvasElement.getBoundingClientRect()
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      engine.rect = rect
      resizeCanvas(canvasElement, rect, dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function frame() {
      updatePhysics(engine)
      render(context, engine, canvasElement)
      engine.rafId = window.requestAnimationFrame(frame)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvasElement)
    resize()
    frame()

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(engine.rafId)
      engineRef.current = null
    }
  }, [])

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const engine = engineRef.current
    if (!engine) return
    event.preventDefault()

    if (event.pointerType === "pen") {
      engine.penActiveUntil = performance.now() + 900
    }

    if (event.pointerType === "touch" && performance.now() < engine.penActiveUntil) return
    if (engine.activePointerId !== null && event.pointerType === "touch") return

    const point = eventPoint(event, engine)
    if (!point) return

    const puck = findPuckAt(engine, point)
    if (!puck) return

    engine.activePointerId = event.pointerId
    engine.activePointerType = event.pointerType
    engine.moved = false
    engine.touchStart = point
    event.currentTarget.setPointerCapture(event.pointerId)

    if (puck) {
      engine.draggingPuckId = puck.id
      puck.choreography = null
      puck.targetX = point.x
      puck.targetY = point.y
      puck.x = point.x
      puck.y = point.y
      puck.vx = 0
      puck.vy = 0
      return
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const engine = engineRef.current
    if (!engine || engine.activePointerId !== event.pointerId) return
    event.preventDefault()

    engine.moved = true

    if (engine.draggingPuckId) {
      const point = eventPoint(event, engine)
      if (!point) return
      engine.moved = true
      const puck = engine.pucks.find((item) => item.id === engine.draggingPuckId)
      if (puck) {
        puck.baseX = point.x
        puck.baseY = point.y
        puck.targetX = point.x
        puck.targetY = point.y
        puck.x = point.x
        puck.y = point.y
        puck.vx = 0
        puck.vy = 0
      }
      return
    }

  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    const engine = engineRef.current
    if (!engine || engine.activePointerId !== event.pointerId) return
    event.preventDefault()

    event.currentTarget.releasePointerCapture(event.pointerId)

    if (engine.draggingPuckId && engine.touchStart) {
      const puck = engine.pucks.find((item) => item.id === engine.draggingPuckId)
      if (puck && distance(engine.touchStart, puck) > 0.015) {
        rememberMove(engine, puck, engine.touchStart, { pressure: 0.5, t: event.timeStamp, x: puck.baseX, y: puck.baseY })
      }
    }

    engine.activePointerId = null
    engine.activePointerType = null
    engine.draggingPuckId = null
    engine.touchStart = null
  }

  function handleSpatialStateRecall(state: SpatialState, at: number) {
    const engine = engineRef.current
    if (!engine) return

    const category = state.category ?? "Offense"
    recallSpatialState(engine, state)
    engine.conditions = {
      ...engine.conditions,
      [category]: state.name,
    }
    engine.formationPulseAt = at
    setActiveConditions(engine.conditions)
  }

  return (
    <main className="fixed inset-0 isolate overflow-hidden bg-[#030303] text-[#f8f1e4] selection:bg-transparent touch-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [-webkit-user-select:none]">
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(248,241,228,0.12),rgba(248,241,228,0)_18%),linear-gradient(135deg,rgba(216,176,96,0.08),rgba(0,0,0,0.12)_52%,rgba(0,0,0,0.62))] mix-blend-screen opacity-85" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-20 bg-gradient-to-b from-black/72 to-transparent" />
      <div className="pointer-events-none absolute inset-x-7 top-8 z-[1] h-[2px] bg-gradient-to-r from-transparent via-[#f6d68a]/50 to-transparent opacity-80" />
      <div className="pointer-events-none absolute left-5 top-[max(1.1rem,env(safe-area-inset-top))] z-10 hidden max-w-[calc(100vw-2.5rem)] gap-2 md:flex">
        {conditionSummary(activeConditions).map(([category, value]) => (
          <div className="rounded-full border border-[#f8f1e4]/10 bg-black/24 px-3 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.14em] text-[#f8f1e4]/44 backdrop-blur-xl" key={category}>
            <span className="text-[#f6d68a]/52">{category}</span>
            <span className="ml-2 text-[#f8f1e4]/64">{value}</span>
          </div>
        ))}
      </div>
      <canvas
        aria-label="Axis tactical canvas"
        className="absolute inset-0 h-full w-full touch-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [-webkit-user-select:none]"
        onContextMenu={(event) => event.preventDefault()}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={canvasRef}
      />

      <nav
        aria-label="Spatial states"
        className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex w-[min(58rem,calc(100vw-1rem))] -translate-x-1/2 snap-x snap-mandatory touch-pan-x items-center gap-2 overflow-x-auto rounded-[1.6rem] border border-[#f8f1e4]/18 bg-[#080806]/78 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_26px_86px_rgba(0,0,0,0.7)] backdrop-blur-2xl [-ms-overflow-style:none] [scrollbar-width:none] [scroll-padding:0.5rem] [&::-webkit-scrollbar]:hidden"
      >
        {spatialStates.map((state) => (
          <button
            aria-pressed={activeConditions[state.category ?? "Offense"] === state.name}
            className={[
              "snap-center shrink-0 touch-manipulation rounded-[1.08rem] px-[1.125rem] py-3 text-[0.74rem] font-black uppercase tracking-[0.14em] outline-none transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.94]",
              activeConditions[state.category ?? "Offense"] === state.name
                ? "bg-[#f8f1e4] text-[#050505] shadow-[0_0_34px_rgba(246,214,138,0.3),inset_0_-2px_0_rgba(214,176,96,0.72),inset_0_1px_0_rgba(255,255,255,0.82)]"
                : "text-[#f8f1e4]/55 hover:bg-[#f8f1e4]/12 hover:text-[#f8f1e4] focus-visible:bg-[#f8f1e4]/14 focus-visible:text-[#f8f1e4]",
            ].join(" ")}
            key={stateKey(state)}
            onClick={(event) => handleSpatialStateRecall(state, event.timeStamp)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") handleSpatialStateRecall(state, event.timeStamp)
            }}
            type="button"
          >
            <span className="block text-[0.52rem] font-black leading-none tracking-[0.18em] text-current/42">{state.category ?? "Offense"}</span>
            <span className="mt-1 block leading-none">{state.name}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}

function render(context: CanvasRenderingContext2D, engine: Engine, canvas: HTMLCanvasElement) {
  const rect = engine.rect
  if (!rect) return

  const width = rect.width
  const height = rect.height
  context.fillStyle = "#060606"
  context.fillRect(0, 0, width, height)
  drawAtmosphere(context, width, height, engine)
  drawCourt(context, width, height)
  drawContinuityResidue(context, width, height, engine)
  drawTemporalTrails(context, width, height, engine.pucks)
  drawMovementIntent(context, width, height, engine)
  drawIntelligenceSurface(context, width, height, engine)
  drawLiveResponse(context, width, height, engine)
  drawPuckInfluence(context, width, height, engine.pucks)
  drawPucks(context, width, height, engine.pucks)

  canvas.style.cursor = "grab"
}

function resizeCanvas(canvas: HTMLCanvasElement, rect: DOMRect, dpr: number) {
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(rect.height * dpr)
}

function drawAtmosphere(context: CanvasRenderingContext2D, width: number, height: number, engine: Engine) {
  const pressure = Math.min(1, engine.pucks.length * 0.035)
  const formation = clamp(1 - (performance.now() - engine.formationPulseAt) / 900, 0, 1)
  const gradient = context.createRadialGradient(width * 0.54, height * 0.45, 0, width * 0.54, height * 0.45, Math.max(width, height) * 0.72)
  gradient.addColorStop(0, `rgba(248,241,228,${0.085 + formation * 0.065 - pressure * 0.012})`)
  gradient.addColorStop(0.4, `rgba(216,176,96,${0.035 + pressure * 0.018 + formation * 0.024})`)
  gradient.addColorStop(1, "rgba(0,0,0,0.82)")
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)

  const glass = context.createLinearGradient(0, 0, width, height)
  glass.addColorStop(0, "rgba(255,255,255,0.075)")
  glass.addColorStop(0.5, "rgba(255,255,255,0)")
  glass.addColorStop(1, "rgba(0,0,0,0.58)")
  context.fillStyle = glass
  context.fillRect(0, 0, width, height)
}

function drawCourt(context: CanvasRenderingContext2D, width: number, height: number) {
  const margin = Math.round(Math.min(width, height) * 0.075)
  const courtHeight = height - margin * 2
  const courtWidth = Math.min(width - margin * 2, courtHeight * 1.2)
  const x = (width - courtWidth) / 2
  const y = margin
  const centerX = x + courtWidth / 2
  const baselineY = y + courtHeight
  const hoopY = y + courtHeight * 0.78
  const line = Math.max(2, Math.round(Math.min(width, height) * 0.00225))

  context.save()
  context.strokeStyle = "rgba(248,241,228,0.2)"
  context.lineWidth = Math.max(1, line)
  context.lineCap = "round"
  context.lineJoin = "round"
  context.strokeRect(round(x), round(y), round(courtWidth), round(courtHeight))

  linePath(context, [
    [x, y + courtHeight * 0.08],
    [x + courtWidth, y + courtHeight * 0.08],
  ])
  circle(context, centerX, y + courtHeight * 0.08, courtWidth * 0.115)

  const keyWidth = courtWidth * 0.32
  const keyHeight = courtHeight * 0.32
  const keyX = centerX - keyWidth / 2
  const keyY = baselineY - keyHeight
  context.strokeRect(round(keyX), round(keyY), round(keyWidth), round(keyHeight))
  circle(context, centerX, keyY, keyWidth * 0.29)

  const hoopRadius = courtWidth * 0.025
  linePath(context, [
    [centerX - courtWidth * 0.07, hoopY + courtHeight * 0.01],
    [centerX + courtWidth * 0.07, hoopY + courtHeight * 0.01],
  ])
  circle(context, centerX, hoopY, hoopRadius)

  context.strokeStyle = "rgba(248,241,228,0.105)"
  context.lineWidth = Math.max(1, line * 0.9)
  arc(context, centerX, hoopY, courtWidth * 0.43, Math.PI * 1.08, Math.PI * 1.92)
  arc(context, centerX, hoopY, courtWidth * 0.16, Math.PI * 1.08, Math.PI * 1.92)
  context.restore()
}

function drawContinuityResidue(context: CanvasRenderingContext2D, width: number, height: number, engine: Engine) {
  const now = performance.now()
  context.save()

  for (const cell of engine.continuityCells) {
    if (cell.visits < 5) continue

    const age = now - cell.lastSeen
    const memory = clamp(cell.visits / 26, 0, 1)
    const recency = clamp(1 - age / 16000, 0, 1)
    const alpha = (0.006 + memory * 0.022) * (0.35 + recency * 0.65)
    if (alpha <= 0.004) continue

    const point = toPixels(cell, width, height)
    const radius = Math.min(width, height) * (0.052 + memory * 0.045)
    const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius)
    gradient.addColorStop(0, continuityColor(cell.symbol, alpha))
    gradient.addColorStop(0.68, continuityColor(cell.symbol, alpha * 0.32))
    gradient.addColorStop(1, continuityColor(cell.symbol, 0))
    context.fillStyle = gradient
    context.beginPath()
    context.arc(point.x, point.y, radius, 0, Math.PI * 2)
    context.fill()
  }

  context.restore()
}

function drawTemporalTrails(context: CanvasRenderingContext2D, width: number, height: number, pucks: Puck[]) {
  const now = performance.now()
  context.save()

  for (const puck of pucks) {
    if (puck.trail.length < 2) continue

    for (let index = 1; index < puck.trail.length; index += 1) {
      const previous = puck.trail[index - 1]
      const current = puck.trail[index]
      const age = now - current.t
      const alpha = clamp(1 - age / 2200, 0, 1) * (puck.symbol === "O" ? 0.09 : 0.055)
      if (alpha <= 0.004) continue

      const start = toPixels(previous, width, height)
      const end = toPixels(current, width, height)
      context.strokeStyle = puck.symbol === "O" ? `rgba(244,237,222,${alpha})` : `rgba(172,178,178,${alpha * 0.86})`
      context.lineWidth = Math.max(1, Math.min(width, height) * 0.0022 * alpha * 8)
      context.lineCap = "round"
      context.beginPath()
      context.moveTo(start.x, start.y)
      context.lineTo(end.x, end.y)
      context.stroke()
    }
  }

  context.restore()
}

function drawMovementIntent(context: CanvasRenderingContext2D, width: number, height: number, engine: Engine) {
  context.save()
  context.lineCap = "round"
  context.lineJoin = "round"

  for (const puck of engine.pucks) {
    const movement = Math.hypot(puck.targetX - puck.baseX, puck.targetY - puck.baseY)
    if (movement < 0.014) continue

    const start = toPixels({ x: puck.baseX, y: puck.baseY }, width, height)
    const end = toPixels({ x: puck.targetX, y: puck.targetY }, width, height)
    const lift = Math.min(width, height) * 0.018
    const controlX = (start.x + end.x) / 2
    const controlY = (start.y + end.y) / 2 - lift

    context.strokeStyle = puck.symbol === "O" ? "rgba(244,237,222,0.16)" : "rgba(172,178,178,0.11)"
    context.lineWidth = Math.max(1, Math.min(width, height) * 0.0014)
    context.beginPath()
    context.moveTo(start.x, start.y)
    context.quadraticCurveTo(controlX, controlY, end.x, end.y)
    context.stroke()
  }

  context.restore()
}

function drawIntelligenceSurface(context: CanvasRenderingContext2D, width: number, height: number, engine: Engine) {
  const offense = engine.pucks.filter((puck) => puck.symbol === "O")
  const defense = engine.pucks.filter((puck) => puck.symbol === "X")
  const offensiveCenter = averagePuck(engine.pucks, "O")
  if (!offensiveCenter) return

  const sideLoad = offensiveCenter.x - 0.5
  const sidePressure = clamp(Math.abs(sideLoad) / 0.2, 0, 1)
  const rim = { x: 0.5, y: 0.78 }
  const drive = offense.reduce((deepest, puck) => (puck.y > deepest.y ? puck : deepest), offense[0])
  const driveDefender = drive ? nearestPuck(drive, defense, "X") : null

  context.save()

  if (sidePressure > 0.05) {
    const laneX = sideLoad > 0 ? 0.74 : 0.26
    const hazeCenter = toPixels({ x: laneX, y: 0.56 }, width, height)
    const hazeRadius = Math.min(width, height) * (0.18 + sidePressure * 0.08)
    const haze = context.createRadialGradient(hazeCenter.x, hazeCenter.y, hazeRadius * 0.1, hazeCenter.x, hazeCenter.y, hazeRadius)
    haze.addColorStop(0, `rgba(244,237,222,${0.04 * sidePressure})`)
    haze.addColorStop(0.58, `rgba(244,237,222,${0.012 * sidePressure})`)
    haze.addColorStop(1, "rgba(244,237,222,0)")
    context.fillStyle = haze
    context.beginPath()
    context.arc(hazeCenter.x, hazeCenter.y, hazeRadius, 0, Math.PI * 2)
    context.fill()

    const weakside = offense
      .filter((puck) => (sideLoad > 0 ? puck.x < offensiveCenter.x : puck.x > offensiveCenter.x))
      .sort((a, b) => Math.abs(b.x - offensiveCenter.x) - Math.abs(a.x - offensiveCenter.x))[0]

    if (weakside) {
      const start = toPixels(weakside, width, height)
      const ghost = toPixels({ x: sideLoad > 0 ? 0.2 : 0.8, y: clamp(weakside.y - 0.035, 0.16, 0.84) }, width, height)
      const control = { x: (start.x + ghost.x) / 2, y: Math.min(start.y, ghost.y) - Math.min(width, height) * 0.035 }
      context.strokeStyle = `rgba(244,237,222,${0.08 * sidePressure})`
      context.lineWidth = Math.max(1, Math.min(width, height) * 0.0015)
      context.setLineDash([Math.min(width, height) * 0.01, Math.min(width, height) * 0.012])
      context.beginPath()
      context.moveTo(start.x, start.y)
      context.quadraticCurveTo(control.x, control.y, ghost.x, ghost.y)
      context.stroke()
      context.setLineDash([])
    }
  }

  if (drive && driveDefender) {
    const pressure = clamp(1 - distance(drive, driveDefender) / 0.24, 0, 1)
    if (pressure > 0.08) {
      const start = toPixels(drive, width, height)
      const end = toPixels(rim, width, height)
      const laneGradient = context.createLinearGradient(start.x, start.y, end.x, end.y)
      laneGradient.addColorStop(0, `rgba(244,237,222,${0.08 * pressure})`)
      laneGradient.addColorStop(1, "rgba(244,237,222,0)")
      context.strokeStyle = laneGradient
      context.lineWidth = Math.max(2, Math.min(width, height) * 0.012 * pressure)
      context.lineCap = "round"
      context.beginPath()
      context.moveTo(start.x, start.y)
      context.quadraticCurveTo((start.x + end.x) / 2, (start.y + end.y) / 2 + Math.min(width, height) * 0.03, end.x, end.y)
      context.stroke()
    }
  }

  context.restore()
}

function drawLiveResponse(context: CanvasRenderingContext2D, width: number, height: number, engine: Engine) {
  const offense = engine.pucks.filter((puck) => puck.symbol === "O")
  const defense = engine.pucks.filter((puck) => puck.symbol === "X")
  const rim = { x: 0.5, y: 0.78 }
  const drivingO = offense
    .map((puck) => ({ puck, speed: Math.hypot(puck.vx, puck.vy) }))
    .sort((a, b) => b.speed - a.speed)[0]

  context.save()
  context.lineCap = "round"
  context.lineJoin = "round"

  if (drivingO && drivingO.speed > 0.004 && drivingO.puck.vy > 0.001) {
    const start = toPixels(drivingO.puck, width, height)
    const end = toPixels(rim, width, height)
    const window = clamp(drivingO.speed / 0.018, 0, 1)
    const recovery = nearestPuck(drivingO.puck, defense, "X")

    context.strokeStyle = `rgba(244,237,222,${0.08 * window})`
    context.lineWidth = Math.max(1, Math.min(width, height) * 0.0025 * window)
    context.beginPath()
    context.moveTo(start.x, start.y)
    context.quadraticCurveTo((start.x + end.x) / 2, start.y + Math.min(width, height) * 0.08, end.x, end.y)
    context.stroke()

    if (recovery) {
      const recoveryStart = toPixels(recovery, width, height)
      const recoverTo = toPixels({ x: (drivingO.puck.x + rim.x) / 2, y: (drivingO.puck.y + rim.y) / 2 }, width, height)
      context.strokeStyle = `rgba(172,178,178,${0.06 * window})`
      context.setLineDash([Math.min(width, height) * 0.007, Math.min(width, height) * 0.012])
      context.beginPath()
      context.moveTo(recoveryStart.x, recoveryStart.y)
      context.lineTo(recoverTo.x, recoverTo.y)
      context.stroke()
      context.setLineDash([])
    }
  }

  const spacing = spacingStress(offense)
  if (spacing > 0) {
    for (const puck of offense) {
      const nearest = nearestPuck(puck, offense, "O")
      if (!nearest) continue
      const gap = distance(puck, nearest)
      if (gap > 0.16) continue

      const midpoint = toPixels({ x: (puck.x + nearest.x) / 2, y: (puck.y + nearest.y) / 2 }, width, height)
      const radius = Math.min(width, height) * (0.055 + spacing * 0.025)
      const haze = context.createRadialGradient(midpoint.x, midpoint.y, radius * 0.1, midpoint.x, midpoint.y, radius)
      haze.addColorStop(0, `rgba(244,237,222,${0.04 * spacing})`)
      haze.addColorStop(1, "rgba(244,237,222,0)")
      context.fillStyle = haze
      context.beginPath()
      context.arc(midpoint.x, midpoint.y, radius, 0, Math.PI * 2)
      context.fill()
    }
  }

  if (engine.advantageFlash) {
    const age = performance.now() - engine.advantageFlash.t
    const alpha = clamp(1 - age / 900, 0, 1)
    if (alpha > 0) {
      const point = toPixels(engine.advantageFlash, width, height)
      const radius = Math.min(width, height) * (0.07 + (1 - alpha) * 0.04)
      const flash = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius)
      flash.addColorStop(0, `rgba(244,237,222,${0.07 * alpha})`)
      flash.addColorStop(1, "rgba(244,237,222,0)")
      context.fillStyle = flash
      context.beginPath()
      context.arc(point.x, point.y, radius, 0, Math.PI * 2)
      context.fill()
    }
  }

  context.restore()
}

function drawPuckInfluence(context: CanvasRenderingContext2D, width: number, height: number, pucks: Puck[]) {
  context.save()
  for (const puck of pucks) {
    const point = toPixels(puck, width, height)
    const radius = puckRadius(width, height)
    const birth = puckBirthProgress(puck)
    if (birth <= 0) continue
    const pulse = (Math.sin(performance.now() / 850 + puck.x * 8) + 1) / 2
    const catchLight = 1 + (1 - birth) * 0.45
    const gradient = context.createRadialGradient(point.x, point.y, radius * 0.18, point.x, point.y, radius * (1.06 + pulse * 0.12 + (1 - birth) * 0.18))
    gradient.addColorStop(0, symbolGlow(puck.symbol, 0.026 * catchLight))
    gradient.addColorStop(0.62, symbolGlow(puck.symbol, 0.009 * catchLight))
    gradient.addColorStop(1, symbolGlow(puck.symbol, 0))
    context.fillStyle = gradient
    context.beginPath()
    context.arc(point.x, point.y, radius * (1.16 + pulse * 0.04), 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
}

function drawPucks(context: CanvasRenderingContext2D, width: number, height: number, pucks: Puck[]) {
  context.save()

  for (const puck of pucks) {
    const point = toPixels(puck, width, height)
    const birth = puckBirthProgress(puck)
    const radius = puckRadius(width, height) * (0.85 + birth * 0.15)
    context.save()
    context.globalAlpha = birth
    drawSymbolMark(context, puck.symbol, point.x, point.y, radius)
    context.restore()
  }
  context.restore()
}

function drawSymbolMark(context: CanvasRenderingContext2D, symbol: PuckSymbol, x: number, y: number, radius: number) {
  context.save()
  context.lineCap = "round"
  context.lineJoin = "round"
  context.shadowBlur = Math.max(9, radius * 0.36)
  context.shadowColor = symbol === "O" ? "rgba(248,241,228,0.36)" : "rgba(185,190,188,0.3)"

  if (symbol === "O") {
    context.strokeStyle = "rgba(248,241,228,0.94)"
    context.lineWidth = Math.max(2.8, radius * 0.19)
    context.beginPath()
    context.arc(x, y, radius * 0.48, 0, Math.PI * 2)
    context.stroke()
  } else {
    context.strokeStyle = "rgba(185,190,188,0.9)"
    context.lineWidth = Math.max(2.8, radius * 0.19)
    const inset = radius * 0.44
    context.beginPath()
    context.moveTo(x - inset, y - inset)
    context.lineTo(x + inset, y + inset)
    context.moveTo(x + inset, y - inset)
    context.lineTo(x - inset, y + inset)
    context.stroke()
  }

  context.restore()
}

function updatePhysics(engine: Engine) {
  const tempo = tempoProfile(engine.conditions.Tempo)
  const spring = 0.145 * tempo.spring
  const damping = 0.805 * tempo.damping
  const settle = 0.000045

  pruneTemporalMemory(engine)
  updateLiveResponse(engine)
  applyBasketballRelationships(engine)
  updateChoreography(engine)
  updateContinuityEngine(engine)

  for (const puck of engine.pucks) {
    const previousX = puck.x
    const previousY = puck.y
    const pullX = puck.targetX - puck.x
    const pullY = puck.targetY - puck.y
    const pull = Math.hypot(pullX, pullY)
    const magneticSpring = spring + clamp(pull / 0.28, 0, 1) * 0.035
    puck.vx += pullX * magneticSpring
    puck.vy += pullY * magneticSpring
    puck.vx *= damping
    puck.vy *= damping
    puck.x += puck.vx
    puck.y += puck.vy
    if (Math.abs(puck.vx) < settle) puck.vx = 0
    if (Math.abs(puck.vy) < settle) puck.vy = 0
    puck.x = clamp(puck.x, 0.04, 0.96)
    puck.y = clamp(puck.y, 0.06, 0.94)
    puck.targetX = clamp(puck.targetX, 0.04, 0.96)
    puck.targetY = clamp(puck.targetY, 0.06, 0.94)
    captureTrailPoint(puck, previousX, previousY)
  }

  captureAbstractReplay(engine)
}

function updateChoreography(engine: Engine) {
  const now = performance.now()

  for (const puck of engine.pucks) {
    const choreography = puck.choreography
    if (!choreography || puck.id === engine.draggingPuckId) continue

    const elapsed = now - choreography.startedAt - choreography.delay
    if (elapsed < 0) continue

    const progress = clamp(elapsed / choreography.duration, 0, 1)
    const eased = easeInOutCubic(progress)
    const settle = Math.sin(progress * Math.PI) * 0.006

    puck.baseX = choreography.from.x + (choreography.to.x - choreography.from.x) * eased + settle * Math.sign(choreography.to.x - choreography.from.x)
    puck.baseY = choreography.from.y + (choreography.to.y - choreography.from.y) * eased + settle * 0.45
    puck.targetX = puck.baseX
    puck.targetY = puck.baseY

    if (progress >= 1) {
      puck.choreography = null
    }
  }
}

function recallSpatialState(engine: Engine, state: SpatialState) {
  const now = performance.now()
  const category = state.category ?? "Offense"
  for (const puck of engine.pucks) {
    const next = state.pucks[puck.id]
    if (!next) continue

    const weight = category === "Offense" ? 1 : category === "Defense" ? 0.74 : category === "Tempo" ? 0.38 : category === "Emphasis" ? 0.48 : 0.56
    puck.baseX = puck.baseX + (next.x - puck.baseX) * weight
    puck.baseY = puck.baseY + (next.y - puck.baseY) * weight
    puck.targetX = puck.baseX
    puck.targetY = puck.baseY
    puck.vx *= 0.3
    puck.vy *= 0.3
    puck.choreography = null
    puck.bornAt = now - 190
    puck.trail = puck.trail.slice(-8)
  }
}

function pruneTemporalMemory(engine: Engine) {
  const now = performance.now()
  for (const puck of engine.pucks) {
    puck.trail = puck.trail.filter((point) => now - point.t < 2200)
  }
}

function captureTrailPoint(puck: Puck, previousX: number, previousY: number) {
  const moved = Math.hypot(puck.x - previousX, puck.y - previousY)
  if (moved < 0.0014) return

  const last = puck.trail.at(-1)
  const now = performance.now()
  if (last && now - last.t < 70 && distance(last, puck) < 0.012) return

  puck.trail.push({ t: now, x: puck.x, y: puck.y })
  if (puck.trail.length > 32) {
    puck.trail.shift()
  }
}

function captureAbstractReplay(engine: Engine) {
  const now = performance.now()
  if (now - engine.lastAbstractReplayAt < 180) return

  engine.lastAbstractReplayAt = now
  engine.abstractReplayState.tracks = engine.pucks.map((puck) => ({
    confidence: 1,
    id: puck.id,
    lastSeenAt: now,
    misses: 0,
    symbol: puck.symbol,
    vx: puck.vx,
    vy: puck.vy,
    x: puck.x,
    y: puck.y,
  }))
  engine.abstractReplayFrames.push(buildAbstractReplayFrame(engine.abstractReplayState, now, "surface"))

  if (engine.abstractReplayFrames.length > 360) {
    engine.abstractReplayFrames.splice(0, engine.abstractReplayFrames.length - 360)
  }
}

function updateLiveResponse(engine: Engine) {
  const offense = engine.pucks.filter((puck) => puck.symbol === "O")
  const defense = engine.pucks.filter((puck) => puck.symbol === "X")

  if (engine.advantageFlash && performance.now() - engine.advantageFlash.t > 900) {
    engine.advantageFlash = null
  }

  for (const puck of offense) {
    const speed = Math.hypot(puck.vx, puck.vy)
    if (speed < 0.006 || puck.vy <= 0.001) continue

    const nearestX = nearestPuck(puck, defense, "X")
    const pressure = nearestX ? clamp(1 - distance(puck, nearestX) / 0.24, 0, 1) : 0
    const gapWindow = clamp(speed / 0.018, 0, 1) * (1 - pressure * 0.65)
    if (gapWindow > 0.42) {
      engine.advantageFlash = { t: performance.now(), x: puck.x, y: puck.y }
    }
  }
}

function updateContinuityEngine(engine: Engine) {
  const now = performance.now()

  for (const puck of engine.pucks) {
    const speed = Math.hypot(puck.vx, puck.vy)
    const pressure = puck.symbol === "X" ? 0.7 : 0.48 + clamp(speed / 0.012, 0, 1) * 0.28
    reinforceContinuityCell(engine, puck.x, puck.y, puck.symbol, pressure)
  }

  const offense = engine.pucks.filter((puck) => puck.symbol === "O")
  const defense = engine.pucks.filter((puck) => puck.symbol === "X")
  for (const puck of offense) {
    const nearestX = nearestPuck(puck, defense, "X")
    if (!nearestX) continue

    const pressure = clamp(1 - distance(puck, nearestX) / 0.22, 0, 1)
    if (pressure > 0.2) {
      reinforceContinuityCell(engine, (puck.x + nearestX.x) / 2, (puck.y + nearestX.y) / 2, "pressure", pressure)
    }
  }

  engine.continuityCells = engine.continuityCells
    .map((cell) => ({
      ...cell,
      pressure: cell.pressure * 0.996,
    }))
    .filter((cell) => cell.visits > 1 && (now - cell.lastSeen < 45000 || cell.pressure > 0.12))
    .slice(-96)
}

function reinforceContinuityCell(engine: Engine, x: number, y: number, symbol: ContinuityCell["symbol"], pressure: number) {
  const key = `${symbol}:${Math.round(x * 12)}:${Math.round(y * 12)}`
  const existing = engine.continuityCells.find((cell) => cell.key === key)
  const now = performance.now()

  if (existing) {
    existing.lastSeen = now
    existing.pressure = clamp(existing.pressure + pressure * 0.05, 0, 1)
    existing.visits += 1
    existing.x = existing.x * 0.92 + x * 0.08
    existing.y = existing.y * 0.92 + y * 0.08
    return
  }

  engine.continuityCells.push({
    key,
    lastSeen: now,
    pressure: clamp(pressure * 0.08, 0, 1),
    symbol,
    visits: 1,
    x,
    y,
  })
}

function applyBasketballRelationships(engine: Engine) {
  const activeMovement = strongestMovement(engine.pucks)
  const ballSide = averagePuck(engine.pucks, "O")
  const sideLoad = ballSide ? ballSide.x - 0.5 : 0
  const sidePressure = clamp(Math.abs(sideLoad) / 0.2, 0, 1)
  const rim = { x: 0.5, y: 0.78 }
  const defense = defenseProfile(engine.conditions.Defense)
  const emphasis = emphasisProfile(engine.conditions.Emphasis)
  const offense = offenseProfile(engine.conditions.Offense)

  for (const puck of engine.pucks) {
    if (puck.id === engine.draggingPuckId) continue

    let desiredX = puck.baseX
    let desiredY = puck.baseY

    if (puck.symbol === "X") {
      const nearestO = nearestPuck(puck, engine.pucks, "O")
      if (nearestO) {
        const proximity = clamp(1 - distance(puck, nearestO) / 0.34, 0, 1)
        desiredX += (nearestO.x - puck.baseX) * 0.1 * proximity * defense.pressure
        desiredY += (nearestO.y - puck.baseY) * 0.1 * proximity * defense.pressure
      }

      if (ballSide) {
        desiredX += (ballSide.x - 0.5) * 0.035 * defense.shell
        desiredY += (ballSide.y - puck.baseY) * 0.025 * defense.shell
      }

      if (sidePressure > 0.05 && sideLoad !== 0) {
        const weakside = sideLoad > 0 ? puck.baseX < 0.5 : puck.baseX > 0.5
        if (weakside) {
          desiredX += (0.5 - puck.baseX) * 0.055 * sidePressure * defense.weakside
          desiredY += (rim.y - puck.baseY) * 0.035 * sidePressure * defense.weakside
        }
      }

      if (activeMovement && activeMovement.puck.symbol === "O" && activeMovement.puck.id !== puck.id) {
        const reaction = delayedReaction(puck, activeMovement.puck, activeMovement.pressure)
        const gap = distance(puck, activeMovement.puck)
        const lanePull = clamp(1 - gap / 0.42, 0, 1) * reaction * defense.help
        desiredX += (activeMovement.puck.x - puck.baseX) * 0.07 * lanePull
        desiredY += (activeMovement.puck.y - puck.baseY) * 0.055 * lanePull

        const cutPressure = clamp((activeMovement.puck.y - 0.48) / 0.28, 0, 1) * reaction * defense.help
        if (cutPressure > 0) {
          const weakside = activeMovement.puck.x > 0.5 ? puck.baseX < activeMovement.puck.x : puck.baseX > activeMovement.puck.x
          desiredX += (weakside ? 0.5 - puck.baseX : rim.x - puck.baseX) * 0.034 * cutPressure
          desiredY += (rim.y - puck.baseY) * 0.028 * cutPressure
        }
      }
    } else {
      const driveSpeed = Math.hypot(puck.vx, puck.vy)
      for (const teammate of engine.pucks) {
        if (teammate.id === puck.id || teammate.symbol !== "O") continue
        const gap = distance(puck, teammate)
        if (gap > 0 && gap < 0.18) {
          desiredX += ((puck.x - teammate.x) / gap) * (0.18 - gap) * 0.09 * emphasis.width
          desiredY += ((puck.y - teammate.y) / gap) * (0.18 - gap) * 0.09 * emphasis.width
        }
      }

      const nearestX = nearestPuck(puck, engine.pucks, "X")
      if (nearestX) {
        const pressure = clamp(1 - distance(puck, nearestX) / 0.22, 0, 1)
        desiredX += (puck.x - nearestX.x) * 0.055 * pressure * offense.space
        desiredY += (puck.y - nearestX.y) * 0.055 * pressure * offense.space
      }

      if (driveSpeed > 0.004 && puck.vy > 0.001) {
        const cornerX = puck.x < 0.5 ? 0.18 : 0.82
        desiredX += (cornerX - puck.baseX) * 0.04 * offense.lift * emphasis.width
        desiredY += (0.72 - puck.baseY) * 0.02 * offense.lift
      }

      if (activeMovement && activeMovement.puck.symbol === "O" && activeMovement.puck.id !== puck.id) {
        const reaction = delayedReaction(puck, activeMovement.puck, activeMovement.pressure)
        const gap = distance(puck, activeMovement.puck)
        const spacingPush = clamp(1 - gap / 0.34, 0, 1) * reaction
        if (gap > 0) {
          desiredX += ((puck.x - activeMovement.puck.x) / gap) * 0.038 * spacingPush
          desiredY += ((puck.y - activeMovement.puck.y) / gap) * 0.024 * spacingPush
        }

        const cornerX = activeMovement.puck.x < 0.5 ? 0.82 : 0.18
        const weakside = activeMovement.puck.x < 0.5 ? puck.baseX > 0.5 : puck.baseX < 0.5
        if (weakside) {
          desiredX += (cornerX - puck.baseX) * 0.026 * reaction * offense.lift * emphasis.weakside
          desiredY += (0.74 - puck.baseY) * 0.018 * reaction * offense.lift
        }
      }

      if (activeMovement && activeMovement.puck.symbol === "X") {
        const reaction = delayedReaction(puck, activeMovement.puck, activeMovement.pressure)
        const gap = distance(puck, activeMovement.puck)
        const pressureRelease = clamp(1 - gap / 0.28, 0, 1) * reaction
        if (gap > 0) {
          desiredX += ((puck.x - activeMovement.puck.x) / gap) * 0.03 * pressureRelease * offense.space
          desiredY += ((puck.y - activeMovement.puck.y) / gap) * 0.022 * pressureRelease * offense.space
        }
      }
    }

    puck.targetX = clamp(desiredX, 0.04, 0.96)
    puck.targetY = clamp(desiredY, 0.06, 0.94)
  }
}

function defenseProfile(condition = "Shell") {
  return {
    help: ["ICE", "Drop", "Pack", "Zone", "Shrink", "Nail Help"].includes(condition) ? 1.28 : ["Blitz", "Trap", "Press", "Deny"].includes(condition) ? 0.86 : 1,
    pressure: ["Blitz", "Trap", "Press", "Deny", "Full Court"].includes(condition) ? 1.32 : ["Drop", "Pack", "Zone"].includes(condition) ? 0.84 : 1,
    shell: ["Shell", "Matchup", "Recover", "Scramble", "X-Out"].includes(condition) ? 1.22 : 1,
    weakside: ["ICE", "Weak", "Shrink", "Nail Help", "X-Out"].includes(condition) ? 1.34 : ["Strong", "Deny"].includes(condition) ? 0.82 : 1,
  }
}

function emphasisProfile(condition = "Keep Width") {
  return {
    weakside: ["Weakside Ready", "Early Help", "Stay Connected", "Protect Nail"].includes(condition) ? 1.3 : 1,
    width: ["Keep Width", "Sprint Lanes", "Push Pace", "Shot Discipline"].includes(condition) ? 1.34 : ["Touch Paint", "Paint Collapse", "Kill Middle"].includes(condition) ? 0.88 : 1,
  }
}

function offenseProfile(condition = "Horns") {
  return {
    lift: ["Spain", "Ghost", "Chicago", "Hammer", "Zoom"].includes(condition) ? 1.32 : ["Iso", "Post Split", "High-Low"].includes(condition) ? 0.88 : 1,
    space: ["5-Out", "Wide", "Flow", "DHO", "Motion", "Delay"].includes(condition) ? 1.26 : ["Horns", "Post Split", "High-Low"].includes(condition) ? 0.92 : 1,
  }
}

function tempoProfile(condition = "Controlled") {
  if (["Fast", "Push", "Early", "Transition", "Scramble"].includes(condition)) return { damping: 0.96, spring: 1.18 }
  if (["Controlled", "Patient", "Organized", "Halfcourt"].includes(condition)) return { damping: 1.03, spring: 0.88 }
  if (condition === "Flowing") return { damping: 1, spring: 1.05 }
  return { damping: 1, spring: 1 }
}

function nearestPuck(origin: Puck, pucks: Puck[], symbol: PuckSymbol) {
  let nearest: Puck | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const puck of pucks) {
    if (puck.id === origin.id || puck.symbol !== symbol) continue
    const gap = distance(origin, puck)
    if (gap < nearestDistance) {
      nearest = puck
      nearestDistance = gap
    }
  }

  return nearest
}

function strongestMovement(pucks: Puck[]) {
  let strongest: { pressure: number; puck: Puck } | null = null

  for (const puck of pucks) {
    const speed = Math.hypot(puck.vx, puck.vy)
    const pressure = clamp(speed / 0.015 + (puck.choreography ? 0.45 : 0), 0, 1)
    if (pressure < 0.12) continue

    if (!strongest || pressure > strongest.pressure) {
      strongest = { pressure, puck }
    }
  }

  return strongest
}

function delayedReaction(puck: Puck, source: Puck, pressure: number) {
  const distanceDelay = clamp(distance(puck, source) / 0.46, 0, 1)
  const phase = (Math.sin(performance.now() / 420 + idPhase(puck.id)) + 1) / 2
  const hesitation = 0.42 + phase * 0.34
  return pressure * (1 - distanceDelay * 0.48) * hesitation
}

function idPhase(id: string) {
  let value = 0
  for (let index = 0; index < id.length; index += 1) {
    value += id.charCodeAt(index) * (index + 1)
  }
  return value * 0.17
}

function averagePuck(pucks: Puck[], symbol: PuckSymbol) {
  const matching = pucks.filter((puck) => puck.symbol === symbol)
  if (matching.length === 0) return null

  return {
    x: matching.reduce((sum, puck) => sum + puck.x, 0) / matching.length,
    y: matching.reduce((sum, puck) => sum + puck.y, 0) / matching.length,
  }
}

function spacingStress(pucks: Puck[]) {
  if (pucks.length < 2) return 0

  let stress = 0
  for (const puck of pucks) {
    const nearest = nearestPuck(puck, pucks, "O")
    if (!nearest) continue
    stress += clamp((0.16 - distance(puck, nearest)) / 0.16, 0, 1)
  }

  return clamp(stress / pucks.length, 0, 1)
}

function eventPoint(event: ReactPointerEvent<HTMLCanvasElement>, engine: Engine): Point | null {
  const rect = engine.rect
  if (!rect) return null

  return {
    pressure: event.pressure || 0.5,
    t: event.timeStamp,
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  }
}

function findPuckAt(engine: Engine, point: Point) {
  const rect = engine.rect
  if (!rect) return null

  const radius = puckRadius(rect.width, rect.height) / Math.min(rect.width, rect.height)
  for (let index = engine.pucks.length - 1; index >= 0; index -= 1) {
    const puck = engine.pucks[index]
    if (distance(puck, point) < radius * 1.45) return puck
  }
  return null
}

function rememberMove(engine: Engine, puck: Puck, from: Point, to: Point) {
  appendMemory(engine, {
    at: performance.now(),
    from,
    id: `memory-${engine.sessionMemory.length + 1}`,
    kind: "move",
    puckId: puck.id,
    symbol: puck.symbol,
    to,
  })
}

function appendMemory(engine: Engine, event: MemoryEvent) {
  engine.sessionMemory.push(event)
  if (engine.sessionMemory.length > 160) {
    engine.sessionMemory.shift()
  }
}

function makePuck(id: string, symbol: PuckSymbol, x: number, y: number): Puck {
  return { baseX: x, baseY: y, bornAt: -10000, choreography: null, id, symbol, targetX: x, targetY: y, trail: [], vx: 0, vy: 0, x, y }
}

function clonePucks(pucks: Puck[]) {
  return pucks.map((puck) => ({ ...puck, choreography: null, trail: [] }))
}

function toPixels(point: { x: number; y: number }, width: number, height: number) {
  return {
    x: point.x * width,
    y: point.y * height,
  }
}

function puckRadius(width: number, height: number) {
  return Math.max(19, Math.min(width, height) * 0.0385)
}

function linePath(context: CanvasRenderingContext2D, points: Array<[number, number]>) {
  context.beginPath()
  context.moveTo(round(points[0][0]), round(points[0][1]))
  for (const point of points.slice(1)) {
    context.lineTo(round(point[0]), round(point[1]))
  }
  context.stroke()
}

function circle(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  context.beginPath()
  context.arc(round(x), round(y), round(radius), 0, Math.PI * 2)
  context.stroke()
}

function arc(context: CanvasRenderingContext2D, x: number, y: number, radius: number, start: number, end: number) {
  context.beginPath()
  context.arc(round(x), round(y), round(radius), start, end)
  context.stroke()
}

function round(value: number) {
  return Math.round(value)
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function puckBirthProgress(puck: Puck) {
  if (puck.bornAt < 0) return 1
  return easeOutCubic(clamp((performance.now() - puck.bornAt) / 320, 0, 1))
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - (-2 * value + 2) ** 3 / 2
}

function symbolGlow(symbol: PuckSymbol, alpha: number) {
  if (symbol === "O") return `rgba(244,237,222,${alpha * 0.78})`
  return `rgba(172,178,178,${alpha * 0.66})`
}

function continuityColor(symbol: ContinuityCell["symbol"], alpha: number) {
  if (symbol === "O") return `rgba(244,237,222,${alpha})`
  if (symbol === "X") return `rgba(172,178,178,${alpha * 0.82})`
  return `rgba(214,194,148,${alpha * 1.08})`
}
