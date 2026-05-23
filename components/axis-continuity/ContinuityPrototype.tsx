"use client"

import { buildAbstractReplayFrame, createAbstractReplayState, type AbstractReplayFrame, type AbstractReplayState } from "@/lib/axis/abstractReplay"
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

type PuckSymbol = "O" | "X"
type SpatialStateName = string
type TacticalCategory = "Offense" | "Defense" | "SLOB" | "ATO" | "Tempo" | "Emphasis"
type ActiveConditions = Partial<Record<TacticalCategory, string>>
type DecisionStage = "owned" | "afterPass" | "afterDrive"
type PossessionAction = "pass" | "drive" | "shoot" | "wing" | "corner" | "slot" | "shortRoll" | "kick" | "finish" | "dumpOff" | "reset"
type PossessionDecision = {
  action: PossessionAction
  label: string
}

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
  arc: number
  delay: number
  duration: number
  from: Point
  startedAt: number
  to: Point
}

type Ball = {
  carrierId: string | null
  lastCarrierId: string | null
  passArc: number
  passedAt: number
  state: "loose" | "owned" | "passing" | "shot"
  targetCarrierId: string | null
  targetX: number
  targetY: number
  trail: TrailPoint[]
  vx: number
  vy: number
  x: number
  y: number
}

type PossessionEvent = {
  at: number
  fromCarrierId: string | null
  id: string
  state: Ball["state"]
  toCarrierId: string | null
  x: number
  y: number
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

type PossessionBranch = {
  id: string
  moves: Array<{ delay: number; duration: number; id: string; x: number; y: number }>
  name: string
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

type CourtZone = {
  id: string
  radius: number
  x: number
  y: number
}

const ENABLE_REACTION_ECOLOGY = false

type Engine = {
  activePointerId: number | null
  activePointerType: string | null
  abstractReplayFrames: AbstractReplayFrame[]
  abstractReplayState: AbstractReplayState
  advantageFlash: TrailPoint | null
  conditions: ActiveConditions
  ball: Ball
  draggingBall: boolean
  draggingPuckId: string | null
  formationPulseAt: number
  lastAbstractReplayAt: number
  moved: boolean
  penActiveUntil: number
  pucks: Puck[]
  possessionChangedAt: number
  possessionEvents: PossessionEvent[]
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

const initialBall: Ball = {
  carrierId: "o1",
  lastCarrierId: "o1",
  passArc: 0,
  passedAt: -10000,
  state: "owned",
  targetCarrierId: "o1",
  targetX: 0.5,
  targetY: 0.24,
  trail: [],
  vx: 0,
  vy: 0,
  x: 0.5,
  y: 0.24,
}

const LIVE_COURT = {
  bottom: 0.89,
  left: 0.08,
  right: 0.92,
  top: 0.13,
}

const courtZones: CourtZone[] = [
  { id: "top", radius: 0.16, x: 0.5, y: 0.25 },
  { id: "slot-left", radius: 0.13, x: 0.34, y: 0.38 },
  { id: "slot-right", radius: 0.13, x: 0.66, y: 0.38 },
  { id: "wing-left", radius: 0.14, x: 0.22, y: 0.52 },
  { id: "wing-right", radius: 0.14, x: 0.78, y: 0.52 },
  { id: "corner-left", radius: 0.13, x: 0.16, y: 0.77 },
  { id: "corner-right", radius: 0.13, x: 0.84, y: 0.77 },
  { id: "elbow-left", radius: 0.1, x: 0.38, y: 0.58 },
  { id: "elbow-right", radius: 0.1, x: 0.62, y: 0.58 },
  { id: "nail", radius: 0.12, x: 0.5, y: 0.52 },
  { id: "paint", radius: 0.16, x: 0.5, y: 0.69 },
  { id: "dunker-left", radius: 0.1, x: 0.34, y: 0.8 },
  { id: "dunker-right", radius: 0.1, x: 0.66, y: 0.8 },
  { id: "short-left", radius: 0.1, x: 0.22, y: 0.71 },
  { id: "short-right", radius: 0.1, x: 0.78, y: 0.71 },
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

const initialConditions: ActiveConditions = {
  Defense: "Shell",
  Emphasis: "Keep Width",
  Offense: "Horns",
  Tempo: "Controlled",
}

const possessionDecisionTree: Record<DecisionStage, PossessionDecision[]> = {
  afterDrive: [
    { action: "kick", label: "Kick" },
    { action: "finish", label: "Finish" },
    { action: "dumpOff", label: "Dump Off" },
    { action: "reset", label: "Reset" },
  ],
  afterPass: [
    { action: "wing", label: "Wing" },
    { action: "corner", label: "Corner" },
    { action: "slot", label: "Slot" },
    { action: "shortRoll", label: "Short Roll" },
  ],
  owned: [
    { action: "pass", label: "Pass" },
    { action: "drive", label: "Drive" },
    { action: "shoot", label: "Shoot" },
  ],
}

export function ContinuityPrototype() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const [activeAction, setActiveAction] = useState<PossessionAction | null>(null)
  const [decisionStage, setDecisionStage] = useState<DecisionStage>("owned")

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
      ball: cloneBall(initialBall),
      conditions: initialConditions,
      draggingBall: false,
      draggingPuckId: null,
      formationPulseAt: -10000,
      lastAbstractReplayAt: 0,
      moved: false,
      penActiveUntil: 0,
      pucks: clonePucks(initialPucks),
      possessionChangedAt: -10000,
      possessionEvents: [],
      rafId: 0,
      rect: null,
      continuityCells: [],
      sessionMemory: [],
      touchStart: null,
    }
    engineRef.current = engine
    if (ENABLE_REACTION_ECOLOGY && spatialStates.length > 0) {
      const dormantBranches = getPossessionBranches(initialConditions, null)
      const dormantState = spatialStates[0]
      if (dormantState) recallSpatialState(engine, dormantState)
      if (dormantBranches[0]) applyPossessionBranch(engine, dormantBranches[0], 0)
    }

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

    if (findBallAt(engine, point)) {
      engine.activePointerId = event.pointerId
      engine.activePointerType = event.pointerType
      engine.draggingBall = true
      engine.moved = false
      engine.touchStart = point
      setBallLoose(engine, point, event.timeStamp)
      engine.ball.targetX = point.x
      engine.ball.targetY = point.y
      engine.ball.x = point.x
      engine.ball.y = point.y
      engine.ball.vx = 0
      engine.ball.vy = 0
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

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
      const constrained = constrainToLiveCourt(point)
      puck.targetX = constrained.x
      puck.targetY = constrained.y
      puck.x = constrained.x
      puck.y = constrained.y
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
        const constrained = constrainToLiveCourt(point)
        puck.baseX = constrained.x
        puck.baseY = constrained.y
        puck.targetX = constrained.x
        puck.targetY = constrained.y
        puck.x = constrained.x
        puck.y = constrained.y
        puck.vx = 0
        puck.vy = 0
      }
      return
    }

    if (engine.draggingBall) {
      const point = eventPoint(event, engine)
      if (!point) return
      const nearest = nearestPuck(point, engine.pucks, "O")
      engine.ball.state = "loose"
      engine.ball.targetCarrierId = nearest && distance(point, nearest) < 0.24 ? nearest.id : null
      engine.ball.targetX = point.x
      engine.ball.targetY = point.y
      engine.ball.x = point.x
      engine.ball.y = point.y
      engine.ball.vx = 0
      engine.ball.vy = 0
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
        if (engine.ball.carrierId === puck.id) {
          setBallOwned(engine, puck.id, event.timeStamp)
        }
      }
    }

    if (engine.draggingBall) {
      const nearest = nearestPuck(engine.ball, engine.pucks, "O")
      if (nearest && distance(engine.ball, nearest) < 0.18) {
        passBallTo(engine, nearest.id, event.timeStamp)
      } else if (engine.ball.lastCarrierId) {
        passBallTo(engine, engine.ball.lastCarrierId, event.timeStamp)
      } else {
        setBallLoose(engine, engine.ball, event.timeStamp)
      }
    }

    engine.activePointerId = null
    engine.activePointerType = null
    engine.draggingBall = false
    engine.draggingPuckId = null
    engine.touchStart = null
  }

  function handlePossessionAction(action: PossessionAction, at: number) {
    const engine = engineRef.current
    if (!engine) return

    applyPossessionAction(engine, action, at)
    setDecisionStage(nextDecisionStage(action))
    setActiveAction(action)
    window.setTimeout(() => setActiveAction((current) => (current === action ? null : current)), 520)
  }

  const possessionActions = possessionDecisionTree[decisionStage].slice(0, 4)

  return (
    <main className="fixed inset-0 isolate overflow-hidden bg-[#eee6d7] text-[#26231f] selection:bg-transparent touch-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [-webkit-user-select:none]">
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_22%,rgba(255,252,244,0.82),rgba(255,252,244,0)_34%),linear-gradient(135deg,rgba(116,103,83,0.06),rgba(255,255,255,0.1)_42%,rgba(73,64,50,0.12))] opacity-80" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-20 bg-gradient-to-b from-[#f8f1e4]/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-7 top-8 z-[1] h-px bg-gradient-to-r from-transparent via-[#6f6659]/22 to-transparent opacity-80" />
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
        aria-label="Possession decisions"
        className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex max-w-[calc(100vw-1.25rem)] -translate-x-1/2 items-center justify-center gap-1.5 rounded-full border border-[#4e473d]/8 bg-[#fff8ea]/42 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_12px_34px_rgba(68,58,43,0.11)] backdrop-blur-2xl"
      >
        {possessionActions.map(({ action, label }) => {
          const active = activeAction === action
          return (
            <button
              aria-pressed={active}
              className={[
                "snap-center shrink-0 touch-manipulation whitespace-nowrap rounded-full px-4 py-2 text-[0.65rem] font-medium uppercase leading-none tracking-[0.14em] outline-none transition-[background,color,box-shadow,opacity,transform] duration-150 active:scale-[0.96]",
                active
                  ? "bg-[#2c2924]/88 text-[#fff8ea] opacity-100 shadow-[0_7px_18px_rgba(70,58,42,0.14),inset_0_-1px_0_rgba(0,0,0,0.22)]"
                  : "bg-[#fffdf7]/24 text-[#3b352d]/50 opacity-85 shadow-[inset_0_0_0_1px_rgba(76,68,55,0.045)] hover:bg-[#fffdf7]/44 hover:text-[#2c2924]/78 focus-visible:bg-[#fffdf7]/58 focus-visible:text-[#2c2924]",
              ].join(" ")}
              key={action}
              onClick={(event) => handlePossessionAction(action, event.timeStamp)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") handlePossessionAction(action, event.timeStamp)
              }}
              type="button"
            >
              {label}
            </button>
          )
        })}
      </nav>
    </main>
  )
}

function render(context: CanvasRenderingContext2D, engine: Engine, canvas: HTMLCanvasElement) {
  const rect = engine.rect
  if (!rect) return

  const width = rect.width
  const height = rect.height
  context.fillStyle = "#eee6d7"
  context.fillRect(0, 0, width, height)
  drawAtmosphere(context, width, height, engine)
  drawCourt(context, width, height)
  drawContinuityResidue(context, width, height, engine)
  drawTemporalTrails(context, width, height, engine.pucks)
  drawMovementIntent(context, width, height, engine)
  if (ENABLE_REACTION_ECOLOGY) {
    drawIntelligenceSurface(context, width, height, engine)
    drawLiveResponse(context, width, height, engine)
  }
  drawPuckInfluence(context, width, height, engine.pucks)
  drawPucks(context, width, height, engine.pucks)
  drawBall(context, width, height, engine.ball)

  canvas.style.cursor = "grab"
}

function resizeCanvas(canvas: HTMLCanvasElement, rect: DOMRect, dpr: number) {
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(rect.height * dpr)
}

function drawAtmosphere(context: CanvasRenderingContext2D, width: number, height: number, engine: Engine) {
  const pressure = Math.min(1, engine.pucks.length * 0.035)
  const formation = clamp(1 - (performance.now() - engine.formationPulseAt) / 900, 0, 1)
  const possession = clamp(1 - (performance.now() - engine.possessionChangedAt) / 620, 0, 1)
  const gradient = context.createRadialGradient(width * 0.54, height * 0.45, 0, width * 0.54, height * 0.45, Math.max(width, height) * 0.72)
  gradient.addColorStop(0, `rgba(255,252,244,${0.52 + formation * 0.08 + possession * 0.035 - pressure * 0.018})`)
  gradient.addColorStop(0.46, `rgba(226,214,192,${0.18 + pressure * 0.025 + formation * 0.03 + possession * 0.024})`)
  gradient.addColorStop(1, "rgba(202,190,169,0.36)")
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)

  const paper = context.createLinearGradient(0, 0, width, height)
  paper.addColorStop(0, "rgba(255,255,255,0.3)")
  paper.addColorStop(0.52, "rgba(255,255,255,0.04)")
  paper.addColorStop(1, "rgba(86,75,60,0.08)")
  context.fillStyle = paper
  context.fillRect(0, 0, width, height)

  context.save()
  context.globalAlpha = 0.18
  context.strokeStyle = "rgba(95,82,64,0.055)"
  context.lineWidth = 1
  const fiberGap = Math.max(18, Math.min(width, height) * 0.038)
  for (let x = -fiberGap; x < width + fiberGap; x += fiberGap) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x + height * 0.08, height)
    context.stroke()
  }
  context.globalAlpha = 0.11
  for (let y = fiberGap * 0.6; y < height; y += fiberGap * 1.35) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(width, y + width * 0.01)
    context.stroke()
  }
  context.restore()
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
  context.strokeStyle = "rgba(61,56,49,0.24)"
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

  context.strokeStyle = "rgba(61,56,49,0.13)"
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
      context.strokeStyle = puck.symbol === "O" ? `rgba(45,40,34,${alpha * 1.05})` : `rgba(96,91,83,${alpha * 0.9})`
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

    context.strokeStyle = puck.symbol === "O" ? "rgba(45,40,34,0.15)" : "rgba(96,91,83,0.11)"
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
  const ball = engine.ball
  const sideLoad = ball.x - 0.5
  const sidePressure = clamp(Math.abs(sideLoad) / 0.2, 0, 1)
  const rim = { x: 0.5, y: 0.78 }
  const drive = offense.reduce((deepest, puck) => (distance(puck, ball) < distance(deepest, ball) ? puck : deepest), offense[0])
  const driveDefender = drive ? nearestPuck(drive, defense, "X") : null

  context.save()

  if (sidePressure > 0.05) {
    const laneX = sideLoad > 0 ? 0.74 : 0.26
    const hazeCenter = toPixels({ x: laneX, y: 0.56 }, width, height)
    const hazeRadius = Math.min(width, height) * (0.18 + sidePressure * 0.08)
    const haze = context.createRadialGradient(hazeCenter.x, hazeCenter.y, hazeRadius * 0.1, hazeCenter.x, hazeCenter.y, hazeRadius)
    haze.addColorStop(0, `rgba(65,56,44,${0.028 * sidePressure})`)
    haze.addColorStop(0.58, `rgba(65,56,44,${0.009 * sidePressure})`)
    haze.addColorStop(1, "rgba(65,56,44,0)")
    context.fillStyle = haze
    context.beginPath()
    context.arc(hazeCenter.x, hazeCenter.y, hazeRadius, 0, Math.PI * 2)
    context.fill()

    const weakside = offense
      .filter((puck) => (sideLoad > 0 ? puck.x < ball.x : puck.x > ball.x))
      .sort((a, b) => Math.abs(b.x - ball.x) - Math.abs(a.x - ball.x))[0]

    if (weakside) {
      const start = toPixels(weakside, width, height)
      const ghost = toPixels({ x: sideLoad > 0 ? 0.2 : 0.8, y: clamp(weakside.y - 0.035, 0.16, 0.84) }, width, height)
      const control = { x: (start.x + ghost.x) / 2, y: Math.min(start.y, ghost.y) - Math.min(width, height) * 0.035 }
      context.strokeStyle = `rgba(65,56,44,${0.06 * sidePressure})`
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
      laneGradient.addColorStop(0, `rgba(65,56,44,${0.055 * pressure})`)
      laneGradient.addColorStop(1, "rgba(65,56,44,0)")
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
  const ball = engine.ball
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

    context.strokeStyle = `rgba(65,56,44,${0.06 * window})`
    context.lineWidth = Math.max(1, Math.min(width, height) * 0.0025 * window)
    context.beginPath()
    context.moveTo(start.x, start.y)
    context.quadraticCurveTo((start.x + end.x) / 2, start.y + Math.min(width, height) * 0.08, end.x, end.y)
    context.stroke()

    if (recovery) {
      const recoveryStart = toPixels(recovery, width, height)
      const recoverTo = toPixels({ x: (drivingO.puck.x + rim.x) / 2, y: (drivingO.puck.y + rim.y) / 2 }, width, height)
      context.strokeStyle = `rgba(96,91,83,${0.052 * window})`
      context.setLineDash([Math.min(width, height) * 0.007, Math.min(width, height) * 0.012])
      context.beginPath()
      context.moveTo(recoveryStart.x, recoveryStart.y)
      context.lineTo(recoverTo.x, recoverTo.y)
      context.stroke()
      context.setLineDash([])
    }
  }

  const ballDepth = clamp((ball.y - 0.38) / 0.34, 0, 1)
  if (ballDepth > 0.03) {
    const point = toPixels(ball, width, height)
    const radius = Math.min(width, height) * (0.1 + ballDepth * 0.12)
    const collapse = context.createRadialGradient(point.x, point.y, radius * 0.12, point.x, point.y, radius)
    collapse.addColorStop(0, `rgba(171,111,42,${0.035 * ballDepth})`)
    collapse.addColorStop(0.6, `rgba(65,56,44,${0.01 * ballDepth})`)
    collapse.addColorStop(1, "rgba(171,111,42,0)")
    context.fillStyle = collapse
    context.beginPath()
    context.arc(point.x, point.y, radius, 0, Math.PI * 2)
    context.fill()
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
      haze.addColorStop(0, `rgba(65,56,44,${0.028 * spacing})`)
      haze.addColorStop(1, "rgba(65,56,44,0)")
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
      flash.addColorStop(0, `rgba(65,56,44,${0.052 * alpha})`)
      flash.addColorStop(1, "rgba(65,56,44,0)")
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

function drawBall(context: CanvasRenderingContext2D, width: number, height: number, ball: Ball) {
  const point = toPixels(ball, width, height)
  const radius = Math.max(5.5, Math.min(width, height) * 0.0085)
  const pulse = (Math.sin(performance.now() / 360) + 1) / 2
  const passEnergy = ball.state === "passing" || ball.state === "shot" ? clamp(1 - (performance.now() - ball.passedAt) / 520, 0.28, 1) : clamp(1 - (performance.now() - ball.passedAt) / 520, 0, 1)

  context.save()
  context.lineCap = "round"
  context.lineJoin = "round"

  for (let index = 1; index < ball.trail.length; index += 1) {
    const previous = ball.trail[index - 1]
    const current = ball.trail[index]
    const age = performance.now() - current.t
    const alpha = clamp(1 - age / 620, 0, 1) * 0.18
    if (alpha <= 0.004) continue

    const start = toPixels(previous, width, height)
    const end = toPixels(current, width, height)
      context.strokeStyle = `rgba(171,111,42,${alpha * 0.78})`
    context.lineWidth = Math.max(1, radius * 0.34)
    context.beginPath()
    context.moveTo(start.x, start.y)
    context.lineTo(end.x, end.y)
    context.stroke()
  }

  const glowRadius = radius * (4.6 + pulse * 0.8 + passEnergy * 2.2)
  const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowRadius)
  glow.addColorStop(0, `rgba(171,111,42,${0.14 + passEnergy * 0.1})`)
  glow.addColorStop(0.46, `rgba(171,111,42,${0.035 + passEnergy * 0.035})`)
  glow.addColorStop(1, "rgba(171,111,42,0)")
  context.fillStyle = glow
  context.beginPath()
  context.arc(point.x, point.y, glowRadius, 0, Math.PI * 2)
  context.fill()

  context.shadowBlur = radius * (1.3 + passEnergy * 1.1)
  context.shadowColor = "rgba(143,88,28,0.34)"
  context.fillStyle = ball.state === "loose" ? "rgba(171,111,42,0.72)" : "rgba(171,111,42,0.9)"
  context.beginPath()
  context.arc(point.x, point.y, radius * (1 + passEnergy * 0.08), 0, Math.PI * 2)
  context.fill()

  context.shadowBlur = 0
  context.fillStyle = "rgba(255,246,222,0.54)"
  context.beginPath()
  context.arc(point.x - radius * 0.28, point.y - radius * 0.32, radius * 0.24, 0, Math.PI * 2)
  context.fill()

  context.restore()
}

function drawSymbolMark(context: CanvasRenderingContext2D, symbol: PuckSymbol, x: number, y: number, radius: number) {
  context.save()
  context.lineCap = "round"
  context.lineJoin = "round"
  context.shadowBlur = Math.max(9, radius * 0.36)
  context.shadowColor = symbol === "O" ? "rgba(48,42,34,0.16)" : "rgba(90,84,76,0.14)"

  if (symbol === "O") {
    context.strokeStyle = "rgba(42,38,33,0.92)"
    context.lineWidth = Math.max(2.8, radius * 0.19)
    context.beginPath()
    context.arc(x, y, radius * 0.48, 0, Math.PI * 2)
    context.stroke()
  } else {
    context.strokeStyle = "rgba(88,82,74,0.86)"
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
  const spring = 0.158 * tempo.spring
  const damping = 0.828 * tempo.damping
  const settle = 0.000038

  pruneTemporalMemory(engine)
  updateChoreography(engine)
  updateBall(engine)
  if (ENABLE_REACTION_ECOLOGY) {
    updateLiveResponse(engine)
    applyBasketballRelationships(engine)
  }
  applyCourtPhysics(engine)
  updateContinuityEngine(engine)

  for (const puck of engine.pucks) {
    const previousX = puck.x
    const previousY = puck.y
    const pullX = puck.targetX - puck.x
    const pullY = puck.targetY - puck.y
    const pull = Math.hypot(pullX, pullY)
    const arrival = clamp(1 - pull / 0.11, 0, 1)
    const speed = Math.hypot(puck.vx, puck.vy)
    const magneticSpring = spring + clamp(pull / 0.26, 0, 1) * 0.047
    const settleBounce = arrival * clamp(speed / 0.022, 0, 1) * 0.018
    puck.vx += pullX * magneticSpring
    puck.vy += pullY * magneticSpring
    if (pull > 0.001 && settleBounce > 0) {
      puck.vx -= (pullX / pull) * settleBounce
      puck.vy -= (pullY / pull) * settleBounce
    }
    puck.vx *= damping
    puck.vy *= damping
    puck.x += puck.vx
    puck.y += puck.vy
    if (Math.abs(puck.vx) < settle) puck.vx = 0
    if (Math.abs(puck.vy) < settle) puck.vy = 0
    const constrained = constrainToLiveCourt(puck)
    puck.x = constrained.x
    puck.y = constrained.y
    const constrainedTarget = constrainToLiveCourt({ x: puck.targetX, y: puck.targetY })
    puck.targetX = constrainedTarget.x
    puck.targetY = constrainedTarget.y
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
    const eased = easeOutBack(progress)
    const settle = Math.sin(progress * Math.PI) * 0.0045
    const dx = choreography.to.x - choreography.from.x
    const dy = choreography.to.y - choreography.from.y
    const length = Math.max(0.001, Math.hypot(dx, dy))
    const arcX = (-dy / length) * choreography.arc * Math.sin(progress * Math.PI)
    const arcY = (dx / length) * choreography.arc * Math.sin(progress * Math.PI) * 0.65

    const next = constrainToLiveCourt({
      x: choreography.from.x + dx * eased + settle * Math.sign(dx || 1) + arcX,
      y: choreography.from.y + dy * eased + settle * 0.32 + arcY,
    })
    puck.baseX = next.x
    puck.baseY = next.y
    puck.targetX = puck.baseX
    puck.targetY = puck.baseY

    if (progress >= 1) {
      puck.choreography = null
    }
  }
}

function updateBall(engine: Engine) {
  const previousX = engine.ball.x
  const previousY = engine.ball.y

  if (engine.ball.state === "owned" && engine.ball.carrierId && !engine.draggingBall) {
    const carrier = engine.pucks.find((puck) => puck.id === engine.ball.carrierId)
    if (carrier) {
      const offset = ballOwnershipOffset(carrier)
      engine.ball.targetX = carrier.x + offset.x
      engine.ball.targetY = carrier.y + offset.y
    }
  }

  if (engine.ball.state === "passing" && engine.ball.targetCarrierId && !engine.draggingBall) {
    const target = engine.pucks.find((puck) => puck.id === engine.ball.targetCarrierId)
    if (target) {
      const offset = ballOwnershipOffset(target)
      engine.ball.targetX = target.x + offset.x
      engine.ball.targetY = target.y + offset.y
    }
  }

  if (engine.ball.state === "loose" && !engine.draggingBall) {
    const nearest = nearestPuck(engine.ball, engine.pucks, "O")
    if (nearest && distance(engine.ball, nearest) < 0.12) {
      setBallOwned(engine, nearest.id, performance.now())
    } else if (engine.ball.lastCarrierId) {
      const fallback = engine.pucks.find((puck) => puck.id === engine.ball.lastCarrierId)
      if (fallback) {
        engine.ball.targetX = fallback.x
        engine.ball.targetY = fallback.y
      }
    }
  }

  const pullX = engine.ball.targetX - engine.ball.x
  const pullY = engine.ball.targetY - engine.ball.y
  const pull = Math.hypot(pullX, pullY)
  const passProgress = clamp((performance.now() - engine.ball.passedAt) / 520, 0, 1)
  const passEnergy = (1 - passProgress) * (engine.ball.state === "passing" ? 0.075 : 0.035)
  const arrival = clamp(1 - pull / 0.08, 0, 1)
  const speed = Math.hypot(engine.ball.vx, engine.ball.vy)
  const spring = 0.255 + clamp(pull / 0.26, 0, 1) * 0.105 + passEnergy
  const damping = engine.ball.state === "passing" ? 0.785 : 0.755
  const settleBounce = arrival * clamp(speed / 0.038, 0, 1) * 0.012

  engine.ball.vx += pullX * spring
  engine.ball.vy += pullY * spring
  if (engine.ball.state === "passing" && pull > 0.001) {
    const arcEnergy = Math.sin(passProgress * Math.PI) * engine.ball.passArc
    engine.ball.vx += (-pullY / pull) * arcEnergy
    engine.ball.vy += (pullX / pull) * arcEnergy * 0.55
  }
  if (pull > 0.001 && settleBounce > 0) {
    engine.ball.vx -= (pullX / pull) * settleBounce
    engine.ball.vy -= (pullY / pull) * settleBounce
  }
  engine.ball.vx *= damping
  engine.ball.vy *= damping
  engine.ball.x = clamp(engine.ball.x + engine.ball.vx, 0.04, 0.96)
  engine.ball.y = clamp(engine.ball.y + engine.ball.vy, 0.06, 0.94)

  if (engine.ball.state === "passing" && engine.ball.targetCarrierId && !engine.draggingBall) {
    const target = engine.pucks.find((puck) => puck.id === engine.ball.targetCarrierId)
    if (target && distance(engine.ball, target) < 0.035) {
      setBallOwned(engine, target.id, performance.now())
    }
  }

  if (engine.ball.state === "shot" && !engine.draggingBall && Math.hypot(engine.ball.targetX - engine.ball.x, engine.ball.targetY - engine.ball.y) < 0.04) {
    setBallLoose(engine, engine.ball, performance.now())
  }

  const moved = Math.hypot(engine.ball.x - previousX, engine.ball.y - previousY)
  if (moved > 0.0012) {
    const last = engine.ball.trail.at(-1)
    const now = performance.now()
    if (!last || now - last.t > 24 || distance(last, engine.ball) > 0.01) {
      engine.ball.trail.push({ t: now, x: engine.ball.x, y: engine.ball.y })
      if (engine.ball.trail.length > 24) engine.ball.trail.shift()
    }
  }
}

function nextDecisionStage(action: PossessionAction): DecisionStage {
  if (action === "pass") return "afterPass"
  if (action === "drive") return "afterDrive"
  return "owned"
}

function applyPossessionAction(engine: Engine, action: PossessionAction, at: number) {
  const carrier = currentCarrier(engine) ?? nearestPuck(engine.ball, engine.pucks, "O")
  if (!carrier) return

  if (action === "pass") {
    engine.advantageFlash = { t: performance.now(), x: engine.ball.x, y: engine.ball.y }
    return
  }

  if (action === "drive") {
    driveCarrier(engine, carrier, at)
    return
  }

  if (action === "shoot" || action === "finish") {
    setBallShot(engine, at)
    return
  }

  if (action === "reset") {
    resetPossession(engine, carrier, at)
    return
  }

  const target = decisionPassTarget(engine, carrier, action)
  if (target) passBallTo(engine, target.id, at)
}

function currentCarrier(engine: Engine) {
  if (!engine.ball.carrierId) return null
  return engine.pucks.find((puck) => puck.id === engine.ball.carrierId && puck.symbol === "O") ?? null
}

function nextPassTarget(engine: Engine, carrier: Puck) {
  const offense = engine.pucks.filter((puck) => puck.symbol === "O" && puck.id !== carrier.id)
  if (!offense.length) return null

  return offense.sort((first, second) => {
    const firstScore = passTargetScore(engine.ball, carrier, first)
    const secondScore = passTargetScore(engine.ball, carrier, second)
    return secondScore - firstScore
  })[0]
}

function decisionPassTarget(engine: Engine, carrier: Puck, action: PossessionAction) {
  if (action === "wing") return targetByZone(engine, carrier, ["wing-left", "wing-right"])
  if (action === "corner") return targetByZone(engine, carrier, ["corner-left", "corner-right"])
  if (action === "slot") return targetByZone(engine, carrier, ["slot-left", "slot-right", "top"])
  if (action === "shortRoll" || action === "dumpOff") return targetByZone(engine, carrier, ["paint", "dunker-left", "dunker-right", "short-left", "short-right"])
  if (action === "kick") return weaksideTarget(engine, carrier) ?? targetByZone(engine, carrier, ["corner-left", "corner-right", "wing-left", "wing-right"])
  return nextPassTarget(engine, carrier)
}

function targetByZone(engine: Engine, carrier: Puck, zoneIds: string[]) {
  const zones = zoneIds.map((zoneId) => courtZones.find((zone) => zone.id === zoneId)).filter((zone): zone is CourtZone => Boolean(zone))
  const offense = engine.pucks.filter((puck) => puck.symbol === "O" && puck.id !== carrier.id)
  if (!offense.length || !zones.length) return nextPassTarget(engine, carrier)

  return offense.sort((first, second) => {
    const firstScore = zoneTargetScore(first, zones, carrier)
    const secondScore = zoneTargetScore(second, zones, carrier)
    return secondScore - firstScore
  })[0]
}

function zoneTargetScore(puck: Puck, zones: CourtZone[], carrier: Puck) {
  const nearestZoneDistance = Math.min(...zones.map((zone) => distance(puck, zone)))
  const separation = distance(puck, carrier)
  return 1 - nearestZoneDistance + separation * 0.18
}

function weaksideTarget(engine: Engine, carrier: Puck) {
  const ballSide = engine.ball.x < 0.5 ? -1 : 1
  const offense = engine.pucks.filter((puck) => puck.symbol === "O" && puck.id !== carrier.id)
  const weakside = offense.filter((puck) => (ballSide < 0 ? puck.x > 0.5 : puck.x < 0.5))
  return (weakside.length ? weakside : offense).sort((first, second) => distance(second, carrier) - distance(first, carrier))[0] ?? null
}

function driveCarrier(engine: Engine, carrier: Puck, at: number) {
  setBallOwned(engine, carrier.id, at)
  const side = carrier.x < 0.5 ? -1 : 1
  const target = constrainToLiveCourt({
    x: clamp(carrier.x + side * 0.055, 0.28, 0.72),
    y: Math.max(carrier.y + 0.18, 0.61),
  })
  carrier.choreography = {
    arc: movementArcFor(carrier, target) * 0.7,
    delay: 0,
    duration: 620,
    from: { pressure: 0.5, t: at, x: carrier.x, y: carrier.y },
    startedAt: performance.now(),
    to: { pressure: 0.5, t: at, x: target.x, y: target.y },
  }
  carrier.targetX = target.x
  carrier.targetY = target.y
}

function resetPossession(engine: Engine, carrier: Puck, at: number) {
  setBallOwned(engine, carrier.id, at)
  const target = constrainToLiveCourt({ x: 0.5, y: 0.25 })
  carrier.choreography = {
    arc: movementArcFor(carrier, target) * 0.46,
    delay: 0,
    duration: 540,
    from: { pressure: 0.5, t: at, x: carrier.x, y: carrier.y },
    startedAt: performance.now(),
    to: { pressure: 0.5, t: at, x: target.x, y: target.y },
  }
  carrier.targetX = target.x
  carrier.targetY = target.y
}

function passTargetScore(ball: Ball, carrier: Puck, target: Puck) {
  const width = Math.abs(target.x - carrier.x)
  const forward = target.y >= carrier.y ? 0.08 : 0
  const weakside = ball.x < 0.5 ? target.x > carrier.x : target.x < carrier.x
  return width + forward + (weakside ? 0.12 : 0)
}

function applyCourtPhysics(engine: Engine) {
  const ball = engine.ball

  for (const puck of engine.pucks) {
    if (puck.id === engine.draggingPuckId) continue

    const bounded = softBoundaryTarget(puck)
    puck.targetX = bounded.x
    puck.targetY = bounded.y

    const zone = preferredZoneForPuck(puck, ball)
    if (zone) {
      const zonePull = zoneInfluence(puck, zone) * (puck.symbol === "O" ? 0.032 : 0.025)
      puck.targetX += (zone.x - puck.targetX) * zonePull
      puck.targetY += (zone.y - puck.targetY) * zonePull
    }
  }

  softenCollisions(engine.pucks)
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

function getPossessionBranches(conditions: ActiveConditions, activeBranchId: string | null): PossessionBranch[] {
  const offense = conditions.Offense ?? "Horns"
  const defense = conditions.Defense ?? "Shell"
  const emphasis = conditions.Emphasis ?? "Keep Width"
  const tempo = conditions.Tempo ?? "Controlled"
  const continuations = activeBranchId ? getContinuationBranches(activeBranchId, conditions) : null
  if (continuations?.length) return continuations.slice(0, 4)

  if (offense === "Spain" && defense === "Drop") {
    return [
      possessionBranch("spain-drop-pocket", "Pocket Pass", [
        ["o1", 0.5, 0.39, 0],
        ["o2", 0.5, 0.63, 120],
        ["o4", 0.16, 0.72, 240],
        ["o5", 0.84, 0.72, 300],
        ["x1", 0.5, 0.48, 220],
        ["x3", 0.52, 0.72, 360],
      ]),
      possessionBranch("spain-drop-lift", "Weakside Lift", [
        ["o1", 0.5, 0.36, 0],
        ["o5", 0.78, 0.56, 180],
        ["o4", 0.17, 0.74, 260],
        ["x4", 0.36, 0.7, 360],
        ["x5", 0.68, 0.67, 420],
      ]),
      possessionBranch("spain-drop-reject", "Ghost Reject", [
        ["o1", 0.37, 0.43, 0],
        ["o3", 0.6, 0.48, 160],
        ["x1", 0.46, 0.43, 260],
        ["x2", 0.42, 0.58, 390],
      ]),
      possessionBranch("spain-drop-roll", "Short Roll", [
        ["o2", 0.5, 0.59, 0],
        ["o3", 0.52, 0.72, 160],
        ["o5", 0.82, 0.69, 260],
        ["x3", 0.54, 0.67, 340],
      ]),
    ]
  }

  if (offense === "Spain" && defense === "Switch") {
    return [
      possessionBranch("spain-switch-slip", "Slip", [
        ["o2", 0.46, 0.63, 0],
        ["o1", 0.55, 0.36, 130],
        ["x2", 0.49, 0.57, 260],
      ]),
      possessionBranch("spain-switch-seal", "Seal Mismatch", [
        ["o3", 0.5, 0.74, 0],
        ["o1", 0.42, 0.38, 170],
        ["x3", 0.53, 0.69, 300],
      ]),
      possessionBranch("spain-switch-empty", "Empty Drift", [
        ["o4", 0.12, 0.72, 0],
        ["o5", 0.88, 0.72, 60],
        ["o1", 0.65, 0.36, 220],
        ["x5", 0.72, 0.66, 360],
      ]),
      possessionBranch("spain-switch-post", "Post Punish", [
        ["o2", 0.42, 0.71, 0],
        ["o3", 0.58, 0.54, 180],
        ["x2", 0.46, 0.67, 340],
      ]),
    ]
  }

  if (offense === "Horns" && defense === "ICE") {
    return [
      possessionBranch("horns-ice-reject", "Reject", [
        ["o1", 0.38, 0.42, 0],
        ["o2", 0.42, 0.51, 160],
        ["x1", 0.45, 0.42, 280],
        ["x2", 0.43, 0.59, 420],
      ]),
      possessionBranch("horns-ice-middle", "Middle Attack", [
        ["o1", 0.52, 0.45, 0],
        ["o3", 0.59, 0.52, 150],
        ["x3", 0.58, 0.59, 300],
      ]),
      possessionBranch("horns-ice-skip", "Weakside Skip", [
        ["o1", 0.41, 0.44, 0],
        ["o5", 0.82, 0.7, 180],
        ["x5", 0.63, 0.68, 360],
      ]),
      possessionBranch("horns-ice-ghost", "Ghost Counter", [
        ["o3", 0.62, 0.42, 0],
        ["o1", 0.56, 0.36, 180],
        ["x1", 0.54, 0.41, 300],
      ]),
    ]
  }

  if (offense === "5-Out" && defense === "Shell") {
    return [
      possessionBranch("fiveout-shell-corner-lift", "Corner Lift", [
        ["o1", 0.52, 0.37, 0],
        ["o4", 0.17, 0.7, 160],
        ["o5", 0.85, 0.7, 210],
        ["x4", 0.32, 0.69, 330],
      ]),
      possessionBranch("fiveout-shell-paint-touch", "Paint Touch", [
        ["o1", 0.48, 0.5, 0],
        ["o2", 0.2, 0.5, 180],
        ["o3", 0.8, 0.5, 230],
        ["x1", 0.5, 0.55, 350],
      ]),
      possessionBranch("fiveout-shell-empty-drift", "Empty Drift", [
        ["o2", 0.14, 0.46, 0],
        ["o4", 0.18, 0.74, 110],
        ["o1", 0.62, 0.34, 240],
        ["x2", 0.34, 0.52, 360],
      ]),
      possessionBranch("fiveout-shell-reset-angle", "Reset Angle", [
        ["o1", 0.5, 0.3, 0],
        ["o2", 0.28, 0.47, 210],
        ["o3", 0.72, 0.47, 270],
        ["x1", 0.5, 0.41, 390],
      ]),
    ]
  }

  const branches: PossessionBranch[] = []

  if (offense === "Horns") {
    branches.push(
      possessionBranch("horns-default-elbow", "Elbow Touch", [
        ["o1", 0.5, 0.38, 0],
        ["o2", 0.42, 0.5, 160],
        ["o3", 0.58, 0.5, 220],
      ]),
      possessionBranch("horns-default-corner", "Corner Lift", [
        ["o4", 0.2, 0.7, 0],
        ["o5", 0.8, 0.7, 80],
        ["x4", 0.33, 0.69, 300],
      ]),
    )
  } else if (offense === "5-Out") {
    branches.push(
      possessionBranch("fiveout-default-drive", "Paint Touch", [
        ["o1", 0.48, 0.46, 0],
        ["o2", 0.19, 0.48, 180],
        ["o3", 0.81, 0.48, 220],
        ["x1", 0.5, 0.52, 340],
      ]),
      possessionBranch("fiveout-default-swing", "Second Side", [
        ["o1", 0.64, 0.34, 0],
        ["o3", 0.77, 0.54, 150],
        ["o5", 0.84, 0.74, 280],
      ]),
    )
  } else if (offense === "Delay") {
    branches.push(
      possessionBranch("delay-default-dho", "DHO Keep", [
        ["o1", 0.42, 0.4, 0],
        ["o2", 0.35, 0.46, 140],
        ["x2", 0.39, 0.54, 300],
      ]),
      possessionBranch("delay-default-backcut", "Back Cut", [
        ["o3", 0.68, 0.68, 0],
        ["o1", 0.55, 0.36, 180],
        ["x3", 0.63, 0.6, 340],
      ]),
    )
  } else {
    branches.push(
      possessionBranch("default-space", "Spacing Read", [
        ["o1", 0.5, 0.34, 0],
        ["o4", 0.18, 0.74, 170],
        ["o5", 0.82, 0.74, 220],
      ]),
      possessionBranch("default-pressure", "Pressure Release", [
        ["o2", 0.28, 0.52, 0],
        ["o3", 0.72, 0.52, 90],
        ["x1", 0.5, 0.45, 280],
      ]),
    )
  }

  if (["Fast", "Push", "Early", "Transition"].includes(tempo)) {
    branches.push(
      possessionBranch("tempo-early-drag", "Early Drag", [
        ["o1", 0.42, 0.3, 0],
        ["o5", 0.58, 0.43, 110],
        ["x1", 0.46, 0.38, 300],
      ]),
    )
  } else if (["Controlled", "Patient", "Organized", "Halfcourt"].includes(tempo)) {
    branches.push(
      possessionBranch("tempo-controlled-reset", "Reset Angle", [
        ["o1", 0.5, 0.3, 0],
        ["o2", 0.33, 0.5, 220],
        ["o3", 0.67, 0.5, 280],
      ]),
    )
  }

  if (["Touch Paint", "Paint Collapse", "Kill Middle"].includes(emphasis)) {
    branches.push(
      possessionBranch("emphasis-touch-paint", "Touch Paint", [
        ["o1", 0.5, 0.53, 0],
        ["x1", 0.5, 0.58, 240],
        ["x4", 0.42, 0.72, 360],
        ["x5", 0.58, 0.72, 390],
      ]),
    )
  } else if (["Keep Width", "Sprint Lanes", "Weakside Ready"].includes(emphasis)) {
    branches.push(
      possessionBranch("emphasis-width", "Hold Width", [
        ["o4", 0.14, 0.75, 0],
        ["o5", 0.86, 0.75, 60],
        ["x4", 0.32, 0.72, 300],
        ["x5", 0.68, 0.72, 320],
      ]),
    )
  }

  if (["Drop", "Pack", "Zone"].includes(defense)) {
    branches.push(
      possessionBranch("defense-drop-window", "Pocket Window", [
        ["o2", 0.5, 0.58, 0],
        ["x1", 0.5, 0.5, 220],
        ["x3", 0.54, 0.68, 360],
      ]),
    )
  } else if (["Switch", "Blitz", "Trap"].includes(defense)) {
    branches.push(
      possessionBranch("defense-pressure-slip", "Pressure Slip", [
        ["o5", 0.57, 0.57, 0],
        ["o1", 0.37, 0.42, 160],
        ["x5", 0.53, 0.55, 320],
      ]),
    )
  }

  return branches.slice(0, 4)
}

function getContinuationBranches(activeBranchId: string, conditions: ActiveConditions): PossessionBranch[] {
  const defense = conditions.Defense ?? "Shell"
  const tempo = conditions.Tempo ?? "Controlled"
  const fast = ["Fast", "Push", "Early", "Transition"].includes(tempo)
  const pressure = ["Switch", "Blitz", "Trap", "ICE"].includes(defense)

  if (activeBranchId.includes("reject")) {
    return [
      possessionBranch("continue-reject-hammer", "Hammer", [
        ["o1", 0.36, 0.5, 0],
        ["o5", 0.84, 0.74, 170],
        ["x5", 0.65, 0.68, 360],
      ]),
      possessionBranch("continue-reject-skip", "Skip", [
        ["o1", 0.4, 0.45, 0],
        ["o5", 0.82, 0.7, 130],
        ["x4", 0.45, 0.68, 320],
      ]),
      possessionBranch("continue-reject-rescreen", "Re-screen", [
        ["o3", 0.52, 0.48, 0],
        ["o1", 0.58, 0.39, 180],
        ["x1", 0.55, 0.45, 340],
      ]),
      possessionBranch("continue-reject-middle", "Attack Middle", [
        ["o1", 0.52, 0.52, 0],
        ["x1", 0.5, 0.57, 280],
        ["o4", 0.16, 0.72, 360],
      ]),
    ]
  }

  if (activeBranchId.includes("paint") || activeBranchId.includes("pocket")) {
    return [
      possessionBranch("continue-paint-dunkspot", "Dunk Spot", [
        ["o2", 0.5, 0.68, 0],
        ["o4", 0.18, 0.74, 180],
        ["x4", 0.39, 0.73, 340],
      ]),
      possessionBranch("continue-paint-kick", "Kick Corner", [
        ["o1", 0.52, 0.56, 0],
        ["o5", 0.86, 0.72, 150],
        ["x5", 0.66, 0.68, 330],
      ]),
      possessionBranch("continue-paint-lift", "Slot Lift", [
        ["o3", 0.7, 0.48, 0],
        ["o1", 0.56, 0.46, 140],
        ["x3", 0.64, 0.55, 320],
      ]),
      possessionBranch(fast ? "continue-paint-early" : "continue-paint-reset", fast ? "Early Swing" : "Reset", [
        ["o1", fast ? 0.68 : 0.5, fast ? 0.36 : 0.3, 0],
        ["o2", 0.28, 0.5, 180],
        ["o3", 0.72, 0.5, 230],
      ]),
    ]
  }

  if (activeBranchId.includes("corner") || activeBranchId.includes("lift") || activeBranchId.includes("skip")) {
    return [
      possessionBranch("continue-lift-drive", "Baseline Drive", [
        ["o5", 0.82, 0.62, 0],
        ["x5", 0.72, 0.66, 260],
        ["o3", 0.68, 0.49, 330],
      ]),
      possessionBranch("continue-lift-extra", "Extra Pass", [
        ["o5", 0.86, 0.7, 0],
        ["o3", 0.72, 0.5, 140],
        ["x3", 0.64, 0.56, 320],
      ]),
      possessionBranch("continue-lift-drift", "Weakside Drift", [
        ["o4", 0.14, 0.73, 0],
        ["o1", 0.6, 0.36, 170],
        ["x4", 0.32, 0.7, 310],
      ]),
      possessionBranch(pressure ? "continue-lift-slip" : "continue-lift-hold", pressure ? "Slip Behind" : "Hold Width", [
        ["o2", pressure ? 0.5 : 0.22, pressure ? 0.63 : 0.48, 0],
        ["x2", 0.42, 0.58, 260],
        ["o5", 0.84, 0.72, 330],
      ]),
    ]
  }

  return [
    possessionBranch("continue-read-swing", "Swing", [
      ["o1", 0.62, 0.36, 0],
      ["o3", 0.76, 0.52, 130],
      ["x3", 0.67, 0.56, 310],
    ]),
    possessionBranch("continue-read-cut", "Cut", [
      ["o2", 0.46, 0.64, 0],
      ["x2", 0.44, 0.58, 260],
      ["o4", 0.17, 0.73, 330],
    ]),
    possessionBranch("continue-read-reverse", "Reverse", [
      ["o1", 0.44, 0.34, 0],
      ["o2", 0.24, 0.5, 160],
      ["o5", 0.82, 0.73, 260],
    ]),
    possessionBranch("continue-read-reset", "Reset", [
      ["o1", 0.5, 0.28, 0],
      ["x1", 0.5, 0.4, 300],
      ["o3", 0.72, 0.48, 360],
    ]),
  ]
}

function possessionBranch(id: string, name: string, moves: Array<[string, number, number, number]>): PossessionBranch {
  return {
    id,
    moves: moves.map(([moveId, x, y, delay], index) => ({
      delay,
      duration: 680 + index * 42,
      id: moveId,
      ...constrainToLiveCourt({ x, y }),
    })),
    name,
  }
}

function applyPossessionBranch(engine: Engine, branch: PossessionBranch, at: number) {
  const now = performance.now()
  const ballMove = branch.moves.find((move) => move.id.startsWith("o"))

  for (const move of branch.moves) {
    const puck = engine.pucks.find((item) => item.id === move.id)
    if (!puck || puck.id === engine.draggingPuckId) continue

    const to = { pressure: 0.5, t: at + move.delay, x: move.x, y: move.y }
    puck.choreography = {
      arc: movementArcFor(puck, to),
      delay: move.delay,
      duration: move.duration,
      from: { pressure: 0.5, t: at, x: puck.x, y: puck.y },
      startedAt: now,
      to,
    }
    puck.targetX = move.x
    puck.targetY = move.y
    puck.vx *= 0.18
    puck.vy *= 0.18
    rememberMove(engine, puck, { pressure: 0.5, t: at, x: puck.x, y: puck.y }, to)
  }

  if (ballMove) {
    passBallTo(engine, ballMove.id, at)
  }

  engine.advantageFlash = { t: now, x: branch.moves[0]?.x ?? 0.5, y: branch.moves[0]?.y ?? 0.5 }
  engine.formationPulseAt = at
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

  reinforceContinuityCell(engine, engine.ball.x, engine.ball.y, "pressure", 0.52 + clamp(Math.hypot(engine.ball.vx, engine.ball.vy) / 0.018, 0, 1) * 0.28)

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
  const ballSide = engine.ball
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

      const ballGap = distance(puck, engine.ball)
      const ballGravity = clamp(1 - ballGap / 0.44, 0, 1) * defense.help
      desiredX += (engine.ball.x - puck.baseX) * 0.042 * ballGravity
      desiredY += (engine.ball.y - puck.baseY) * 0.036 * ballGravity

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
        const ballPressure = clamp(1 - distance(puck, engine.ball) / 0.28, 0, 1)
        desiredX += (puck.x - nearestX.x) * 0.055 * pressure * offense.space
        desiredY += (puck.y - nearestX.y) * 0.055 * pressure * offense.space
        desiredX += (puck.x - engine.ball.x) * 0.024 * ballPressure * offense.space
        desiredY += (puck.y - engine.ball.y) * 0.018 * ballPressure * offense.space
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

function nearestPuck(origin: { id?: string; x: number; y: number }, pucks: Puck[], symbol: PuckSymbol) {
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

function findBallAt(engine: Engine, point: Point) {
  const rect = engine.rect
  if (!rect) return false

  const radius = ballHitRadius(rect.width, rect.height) / Math.min(rect.width, rect.height)
  return distance(engine.ball, point) < radius
}

function passBallTo(engine: Engine, carrierId: string, at: number) {
  const carrier = engine.pucks.find((puck) => puck.id === carrierId && puck.symbol === "O")
  if (!carrier) return

  const fromCarrierId = engine.ball.carrierId ?? engine.ball.lastCarrierId
  const startX = engine.ball.x
  const startY = engine.ball.y
  engine.ball.lastCarrierId = fromCarrierId
  engine.ball.carrierId = null
  engine.ball.passedAt = performance.now()
  engine.ball.state = "passing"
  engine.ball.targetCarrierId = carrier.id
  const offset = ballOwnershipOffset(carrier)
  engine.ball.targetX = carrier.x + offset.x
  engine.ball.targetY = carrier.y + offset.y
  const dx = engine.ball.targetX - startX
  const dy = engine.ball.targetY - startY
  const passLength = Math.max(0.001, Math.hypot(dx, dy))
  const arcDirection = carrier.x >= startX ? 1 : -1
  engine.ball.passArc = arcDirection * clamp(passLength / 0.56, 0.35, 1) * 0.0034
  engine.ball.vx += (dx / passLength) * 0.016
  engine.ball.vy += (dy / passLength) * 0.016
  engine.ball.trail.push({ t: at, x: engine.ball.x, y: engine.ball.y })
  if (engine.ball.trail.length > 24) engine.ball.trail.shift()
  onPossessionChange(engine, fromCarrierId, null, "passing", at)
}

function setBallOwned(engine: Engine, carrierId: string, at: number) {
  const carrier = engine.pucks.find((puck) => puck.id === carrierId && puck.symbol === "O")
  if (!carrier) return

  const fromCarrierId = engine.ball.carrierId ?? engine.ball.lastCarrierId
  const offset = ballOwnershipOffset(carrier)
  engine.ball.carrierId = carrier.id
  engine.ball.lastCarrierId = carrier.id
  engine.ball.passArc = 0
  engine.ball.state = "owned"
  engine.ball.targetCarrierId = carrier.id
  engine.ball.x = carrier.x + offset.x
  engine.ball.y = carrier.y + offset.y
  engine.ball.targetX = engine.ball.x
  engine.ball.targetY = engine.ball.y
  engine.ball.vx *= 0.18
  engine.ball.vy *= 0.18
  onPossessionChange(engine, fromCarrierId, carrier.id, "owned", at)
}

function setBallLoose(engine: Engine, point: { x: number; y: number }, at: number) {
  const fromCarrierId = engine.ball.carrierId ?? engine.ball.lastCarrierId
  engine.ball.lastCarrierId = fromCarrierId
  engine.ball.carrierId = null
  engine.ball.passArc = 0
  engine.ball.state = "loose"
  engine.ball.targetCarrierId = null
  engine.ball.targetX = point.x
  engine.ball.targetY = point.y
  onPossessionChange(engine, fromCarrierId, null, "loose", at)
}

function setBallShot(engine: Engine, at: number) {
  const fromCarrierId = engine.ball.carrierId ?? engine.ball.lastCarrierId
  engine.ball.lastCarrierId = fromCarrierId
  engine.ball.carrierId = null
  engine.ball.passedAt = performance.now()
  engine.ball.passArc = 0.0022
  engine.ball.state = "shot"
  engine.ball.targetCarrierId = null
  engine.ball.targetX = 0.5
  engine.ball.targetY = 0.78
  engine.ball.vx += (engine.ball.targetX - engine.ball.x) * 0.12
  engine.ball.vy += (engine.ball.targetY - engine.ball.y) * 0.12
  engine.ball.trail.push({ t: at, x: engine.ball.x, y: engine.ball.y })
  if (engine.ball.trail.length > 24) engine.ball.trail.shift()
  onPossessionChange(engine, fromCarrierId, null, "shot", at)
}

function onPossessionChange(engine: Engine, fromCarrierId: string | null, toCarrierId: string | null, state: Ball["state"], at: number) {
  if (fromCarrierId === toCarrierId && state === "owned" && performance.now() - engine.possessionChangedAt < 180) return

  const now = performance.now()
  engine.possessionChangedAt = now
  engine.advantageFlash = { t: engine.possessionChangedAt, x: engine.ball.x, y: engine.ball.y }
  engine.possessionEvents.push({
    at,
    fromCarrierId,
    id: `possession-${engine.possessionEvents.length + 1}`,
    state,
    toCarrierId,
    x: engine.ball.x,
    y: engine.ball.y,
  })
  if (engine.possessionEvents.length > 48) engine.possessionEvents.shift()
}

function ballOwnershipOffset(carrier: { x: number; y: number }) {
  const side = carrier.x < 0.5 ? 1 : -1
  return {
    x: side * 0.018,
    y: -0.01,
  }
}

function constrainToLiveCourt(point: { x: number; y: number }) {
  return {
    x: clamp(point.x, LIVE_COURT.left, LIVE_COURT.right),
    y: clamp(point.y, LIVE_COURT.top, LIVE_COURT.bottom),
  }
}

function softBoundaryTarget(point: { x: number; y: number; targetX: number; targetY: number }) {
  let x = point.targetX
  let y = point.targetY
  const edge = 0.055

  if (x < LIVE_COURT.left + edge) x += (LIVE_COURT.left + edge - x) * 0.2
  if (x > LIVE_COURT.right - edge) x -= (x - (LIVE_COURT.right - edge)) * 0.2
  if (y < LIVE_COURT.top + edge) y += (LIVE_COURT.top + edge - y) * 0.18
  if (y > LIVE_COURT.bottom - edge) y -= (y - (LIVE_COURT.bottom - edge)) * 0.2

  return constrainToLiveCourt({ x, y })
}

function preferredZoneForPuck(puck: Puck, ball: Ball) {
  const side = ball.x < 0.5 ? "left" : "right"
  const weak = side === "left" ? "right" : "left"

  if (puck.symbol === "X") {
    if (puck.id === "x1") return zoneById(ball.y > 0.48 ? "nail" : "top")
    if (puck.id === "x2") return zoneById(side === "left" ? "wing-left" : "slot-left")
    if (puck.id === "x3") return zoneById(side === "right" ? "wing-right" : "slot-right")
    if (puck.id === "x4") return zoneById(weak === "left" ? "short-left" : "dunker-left")
    return zoneById(weak === "right" ? "short-right" : "dunker-right")
  }

  if (puck.id === "o1") return zoneById(ball.carrierId === puck.id ? "top" : ball.x < 0.5 ? "slot-left" : "slot-right")
  if (puck.id === "o2") return zoneById("wing-left")
  if (puck.id === "o3") return zoneById("wing-right")
  if (puck.id === "o4") return zoneById(ball.y > 0.58 ? "dunker-left" : "corner-left")
  if (puck.id === "o5") return zoneById(ball.y > 0.58 ? "dunker-right" : "corner-right")
  return null
}

function zoneById(id: string) {
  return courtZones.find((zone) => zone.id === id) ?? null
}

function zoneInfluence(puck: Puck, zone: CourtZone) {
  const gap = distance(puck, zone)
  return clamp(gap / zone.radius, 0, 1)
}

function softenCollisions(pucks: Puck[]) {
  for (let outer = 0; outer < pucks.length; outer += 1) {
    for (let inner = outer + 1; inner < pucks.length; inner += 1) {
      const first = pucks[outer]
      const second = pucks[inner]
      const minimum = first.symbol === second.symbol ? 0.105 : 0.082
      const gap = distance(first, second)
      if (gap <= 0.001 || gap >= minimum) continue

      const push = (minimum - gap) * 0.42
      const dx = (first.x - second.x) / gap
      const dy = (first.y - second.y) / gap
      first.targetX += dx * push
      first.targetY += dy * push
      second.targetX -= dx * push
      second.targetY -= dy * push
    }
  }
}

function movementArcFor(puck: Puck, to: { x: number; y: number }) {
  const phase = idPhase(puck.id)
  const traffic = puck.symbol === "O" ? 0.018 : 0.013
  const side = to.x > puck.x ? 1 : -1
  return (Math.sin(phase) > 0 ? 1 : -1) * side * traffic
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

function cloneBall(ball: Ball) {
  return { ...ball, trail: [] }
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

function ballHitRadius(width: number, height: number) {
  return Math.max(28, Math.min(width, height) * 0.05)
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

function easeOutBack(value: number) {
  const tension = 1.18
  return 1 + (tension + 1) * (value - 1) ** 3 + tension * (value - 1) ** 2
}

function symbolGlow(symbol: PuckSymbol, alpha: number) {
  if (symbol === "O") return `rgba(45,40,34,${alpha * 0.62})`
  return `rgba(96,91,83,${alpha * 0.52})`
}

function continuityColor(symbol: ContinuityCell["symbol"], alpha: number) {
  if (symbol === "O") return `rgba(45,40,34,${alpha * 0.72})`
  if (symbol === "X") return `rgba(96,91,83,${alpha * 0.64})`
  return `rgba(171,111,42,${alpha * 0.72})`
}
