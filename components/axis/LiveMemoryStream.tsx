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
import { startPassiveContinuityObservers } from "@/lib/passiveContinuityObservers"
import { captureVideoFrameBlob } from "@/lib/snapshotCapture"
import { defaultReplayWindow, type TemporalEventType } from "@/lib/temporalEventGraph"

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

function LiveMachinePerceptionOverlay({
  active,
  enabled,
  videoRef,
}: {
  active: boolean
  enabled: boolean
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
      const overloaded = attentionState === "OVERLOADED"
      const locking = attentionState === "LOCKING"
      const watching = attentionState === "WATCHING"
      context.save()
      context.globalCompositeOperation = "screen"
      context.globalAlpha =
        attentionState === "IDLE"
          ? 0.18 + pressure * 0.18
          : 0.38 + peakEnergy * 0.18 + pressure * 0.22

      residues.forEach((residue, index) => {
        const x = (residue.x / 100) * width
        const y = (residue.y / 100) * height
        const boxWidth = (residue.width / 100) * width
        const boxHeight = (residue.height / 100) * height
        const centerX = x + boxWidth / 2
        const centerY = y + boxHeight / 2
        const dragX = residue.velocityX * width * 0.018
        const dragY = residue.velocityY * height * 0.018
        const alpha = residue.life * (0.04 + pressure * 0.14 + residue.energy * 0.05)

        context.strokeStyle = `rgba(242,241,237,${alpha})`
        context.lineWidth = 0.45 + residue.energy * 0.45
        context.strokeRect(
          x - dragX * (1 + index * 0.02),
          y - dragY * (1 + index * 0.02),
          boxWidth + residue.life * 14,
          boxHeight + residue.life * 10
        )

        context.strokeStyle = `rgba(215,192,138,${alpha * 0.42})`
        context.beginPath()
        context.moveTo(centerX - dragX * 2.6, centerY - dragY * 2.6)
        context.lineTo(centerX + dragX * 0.4, centerY + dragY * 0.4)
        context.stroke()
      })

      locks.forEach((lock, index) => {
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
          Math.sqrt(lock.velocityX * lock.velocityX + lock.velocityY * lock.velocityY) / 12
        )
        const jitter =
          overloaded
            ? Math.sin(timestamp * 0.011 + index * 4.7) * (3 + pressure * 8)
            : Math.sin(timestamp * 0.0014 + index * 1.6) * (watching ? 1.8 : 0.55)
        const sharpness = locking ? 1.25 : attentionState === "TRACKING" ? 1 : watching ? 0.62 : 0.36

        context.strokeStyle = `rgba(242,241,237,${0.08 + lock.energy * 0.22 + pressure * 0.18})`
        context.lineWidth = 0.55 + lock.energy * 0.52 + sharpness * 0.34
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
            lock.energy * (0.07 + pressure * 0.13) - step * (overloaded ? 0.018 : 0.027)
          )})`
          context.lineWidth = overloaded ? 0.42 : 0.5
          context.strokeRect(
            previousX - step * (5 + velocity * 8) + jitter * 0.3,
            previousY + step * (2 + velocity * 4) - jitter * 0.2,
            boxWidth + step * (7 + pressure * 16),
            boxHeight + step * (6 + pressure * 12)
          )
        })

        context.strokeStyle = `rgba(242,241,237,${0.14 + lock.energy * 0.34 + pressure * 0.2})`
        context.lineWidth = 0.55 + lock.energy * 0.3 + sharpness * 0.34
        context.strokeRect(x + jitter * 0.15, y - jitter * 0.12, boxWidth, boxHeight)

        context.strokeStyle = `rgba(185,215,191,${lock.energy * (0.08 + pressure * 0.22)})`
        context.lineWidth = 0.55
        context.strokeRect(
          x - 3 - sharpness * 2,
          y - 3 - sharpness * 2,
          boxWidth + 6 + sharpness * 4,
          boxHeight + 6 + sharpness * 4
        )

        if (lock.energy > 0.42 || pressure > 0.46) {
          const gradient = context.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            18 + lock.energy * 34 + pressure * 36
          )
          gradient.addColorStop(0, `rgba(215,192,138,${lock.energy * 0.1 + pressure * 0.15})`)
          gradient.addColorStop(0.45, "rgba(242,241,237,0.035)")
          gradient.addColorStop(1, "rgba(242,241,237,0)")
          context.fillStyle = gradient
          context.beginPath()
          context.arc(centerX, centerY, 18 + lock.energy * 34 + pressure * 36, 0, Math.PI * 2)
          context.fill()
        }
      })

      const drift = Math.sin(timestamp * 0.0012) * 0.35
      context.globalAlpha = pressure * (overloaded ? 0.2 : 0.12)
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
      if (timestamp - lastSampleAt < 120) return
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

          const energy = clamp01(delta / Math.max(1, count) / 58)
          if (energy < 0.09) continue

          const focus = clamp01(energy * 1.45)
          const looseness = 1 - focus

          regions.push({
            id: `${row}-${column}`,
            x: (column / columns) * 100 + 1.8,
            y: (row / rows) * 100 + 2.2,
            width: 10.5 + looseness * 8,
            height: 14 + looseness * 10,
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
      const pressureTarget = clamp01(rawEnergy * 0.58 + acceleration * 0.62 + density * 0.24)
      pressureRef.current = clamp01(pressureRef.current * 0.82 + pressureTarget * 0.18)
      const overload = acceleration > 0.42 || (density > 0.88 && pressureRef.current > 0.62)

      if (overload) {
        attentionStateRef.current = "OVERLOADED"
      } else if (pressureRef.current > 0.7) {
        attentionStateRef.current = "LOCKING"
      } else if (pressureRef.current > 0.34) {
        attentionStateRef.current = "TRACKING"
      } else if (pressureRef.current > 0.1 || rawEnergy > 0.12) {
        attentionStateRef.current = "WATCHING"
      } else {
        attentionStateRef.current = "IDLE"
      }

      if (!strongest.length && !inferenceLocks.length) {
        pressureRef.current = pressureRef.current * 0.9
        attentionStateRef.current =
          pressureRef.current > 0.26 ? "WATCHING" : pressureRef.current > 0.06 ? "IDLE" : "IDLE"
        const fading = smoothedLocksRef.current
          .map((lock) => ({
            ...lock,
            previousX: lock.x,
            previousY: lock.y,
            x: lock.x + Math.sin(timestamp * 0.0008 + lock.energy * 4) * 0.2,
            y: lock.y + Math.cos(timestamp * 0.0007 + lock.energy * 3) * 0.18,
            energy: lock.energy * 0.76,
            width: lock.width + 0.32,
            height: lock.height + 0.32,
            velocityX: lock.velocityX * 0.62,
            velocityY: lock.velocityY * 0.62,
          }))
          .filter((lock) => lock.energy > 0.08)

        smoothedLocksRef.current = fading
        residueLocksRef.current = [
          ...fading.map((lock) => ({
            ...lock,
            life: clamp01(lock.energy * 0.65),
          })),
          ...residueLocksRef.current.map((lock) => ({
            ...lock,
            life: lock.life * 0.84,
            energy: lock.energy * 0.92,
          })),
        ]
          .filter((lock) => lock.life > 0.03)
          .slice(0, 42)
        return
      }

      const sourceLocks = inferenceLocks.length
        ? inferenceLocks.map((lock, index) => {
            const nearbyEnergy = strongest[index]?.energy || strongest[0]?.energy || 0

            return {
              ...lock,
              energy: clamp01(lock.energy * 0.74 + nearbyEnergy * 0.42),
              width: lock.width * (0.92 + nearbyEnergy * 0.18),
              height: lock.height * (0.92 + nearbyEnergy * 0.18),
            }
          })
        : strongest

      const attentionState = attentionStateRef.current
      const pressure = pressureRef.current
      const inertia =
        attentionState === "LOCKING"
          ? 0.52
          : attentionState === "TRACKING"
            ? 0.34
            : attentionState === "WATCHING"
              ? 0.22
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

      const nextLocks = sourceLocks.slice(0, 5).map((region, index) => {
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
      residueLocksRef.current = [
        ...nextLocks.map((lock) => ({
          ...lock,
          life: clamp01(0.18 + lock.energy * 0.7 + pressure * 0.35),
        })),
        ...residueLocksRef.current.map((lock) => ({
          ...lock,
          life: lock.life * (attentionState === "LOCKING" ? 0.91 : 0.85),
          energy: lock.energy * 0.94,
        })),
      ]
        .filter((lock) => lock.life > 0.035)
        .slice(0, attentionState === "OVERLOADED" ? 56 : 42)
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
  }, [active, enabled, videoRef])

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
  const [liveViewMode, setLiveViewMode] = useState<LiveViewMode>("RECON")
  const snapshots = useAxisChronologyStore((state) => state.snapshots)

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
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

  const appendTemporalEvent = useCallback(
    (type: TemporalEventType, metadata?: Record<string, unknown>) => {
      const session = workingSessionRef.current
      if (!session) return

      const sessionTime = elapsedRef.current
      useAxisChronologyStore.getState().triggerAttentionSignal(type, sessionTime, {
          replay_window: defaultReplayWindow(),
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

  const captureSnapshot = useCallback(async () => {
    const session = workingSessionRef.current
    if (!session) return

    const sessionTime = elapsedRef.current
    const videoElement = localVideoRef.current

    if (!videoElement) {
      appendTemporalEvent("SNAPSHOT")
      return
    }

    const blob = await captureVideoFrameBlob(videoElement)

    if (!blob) {
      appendTemporalEvent("SNAPSHOT")
      return
    }

    const localUrl =
      typeof URL !== "undefined" && "createObjectURL" in URL
        ? URL.createObjectURL(blob)
        : ""

    useAxisChronologyStore.getState().triggerSnapshotCapture(sessionTime, blob, localUrl, {
      replay_window: defaultReplayWindow(),
    })
  }, [appendTemporalEvent])

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

  return (
    <main className="h-dvh overflow-hidden bg-black text-zinc-100">
      <section className="relative h-dvh overflow-hidden bg-black">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />

        <LiveMachinePerceptionOverlay
          active={status === "LIVE" || status === "READY" || status === "STARTING"}
          enabled={liveViewMode === "MOTION_ECHO"}
          videoRef={localVideoRef}
        />

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.76),transparent_31%,transparent_68%,rgba(0,0,0,0.86))]" />

        <header className="absolute left-4 right-4 top-4 z-20 border-b border-white/10 bg-black/46 px-4 py-3 backdrop-blur-sm">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-zinc-100">
              AXIS
            </p>
            <div className="h-px bg-white/16" />
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  status === "LIVE"
                    ? "bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.85)]"
                    : "bg-zinc-300/80"
                }`}
              />
              <span className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-100">
                LIVE
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Session
              </p>
              <p className="mt-1 font-mono text-4xl font-black leading-none text-zinc-100">
                {formatClock(elapsed)}
              </p>
            </div>
            {archivedRecording ? (
              <Link
                href={`/session/${archivedRecording.id}`}
                className="border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-100"
              >
                Last record
              </Link>
            ) : null}
          </div>
          <div className="mt-4 grid w-full max-w-64 grid-cols-2 border border-white/10">
            {(["RECON", "MOTION_ECHO"] as LiveViewMode[]).map((mode) => {
              const active = liveViewMode === mode
              const label = mode === "MOTION_ECHO" ? "MOTION ECHO" : mode

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLiveViewMode(mode)}
                  className={`axis-mono axis-optical-transition h-8 border-r border-white/10 px-3 text-[9px] font-black uppercase tracking-[0.16em] transition last:border-r-0 ${
                    active
                      ? "bg-zinc-100 text-black"
                      : "bg-black/34 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
                  }`}
                >
                  {label}
                </button>
              )
            })}
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
                  className="border border-white/10 bg-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black"
                >
                  Open recording
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
                  className="border border-white/10 bg-black/40 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100"
                >
                  New session
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <footer className="absolute bottom-5 left-4 right-4 z-20">
          {status === "LIVE" && latestSnapshot ? (
            <div className="mx-auto mb-3 flex max-w-sm items-center gap-3 border border-white/10 bg-black/58 p-2 backdrop-blur-sm">
              {latestSnapshot.image_url || latestSnapshot.localUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={latestSnapshot.image_url || latestSnapshot.localUrl || ""}
                  alt="Latest snapshot"
                  className="h-12 w-16 object-cover"
                />
              ) : (
                <div className="grid h-12 w-16 place-items-center bg-zinc-950 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-600">
                  SNAP
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  Snapshot
                </p>
              </div>
            </div>
          ) : null}
          <div className="mx-auto flex max-w-sm justify-center">
            {status === "READY" ? (
              <button
                type="button"
                onClick={() => void startSession()}
                className="w-full border border-white/10 bg-zinc-100 px-5 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-black active:bg-zinc-300"
              >
                Start
              </button>
            ) : null}

            {status === "STARTING" || status === "FINALIZING" || status === "RECONNECTING" ? (
              <div className="w-full border border-white/10 bg-black/54 px-5 py-4 text-center text-[11px] font-black uppercase tracking-[0.24em] text-zinc-300">
                ...
              </div>
            ) : null}

            {status === "LIVE" ? (
              <div className="grid w-full grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void captureSnapshot()}
                  className="border border-white/10 bg-black/58 px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100 active:bg-white/10"
                >
                  Snap
                </button>
                <button
                  type="button"
                  onClick={() => void finalizeSession()}
                  className="border border-white/10 bg-zinc-100 px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black active:bg-zinc-300"
                >
                  End
                </button>
              </div>
            ) : null}
          </div>
          {hasRecentArchive && status === "READY" ? (
            <p className="mt-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Last recording stored
            </p>
          ) : null}
        </footer>
      </section>
    </main>
  )
}
