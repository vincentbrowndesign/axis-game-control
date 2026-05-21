import type { AxisPoseFrame, AxisPoseLandmark } from "@/lib/axis/perception/mediapipePose"

export type AxisMotionPoint = {
  x: number
  y: number
}

export type AxisMotionSignature =
  | {
      id: string
      type: "shot_arc"
      createdAt: number
      ttlMs: number
      intensity: number
      points: AxisMotionPoint[]
    }
  | {
      id: string
      type: "pressure_streak"
      createdAt: number
      ttlMs: number
      intensity: number
      from: AxisMotionPoint
      to: AxisMotionPoint
    }

type MotionSample = {
  timestampMs: number
  center: AxisMotionPoint
  wrist: AxisMotionPoint
}

const SHOT_ARC_TTL_MS = 1320
const PRESSURE_STREAK_TTL_MS = 860
const MIN_PRESSURE_VELOCITY = 0.00042
const MIN_RELEASE_VELOCITY = 0.00034

export class AxisMotionSignatureTracker {
  private previous: MotionSample | null = null
  private signatures: AxisMotionSignature[] = []

  update(frame: AxisPoseFrame): AxisMotionSignature[] {
    const sample = toMotionSample(frame)
    if (!sample) return this.active(frame.timestampMs)

    if (this.previous) {
      const deltaMs = Math.max(1, sample.timestampMs - this.previous.timestampMs)
      const centerVelocity = velocity(this.previous.center, sample.center, deltaMs)
      const wristVelocity = velocity(this.previous.wrist, sample.wrist, deltaMs)

      if (magnitude(centerVelocity) >= MIN_PRESSURE_VELOCITY) {
        this.signatures.push(createPressureStreak(this.previous.center, sample.center, frame.timestampMs, magnitude(centerVelocity)))
      }

      if (wristVelocity.y < -MIN_RELEASE_VELOCITY && Math.abs(wristVelocity.y) > Math.abs(wristVelocity.x) * 0.72) {
        this.signatures.push(createShotArc(sample.wrist, wristVelocity, frame.timestampMs))
      }
    }

    this.previous = sample
    return this.active(frame.timestampMs)
  }

  reset() {
    this.previous = null
    this.signatures = []
  }

  private active(now: number) {
    this.signatures = this.signatures.filter((signature) => now - signature.createdAt <= signature.ttlMs)
    return this.signatures
  }
}

function toMotionSample(frame: AxisPoseFrame): MotionSample | null {
  const leftHip = frame.landmarks[23]
  const rightHip = frame.landmarks[24]
  const leftShoulder = frame.landmarks[11]
  const rightShoulder = frame.landmarks[12]
  const leftWrist = frame.landmarks[15]
  const rightWrist = frame.landmarks[16]
  const center = averageVisible([leftHip, rightHip, leftShoulder, rightShoulder])
  const wrist = mostLiftedVisible([leftWrist, rightWrist])

  if (!center || !wrist) return null

  return {
    timestampMs: frame.timestampMs,
    center,
    wrist,
  }
}

function createShotArc(origin: AxisMotionPoint, wristVelocity: AxisMotionPoint, createdAt: number): AxisMotionSignature {
  const horizontal = clamp(wristVelocity.x * 820, -0.18, 0.18)
  const lift = clamp(Math.abs(wristVelocity.y) * 760, 0.14, 0.28)
  const end = {
    x: clamp(origin.x + horizontal + 0.1, 0.04, 0.96),
    y: clamp(origin.y - lift, 0.04, 0.96),
  }
  const apex = {
    x: clamp((origin.x + end.x) / 2 + horizontal * 0.3, 0.04, 0.96),
    y: clamp(Math.min(origin.y, end.y) - lift * 0.52, 0.03, 0.94),
  }

  return {
    id: `shot-${createdAt.toString(36)}`,
    type: "shot_arc",
    createdAt,
    ttlMs: SHOT_ARC_TTL_MS,
    intensity: clamp(Math.abs(wristVelocity.y) * 1600, 0.28, 0.72),
    points: [origin, apex, end],
  }
}

function createPressureStreak(from: AxisMotionPoint, to: AxisMotionPoint, createdAt: number, speed: number): AxisMotionSignature {
  return {
    id: `pressure-${createdAt.toString(36)}`,
    type: "pressure_streak",
    createdAt,
    ttlMs: PRESSURE_STREAK_TTL_MS,
    intensity: clamp(speed * 1450, 0.24, 0.68),
    from,
    to,
  }
}

function averageVisible(points: Array<AxisPoseLandmark | undefined>): AxisMotionPoint | null {
  const visible = points.filter(isVisible)
  if (!visible.length) return null

  return {
    x: visible.reduce((sum, point) => sum + point.x, 0) / visible.length,
    y: visible.reduce((sum, point) => sum + point.y, 0) / visible.length,
  }
}

function mostLiftedVisible(points: Array<AxisPoseLandmark | undefined>): AxisMotionPoint | null {
  const visible = points.filter(isVisible).sort((a, b) => a.y - b.y)
  const point = visible[0]
  return point
    ? {
        x: point.x,
        y: point.y,
      }
    : null
}

function isVisible(point: AxisPoseLandmark | undefined): point is AxisPoseLandmark {
  return Boolean(point && (point.visibility === undefined || point.visibility >= 0.38))
}

function velocity(from: AxisMotionPoint, to: AxisMotionPoint, deltaMs: number) {
  return {
    x: (to.x - from.x) / deltaMs,
    y: (to.y - from.y) / deltaMs,
  }
}

function magnitude(point: AxisMotionPoint) {
  return Math.hypot(point.x, point.y)
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}
