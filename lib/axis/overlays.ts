import type { AxisMemoryObject } from "@/lib/axis/types"

export type AxisOverlayKind = "pose" | "movement" | "spatial" | "continuity" | "pressure"

export type AxisPoseOverlayFocus =
  | "skeleton"
  | "landmarks"
  | "release"
  | "balance"
  | "shoulders"
  | "feet"
  | "movement"

export type AxisOverlayPoint = {
  x: number
  y: number
}

export type AxisMovementOverlayOutput = {
  releaseAngle: number | null
  balanceState: "centered" | "left" | "right" | "forward" | "back" | null
  footAlignment: "set" | "narrow" | "wide" | "staggered" | null
  movementPath: AxisOverlayPoint[]
  landmarks: Record<string, AxisOverlayPoint>
}

export type AxisOverlayState = {
  id: string
  kind: AxisOverlayKind
  focus: AxisPoseOverlayFocus
  label: string
  memoryId: string | null
  createdAt: number
  output: AxisMovementOverlayOutput
}

export type AxisMemoryOverlayEnrichment = {
  overlayId: string
  label: string
  output: AxisMovementOverlayOutput
}

export function resolvePoseOverlayFocus(query: string): AxisPoseOverlayFocus {
  const normalized = query.toLowerCase()
  if (/\brelease|jumper|shot\b/.test(normalized)) return "release"
  if (/\bbalance|axis\b/.test(normalized)) return "balance"
  if (/\bshoulder|alignment\b/.test(normalized)) return "shoulders"
  if (/\bfeet|foot|placement\b/.test(normalized)) return "feet"
  if (/\bmove|movement|path|direction\b/.test(normalized)) return "movement"
  if (/\blandmark/.test(normalized)) return "landmarks"
  return "skeleton"
}

export function buildPoseOverlay(memory: AxisMemoryObject | null, query: string): AxisOverlayState {
  const focus = resolvePoseOverlayFocus(query)

  return {
    id: `overlay-${Date.now().toString(36)}`,
    kind: focus === "movement" ? "movement" : "pose",
    focus,
    label: overlayLabel(focus),
    memoryId: memory?.id ?? null,
    createdAt: Date.now(),
    output: {
      releaseAngle: focus === "release" ? 48 : null,
      balanceState: focus === "balance" || focus === "skeleton" ? "centered" : null,
      footAlignment: focus === "feet" || focus === "skeleton" ? "set" : null,
      movementPath: [
        { x: 24, y: 72 },
        { x: 37, y: 63 },
        { x: 48, y: 52 },
        { x: 58, y: 41 },
      ],
      landmarks: {
        head: { x: 51, y: 20 },
        leftShoulder: { x: 42, y: 34 },
        rightShoulder: { x: 61, y: 34 },
        leftElbow: { x: 36, y: 48 },
        rightElbow: { x: 68, y: 43 },
        leftWrist: { x: 33, y: 60 },
        rightWrist: { x: 74, y: 28 },
        hip: { x: 51, y: 58 },
        leftKnee: { x: 44, y: 76 },
        rightKnee: { x: 59, y: 76 },
        leftFoot: { x: 39, y: 91 },
        rightFoot: { x: 65, y: 91 },
      },
    },
  }
}

function overlayLabel(focus: AxisPoseOverlayFocus) {
  if (focus === "release") return "Release"
  if (focus === "balance") return "Balance"
  if (focus === "shoulders") return "Shoulders"
  if (focus === "feet") return "Footing"
  if (focus === "movement") return "Movement"
  if (focus === "landmarks") return "Landmarks"
  return "Form"
}
