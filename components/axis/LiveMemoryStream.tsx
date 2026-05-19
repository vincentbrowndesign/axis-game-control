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

type MotionLock = {
  id: string
  x: number
  y: number
  width: number
  height: number
  energy: number
  previousX: number
  previousY: number
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
  const [locks, setLocks] = useState<MotionLock[]>([])
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null)
  const smoothedLocksRef = useRef<MotionLock[]>([])

  useEffect(() => {
    if (!enabled || !active || typeof document === "undefined") {
      previousFrameRef.current = null
      smoothedLocksRef.current = []
      return
    }

    let frameId = 0
    let lastSampleAt = 0
    let disposed = false
    const sampleWidth = 96
    const sampleHeight = 54
    const canvas = document.createElement("canvas")
    canvas.width = sampleWidth
    canvas.height = sampleHeight
    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    })

    const sample = (timestamp: number) => {
      if (disposed) return
      frameId = window.requestAnimationFrame(sample)
      if (timestamp - lastSampleAt < 120) return
      lastSampleAt = timestamp

      const video = videoRef.current
      if (!context || !video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
        return
      }

      context.drawImage(video, 0, 0, sampleWidth, sampleHeight)
      const frame = context.getImageData(0, 0, sampleWidth, sampleHeight).data
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
          })
        }
      }

      const strongest = regions.sort((a, b) => b.energy - a.energy).slice(0, 4)

      if (!strongest.length) {
        const fading = smoothedLocksRef.current
          .map((lock) => ({
            ...lock,
            previousX: lock.x,
            previousY: lock.y,
            x: lock.x + Math.sin(timestamp * 0.0008 + lock.energy * 4) * 0.28,
            y: lock.y + Math.cos(timestamp * 0.0007 + lock.energy * 3) * 0.22,
            energy: lock.energy * 0.64,
            width: lock.width + 0.5,
            height: lock.height + 0.5,
          }))
          .filter((lock) => lock.energy > 0.08)

        smoothedLocksRef.current = fading
        setLocks(fading)
        return
      }

      const nextLocks = strongest.map((region, index) => {
        const previousLock = smoothedLocksRef.current[index]
        const driftX = Math.sin(timestamp * 0.001 + index * 1.9) * (0.18 + (1 - region.energy) * 0.45)
        const driftY = Math.cos(timestamp * 0.0011 + index * 1.4) * (0.14 + (1 - region.energy) * 0.38)

        if (!previousLock) {
          return {
            ...region,
            x: region.x + driftX,
            y: region.y + driftY,
          }
        }

        return {
          ...region,
          previousX: previousLock.x,
          previousY: previousLock.y,
          x: previousLock.x * 0.66 + region.x * 0.34 + driftX,
          y: previousLock.y * 0.66 + region.y * 0.34 + driftY,
          width: previousLock.width * 0.5 + region.width * 0.5,
          height: previousLock.height * 0.5 + region.height * 0.5,
          energy: previousLock.energy * 0.42 + region.energy * 0.58,
        }
      })

      smoothedLocksRef.current = nextLocks
      setLocks(nextLocks)
    }

    frameId = window.requestAnimationFrame(sample)

    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
    }
  }, [active, enabled, videoRef])

  if (!enabled || !active || !locks.length) return null

  const peakEnergy = Math.max(...locks.map((lock) => lock.energy))

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden mix-blend-screen"
      style={{
        opacity: 0.5 + peakEnergy * 0.32,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="axis-optical-drift absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="axis-live-attention" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(215,192,138,0.2)" />
            <stop offset="46%" stopColor="rgba(242,241,237,0.04)" />
            <stop offset="100%" stopColor="rgba(242,241,237,0)" />
          </radialGradient>
        </defs>
        {locks.map((lock, index) => {
          const next = locks[(index + 1) % locks.length] || lock
          const centerX = lock.x + lock.width / 2
          const centerY = lock.y + lock.height / 2
          const previousCenterX = lock.previousX + lock.width / 2
          const previousCenterY = lock.previousY + lock.height / 2
          const echoOpacity = lock.energy * 0.14

          return (
            <g key={lock.id}>
              <path
                d={`M ${previousCenterX} ${previousCenterY} Q ${
                  (centerX + next.x) / 2
                } ${centerY - 5 - lock.energy * 8} ${next.x + next.width / 2} ${
                  next.y + next.height / 2
                }`}
                fill="none"
                stroke="rgba(242,241,237,0.24)"
                strokeLinecap="round"
                strokeWidth={0.08 + lock.energy * 0.13}
                opacity={0.16 + lock.energy * 0.4}
              />
              {[1, 2, 3].map((step) => (
                <rect
                  key={step}
                  x={lock.previousX - step * 0.9}
                  y={lock.previousY + step * 0.44}
                  width={lock.width + step * 2.2}
                  height={lock.height + step * 1.7}
                  fill="none"
                  stroke="rgba(242,241,237,0.34)"
                  strokeWidth={0.06}
                  opacity={Math.max(0, echoOpacity - step * 0.028)}
                />
              ))}
              <rect
                x={lock.x}
                y={lock.y}
                width={lock.width}
                height={lock.height}
                fill="none"
                stroke="rgba(242,241,237,0.5)"
                strokeWidth={0.08 + lock.energy * 0.06}
                opacity={0.22 + lock.energy * 0.5}
              />
              <rect
                x={lock.x - 0.65}
                y={lock.y - 0.65}
                width={lock.width + 1.3}
                height={lock.height + 1.3}
                fill="none"
                stroke="rgba(185,215,191,0.18)"
                strokeWidth={0.06}
                opacity={lock.energy * 0.36}
              />
              <circle
                cx={centerX}
                cy={centerY}
                r={3.5 + lock.energy * 8}
                fill="url(#axis-live-attention)"
                opacity={lock.energy > 0.48 ? lock.energy * 0.5 : 0}
              />
            </g>
          )
        })}
      </svg>
    </div>
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
