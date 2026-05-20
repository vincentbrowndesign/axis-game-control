import type { TemporalEventPayload, TemporalReplayWindow } from "@/lib/temporalEventGraph"

export type ContinuityAttentionState =
  | "IDLE"
  | "WATCHING"
  | "TRACKING"
  | "LOCKING"
  | "OVERLOADED"

export type ContinuityPrimitive =
  | "MOVE"
  | "STOP"
  | "TURN"
  | "FAST"
  | "SLOW"
  | "OPEN"
  | "CLOSE"
  | "SET"
  | "OFF"
  | "LEAN"
  | "LAND"
  | "JUMP"

export const continuityPrimitives: ContinuityPrimitive[] = [
  "MOVE",
  "STOP",
  "TURN",
  "FAST",
  "SLOW",
  "OPEN",
  "CLOSE",
  "SET",
  "OFF",
  "LEAN",
  "LAND",
  "JUMP",
]

export type BasketballEvent =
  | "MAKE"
  | "MISS"
  | "ASSIST"
  | "TURNOVER"
  | "REBOUND"
  | "STEAL"
  | "BLOCK"
  | "FOUL"
  | "SHOT"
  | "PASS"
  | "DRIVE"

export type BasketballReconstructionChapter =
  | "Drive Sequence"
  | "Shot Attempt"
  | "Transition Window"
  | "Recovery Sequence"
  | "Ball Movement"
  | "Possession Shift"
  | "Release Window"
  | "Movement Reset"

export const basketballEvents: BasketballEvent[] = [
  "MAKE",
  "MISS",
  "ASSIST",
  "TURNOVER",
  "REBOUND",
  "STEAL",
  "BLOCK",
  "FOUL",
  "SHOT",
  "PASS",
  "DRIVE",
]

export type ContinuityRegion = {
  x: number
  y: number
  width: number
  height: number
  energy: number
  velocityX: number
  velocityY: number
}

export type ContinuityAssistSample = {
  recordedAt: number
  attentionState: ContinuityAttentionState
  pressure: number
  kineticDensity: number
  motionEnergy: number
  acceleration: number
  movementOrigin: {
    x: number
    y: number
  } | null
  primaryRegion: ContinuityRegion | null
  primitives: ContinuityPrimitive[]
}

export type ReplayNegotiationType =
  | "EVENT_JUMP"
  | "RAIL_JUMP"
  | "SNAPSHOT_JUMP"
  | "FREEZE_FRAME"
  | "SCRUB"
  | "ANNOTATION"
  | "EXPORT"
  | "LANGUAGE_ROUTE"

export function reconstructionChapterForEvent(
  event: BasketballEvent
): BasketballReconstructionChapter {
  if (event === "DRIVE") return "Drive Sequence"
  if (event === "SHOT" || event === "MAKE" || event === "MISS") return "Shot Attempt"
  if (event === "ASSIST" || event === "PASS") return "Ball Movement"
  if (event === "TURNOVER" || event === "STEAL" || event === "BLOCK") {
    return "Possession Shift"
  }
  if (event === "REBOUND") return "Recovery Sequence"
  if (event === "FOUL") return "Movement Reset"

  return "Transition Window"
}

type ReplayNegotiationRecord = {
  id: string
  type: ReplayNegotiationType
  sessionId: string
  sessionTime: number
  createdAt: string
}

const negotiationStorageKey = "axis:replay-negotiation:v1"

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function round(value: number, precision = 3) {
  const scale = 10 ** precision
  return Math.round(value * scale) / scale
}

function stableId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `axis-negotiation-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function generateContinuityPrimitives({
  attentionState,
  pressure,
  kineticDensity,
  motionEnergy,
  acceleration,
  primaryRegion,
  previousRegion,
}: {
  attentionState: ContinuityAttentionState
  pressure: number
  kineticDensity: number
  motionEnergy: number
  acceleration: number
  primaryRegion: ContinuityRegion | null
  previousRegion: ContinuityRegion | null
}): ContinuityPrimitive[] {
  const primitives = new Set<ContinuityPrimitive>()
  const velocity = primaryRegion
    ? Math.sqrt(primaryRegion.velocityX ** 2 + primaryRegion.velocityY ** 2)
    : 0

  if (motionEnergy < 0.035 && pressure < 0.06) primitives.add("SET")
  if (!primaryRegion && previousRegion && previousRegion.energy > 0.22 && motionEnergy < 0.045) {
    primitives.add("STOP")
    primitives.add("LAND")
  }
  if (motionEnergy > 0.06) primitives.add("MOVE")
  if (acceleration > 0.16) primitives.add("TURN")
  if (acceleration > 0.28 || pressure > 0.48) primitives.add("FAST")
  if (attentionState === "LOCKING" && kineticDensity > 0.42) {
    primitives.add("SET")
  }
  if (attentionState === "OVERLOADED") primitives.add("OFF")
  if (pressure > 0.36) primitives.add("CLOSE")
  if (previousRegion && primaryRegion) {
    const previousAngle = Math.atan2(previousRegion.velocityY, previousRegion.velocityX)
    const nextAngle = Math.atan2(primaryRegion.velocityY, primaryRegion.velocityX)
    const angleDelta = Math.abs(previousAngle - nextAngle)
    const centerDelta = Math.sqrt(
      (primaryRegion.x - previousRegion.x) ** 2 + (primaryRegion.y - previousRegion.y) ** 2
    )

    if (velocity > 0.7 && angleDelta > 1.1) primitives.add("TURN")
    if (centerDelta > 5.5) primitives.add("LEAN")
    if (primaryRegion.velocityY < -0.9 && velocity > 0.7) primitives.add("JUMP")
    if (previousRegion.energy > 0.28 && primaryRegion.energy < 0.12) {
      primitives.add("STOP")
      primitives.add("LAND")
    }
  }
  if (pressure < 0.18 && motionEnergy > 0.06 && acceleration < 0.08) primitives.add("SLOW")

  return Array.from(primitives).slice(0, 4)
}

export function buildContinuitySnapshotPayload(
  sessionTime: number,
  sample: ContinuityAssistSample | null
): TemporalEventPayload {
  const stale = !sample || Date.now() - sample.recordedAt > 3200

  if (stale) {
    return {
      replay_window: {
        before: 8,
        after: 8,
      },
      continuity_assist: {
        version: 1,
        source: "fallback",
        attention_anchor: round(Math.max(0, sessionTime)),
        primitives: [] as ContinuityPrimitive[],
      },
    }
  }

  const pressure = clamp(sample.pressure, 0, 1)
  const density = clamp(sample.kineticDensity, 0, 1)
  const hasStop = sample.primitives.includes("STOP") || sample.primitives.includes("SET")
  const active = sample.attentionState === "TRACKING" || sample.attentionState === "LOCKING"
  const overloaded = sample.attentionState === "OVERLOADED"
  const before = hasStop
    ? 4.25
    : overloaded
      ? 5.75
      : active
        ? 3.75 + (1 - pressure) * 1.25
        : 6.5
  const after = hasStop ? 2.25 : active ? 2.75 + density * 1.25 : 4.5
  const anchorPull = active ? clamp(pressure * 1.65 + sample.acceleration * 1.15, 0, 2.4) : 0

  return {
    replay_window: {
      before: round(before, 2),
      after: round(after, 2),
    } satisfies TemporalReplayWindow,
    continuity_assist: {
      version: 1,
      source: "live_perception",
      attention_state: sample.attentionState,
      attention_anchor: round(Math.max(0, sessionTime - anchorPull)),
      pressure: round(pressure),
      kinetic_density: round(density),
      motion_energy: round(sample.motionEnergy),
      acceleration: round(sample.acceleration),
      movement_origin: sample.movementOrigin
        ? {
            x: round(sample.movementOrigin.x, 2),
            y: round(sample.movementOrigin.y, 2),
          }
        : null,
      primary_region: sample.primaryRegion
        ? {
            x: round(sample.primaryRegion.x, 2),
            y: round(sample.primaryRegion.y, 2),
            width: round(sample.primaryRegion.width, 2),
            height: round(sample.primaryRegion.height, 2),
            energy: round(sample.primaryRegion.energy),
          }
        : null,
      primitives: sample.primitives,
    },
  }
}

export function recordReplayNegotiation({
  sessionId,
  sessionTime,
  type,
}: {
  sessionId: string
  sessionTime: number
  type: ReplayNegotiationType
}) {
  if (typeof window === "undefined" || !sessionId) return

  const record: ReplayNegotiationRecord = {
    id: stableId(),
    type,
    sessionId,
    sessionTime: round(sessionTime),
    createdAt: new Date().toISOString(),
  }

  try {
    const current = JSON.parse(
      window.localStorage.getItem(negotiationStorageKey) || "[]"
    ) as ReplayNegotiationRecord[]
    const next = [...current, record]
      .filter((item) => item && item.sessionId && Number.isFinite(item.sessionTime))
      .slice(-600)

    window.localStorage.setItem(negotiationStorageKey, JSON.stringify(next))
  } catch {
    return
  }
}
