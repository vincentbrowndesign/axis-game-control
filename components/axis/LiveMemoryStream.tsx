"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  type LiveArchiveSession,
  type LiveIngestEvent,
  type LiveIngestEventType,
  type LiveSessionStatus,
  loadArchivedRecording,
  saveArchivedRecording,
} from "@/lib/liveArchive"
import { useAxisChronologyStore } from "@/lib/axisChronologyStore"
import {
  buildContinuitySnapshotPayload,
  generateContinuityPrimitives,
  reconstructionChapterForEvent,
  type BasketballEvent,
  type ContinuityAssistSample,
  type ContinuityRegion,
} from "@/lib/continuityAssistance"
import { startPassiveContinuityObservers } from "@/lib/passiveContinuityObservers"
import { captureVideoFrameBlob } from "@/lib/snapshotCapture"
import { defaultReplayWindow, type TemporalEventType } from "@/lib/temporalEventGraph"
import { blobFromUrl } from "@/lib/trainingSetMemory"
import {
  applyLiveStatEvent,
  createLiveBasketballStatEvent,
  createLiveBoxScore,
  liveScoringInputForAction,
  liveScoringInputs,
  scoreFromLiveBoxScore,
  summarizeLiveReport,
  type LiveBasketballStatEvent,
  type LiveBoxScore,
  type LiveScoringInput,
  type LiveStatTeam,
} from "@/lib/liveBasketballStats"
import type { AxisGameAction } from "@/lib/axisEventModel"
import { AxisScorebug } from "@/components/axis/AxisPrimitives"
import type { AxisCommandPayload } from "@/lib/axisCommand"

type WorkingSession = {
  id: string
  status: Exclude<LiveSessionStatus, "ARCHIVED">
  startedAt: string
  endedAt: string | null
  duration: number
  playbackUrl: string | null
  storagePath: string | null
  createdAt: string
}

type LiveViewMode = "RECON" | "MOTION_ECHO"
type LiveOpticalDepth = 0.5 | 1 | 2 | 2.5

type AttentionState = "IDLE" | "WATCHING" | "TRACKING" | "LOCKING" | "OVERLOADED"

type MotionLock = {
  id: string
  x: number
  y: number
  width: number
  height: number
  energy: number
  previousX: number
  previousY: number
  velocityX: number
  velocityY: number
}

type ResidueLock = MotionLock & {
  life: number
}

type RoboflowConfig = {
  apiKey: string
  model: string
  version: string
}

type RoboflowPrediction = {
  x?: number
  y?: number
  width?: number
  height?: number
  confidence?: number
}

type PendingContinuitySelection = {
  sessionTime: number
  snapshotId: string | null
  suggested: BasketballEvent[]
  openedAt: number
}

type LiveMemoryDraft = {
  raw: string
  team: LiveStatTeam | null
  player: string | null
  action: AxisGameAction | null
}

type LiveMemoryQuestion = {
  prompt: "who?" | "who/team?" | "home or away?" | "2 or 3?"
  draft: LiveMemoryDraft
}

type LiveMemoryResolution =
  | {
      kind: "stat"
      raw: string
      team: LiveStatTeam
      player: string | null
      action: AxisGameAction
    }
  | {
      kind: "question"
      prompt: LiveMemoryQuestion["prompt"]
      draft: LiveMemoryDraft
    }
  | {
      kind: "memory"
      raw: string
      label: string
    }

const recorderTypes = [
  "video/mp4;codecs=h264,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm",
]

const mobileCaptureConstraints: MediaStreamConstraints = {
  video: {
    facingMode: "environment",
    width: {
      ideal: 1280,
    },
    height: {
      ideal: 720,
    },
    frameRate: {
      ideal: 30,
      max: 30,
    },
    aspectRatio: 1.777777778,
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
}

const reconnectDebounceMs = 1400
const trackFailureGraceMs = 5200
const recorderTimesliceMs = 2000
const trainingLabels = ["ball", "rim", "make", "miss", "release", "other"] as const
const primaryScoringActions = liveScoringInputs.slice(0, 6)
const secondaryStatActions = liveScoringInputs.slice(6)

type TrainingLabel = (typeof trainingLabels)[number]

function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function getRoboflowConfig(): RoboflowConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY
  const model = process.env.NEXT_PUBLIC_ROBOFLOW_MODEL
  const version = process.env.NEXT_PUBLIC_ROBOFLOW_VERSION

  if (!apiKey || !model || !version) return null

  return {
    apiKey,
    model,
    version,
  }
}

function normalizeRoboflowPrediction(
  prediction: RoboflowPrediction,
  canvasWidth: number,
  canvasHeight: number,
  index: number
): MotionLock | null {
  const width = Number(prediction.width) || 0
  const height = Number(prediction.height) || 0
  const centerX = Number(prediction.x) || 0
  const centerY = Number(prediction.y) || 0

  if (width <= 0 || height <= 0 || canvasWidth <= 0 || canvasHeight <= 0) return null

  const x = clamp01((centerX - width / 2) / canvasWidth) * 100
  const y = clamp01((centerY - height / 2) / canvasHeight) * 100
  const normalizedWidth = clamp01(width / canvasWidth) * 100
  const normalizedHeight = clamp01(height / canvasHeight) * 100
  const confidence = clamp01(Number(prediction.confidence) || 0.42)
  const energy = clamp01(0.2 + confidence * 0.72)

  return {
    id: `rf-${index}`,
    x,
    y,
    width: Math.max(5, normalizedWidth),
    height: Math.max(7, normalizedHeight),
    energy,
    previousX: x,
    previousY: y,
    velocityX: 0,
    velocityY: 0,
  }
}

async function inferRoboflowLocks({
  config,
  canvas,
}: {
  config: RoboflowConfig
  canvas: HTMLCanvasElement
}) {
  const encoded = canvas.toDataURL("image/jpeg", 0.52).split(",")[1]
  if (!encoded) return []

  const response = await fetch(
    `https://detect.roboflow.com/${encodeURIComponent(config.model)}/${encodeURIComponent(
      config.version
    )}?api_key=${encodeURIComponent(config.apiKey)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: encoded,
    }
  )

  if (!response.ok) return []

  const payload = (await response.json().catch(() => null)) as {
    predictions?: RoboflowPrediction[]
  } | null

  return (payload?.predictions || [])
    .slice(0, 6)
    .flatMap((prediction, index) => {
      const lock = normalizeRoboflowPrediction(
        prediction,
        canvas.width,
        canvas.height,
        index
      )

      return lock ? [lock] : []
    })
}

function createId(prefix = "axis") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function BasketballEventSelector({
  pending,
  onCancel,
  onSelect,
}: {
  pending: PendingContinuitySelection
  onCancel: () => void
  onSelect: (input: LiveScoringInput, machineSuggested: boolean) => void
}) {
  const visibleSuggested = pending.suggested
  const selectInput = (input: LiveScoringInput) => {
    onSelect(input, visibleSuggested.includes(input.type))
  }

  return (
    <div className="absolute inset-x-0 bottom-24 z-30 flex justify-center px-4">
      <div className="axis-operator-hub axis-operator-protected w-full max-w-sm p-2" aria-label="Tag play">
        <div className="mb-2 grid grid-cols-3 gap-1">
          {primaryScoringActions.map((input) => {
            const suggested = visibleSuggested.includes(input.type)

            return (
              <button
                key={input.action}
                type="button"
                onClick={() => selectInput(input)}
                className={`axis-mono axis-optical-transition min-h-11 px-2 py-2 text-[9px] font-black uppercase tracking-[0.12em] transition ${
                  suggested ? "axis-familiar-primary" : "axis-familiar-control"
                }`}
              >
                {input.label}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-6 gap-1">
          {secondaryStatActions.map((input) => (
            <button
              key={input.action}
              type="button"
              onClick={() => selectInput(input)}
              className="axis-mono axis-familiar-control min-h-9 px-1 text-[8px] font-black uppercase tracking-[0.08em]"
            >
              {input.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="axis-mono mt-2 w-full py-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/44 transition hover:text-white/78"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function LiveMachinePerceptionOverlay({
  active,
  enabled,
  onContinuitySample,
  videoRef,
}: {
  active: boolean
  enabled: boolean
  onContinuitySample?: (sample: ContinuityAssistSample) => void
  videoRef: RefObject<HTMLVideoElement | null>
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null)
  const smoothedLocksRef = useRef<MotionLock[]>([])
  const residueLocksRef = useRef<ResidueLock[]>([])
  const roboflowLocksRef = useRef<MotionLock[]>([])
  const roboflowSeenAtRef = useRef(0)
  const roboflowRequestRef = useRef(false)
  const attentionStateRef = useRef<AttentionState>("IDLE")
  const pressureRef = useRef(0)
  const lastEnergyRef = useRef(0)
  const lastContinuitySampleAtRef = useRef(0)
  const lastPrimaryRegionRef = useRef<ContinuityRegion | null>(null)

  useEffect(() => {
    if (!enabled || !active || typeof document === "undefined") {
      previousFrameRef.current = null
      smoothedLocksRef.current = []
      residueLocksRef.current = []
      roboflowLocksRef.current = []
      roboflowSeenAtRef.current = 0
      attentionStateRef.current = "IDLE"
      pressureRef.current = 0
      lastEnergyRef.current = 0
      lastContinuitySampleAtRef.current = 0
      lastPrimaryRegionRef.current = null
      return
    }

    const overlayCanvas = canvasRef.current
    if (!overlayCanvas) return

    const roboflowConfig = getRoboflowConfig()
    let frameId = 0
    let lastSampleAt = 0
    let lastRoboflowAt = 0
    let disposed = false
    const sampleWidth = 96
    const sampleHeight = 54
    const sampleCanvas = document.createElement("canvas")
    sampleCanvas.width = sampleWidth
    sampleCanvas.height = sampleHeight
    const sampleContext = sampleCanvas.getContext("2d", {
      willReadFrequently: true,
    })
    const inferenceCanvas = document.createElement("canvas")
    inferenceCanvas.width = 416
    inferenceCanvas.height = 234
    const inferenceContext = inferenceCanvas.getContext("2d")
    const emitContinuitySample = ({
      timestamp,
      locks,
      rawEnergy,
      acceleration,
      density,
    }: {
      timestamp: number
      locks: MotionLock[]
      rawEnergy: number
      acceleration: number
      density: number
    }) => {
      if (!onContinuitySample || timestamp - lastContinuitySampleAtRef.current < 240) {
        return
      }

      lastContinuitySampleAtRef.current = timestamp

      const attentionState = attentionStateRef.current
      const pressure = pressureRef.current
      const primaryLock = locks.reduce<MotionLock | null>(
        (primary, lock) => (!primary || lock.energy > primary.energy ? lock : primary),
        null
      )
      const primaryRegion: ContinuityRegion | null = primaryLock
        ? {
            x: primaryLock.x,
            y: primaryLock.y,
            width: primaryLock.width,
            height: primaryLock.height,
            energy: primaryLock.energy,
            velocityX: primaryLock.velocityX,
            velocityY: primaryLock.velocityY,
          }
        : null
      const primitives = generateContinuityPrimitives({
        attentionState,
        pressure,
        kineticDensity: density,
        motionEnergy: rawEnergy,
        acceleration,
        primaryRegion,
        previousRegion: lastPrimaryRegionRef.current,
      })

      lastPrimaryRegionRef.current = primaryRegion

      onContinuitySample({
        recordedAt: Date.now(),
        attentionState,
        pressure,
        kineticDensity: density,
        motionEnergy: rawEnergy,
        acceleration,
        movementOrigin: primaryRegion
          ? {
              x: primaryRegion.x + primaryRegion.width / 2,
              y: primaryRegion.y + primaryRegion.height / 2,
            }
          : null,
        primaryRegion,
        primitives,
      })
    }

    const syncCanvasSize = () => {
      const bounds = overlayCanvas.getBoundingClientRect()
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.floor(bounds.width * pixelRatio))
      const height = Math.max(1, Math.floor(bounds.height * pixelRatio))

      if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
        overlayCanvas.width = width
        overlayCanvas.height = height
      }

      const outputContext = overlayCanvas.getContext("2d")
      if (!outputContext) return null

      outputContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

      return {
        context: outputContext,
        width: bounds.width,
        height: bounds.height,
      }
    }

    const drawLocks = (timestamp: number) => {
      const output = syncCanvasSize()
      if (!output) return

      const { context, width, height } = output
      const locks = smoothedLocksRef.current
      const residues = residueLocksRef.current
      const attentionState = attentionStateRef.current
      const pressure = pressureRef.current
      context.clearRect(0, 0, width, height)
      if (!locks.length && !residues.length && pressure < 0.02) return

      const peakEnergy = locks.length ? Math.max(...locks.map((lock) => lock.energy)) : 0
      const primaryLock = locks.reduce<MotionLock | null>(
        (primary, lock) => (!primary || lock.energy > primary.energy ? lock : primary),
        null
      )
      const overloaded = attentionState === "OVERLOADED"
      const locking = attentionState === "LOCKING"
      const watching = attentionState === "WATCHING"
      context.save()
      context.globalCompositeOperation = "screen"
      context.globalAlpha =
        attentionState === "IDLE"
          ? 0.18 + pressure * 0.18
          : 0.44 + peakEnergy * 0.2 + pressure * 0.28

      if (pressure > 0.045) {
        const fieldPulse = 0.5 + Math.sin(timestamp * (locking ? 0.006 : 0.0035)) * 0.5
        const fieldAlpha =
          attentionState === "OVERLOADED"
            ? 0.08 + pressure * 0.13
            : attentionState === "LOCKING"
              ? 0.06 + pressure * 0.16
              : 0.035 + pressure * 0.1

        context.strokeStyle = `rgba(242,241,237,${fieldAlpha})`
        context.lineWidth = locking ? 1.15 : 0.75
        context.beginPath()
        context.ellipse(
          width * (0.5 + Math.sin(timestamp * 0.0004) * 0.08),
          height * (0.52 + Math.cos(timestamp * 0.00045) * 0.05),
          width * (0.18 + pressure * 0.26 + fieldPulse * 0.05),
          height * (0.1 + pressure * 0.2),
          Math.sin(timestamp * 0.00035) * 0.28,
          0,
          Math.PI * 2
        )
        context.stroke()

        context.globalAlpha = Math.min(0.2, pressure * 0.2)
        context.strokeStyle = "rgba(215,192,138,0.24)"
        context.beginPath()
        context.moveTo(width * 0.08, height * (0.38 + fieldPulse * 0.08))
        context.quadraticCurveTo(
          width * 0.5,
          height * (0.28 - pressure * 0.08),
          width * 0.92,
          height * (0.48 - fieldPulse * 0.06)
        )
        context.stroke()
        context.globalAlpha =
          attentionState === "IDLE"
            ? 0.18 + pressure * 0.18
            : 0.44 + peakEnergy * 0.2 + pressure * 0.28
      }

      residues
        .filter((residue, index) => residue.id === primaryLock?.id || index < 18)
        .forEach((residue, index) => {
          const x = (residue.x / 100) * width
          const y = (residue.y / 100) * height
          const boxWidth = (residue.width / 100) * width
          const boxHeight = (residue.height / 100) * height
          const centerX = x + boxWidth / 2
          const centerY = y + boxHeight / 2
          const dragX = residue.velocityX * width * 0.018
          const dragY = residue.velocityY * height * 0.018
          const primaryResidue = residue.id === primaryLock?.id
          const alpha =
            residue.life *
            (primaryResidue
              ? 0.085 + pressure * 0.24 + residue.energy * 0.1
              : 0.018 + pressure * 0.045)

          context.strokeStyle = `rgba(242,241,237,${alpha})`
          context.lineWidth = primaryResidue
            ? 0.55 + residue.energy * 0.62 + pressure * 0.5
            : 0.35
          context.strokeRect(
            x - dragX * (1 + index * 0.02),
            y - dragY * (1 + index * 0.02),
            boxWidth + residue.life * (18 + pressure * 18),
            boxHeight + residue.life * (12 + pressure * 14)
          )

          context.strokeStyle = `rgba(215,192,138,${alpha * 0.42})`
          context.beginPath()
          context.moveTo(centerX - dragX * 2.6, centerY - dragY * 2.6)
          context.lineTo(centerX + dragX * 0.4, centerY + dragY * 0.4)
          context.stroke()
        })

      locks.forEach((lock, index) => {
        const primary = lock.id === primaryLock?.id
        const next = locks[(index + 1) % locks.length] || lock
        const x = (lock.x / 100) * width
        const y = (lock.y / 100) * height
        const previousX = (lock.previousX / 100) * width
        const previousY = (lock.previousY / 100) * height
        const boxWidth = (lock.width / 100) * width
        const boxHeight = (lock.height / 100) * height
        const centerX = x + boxWidth / 2
        const centerY = y + boxHeight / 2
        const previousCenterX = previousX + boxWidth / 2
        const previousCenterY = previousY + boxHeight / 2
        const nextCenterX = ((next.x + next.width / 2) / 100) * width
        const nextCenterY = ((next.y + next.height / 2) / 100) * height
        const velocity = Math.min(
          1,
          Math.sqrt(lock.velocityX * lock.velocityX + lock.velocityY * lock.velocityY) / 10
        )
        const jitter =
          overloaded
            ? Math.sin(timestamp * 0.011 + index * 4.7) * (3 + pressure * 8)
            : Math.sin(timestamp * 0.0014 + index * 1.6) * (watching ? 1.8 : 0.55)
        const sharpness = locking ? 1.25 : attentionState === "TRACKING" ? 1 : watching ? 0.62 : 0.36

        if (!primary) {
          const falloff = overloaded ? 0.22 : 0.11

          context.strokeStyle = `rgba(242,241,237,${falloff * lock.energy})`
          context.lineWidth = 0.45
          context.strokeRect(
            x + jitter * 0.08,
            y - jitter * 0.06,
            boxWidth * 0.92,
            boxHeight * 0.92
          )
          return
        }

        context.strokeStyle = `rgba(242,241,237,${0.12 + lock.energy * 0.28 + pressure * 0.23})`
        context.lineWidth = 0.7 + lock.energy * 0.6 + sharpness * 0.42
        context.beginPath()
        context.moveTo(previousCenterX, previousCenterY)
        context.quadraticCurveTo(
          (centerX + nextCenterX) / 2,
          centerY - 9 - pressure * 30 + jitter,
          nextCenterX,
          nextCenterY
        )
        context.stroke()

        ;[1, 2, 3, 4].forEach((step) => {
          context.strokeStyle = `rgba(242,241,237,${Math.max(
            0,
            lock.energy * (0.1 + pressure * 0.18) - step * (overloaded ? 0.018 : 0.025)
          )})`
          context.lineWidth = overloaded ? 0.42 : 0.5
          context.strokeRect(
            previousX - step * (5 + velocity * 8) + jitter * 0.3,
            previousY + step * (2 + velocity * 4) - jitter * 0.2,
            boxWidth + step * (8 + pressure * 22),
            boxHeight + step * (7 + pressure * 18)
          )
        })

        context.strokeStyle = `rgba(242,241,237,${0.2 + lock.energy * 0.38 + pressure * 0.24})`
        context.lineWidth = 0.72 + lock.energy * 0.36 + sharpness * 0.42
        context.strokeRect(x + jitter * 0.15, y - jitter * 0.12, boxWidth, boxHeight)

        context.strokeStyle = `rgba(185,215,191,${lock.energy * (0.14 + pressure * 0.28)})`
        context.lineWidth = 0.55
        context.strokeRect(
          x - 3 - sharpness * 2,
          y - 3 - sharpness * 2,
          boxWidth + 6 + sharpness * 4,
          boxHeight + 6 + sharpness * 4
        )

        if (lock.energy > 0.32 || pressure > 0.28) {
          const gradient = context.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            18 + lock.energy * 34 + pressure * 36
          )
          gradient.addColorStop(0, `rgba(215,192,138,${lock.energy * 0.14 + pressure * 0.18})`)
          gradient.addColorStop(0.45, "rgba(242,241,237,0.05)")
          gradient.addColorStop(1, "rgba(242,241,237,0)")
          context.fillStyle = gradient
          context.beginPath()
          context.arc(centerX, centerY, 18 + lock.energy * 34 + pressure * 36, 0, Math.PI * 2)
          context.fill()
        }
      })

      const drift = Math.sin(timestamp * 0.0012) * 0.35
      context.globalAlpha = pressure * (overloaded ? 0.28 : 0.17)
      context.strokeStyle = "rgba(242,241,237,0.24)"
      context.lineWidth = locking ? 1.25 : 0.8
      context.beginPath()
      context.moveTo(0, height * (0.5 + drift * 0.02 + (overloaded ? Math.sin(timestamp * 0.01) * 0.008 : 0)))
      context.lineTo(width, height * (0.5 - drift * 0.02))
      context.stroke()
      context.restore()
    }

    const requestRoboflowLocks = (video: HTMLVideoElement, timestamp: number) => {
      if (!roboflowConfig || !inferenceContext || roboflowRequestRef.current) return
      if (timestamp - lastRoboflowAt < 720) return

      lastRoboflowAt = timestamp
      roboflowRequestRef.current = true

      try {
        inferenceContext.drawImage(video, 0, 0, inferenceCanvas.width, inferenceCanvas.height)
      } catch {
        roboflowRequestRef.current = false
        return
      }

      inferRoboflowLocks({
        config: roboflowConfig,
        canvas: inferenceCanvas,
      })
        .then((locks) => {
          if (disposed) return
          roboflowLocksRef.current = locks
          roboflowSeenAtRef.current = locks.length ? timestamp : 0
        })
        .catch(() => undefined)
        .finally(() => {
          roboflowRequestRef.current = false
        })
    }

    const sample = (timestamp: number) => {
      if (disposed) return
      frameId = window.requestAnimationFrame(sample)
      drawLocks(timestamp)
      if (timestamp - lastSampleAt < 90) return
      lastSampleAt = timestamp

      const video = videoRef.current
      if (!sampleContext || !video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
        return
      }

      requestRoboflowLocks(video, timestamp)

      try {
        sampleContext.drawImage(video, 0, 0, sampleWidth, sampleHeight)
      } catch {
        return
      }

      const frame = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data
      const previous = previousFrameRef.current
      previousFrameRef.current = new Uint8ClampedArray(frame)

      if (!previous) return

      const columns = 6
      const rows = 4
      const cellWidth = Math.floor(sampleWidth / columns)
      const cellHeight = Math.floor(sampleHeight / rows)
      const regions: MotionLock[] = []

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          let delta = 0
          let count = 0

          for (let y = row * cellHeight; y < (row + 1) * cellHeight; y += 2) {
            for (let x = column * cellWidth; x < (column + 1) * cellWidth; x += 2) {
              const index = (y * sampleWidth + x) * 4
              delta +=
                Math.abs(frame[index] - previous[index]) +
                Math.abs(frame[index + 1] - previous[index + 1]) +
                Math.abs(frame[index + 2] - previous[index + 2])
              count += 3
            }
          }

          const energy = clamp01(delta / Math.max(1, count) / 44)
          if (energy < 0.045) continue

          const focus = clamp01(energy * 1.85)
          const looseness = 1 - focus

          regions.push({
            id: `${row}-${column}`,
            x: (column / columns) * 100 + 1.8,
            y: (row / rows) * 100 + 2.2,
            width: 9.5 + looseness * 9,
            height: 12.5 + looseness * 12,
            energy: focus,
            previousX: (column / columns) * 100 + 1.8,
            previousY: (row / rows) * 100 + 2.2,
            velocityX: 0,
            velocityY: 0,
          })
        }
      }

      const strongest = regions.sort((a, b) => b.energy - a.energy).slice(0, 4)
      const inferenceLocks =
        timestamp - roboflowSeenAtRef.current < 1400 ? roboflowLocksRef.current : []
      const strongestEnergy = strongest.length
        ? strongest.reduce((total, lock) => total + lock.energy, 0) / strongest.length
        : 0
      const inferenceEnergy = inferenceLocks.length
        ? inferenceLocks.reduce((total, lock) => total + lock.energy, 0) / inferenceLocks.length
        : 0
      const rawEnergy = Math.max(strongestEnergy, inferenceEnergy)
      const acceleration = Math.abs(rawEnergy - lastEnergyRef.current)
      lastEnergyRef.current = rawEnergy
      const density = clamp01((strongest.length + inferenceLocks.length * 0.8) / 5)
      const pressureTarget = clamp01(rawEnergy * 0.72 + acceleration * 0.78 + density * 0.32)
      pressureRef.current = clamp01(pressureRef.current * 0.72 + pressureTarget * 0.28)
      const overload = acceleration > 0.5 || (density > 0.92 && pressureRef.current > 0.72)

      if (overload) {
        attentionStateRef.current = "OVERLOADED"
      } else if (pressureRef.current > 0.58) {
        attentionStateRef.current = "LOCKING"
      } else if (pressureRef.current > 0.24) {
        attentionStateRef.current = "TRACKING"
      } else if (pressureRef.current > 0.055 || rawEnergy > 0.055) {
        attentionStateRef.current = "WATCHING"
      } else {
        attentionStateRef.current = "IDLE"
      }

      if (!strongest.length && !inferenceLocks.length) {
        pressureRef.current = pressureRef.current * 0.92
        attentionStateRef.current =
          pressureRef.current > 0.26 ? "WATCHING" : pressureRef.current > 0.06 ? "IDLE" : "IDLE"
        const fading = smoothedLocksRef.current
          .map((lock) => ({
            ...lock,
            previousX: lock.x,
            previousY: lock.y,
            x: lock.x + Math.sin(timestamp * 0.0008 + lock.energy * 4) * 0.2,
            y: lock.y + Math.cos(timestamp * 0.0007 + lock.energy * 3) * 0.18,
            energy: lock.energy * 0.82,
            width: lock.width + 0.26,
            height: lock.height + 0.26,
            velocityX: lock.velocityX * 0.62,
            velocityY: lock.velocityY * 0.62,
          }))
          .filter((lock) => lock.energy > 0.08)

        smoothedLocksRef.current = fading
        residueLocksRef.current = [
          ...fading.map((lock) => ({
            ...lock,
            life: clamp01(0.12 + lock.energy * 0.78 + pressureRef.current * 0.18),
          })),
          ...residueLocksRef.current.map((lock) => ({
            ...lock,
            life: lock.life * 0.88,
            energy: lock.energy * 0.92,
          })),
        ]
          .filter((lock) => lock.life > 0.03)
          .slice(0, 48)
        emitContinuitySample({
          timestamp,
          locks: fading,
          rawEnergy,
          acceleration,
          density,
        })
        return
      }

      const sourceLocks = inferenceLocks.length
        ? inferenceLocks.map((lock, index) => {
            const nearbyEnergy = strongest[index]?.energy || strongest[0]?.energy || 0

            return {
              ...lock,
              energy: clamp01(lock.energy * 0.76 + nearbyEnergy * 0.5),
              width: lock.width * (0.9 + nearbyEnergy * 0.22),
              height: lock.height * (0.9 + nearbyEnergy * 0.22),
            }
          })
        : strongest

      const attentionState = attentionStateRef.current
      const pressure = pressureRef.current
      const inertia =
        attentionState === "LOCKING"
          ? 0.64
          : attentionState === "TRACKING"
            ? 0.42
            : attentionState === "WATCHING"
              ? 0.3
              : attentionState === "OVERLOADED"
                ? 0.18
                : 0.12
      const looseness =
        attentionState === "LOCKING"
          ? 0.12
          : attentionState === "TRACKING"
            ? 0.26
            : attentionState === "OVERLOADED"
              ? 1.1
              : 0.58

      const nextLocks = sourceLocks
        .sort((a, b) => b.energy - a.energy)
        .slice(0, 3)
        .map((region, index) => {
          const previousLock = smoothedLocksRef.current[index]
          const overloadScatter =
            attentionState === "OVERLOADED"
              ? Math.sin(timestamp * 0.012 + index * 3.3) * (1.4 + pressure * 3.4)
              : 0
          const driftX =
            Math.sin(timestamp * 0.001 + index * 1.9) * (0.12 + looseness * 0.62) +
            overloadScatter
          const driftY =
            Math.cos(timestamp * 0.0011 + index * 1.4) * (0.1 + looseness * 0.54) -
            overloadScatter * 0.55

          if (!previousLock) {
            return {
              ...region,
              x: region.x + driftX,
              y: region.y + driftY,
              velocityX: 0,
              velocityY: 0,
            }
          }

          const nextX = previousLock.x * (1 - inertia) + region.x * inertia + driftX
          const nextY = previousLock.y * (1 - inertia) + region.y * inertia + driftY
          const velocityX = nextX - previousLock.x
          const velocityY = nextY - previousLock.y

          return {
            ...region,
            previousX: previousLock.x,
            previousY: previousLock.y,
            x: nextX,
            y: nextY,
            width: previousLock.width * (1 - inertia) + region.width * inertia,
            height: previousLock.height * (1 - inertia) + region.height * inertia,
            energy: clamp01(previousLock.energy * 0.48 + region.energy * 0.52 + pressure * 0.16),
            velocityX,
            velocityY,
          }
        })

      smoothedLocksRef.current = nextLocks
      emitContinuitySample({
        timestamp,
        locks: nextLocks,
        rawEnergy,
        acceleration,
        density,
      })
      residueLocksRef.current = [
        ...nextLocks.map((lock) => ({
          ...lock,
          life: clamp01(0.25 + lock.energy * 0.82 + pressure * 0.45),
        })),
        ...residueLocksRef.current.map((lock) => ({
          ...lock,
          life: lock.life * (attentionState === "LOCKING" ? 0.93 : 0.88),
          energy: lock.energy * 0.94,
        })),
      ]
        .filter((lock) => lock.life > 0.035)
        .slice(0, attentionState === "OVERLOADED" ? 64 : 52)
    }

    frameId = window.requestAnimationFrame(sample)

    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      const outputContext = overlayCanvas.getContext("2d")
      if (outputContext) {
        outputContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
      }
    }
  }, [active, enabled, onContinuitySample, videoRef])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-10 h-full w-full mix-blend-screen axis-optical-drift ${
        enabled && active ? "opacity-100" : "opacity-0"
      }`}
    />
  )
}

function getRecorderType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return ""
  }

  return recorderTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
}

function extensionForType(type: string) {
  return type.includes("mp4") ? "mp4" : "webm"
}

function trackSummary(track: MediaStreamTrack) {
  return {
    kind: track.kind,
    label: track.label,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
    settings: track.getSettings(),
  }
}

function hasLiveVideoTrack(stream: MediaStream | null) {
  return Boolean(
    stream?.getVideoTracks().some((track) => track.readyState === "live" && track.enabled)
  )
}

function normalizeMemoryText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function explicitTeamFromMemoryText(value: string): LiveStatTeam | null {
  const normalized = value.toUpperCase()
  if (/\bHOME\b/.test(normalized)) return "home"
  if (/\bAWAY\b/.test(normalized)) return "away"
  return null
}

function actionFromMemoryText(value: string): AxisGameAction | null {
  const normalized = value.toUpperCase()

  if (/\b(MISS 3|MISSED 3|3 MISS)\b/.test(normalized)) return "MISS_3"
  if (/\b(MISS 2|MISSED 2|2 MISS)\b/.test(normalized)) return "MISS_2"
  if (/\b(AND 1|AND-1|AND ONE)\b/.test(normalized)) return "AND_1"
  if (/\b(3|3PT|THREE)\b/.test(normalized)) return "MAKE_3"
  if (/\b(2|2PT|TWO)\b/.test(normalized)) return "MAKE_2"
  if (/\b(1|1PT|FT|FREE THROW)\b/.test(normalized)) return "MAKE_1"
  if (/\b(REBOUND|REB|BOARD)\b/.test(normalized)) return "REBOUND"
  if (/\b(TURNOVER|TO)\b/.test(normalized)) return "TURNOVER"
  if (/\b(ASSIST|AST)\b/.test(normalized)) return "ASSIST"
  if (/\b(STEAL|STL)\b/.test(normalized)) return "STEAL"
  if (/\b(BLOCK|BLK)\b/.test(normalized)) return "BLOCK"
  if (/\b(FOUL)\b/.test(normalized)) return "FOUL"

  return null
}

function playerFromMemoryText(value: string) {
  const normalized = value
    .toUpperCase()
    .replace(/\b(HOME|AWAY|THEY|HE|SHE|WE|US|SCORED|SCORE|MADE|MAKE|HIT|BUCKET|POINTS?)\b/g, " ")
    .replace(/\b(MISS|MISSED|REBOUND|REB|BOARD|TURNOVER|TO|ASSIST|AST|STEAL|STL|BLOCK|BLK|FOUL|AND|ONE|FREE|THROW|FT|PT|TWO|THREE)\b/g, " ")
    .replace(/\b[123]\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return normalized || null
}

function scoringNeedsPoints(value: string, action: AxisGameAction | null) {
  return !action && /\b(SCORED|SCORE|MADE|MAKE|HIT|BUCKET)\b/i.test(value)
}

function memoryTextIsAmbiguousPerson(value: string) {
  return /\b(THEY|HE|SHE|SOMEONE)\b/i.test(value)
}

function actionNeedsActor(value: string, action: AxisGameAction | null) {
  const hasExplicitTeam = Boolean(explicitTeamFromMemoryText(value))
  if (hasExplicitTeam || memoryTextIsAmbiguousPerson(value)) return false
  return action === "REBOUND" || action === "MAKE_1" || action === "MAKE_2" || action === "MAKE_3"
}

function actionNeedsTeam(value: string, action: AxisGameAction | null) {
  if (explicitTeamFromMemoryText(value) || playerFromMemoryText(value)) return false
  return action === "TURNOVER" || action === "FOUL"
}

function resolveLiveMemoryText(value: string, fallbackTeam: LiveStatTeam): LiveMemoryResolution | null {
  const raw = normalizeMemoryText(value)
  if (!raw) return null

  const normalized = raw.toUpperCase()
  if (/^(CLIP|SAVE CLIP|CLIP LAST|CLIP LAST PLAY|CLIP LAST POSSESSION)\b/.test(normalized)) {
    return {
      kind: "memory",
      raw,
      label: "Clip anchor stored",
    }
  }

  if (/^(SUB|SUBSTITUTION|TIMEOUT)\b/.test(normalized)) {
    return {
      kind: "memory",
      raw,
      label: "Game note stored",
    }
  }

  const explicitTeam = explicitTeamFromMemoryText(raw)
  const team = explicitTeam || fallbackTeam
  const action = actionFromMemoryText(raw)
  const player = playerFromMemoryText(raw)
  const scoredButMissingPoints = scoringNeedsPoints(raw, action)

  if (memoryTextIsAmbiguousPerson(raw) && (action || scoredButMissingPoints)) {
    return {
      kind: "question",
      prompt: "who?",
      draft: {
        raw,
        team: explicitTeam,
        player: null,
        action,
      },
    }
  }

  if (actionNeedsActor(raw, action)) {
    return {
      kind: "question",
      prompt: action === "REBOUND" ? "who?" : "who/team?",
      draft: {
        raw,
        team: explicitTeam,
        player: null,
        action,
      },
    }
  }

  if (actionNeedsTeam(raw, action)) {
    return {
      kind: "question",
      prompt: "home or away?",
      draft: {
        raw,
        team: null,
        player: null,
        action,
      },
    }
  }

  if (scoredButMissingPoints) {
    return {
      kind: "question",
      prompt: "2 or 3?",
      draft: {
        raw,
        team,
        player,
        action: null,
      },
    }
  }

  if (action) {
    return {
      kind: "stat",
      raw,
      team,
      player,
      action,
    }
  }

  return {
    kind: "memory",
    raw,
    label: "Memory stored",
  }
}

function pointsAnswerToAction(value: string): AxisGameAction | null {
  const normalized = value.toUpperCase()
  if (/\b(3|3PT|THREE)\b/.test(normalized)) return "MAKE_3"
  if (/\b(2|2PT|TWO)\b/.test(normalized)) return "MAKE_2"
  if (/\b(1|1PT|FT|FREE THROW)\b/.test(normalized)) return "MAKE_1"
  return null
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as T & {
    ok?: boolean
    error?: string
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "REQUEST_FAILED")
  }

  return data
}

export function LiveMemoryStream() {
  const [status, setStatus] = useState<LiveSessionStatus>("READY")
  const [elapsed, setElapsed] = useState(0)
  const [archivedRecording, setArchivedRecording] = useState<LiveArchiveSession | null>(null)
  const [liveViewMode] = useState<LiveViewMode>("RECON")
  const [liveOpticalDepth] = useState<LiveOpticalDepth>(1)
  const [trainingStatus, setTrainingStatus] = useState<"idle" | "saving" | "stored">("idle")
  const [showLiveTrainingLabels, setShowLiveTrainingLabels] = useState(false)
  const [pendingContinuitySelection, setPendingContinuitySelection] =
    useState<PendingContinuitySelection | null>(null)
  const [activeStatTeam, setActiveStatTeam] = useState<LiveStatTeam>("home")
  const [memoryInput, setMemoryInput] = useState("")
  const [memoryInputFocused, setMemoryInputFocused] = useState(false)
  const [memoryQuestion, setMemoryQuestion] = useState<LiveMemoryQuestion | null>(null)
  const [liveBoxScore, setLiveBoxScore] = useState<LiveBoxScore>(() => createLiveBoxScore())
  const [, setLiveStatEvents] = useState<LiveBasketballStatEvent[]>([])
  const snapshots = useAxisChronologyStore((state) => state.snapshots)

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const memoryInputRef = useRef<HTMLInputElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const workingSessionRef = useRef<WorkingSession | null>(null)
  const eventsRef = useRef<LiveIngestEvent[]>([])
  const eventSequenceRef = useRef(0)
  const startedAtMsRef = useRef(0)
  const elapsedRef = useRef(0)
  const elapsedTimerRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const trackFailureTimerRef = useRef<number | null>(null)
  const passiveObserversRef = useRef<ReturnType<typeof startPassiveContinuityObservers> | null>(null)
  const continuityAssistRef = useRef<ContinuityAssistSample | null>(null)
  const basketballSequenceRef = useRef<BasketballEvent[]>([])
  const liveBoxScoreRef = useRef<LiveBoxScore>(createLiveBoxScore())
  const liveStatEventsRef = useRef<LiveBasketballStatEvent[]>([])
  const openingCameraRef = useRef(false)
  const finalizingRef = useRef(false)
  const hardStoppedRef = useRef(false)
  const statusRef = useRef<LiveSessionStatus>("READY")

  const setLiveStatus = useCallback((nextStatus: LiveSessionStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
    if (workingSessionRef.current && nextStatus !== "ARCHIVED") {
      workingSessionRef.current.status = nextStatus as WorkingSession["status"]
    }
  }, [])

  const handleContinuitySample = useCallback((sample: ContinuityAssistSample) => {
    continuityAssistRef.current = sample
  }, [])

  const focusMemoryInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      memoryInputRef.current?.focus()
    })
  }, [])

  const emitEvent = useCallback(
    (type: LiveIngestEventType, metadata?: Record<string, unknown>) => {
      const event: LiveIngestEvent = {
        id: `${workingSessionRef.current?.id ?? "pending"}-${eventSequenceRef.current++}`,
        type,
        createdAt: new Date().toISOString(),
        sessionTime: elapsedRef.current,
        metadata,
      }

      eventsRef.current = [...eventsRef.current, event]
      return event
    },
    []
  )

  const attachBasketballEvent = useCallback(
    (input: LiveScoringInput, machineSuggested: boolean) => {
      const pending = pendingContinuitySelection
      const session = workingSessionRef.current
      if (!pending || !session) {
        setPendingContinuitySelection(null)
        return
      }
      const basketballEvent = input.type
      const previousEvents = basketballSequenceRef.current.slice(-3)
      const statEvent = createLiveBasketballStatEvent({
        id: createId("axis-stat"),
        sessionId: session.id,
        type: basketballEvent,
        team: activeStatTeam,
        sessionTime: pending.sessionTime,
        scoreBefore: liveBoxScoreRef.current,
        snapshotId: pending.snapshotId,
        sequenceIndex: basketballSequenceRef.current.length,
        previousEvents,
        continuity: continuityAssistRef.current,
        input,
        possessionBefore: activeStatTeam,
      })
      const nextBoxScore = applyLiveStatEvent(liveBoxScoreRef.current, statEvent)

      liveBoxScoreRef.current = nextBoxScore
      liveStatEventsRef.current = [...liveStatEventsRef.current, statEvent].slice(-80)
      setLiveBoxScore(nextBoxScore)
      setLiveStatEvents(liveStatEventsRef.current)
      setActiveStatTeam(statEvent.possession)
      emitEvent("basketball_stat", {
        visible: {
          team: statEvent.team,
          eventType: statEvent.type,
          action: statEvent.action,
          points: statEvent.points,
          possession: statEvent.possession,
          score: statEvent.score,
          playByPlay: statEvent.playByPlay,
        },
        replayAnchor: statEvent.replayAnchor,
        training: statEvent.training,
      })

      useAxisChronologyStore.getState().triggerAttentionSignal(
        "BASKETBALL_EVENT",
        pending.sessionTime,
        {
          basketball_event: basketballEvent,
          basketball_action: statEvent.action,
          team: activeStatTeam,
          points: statEvent.points,
          made: statEvent.made,
          assisted: statEvent.assisted,
          foul_linked: statEvent.foulLinked,
          possession: statEvent.possession,
          score_state: statEvent.score,
          play_by_play: statEvent.playByPlay,
          reconstruction_chapter: reconstructionChapterForEvent(basketballEvent),
          timestamp: pending.sessionTime,
          source: "human_confirmed",
          machineSuggested,
          snapshot_id: pending.snapshotId,
          sequence: {
            index: basketballSequenceRef.current.length,
            previous: previousEvents,
            next: [...previousEvents, basketballEvent],
          },
          replay_window: {
            before: Math.max(0, pending.sessionTime - statEvent.replayAnchor.clipStart),
            after: Math.max(0, statEvent.replayAnchor.clipEnd - pending.sessionTime),
          },
          replay_anchor: statEvent.replayAnchor,
          training_rep: statEvent.training,
        }
      )
      basketballSequenceRef.current = [...basketballSequenceRef.current, basketballEvent].slice(-12)
      setPendingContinuitySelection(null)
    },
    [activeStatTeam, emitEvent, pendingContinuitySelection]
  )

  const recordCommandStat = useCallback(
    (
      input: LiveScoringInput,
      team: LiveStatTeam,
      options?: {
        player?: string | null
        raw?: string
        source?: string
      }
    ) => {
      const session = workingSessionRef.current
      if (!session) return

      const sessionTime = elapsedRef.current
      const previousEvents = basketballSequenceRef.current.slice(-3)
      const scoreBefore = liveBoxScoreRef.current
      const statEvent = createLiveBasketballStatEvent({
        id: createId("axis-stat"),
        sessionId: session.id,
        type: input.type,
        team,
        sessionTime,
        scoreBefore,
        snapshotId: useAxisChronologyStore.getState().snapshots.at(-1)?.id || null,
        sequenceIndex: basketballSequenceRef.current.length,
        previousEvents,
        continuity: continuityAssistRef.current,
        input,
        player: options?.player || null,
        possessionBefore: team,
      })
      const nextBoxScore = applyLiveStatEvent(liveBoxScoreRef.current, statEvent)
      const normalizedCommand = `${team.toUpperCase()} ${input.label}`.toUpperCase()
      const resolvedEvent = {
        eventId: statEvent.id,
        sessionId: session.id,
        timestamp: sessionTime,
        gameClock: formatClock(sessionTime),
        team: team.toUpperCase(),
        player: options?.player || null,
        eventType: statEvent.type,
        points: statEvent.points,
        possessionBefore: team.toUpperCase(),
        possessionAfter: statEvent.possession.toUpperCase(),
        scoreBefore: scoreFromLiveBoxScore(scoreBefore),
        scoreAfter: statEvent.score,
        source: "conversation",
        rawInput: options?.raw || normalizedCommand,
        normalizedCommand,
        needsReview: false,
      }

      liveBoxScoreRef.current = nextBoxScore
      liveStatEventsRef.current = [...liveStatEventsRef.current, statEvent].slice(-80)
      basketballSequenceRef.current = [...basketballSequenceRef.current, input.type].slice(-12)
      setLiveBoxScore(nextBoxScore)
      setLiveStatEvents(liveStatEventsRef.current)
      setActiveStatTeam(statEvent.possession)
      emitEvent("basketball_stat", {
        visible: {
          team: statEvent.team,
          eventType: statEvent.type,
          action: statEvent.action,
          points: statEvent.points,
          possession: statEvent.possession,
          score: statEvent.score,
          playByPlay: statEvent.playByPlay,
        },
        resolvedEvent,
        replayAnchor: statEvent.replayAnchor,
        training: statEvent.training,
        raw: options?.raw,
        source: options?.source || "command",
      })

      useAxisChronologyStore.getState().triggerAttentionSignal(
        "BASKETBALL_EVENT",
        sessionTime,
        {
          basketball_event: input.type,
          basketball_action: statEvent.action,
          team,
          points: statEvent.points,
          made: statEvent.made,
          assisted: statEvent.assisted,
          foul_linked: statEvent.foulLinked,
          possession: statEvent.possession,
          score_state: statEvent.score,
          play_by_play: statEvent.playByPlay,
          reconstruction_chapter: reconstructionChapterForEvent(input.type),
          timestamp: sessionTime,
          source: options?.source || "command_confirmed",
          raw: options?.raw,
          normalized_command: normalizedCommand,
          resolved_event: resolvedEvent,
          player: options?.player || null,
          replay_anchor: statEvent.replayAnchor,
          training_rep: statEvent.training,
        }
      )
    },
    [emitEvent]
  )

  const recordLiveMemoryNote = useCallback(
    (raw: string, label = "Memory stored", intent = "memory") => {
      const session = workingSessionRef.current
      if (!session) return

      const sessionTime = elapsedRef.current
      const previousEvents = basketballSequenceRef.current.slice(-3)
      const replayWindow = defaultReplayWindow()
      const score = scoreFromLiveBoxScore(liveBoxScoreRef.current)
      const normalizedCommand = raw.toUpperCase()

      const memoryEvent = emitEvent("memory_command", {
        raw,
        intent,
        label,
        eventId: "",
        sessionId: session.id,
        timestamp: sessionTime,
        gameClock: formatClock(sessionTime),
        team: null,
        player: null,
        eventType: intent,
        points: 0,
        possessionBefore: activeStatTeam.toUpperCase(),
        possessionAfter: activeStatTeam.toUpperCase(),
        scoreBefore: score,
        scoreAfter: score,
        source: "conversation",
        rawInput: raw,
        normalizedCommand,
        needsReview: false,
        possession: activeStatTeam,
        score,
        replayAnchor: {
          sessionTime,
          clipStart: Math.max(0, sessionTime - replayWindow.before),
          clipEnd: sessionTime + replayWindow.after,
          snapshotId: useAxisChronologyStore.getState().snapshots.at(-1)?.id || null,
        },
        sequence: {
          index: basketballSequenceRef.current.length,
          previous: previousEvents,
        },
        continuity: continuityAssistRef.current,
        memorySource: "live_command",
      })
      if (memoryEvent.metadata) {
        memoryEvent.metadata.eventId = memoryEvent.id
      }

      useAxisChronologyStore.getState().triggerAttentionSignal(
        "LIVE_MEMORY_COMMAND",
        sessionTime,
        {
          raw,
          intent,
          event_id: memoryEvent.id,
          normalized_command: normalizedCommand,
          possession: activeStatTeam,
          score_state: score,
          replay_window: replayWindow,
          previous: previousEvents,
          source: "live_command",
        }
      )
    },
    [activeStatTeam, emitEvent]
  )

  const recordCommandMemory = useCallback(
    (payload: AxisCommandPayload) => {
      recordLiveMemoryNote(payload.raw, payload.intent.label, payload.intent.kind)
    },
    [recordLiveMemoryNote]
  )

  useEffect(() => {
    const handleCommand = (event: WindowEventMap["axis-command"]) => {
      const payload = event.detail as AxisCommandPayload
      recordCommandMemory(payload)
      if (payload.intent.kind !== "stat") return

      recordCommandStat(liveScoringInputForAction(payload.intent.action), payload.intent.team, {
        raw: payload.raw,
        source: "command_confirmed",
      })
    }

    window.addEventListener("axis-command", handleCommand)
    return () => window.removeEventListener("axis-command", handleCommand)
  }, [recordCommandMemory, recordCommandStat])

  const undoLastStatEvent = useCallback(() => {
    const lastEvent = liveStatEventsRef.current.at(-1)
    if (!lastEvent) return

    const remainingEvents = liveStatEventsRef.current.slice(0, -1)
    const nextBoxScore = remainingEvents.reduce(
      (score, event) => applyLiveStatEvent(score, event),
      createLiveBoxScore()
    )

    liveStatEventsRef.current = remainingEvents
    liveBoxScoreRef.current = nextBoxScore
    basketballSequenceRef.current = remainingEvents.map((event) => event.type).slice(-12)
    setLiveStatEvents(remainingEvents)
    setLiveBoxScore(nextBoxScore)
    setActiveStatTeam(lastEvent.team)
    emitEvent("basketball_stat_undo", {
      revertedEventId: lastEvent.id,
      score: scoreFromLiveBoxScore(nextBoxScore),
      possession: lastEvent.team,
    })
  }, [emitEvent])

  const appendTemporalEvent = useCallback(
    (type: TemporalEventType, metadata?: Record<string, unknown>) => {
      const session = workingSessionRef.current
      if (!session) return

      const sessionTime = elapsedRef.current
      const payload =
        type === "SNAPSHOT"
          ? buildContinuitySnapshotPayload(sessionTime, continuityAssistRef.current)
          : {
              replay_window: defaultReplayWindow(),
            }

      useAxisChronologyStore.getState().triggerAttentionSignal(type, sessionTime, {
        ...payload,
        ...(metadata || {}),
      })
    },
    []
  )

  const appendPassiveTemporalEvent = useCallback(
    (type: string, metadata?: Record<string, unknown>) => {
      const session = workingSessionRef.current
      if (!session || statusRef.current !== "LIVE") return

      useAxisChronologyStore.getState().triggerAttentionSignal(type, elapsedRef.current, {
        passive: true,
        tier: "secondary",
        ...(metadata || {}),
      })
    },
    []
  )

  const resolveMemoryStat = useCallback(
    (resolution: Extract<LiveMemoryResolution, { kind: "stat" }>) => {
      recordCommandStat(liveScoringInputForAction(resolution.action), resolution.team, {
        player: resolution.player,
        raw: resolution.raw,
        source: "memory_conversation",
      })
      setMemoryQuestion(null)
      setMemoryInput("")
    },
    [recordCommandStat]
  )

  const runMemoryText = useCallback(
    (value: string) => {
      const raw = normalizeMemoryText(value)
      if (!raw) return

      if (memoryQuestion) {
        if (memoryQuestion.prompt === "home or away?") {
          const team = explicitTeamFromMemoryText(raw)
          if (!team) {
            setMemoryInput("")
            return
          }

          const action = memoryQuestion.draft.action
          if (!action) {
            setMemoryQuestion({
              prompt: "2 or 3?",
              draft: {
                ...memoryQuestion.draft,
                team,
              },
            })
            setMemoryInput("")
            return
          }

          resolveMemoryStat({
            kind: "stat",
            raw: `${memoryQuestion.draft.raw} / ${team.toUpperCase()}`,
            team,
            player: null,
            action,
          })
          return
        }

        if (memoryQuestion.prompt === "who/team?") {
          const team = explicitTeamFromMemoryText(raw)
          const player = team ? null : playerFromMemoryText(raw) || raw.toUpperCase()
          const nextTeam = team || memoryQuestion.draft.team || activeStatTeam
          const action = memoryQuestion.draft.action

          if (!action) {
            setMemoryQuestion({
              prompt: "2 or 3?",
              draft: {
                ...memoryQuestion.draft,
                team: nextTeam,
                player,
              },
            })
            setMemoryInput("")
            return
          }

          resolveMemoryStat({
            kind: "stat",
            raw: `${memoryQuestion.draft.raw} / ${raw}`,
            team: nextTeam,
            player,
            action,
          })
          return
        }

        if (memoryQuestion.prompt === "who?") {
          const player = playerFromMemoryText(raw) || raw.toUpperCase()
          const nextDraft = {
            ...memoryQuestion.draft,
            team: memoryQuestion.draft.team || activeStatTeam,
            player,
          }

          if (nextDraft.action) {
            resolveMemoryStat({
              kind: "stat",
              raw: `${nextDraft.raw} / ${player}`,
              team: nextDraft.team || activeStatTeam,
              player,
              action: nextDraft.action,
            })
            return
          }

          setMemoryQuestion({
            prompt: "2 or 3?",
            draft: nextDraft,
          })
          setMemoryInput("")
          return
        }

        const action = pointsAnswerToAction(raw)
        if (!action) {
          setMemoryInput("")
          return
        }

        resolveMemoryStat({
          kind: "stat",
          raw: `${memoryQuestion.draft.raw} / ${raw}`,
          team: memoryQuestion.draft.team || activeStatTeam,
          player: memoryQuestion.draft.player,
          action,
        })
        return
      }

      const resolution = resolveLiveMemoryText(raw, activeStatTeam)
      if (!resolution) return

      if (resolution.kind === "question") {
        setMemoryQuestion({
          prompt: resolution.prompt,
          draft: resolution.draft,
        })
        setMemoryInput("")
        return
      }

      if (resolution.kind === "memory") {
        recordLiveMemoryNote(resolution.raw, resolution.label, "memory")
        setMemoryInput("")
        return
      }

      resolveMemoryStat(resolution)
    },
    [activeStatTeam, memoryQuestion, recordLiveMemoryNote, resolveMemoryStat]
  )

  const submitMemoryInput = useCallback(() => {
    runMemoryText(memoryInput)
    focusMemoryInput()
  }, [focusMemoryInput, memoryInput, runMemoryText])

  const saveLiveReviewToTrainingSet = useCallback(async (label: TrainingLabel) => {
    const session = workingSessionRef.current
    const latestSnapshot = useAxisChronologyStore.getState().snapshots.at(-1) || null
    const sessionId = session?.id || archivedRecording?.id
    const sessionTime = latestSnapshot?.session_time ?? elapsedRef.current

    if (!sessionId || trainingStatus === "saving") return

    try {
      setTrainingStatus("saving")
      const videoFrame = localVideoRef.current
        ? await captureVideoFrameBlob(localVideoRef.current)
        : null
      const snapshotFrame =
        !videoFrame && (latestSnapshot?.image_url || latestSnapshot?.localUrl)
          ? await blobFromUrl(latestSnapshot.image_url || latestSnapshot.localUrl || "")
          : null
      const frame = videoFrame || snapshotFrame

      if (!frame) {
        setTrainingStatus("idle")
        return
      }

      const formData = new FormData()
      formData.append("image", frame, `${sessionId}-${sessionTime.toFixed(2)}.jpg`)
      formData.append("sessionId", sessionId)
      formData.append("label", label)
      formData.append("replayTime", String(sessionTime))
      formData.append("videoUrl", session?.playbackUrl || archivedRecording?.playbackUrl || "")
      formData.append("clipStart", String(Math.max(0, sessionTime - 2)))
      formData.append("clipEnd", String(sessionTime + 2))
      formData.append("eventType", latestSnapshot ? "SNAPSHOT" : "")
      formData.append(
        "metadata",
        JSON.stringify({
          selectedSnapshotId: latestSnapshot?.id || null,
          opticalDepth: liveOpticalDepth,
          chronologyPosition: sessionTime,
          storagePath: session?.storagePath || archivedRecording?.storagePath || null,
          source: "live_review",
          latestStatEvent: liveStatEventsRef.current.at(-1) || null,
          liveReport: summarizeLiveReport(liveStatEventsRef.current, liveBoxScoreRef.current),
          motionState: continuityAssistRef.current
            ? {
                attention_state: continuityAssistRef.current.attentionState,
                pressure: continuityAssistRef.current.pressure,
                kinetic_density: continuityAssistRef.current.kineticDensity,
                motion_energy: continuityAssistRef.current.motionEnergy,
              }
            : null,
        })
      )

      const response = await fetch("/api/training-memory", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("TRAINING_MEMORY_SAVE_FAILED")
      }

      setShowLiveTrainingLabels(false)
      setTrainingStatus("stored")
      window.setTimeout(() => setTrainingStatus("idle"), 1800)
    } catch {
      setTrainingStatus("idle")
    }
  }, [archivedRecording, liveOpticalDepth, trainingStatus])

  const clearReconnectTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    if (trackFailureTimerRef.current) {
      window.clearTimeout(trackFailureTimerRef.current)
      trackFailureTimerRef.current = null
    }
  }, [])

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      window.clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
  }, [])

  const setFailure = useCallback(
    (message: string) => {
      clearReconnectTimers()
      emitEvent("session_failed", {
        reason: message,
      })
      setLiveStatus("FAILED")
    },
    [clearReconnectTimers, emitEvent, setLiveStatus]
  )

  const beginReconnect = useCallback(
    (reason: string) => {
      if (hardStoppedRef.current || finalizingRef.current) return
      if (statusRef.current !== "LIVE") return
      if (reconnectTimerRef.current) return

      emitEvent("reconnect_begin", {
        reason,
      })

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        if (statusRef.current === "LIVE") setLiveStatus("RECONNECTING")
      }, reconnectDebounceMs)
    },
    [emitEvent, setLiveStatus]
  )

  const resolveReconnect = useCallback(
    (reason: string) => {
      const wasReconciling = Boolean(reconnectTimerRef.current) || statusRef.current === "RECONNECTING"
      clearReconnectTimers()

      if (wasReconciling) {
        emitEvent("reconnect_success", {
          reason,
        })
      }

      if (statusRef.current === "RECONNECTING") setLiveStatus("LIVE")
    },
    [clearReconnectTimers, emitEvent, setLiveStatus]
  )

  const cleanupCamera = useCallback(() => {
    clearReconnectTimers()
    passiveObserversRef.current?.stop()
    passiveObserversRef.current = null
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
  }, [clearReconnectTimers])

  const openCamera = useCallback(async () => {
    if (localStreamRef.current || openingCameraRef.current) return localStreamRef.current

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera unavailable")
    }

    openingCameraRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia(mobileCaptureConstraints)

      localStreamRef.current = stream

      stream.getTracks().forEach((track) => {
        track.addEventListener("mute", () => beginReconnect(`${track.kind}_muted`))
        track.addEventListener("unmute", () => resolveReconnect(`${track.kind}_unmuted`))
        track.addEventListener("ended", () => {
          if (hardStoppedRef.current || finalizingRef.current) return

          beginReconnect(`${track.kind}_ended`)
          if (track.kind !== "video") return

          trackFailureTimerRef.current = window.setTimeout(() => {
            if (
              !hardStoppedRef.current &&
              !finalizingRef.current &&
              !hasLiveVideoTrack(localStreamRef.current)
            ) {
              setFailure("Camera stopped")
            }
          }, trackFailureGraceMs)
        })
      })

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        await localVideoRef.current.play().catch(() => undefined)
      }

      return stream
    } finally {
      openingCameraRef.current = false
    }
  }, [beginReconnect, resolveReconnect, setFailure])

  const startElapsedTimer = useCallback(() => {
    stopElapsedTimer()
    elapsedTimerRef.current = window.setInterval(() => {
      if (!startedAtMsRef.current) return
      const nextElapsed = (Date.now() - startedAtMsRef.current) / 1000
      elapsedRef.current = nextElapsed
      setElapsed(nextElapsed)
    }, 500)
  }, [stopElapsedTimer])

  const startSession = async () => {
    if (statusRef.current === "STARTING" || statusRef.current === "LIVE" || statusRef.current === "FINALIZING") {
      return
    }

    try {
      setLiveStatus("STARTING")
      hardStoppedRef.current = false
      chunksRef.current = []
      eventsRef.current = []
      eventSequenceRef.current = 0
      elapsedRef.current = 0
      basketballSequenceRef.current = []
      liveBoxScoreRef.current = createLiveBoxScore()
      liveStatEventsRef.current = []
      setLiveBoxScore(liveBoxScoreRef.current)
      setLiveStatEvents([])
      setActiveStatTeam("home")
      setMemoryInput("")
      setMemoryInputFocused(false)
      setMemoryQuestion(null)
      setPendingContinuitySelection(null)

      const createdAt = new Date().toISOString()
      const sessionId = createId("axis-live")

      workingSessionRef.current = {
        id: sessionId,
        status: "STARTING",
        startedAt: createdAt,
        endedAt: null,
        duration: 0,
        playbackUrl: null,
        storagePath: null,
        createdAt,
      }

      await postJson("/api/live/session", {
        id: sessionId,
        startedAt: createdAt,
        status: "STARTING",
      })
      useAxisChronologyStore.getState().hydrateChronology({
        sessionId,
        duration: 0,
        events: [],
      })

      emitEvent("session_started")
      appendTemporalEvent("SESSION_STARTED")

      const stream = await openCamera()
      if (!stream) throw new Error("Camera unavailable")

      emitEvent("stream_connected", {
        tracks: stream.getTracks().map(trackSummary),
        audioContinuity: stream.getAudioTracks().length > 0,
        videoContinuity: stream.getVideoTracks().length > 0,
      })
      appendTemporalEvent("STREAM_CONNECTED", {
        tracks: stream.getTracks().map(trackSummary),
        audioContinuity: stream.getAudioTracks().length > 0,
        videoContinuity: stream.getVideoTracks().length > 0,
      })

      if (typeof MediaRecorder === "undefined") {
        throw new Error("Recording unavailable")
      }

      const recorderType = getRecorderType()
      const recorder = new MediaRecorder(
        stream,
        recorderType
          ? {
              mimeType: recorderType,
              videoBitsPerSecond: 2400000,
              audioBitsPerSecond: 128000,
            }
          : {
              videoBitsPerSecond: 2400000,
              audioBitsPerSecond: 128000,
            }
      )

      recorder.ondataavailable = (event) => {
        if (!event.data.size) return

        chunksRef.current.push(event.data)
        emitEvent("chunk_recorded", {
          index: chunksRef.current.length - 1,
          size: event.data.size,
          type: event.data.type,
        })
      }
      recorder.onerror = () => setFailure("Recording failed")

      startedAtMsRef.current = Date.now()
      recorderRef.current = recorder
      recorder.start(recorderTimesliceMs)
      setElapsed(0)
      startElapsedTimer()
      setLiveStatus("LIVE")
      passiveObserversRef.current?.stop()
      passiveObserversRef.current = startPassiveContinuityObservers({
        getSessionTime: () => elapsedRef.current,
        appendEvent: (event) => appendPassiveTemporalEvent(event.type, event.payload),
      })
    } catch (error) {
      stopElapsedTimer()
      cleanupCamera()
      setFailure(error instanceof Error ? error.message : "Session failed")
    }
  }

  const finalizeSession = async () => {
    const session = workingSessionRef.current

    if (
      !session ||
      (statusRef.current !== "LIVE" && statusRef.current !== "RECONNECTING") ||
      !recorderRef.current
    ) {
      return
    }

    setLiveStatus("FINALIZING")
    setPendingContinuitySelection(null)
    stopElapsedTimer()
    clearReconnectTimers()
    finalizingRef.current = true
    hardStoppedRef.current = true
    emitEvent("archive_started")
    appendTemporalEvent("ARCHIVE_STARTED")

    try {
      const recorder = recorderRef.current
      const stopped = new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), {
          once: true,
        })
      })

      if (recorder.state !== "inactive") {
        recorder.requestData()
        recorder.stop()
        await stopped
      }

      cleanupCamera()

      const endedAt = new Date().toISOString()
      const duration = startedAtMsRef.current
        ? (Date.now() - startedAtMsRef.current) / 1000
        : elapsedRef.current
      const type = recorder.mimeType || chunksRef.current[0]?.type || "video/webm"
      const blob = new Blob(chunksRef.current, {
        type,
      })

      if (!blob.size) {
        throw new Error("No recording data saved")
      }

      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("Sign in required to archive")
      }

      const extension = extensionForType(type)
      const fileName = safeFileName(`axis-live-${session.id}.${extension}`)
      const storagePath = `${user.id}/live/${fileName}`
      const file =
        typeof File !== "undefined"
          ? new File([blob], fileName, {
              type,
              lastModified: Date.now(),
            })
          : blob

      const uploaded = await supabase.storage
        .from("axis-replays")
        .upload(storagePath, file, {
          cacheControl: "3600",
          contentType: type,
          upsert: false,
        })

      if (uploaded.error) throw uploaded.error

      const completed = await fetch("/api/upload/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          traceId: session.id,
          filePath: storagePath,
          fileName,
          contentType: type,
          sizeBytes: blob.size,
          durationSeconds: duration,
          source: "camera",
          environment: "practice",
          mission: "Live recording",
          client: {
            mode: "live-v1",
          },
        }),
      })

      const result = (await completed.json().catch(() => ({}))) as {
        ok?: boolean
        replayId?: string
        videoUrl?: string
        error?: string
      }

      if (!completed.ok || !result.ok || !result.videoUrl) {
        throw new Error(result.error || "Archive record failed")
      }

      const archiveResult = await postJson<{
        session?: {
          id: string
          playback_url?: string
        }
      }>("/api/live/archive", {
        sessionId: session.id,
        endedAt,
        durationSeconds: duration,
        playbackUrl: result.videoUrl,
        storagePath,
      })

      if (!archiveResult.session?.id) {
        throw new Error("Archive session failed")
      }

      const completedEvent = emitEvent("archive_completed", {
        replayId: result.replayId,
        size: blob.size,
        storagePath,
        liveReport: summarizeLiveReport(liveStatEventsRef.current, liveBoxScoreRef.current),
        statEvents: liveStatEventsRef.current,
      })

      const archived: LiveArchiveSession = {
        id: session.id,
        startedAt: session.startedAt,
        endedAt,
        duration,
        playbackUrl: result.videoUrl,
        videoUrl: result.videoUrl,
        storagePath,
        status: "ARCHIVED",
        createdAt: session.createdAt,
        events: [...eventsRef.current.filter((event) => event.id !== completedEvent.id), completedEvent],
      }

      saveArchivedRecording(archived)
      setArchivedRecording(archived)
      elapsedRef.current = duration
      setElapsed(duration)
      workingSessionRef.current = null
      setLiveStatus("ARCHIVED")
    } catch (error) {
      cleanupCamera()
      emitEvent("archive_failed", {
        reason: error instanceof Error ? error.message : "Archive failed",
      })
      appendTemporalEvent("ARCHIVE_FAILED", {
        reason: error instanceof Error ? error.message : "Archive failed",
      })
      setFailure(error instanceof Error ? error.message : "Archive failed")
    } finally {
      finalizingRef.current = false
      recorderRef.current = null
      chunksRef.current = []
    }
  }

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const archived = loadArchivedRecording()
      if (archived) setArchivedRecording(archived)
    }, 0)

    openCamera().catch((error) => {
      setFailure(error instanceof Error ? error.message : "Camera failed")
    })

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.requestData()
        }
        beginReconnect("page_hidden")
        return
      }

      resolveReconnect("page_visible")
      if (!localStreamRef.current && statusRef.current !== "FINALIZING" && statusRef.current !== "ARCHIVED") {
        openCamera().catch((error) => {
          setFailure(error instanceof Error ? error.message : "Camera failed")
        })
      }
    }

    const requestRecorderData = () => {
      if (finalizingRef.current) return
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.requestData()
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("pagehide", requestRecorderData)
    window.addEventListener("beforeunload", requestRecorderData)

    return () => {
      window.clearTimeout(hydrationTimer)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("pagehide", requestRecorderData)
      window.removeEventListener("beforeunload", requestRecorderData)
      hardStoppedRef.current = true
      stopElapsedTimer()
      clearReconnectTimers()
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop()
      }
      cleanupCamera()
    }
  }, [
    beginReconnect,
    cleanupCamera,
    clearReconnectTimers,
    openCamera,
    resolveReconnect,
    setFailure,
    stopElapsedTimer,
  ])

  const hasRecentArchive = Boolean(archivedRecording)
  const latestSnapshot = snapshots[snapshots.length - 1] || null
  const statusLabel =
    status === "LIVE"
      ? "LIVE"
      : status === "READY"
        ? "READY"
        : status === "STARTING"
          ? "STARTING"
          : status === "FINALIZING"
            ? "SAVING"
            : status === "ARCHIVED"
              ? "SAVED"
              : "RECONNECTING"
  const activeScore = scoreFromLiveBoxScore(liveBoxScore)
  const possessionLabel = activeStatTeam.toUpperCase()

  return (
    <main className="axis-display axis-sync-room axis-familiar-room axis-world-state axis-os-field fixed inset-0 overflow-hidden">
      <section className="axis-live-shell fixed inset-0 overflow-hidden">
        <section className="axis-live-camera-plane absolute inset-0 overflow-hidden" aria-label="Live camera">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[150ms] ease-[cubic-bezier(0.2,0,0.18,1)]"
            style={{
              transform: `scale(${liveOpticalDepth})`,
            }}
          />

          <LiveMachinePerceptionOverlay
            active={status === "LIVE" || status === "READY" || status === "STARTING"}
            enabled={liveViewMode === "MOTION_ECHO"}
            onContinuitySample={handleContinuitySample}
            videoRef={localVideoRef}
          />

          <div className="axis-live-environment-vignette absolute inset-0" />
        </section>

        <header className="axis-live-top-dock fixed left-0 right-0 top-0 z-20 px-5">
          <AxisScorebug
            home={activeScore.home}
            away={activeScore.away}
            clock={formatClock(elapsed)}
            status={statusLabel}
          />
          <div className="axis-live-telemetry-row">
            <span>POS {possessionLabel}</span>
            {status === "LIVE" || status === "RECONNECTING" ? (
              <span className="axis-live-telemetry-pulse" aria-hidden="true" />
            ) : null}
          </div>
        </header>

        {status === "ARCHIVED" && archivedRecording ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/78 px-6 text-center backdrop-blur-sm">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
                ARCHIVED
              </p>
              <p className="mt-5 font-mono text-5xl font-black uppercase text-zinc-100 sm:text-7xl">
                {formatClock(archivedRecording.duration)}
              </p>
              <div className="mt-7 flex justify-center gap-3">
                <Link
                  href={`/session/${archivedRecording.id}`}
                  className="axis-familiar-primary px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]"
                >
                  Open replay
                </Link>
                <Link
                  href="/retrieve"
                  className="axis-retrieval-link px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]"
                >
                  Find clips
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setElapsed(0)
                    elapsedRef.current = 0
                    setLiveStatus("READY")
                    openCamera().catch((error) => {
                      setFailure(error instanceof Error ? error.message : "Camera failed")
                    })
                  }}
                  className="axis-familiar-control px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]"
                >
                  New recording
                </button>
              </div>
              {latestSnapshot ? (
                <div className="mt-5 flex flex-col items-center gap-2">
                  {showLiveTrainingLabels ? (
                    <div className="axis-familiar-bar grid grid-cols-3 gap-1 border p-1">
                      {trainingLabels.map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => void saveLiveReviewToTrainingSet(label)}
                          disabled={trainingStatus === "saving"}
                          className="axis-mono axis-familiar-tag px-3 py-2 text-[8px] font-black uppercase tracking-[0.12em] disabled:text-white/24"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowLiveTrainingLabels((current) => !current)}
                    disabled={trainingStatus === "saving"}
                    className="axis-mono text-[9px] font-black uppercase tracking-[0.18em] text-white/48 transition hover:text-white/78 disabled:text-white/24"
                  >
                    {trainingStatus === "stored" ? "CLIP SAVED" : "SAVE CLIP"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {status === "LIVE" && pendingContinuitySelection ? (
          <BasketballEventSelector
            key={pendingContinuitySelection.openedAt}
            pending={pendingContinuitySelection}
            onCancel={() => setPendingContinuitySelection(null)}
            onSelect={attachBasketballEvent}
          />
        ) : null}

        <footer className="axis-live-bottom-dock fixed bottom-0 left-0 right-0 z-20 px-4">
          <div className="mx-auto flex max-w-xl justify-center">
            {status === "READY" ? (
              <button
                type="button"
                onClick={() => void startSession()}
                className="axis-live-start-trigger w-full"
              >
                Start recording
              </button>
            ) : null}

            {status === "STARTING" || status === "FINALIZING" || status === "RECONNECTING" ? (
              <div className="axis-live-transition-state w-full">
                {statusLabel}
              </div>
            ) : null}

            {status === "LIVE" && !pendingContinuitySelection ? (
              <div className="axis-live-command-stack w-full">
                <form
                  className="axis-live-memory-rail"
                  onSubmit={(event) => {
                    event.preventDefault()
                    submitMemoryInput()
                  }}
                >
                  {memoryQuestion ? (
                    <div className="axis-live-memory-status">{memoryQuestion.prompt}</div>
                  ) : null}
                  <div className={`grid gap-2 ${memoryInputFocused ? "grid-cols-1" : "grid-cols-[1fr_auto]"}`}>
                    <input
                      ref={memoryInputRef}
                      value={memoryInput}
                      onChange={(event) => setMemoryInput(event.currentTarget.value)}
                      onBlur={() => setMemoryInputFocused(false)}
                      onFocus={() => setMemoryInputFocused(true)}
                      placeholder={memoryQuestion ? "Answer" : "they scored / home 3 / nae reb"}
                      className="axis-live-memory-input"
                      autoCapitalize="words"
                      enterKeyHint="send"
                      spellCheck={false}
                      aria-label="Live memory"
                    />
                    {!memoryInputFocused ? (
                      <button type="submit" className="axis-live-memory-run">
                        Run
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="axis-live-memory-chips mt-2 flex flex-wrap justify-center gap-1.5">
                  {["HOME 3", "AWAY TO", "CLIP", "REB", "SUB"].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        runMemoryText(chip === "CLIP" ? "CLIP LAST" : chip)
                        focusMemoryInput()
                      }}
                      onPointerDown={(event) => event.preventDefault()}
                      className="axis-live-memory-chip"
                    >
                      {chip}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      undoLastStatEvent()
                      focusMemoryInput()
                    }}
                    onPointerDown={(event) => event.preventDefault()}
                    className="axis-live-memory-chip"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={() => void finalizeSession()}
                    className="axis-live-memory-chip"
                  >
                    End
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {hasRecentArchive && status === "READY" ? (
            <p className="axis-live-archive-note">
              Last replay saved
            </p>
          ) : null}
        </footer>
      </section>
    </main>
  )
}
