"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react"
import Link from "next/link"
import { useShallow } from "zustand/react/shallow"
import {
  type AxisSnapshot,
  type TimelineAnchor,
  useAxisChronologyStore,
} from "@/lib/axisChronologyStore"
import {
  basketballEvents,
  reconstructionChapterForEvent,
  recordReplayNegotiation,
  type BasketballEvent,
  type BasketballReconstructionChapter,
} from "@/lib/continuityAssistance"
import { captureVideoFrameBlob } from "@/lib/snapshotCapture"
import { summarizeNearbyEvents } from "@/lib/trainingSetMemory"
import type {
  TemporalEventRecord,
  TemporalSessionRecord,
  TemporalSnapshotRecord,
} from "@/lib/temporalEventGraph"

type SessionPayload = {
  ok?: boolean
  events?: TemporalEventRecord[]
  snapshots?: TemporalSnapshotRecord[]
  trainingMemories?: TrainingMemoryRecord[]
}

type InspectionDepth = 0.5 | 1 | 2 | 2.5
type RitualPhase = "apprentice" | "practitioner" | "mastery"
type RitualIntent = "Observe" | "Watch" | "Link" | "Mark" | "Again"
type ReplayGestureMode = "idle" | "press" | "hold" | "drag" | "voice" | "close"
type DevelopmentalAnchor = {
  id: string
  time: number
  weight: number
  source: "event" | "memory" | "unresolved"
}
type AxisClimateStyle = CSSProperties & {
  "--axis-climate-warmth": number
  "--axis-climate-pressure": number
  "--axis-climate-residue": number
  "--axis-climate-depth": number
  "--axis-climate-grain": number
  "--axis-type-emergence": number
  "--axis-type-dormancy": number
  "--axis-type-focus": number
  "--axis-type-decay": number
  "--axis-type-contrast": number
  "--axis-type-visibility": number
  "--axis-type-residue": number
}

const inspectionDepths: InspectionDepth[] = [0.5, 1, 2, 2.5]
const ritualStorageKey = "axis:replay-room-ritual-count:v1"
const unresolvedReplayStoragePrefix = "axis:replay-room-unresolved:v1:"

type AxisSpeechRecognitionResult = {
  readonly isFinal: boolean
  readonly [index: number]: {
    readonly transcript: string
  }
}

type AxisSpeechRecognitionEvent = {
  readonly resultIndex: number
  readonly results: {
    readonly length: number
    readonly [index: number]: AxisSpeechRecognitionResult
  }
}

type AxisSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: AxisSpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type AxisSpeechRecognitionConstructor = new () => AxisSpeechRecognition

type AxisSpeechWindow = Window & {
  SpeechRecognition?: AxisSpeechRecognitionConstructor
  webkitSpeechRecognition?: AxisSpeechRecognitionConstructor
}

type TrainingMemoryRecord = {
  id: string
  session_id: string
  label: string
  frame_url: string
  video_url: string | null
  replay_time: number
  clip_start: number | null
  clip_end: number | null
  event_type: string | null
  metadata: Record<string, unknown>
  roboflow_status: string
  roboflow_response: unknown
  created_at: string
}

function formatClock(totalSeconds: number | null | undefined) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function formatPreciseClock(totalSeconds: number | null | undefined) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = Math.floor(safeSeconds % 60)
  const centiseconds = Math.floor((safeSeconds % 1) * 100)

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`
}

function formatEnvironmentalTimestamp(value: string | null | undefined) {
  if (!value) return "TIME_UNSET"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const month = date
    .toLocaleString("en-US", {
      month: "short",
    })
    .toUpperCase()
  const day = date.getDate().toString().padStart(2, "0")
  const hour = date.getHours()
  const displayHour = hour % 12 || 12
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const meridiem = hour >= 12 ? "PM" : "AM"

  return `${month}_${day}_${displayHour}:${minutes}_${meridiem}`
}

function memoryProgressionContext(memory: TrainingMemoryRecord) {
  const metadata = memory.metadata || {}

  if (typeof metadata.reconstructionChapter === "string") return metadata.reconstructionChapter
  if (typeof metadata.basketballEvent === "string") return metadata.basketballEvent
  if (typeof metadata.eventType === "string") return metadata.eventType

  return "held"
}

function trainingLabelFromEvent(event: TemporalEventRecord | undefined) {
  const basketballEvent = event?.payload?.basketball_event

  if (basketballEvent === "MAKE") return "make"
  if (basketballEvent === "MISS") return "miss"
  if (basketballEvent === "SHOT") return "release"

  return "other"
}

function pulseHaptic(pattern: number | number[] = 8) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return
  navigator.vibrate(pattern)
}

function cleanGesturePhrase(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 220)
}

function pointerDistance(
  first: { x: number; y: number },
  second: { x: number; y: number }
) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function memoryDensityAt(time: number, anchors: Array<{ time: number; weight?: number }>, duration: number) {
  const safeDuration = Math.max(duration, 1)
  const influenceWindow = Math.max(4, safeDuration * 0.08)

  return anchors.reduce((density, anchor) => {
    const distance = Math.abs(anchor.time - time)
    if (distance > influenceWindow) return density

    const proximity = 1 - distance / influenceWindow
    return density + proximity * (anchor.weight || 1)
  }, 0)
}

function hapticForDensity(density: number) {
  if (density >= 2.4) return [18, 26, 14]
  if (density >= 1.35) return [12, 18, 8]
  return 7
}

function densityWarmth(density: number) {
  return Math.min(0.24, 0.04 + density * 0.035)
}

function clampThermalHeat(value: number) {
  return Math.min(1, Math.max(0.18, value))
}

function unresolvedReplayStorageKey(sessionId: string) {
  return `${unresolvedReplayStoragePrefix}${sessionId}`
}

function readUnresolvedReplay(sessionId: string) {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(unresolvedReplayStorageKey(sessionId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      heat?: unknown
      time?: unknown
      updatedAt?: unknown
    }
    const time = Number(parsed.time)
    const heat = Number(parsed.heat)

    if (!Number.isFinite(time) || !Number.isFinite(heat)) return null

    return {
      time: Math.max(0, time),
      heat: clampThermalHeat(heat),
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    }
  } catch {
    return null
  }
}

function writeUnresolvedReplay(sessionId: string, time: number, heat: number) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(
    unresolvedReplayStorageKey(sessionId),
    JSON.stringify({
      time: Math.max(0, Number(time) || 0),
      heat: clampThermalHeat(heat),
      updatedAt: Date.now(),
    })
  )
}

function pressureWeightFromPayload(payload: Record<string, unknown> | null | undefined) {
  const text = JSON.stringify(payload || {}).toLowerCase()
  let weight = 0

  if (text.includes("miss")) weight += 0.72
  if (text.includes("hesitat")) weight += 0.56
  if (text.includes("retry") || text.includes("again")) weight += 0.5
  if (text.includes("recover") || text.includes("pressure")) weight += 0.42
  if (text.includes("turnover") || text.includes("misstep")) weight += 0.48

  return weight
}

function buildDevelopmentalAnchors({
  events,
  trainingMemories,
  activeEventId,
}: {
  events: TemporalEventRecord[]
  trainingMemories: TrainingMemoryRecord[]
  activeEventId?: string | null
}): DevelopmentalAnchor[] {
  const eventAnchors = events
    .filter((event) => event.type === "SNAPSHOT" || event.type === "BASKETBALL_EVENT")
    .map((event) => ({
      id: event.id,
      time: Number(event.session_time) || 0,
      weight: (event.id === activeEventId ? 2.15 : 1.08) + pressureWeightFromPayload(event.payload),
      source: "event" as const,
    }))
  const memoryAnchors = trainingMemories.map((memory) => ({
    id: memory.id,
    time: Number(memory.replay_time) || 0,
    weight:
      1.65 +
      (memory.label === "miss" ? 0.72 : 0) +
      pressureWeightFromPayload(memory.metadata),
    source: "memory" as const,
  }))

  return [...eventAnchors, ...memoryAnchors].sort((a, b) => a.time - b.time)
}

function phaseForRitualCount(count: number): RitualPhase {
  if (count >= 36) return "mastery"
  if (count >= 14) return "practitioner"
  return "apprentice"
}

function readRitualPhase() {
  if (typeof window === "undefined") return "apprentice" as RitualPhase

  const count = Number(window.localStorage.getItem(ritualStorageKey)) || 0
  return phaseForRitualCount(count)
}

function markRitualPractice() {
  if (typeof window === "undefined") return "apprentice" as RitualPhase

  const count = (Number(window.localStorage.getItem(ritualStorageKey)) || 0) + 1
  window.localStorage.setItem(ritualStorageKey, String(count))

  return phaseForRitualCount(count)
}

export function seekToEvent(
  videoElement: HTMLVideoElement | null,
  anchor: TimelineAnchor | null
) {
  if (!videoElement || !anchor) return

  videoElement.pause()
  videoElement.currentTime = anchor.targetTime
}

function waitForSeeked(videoElement: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    const handleSeeked = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    const timeout = window.setTimeout(() => {
      videoElement.removeEventListener("seeked", handleSeeked)
      resolve()
    }, 2500)

    videoElement.addEventListener("seeked", handleSeeked, {
      once: true,
    })
  })
}

function RadialIntentField({
  x,
  y,
  phase,
  onCommit,
}: {
  x: number
  y: number
  phase: RitualPhase
  onCommit: (intent: RitualIntent) => void
}) {
  const fieldRef = useRef<HTMLDivElement | null>(null)
  const intents: Array<{
    label: RitualIntent
    angle: number
  }> = [
    {
      label: "Observe",
      angle: -Math.PI / 2,
    },
    {
      label: "Watch",
      angle: -Math.PI / 5,
    },
    {
      label: "Link",
      angle: Math.PI / 5,
    },
    {
      label: "Mark",
      angle: Math.PI / 2,
    },
    {
      label: "Again",
      angle: Math.PI,
    },
  ]
  const radius = phase === "mastery" ? 58 : phase === "practitioner" ? 68 : 78
  const opacity = phase === "mastery" ? "opacity-36" : phase === "practitioner" ? "opacity-58" : "opacity-78"

  const commitFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = fieldRef.current?.getBoundingClientRect()
    if (!bounds) return

    const centerX = bounds.left + bounds.width / 2
    const centerY = bounds.top + bounds.height / 2
    const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX)
    const nearest = intents.reduce(
      (selected, intent) => {
        const delta = Math.abs(Math.atan2(Math.sin(angle - intent.angle), Math.cos(angle - intent.angle)))
        return delta < selected.delta
          ? {
              delta,
              intent: intent.label,
            }
          : selected
      },
      {
        delta: Number.POSITIVE_INFINITY,
        intent: "Mark" as RitualIntent,
      }
    )

    onCommit(nearest.intent)
  }

  return (
    <div
      ref={fieldRef}
      className={`pointer-events-auto absolute z-50 h-52 w-52 -translate-x-1/2 -translate-y-1/2 touch-none ${opacity}`}
      style={{
        left: x,
        top: y,
      }}
      onPointerUp={commitFromPointer}
      onPointerCancel={() => onCommit("Observe")}
    >
      <div className="absolute inset-1/2 h-px w-px bg-[#f2f1ed]/40 shadow-[0_0_28px_rgba(242,241,237,0.24)]" />
      {intents.map((intent) => {
        const left = 50 + (Math.cos(intent.angle) * radius) / 2
        const top = 50 + (Math.sin(intent.angle) * radius) / 2

        return (
          <span
            key={intent.label}
            className="axis-mono axis-type-emergent pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-[0.16em]"
            style={{
              left: `${left}%`,
              top: `${top}%`,
            }}
          >
            {intent.label}
          </span>
        )
      })}
    </div>
  )
}

function ReplayVideo({
  playbackUrl,
  inspectionDepth,
  session,
  ritualPhase,
  densityAnchors,
  onRitualPractice,
  onTrainingMemoryStored,
  onSetInspectionDepth,
}: {
  playbackUrl: string | null
  inspectionDepth: InspectionDepth
  session: TemporalSessionRecord
  ritualPhase: RitualPhase
  densityAnchors: DevelopmentalAnchor[]
  onRitualPractice: () => void
  onTrainingMemoryStored: (memory: TrainingMemoryRecord) => void
  onSetInspectionDepth: (depth: InspectionDepth) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const seekVersionRef = useRef(0)
  const tapTimerRef = useRef<number | null>(null)
  const holdTimerRef = useRef<number | null>(null)
  const voiceHoldTimerRef = useRef<number | null>(null)
  const radialTimerRef = useRef<number | null>(null)
  const dragSeekFrameRef = useRef<number | null>(null)
  const playbackClockFrameRef = useRef<number | null>(null)
  const resumeAfterSeekRef = useRef(false)
  const holdTriggeredRef = useRef(false)
  const dragStartRef = useRef<{
    x: number
    y: number
    time: number
    wasPlaying: boolean
  } | null>(null)
  const dragTargetRef = useRef<number | null>(null)
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>())
  const twoFingerCloseRef = useRef<{
    initialDistance: number
    committed: boolean
  } | null>(null)
  const recognitionRef = useRef<AxisSpeechRecognition | null>(null)
  const voicePhraseRef = useRef("")
  const [unresolvedReplaySeed] = useState(() => readUnresolvedReplay(session.id))
  const unresolvedReplayRef = useRef(unresolvedReplaySeed)
  const thermalHeatRef = useRef(unresolvedReplaySeed?.heat ?? 0.34)
  const restoredReplayRef = useRef(false)
  const [trainingStatus, setTrainingStatus] = useState<"idle" | "saving" | "stored">("idle")
  const [memoryPulse, setMemoryPulse] = useState(false)
  const [holdActive, setHoldActive] = useState(false)
  const [gestureMode, setGestureMode] = useState<ReplayGestureMode>("idle")
  const [replaySettled, setReplaySettled] = useState(false)
  const [thermalHeat, setThermalHeat] = useState(() => unresolvedReplaySeed?.heat ?? 0.34)
  const [unresolvedAnchorTime, setUnresolvedAnchorTime] = useState<number | null>(
    () => unresolvedReplaySeed?.time ?? null
  )
  const [radialIntent, setRadialIntent] = useState<{
    x: number
    y: number
  } | null>(null)
  const {
    currentTimelineAnchor,
    isInternalSeeking,
    completeInternalSeek,
    syncMediaPlayback,
    events,
    activeEventId,
    playback,
  } =
    useAxisChronologyStore(
      useShallow((state) => ({
        currentTimelineAnchor: state.currentTimelineAnchor,
        isInternalSeeking: state.isInternalSeeking,
        completeInternalSeek: state.completeInternalSeek,
        syncMediaPlayback: state.syncMediaPlayback,
        events: state.events,
        activeEventId: state.activeEventId,
        playback: state.playback,
      }))
    )
  const pressureAnchors =
    unresolvedAnchorTime === null
      ? densityAnchors
      : [
          ...densityAnchors,
          {
            id: `unresolved-${session.id}`,
            time: unresolvedAnchorTime,
            weight: 2.35,
            source: "unresolved" as const,
          },
        ]
  const currentDensity = memoryDensityAt(
    Number(playback.currentTimelineAnchor) || 0,
    pressureAnchors,
    Number(session.duration_seconds) || 0
  )
  const roomTemperature = clampThermalHeat(
    thermalHeat + Math.min(0.28, currentDensity * 0.045) + (replaySettled ? 0.2 : 0)
  )

  const warmRoom = useCallback((amount = 0.12) => {
    setThermalHeat((heat) => {
      const nextHeat = clampThermalHeat(heat + amount)
      thermalHeatRef.current = nextHeat
      return nextHeat
    })
  }, [])

  const holdUnresolvedReplay = useCallback((time: number, heat = thermalHeatRef.current) => {
    const safeDuration = Number(session.duration_seconds) || 0
    const safeTime = Math.min(Math.max(0, Number(time) || 0), Math.max(safeDuration, 0))

    thermalHeatRef.current = clampThermalHeat(heat)
    setUnresolvedAnchorTime(safeTime)
    writeUnresolvedReplay(session.id, safeTime, thermalHeatRef.current)
  }, [session.duration_seconds, session.id])

  const saveCurrentFrameToTrainingSet = async () => {
    const video = videoRef.current
    if (!video || !session.id || trainingStatus === "saving") return

    const frame = await captureVideoFrameBlob(video)
    if (!frame) return

    const sessionTime = Number(video.currentTime) || Number(playback.currentTimelineAnchor) || 0
    const activeEvent = activeEventId
      ? events.find((event) => event.id === activeEventId)
      : events.find((event) => Math.abs(Number(event.session_time) - sessionTime) <= 0.5)
    const basketballEvent =
      typeof activeEvent?.payload?.basketball_event === "string"
        ? activeEvent.payload.basketball_event
        : null
    const reconstructionChapter =
      typeof activeEvent?.payload?.reconstruction_chapter === "string"
        ? activeEvent.payload.reconstruction_chapter
        : null
    const motionState =
      activeEvent?.payload?.continuity_assist &&
      typeof activeEvent.payload.continuity_assist === "object"
        ? (activeEvent.payload.continuity_assist as Record<string, unknown>)
        : null
    const label = trainingLabelFromEvent(activeEvent)

    try {
      setTrainingStatus("saving")
      const formData = new FormData()
      formData.append("image", frame, `${session.id}-${sessionTime.toFixed(2)}.jpg`)
      formData.append("sessionId", session.id)
      formData.append("label", label)
      formData.append("replayTime", String(sessionTime))
      formData.append("videoUrl", session.playback_url || "")
      formData.append("clipStart", String(Math.max(0, sessionTime - 2)))
      formData.append("clipEnd", String(sessionTime + 2))
      formData.append("eventType", activeEvent?.type ? String(activeEvent.type) : "")
      formData.append(
        "metadata",
        JSON.stringify({
          selectedEventId: activeEventId,
          eventType: activeEvent?.type ? String(activeEvent.type) : null,
          basketballEvent,
          reconstructionChapter,
          opticalDepth: inspectionDepth,
          chronologyPosition: Number(playback.currentTimelineAnchor) || sessionTime,
          storagePath: session.storage_path,
          nearbyEvents: summarizeNearbyEvents(events, sessionTime),
          motionState,
        })
      )

      const response = await fetch("/api/training-memory", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("TRAINING_MEMORY_SAVE_FAILED")
      }
      const payload = (await response.json().catch(() => ({}))) as {
        memory?: TrainingMemoryRecord
      }

      if (payload.memory) onTrainingMemoryStored(payload.memory)
      setMemoryPulse(true)
      warmRoom(0.28)
      holdUnresolvedReplay(sessionTime, thermalHeatRef.current + 0.28)
      pulseHaptic([20, 34, 12])
      onRitualPractice()
      setTrainingStatus("stored")
      window.setTimeout(() => setMemoryPulse(false), 620)
      window.setTimeout(() => setTrainingStatus("idle"), 1900)
    } catch {
      setTrainingStatus("idle")
    }
  }

  const seekReplayToAnchor = useCallback(async (
    targetTime: number,
    eventId?: string | null,
    shouldResume = false
  ) => {
    const video = videoRef.current
    if (!video) return
    setReplaySettled(false)
    warmRoom(0.08)
    holdUnresolvedReplay(targetTime, thermalHeatRef.current + 0.08)

    const seekVersion = seekVersionRef.current + 1
    seekVersionRef.current = seekVersion
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const clampedTarget = Math.min(Math.max(0, Number(targetTime) || 0), Math.max(duration, 0))
    const resumeAfterSeek = shouldResume || resumeAfterSeekRef.current || (!video.paused && !video.ended)
    resumeAfterSeekRef.current = resumeAfterSeek

    useAxisChronologyStore.getState().beginSeekTransaction(clampedTarget, eventId)

    if (!video.paused) video.pause()

    syncMediaPlayback({
      currentTime: clampedTarget,
      currentTimelineAnchor: clampedTarget,
      isPlaying: false,
      isSeeking: true,
      paused: true,
      readyState: video.readyState,
    })

    if (Math.abs(video.currentTime - clampedTarget) > 0.04) {
      video.currentTime = clampedTarget
      await waitForSeeked(video)
    }

    if (seekVersionRef.current !== seekVersion) return

    const settledTime = video.currentTime
    useAxisChronologyStore.getState().completeSeekTransaction(settledTime)
    syncMediaPlayback({
      currentTime: settledTime,
      currentTimelineAnchor: settledTime,
      isPlaying: false,
      isSeeking: false,
      paused: true,
      readyState: video.readyState,
    })

    if (resumeAfterSeek && !holdActive) {
      await video.play().catch(() => undefined)
      syncMediaPlayback({
        currentTime: video.currentTime,
        currentTimelineAnchor: video.currentTime,
        isPlaying: !video.paused,
        isSeeking: false,
        paused: video.paused,
        readyState: video.readyState,
      })
    }

    resumeAfterSeekRef.current = false
    const latestStore = useAxisChronologyStore.getState()
    if (latestStore.sessionId) {
      recordReplayNegotiation({
        sessionId: latestStore.sessionId,
        sessionTime: clampedTarget,
        type: "FREEZE_FRAME",
      })
    }
  }, [holdActive, holdUnresolvedReplay, syncMediaPlayback, warmRoom])

  const saveGesturePhrase = async (phrase: string, occurredAtSeconds: number) => {
    const clean = cleanGesturePhrase(phrase)
    if (!clean) return

    try {
      await fetch("/api/practice/voice", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
          phrase: clean,
          workflowStage: "REVIEW",
          occurredAtSeconds,
        }),
      })
      warmRoom(0.18)
      holdUnresolvedReplay(occurredAtSeconds, thermalHeatRef.current + 0.18)
      pulseHaptic([14, 28, 10])
    } catch {
      return
    }
  }

  const stopVoiceHold = () => {
    if (voiceHoldTimerRef.current) {
      window.clearTimeout(voiceHoldTimerRef.current)
      voiceHoldTimerRef.current = null
    }

    const recognition = recognitionRef.current
    recognitionRef.current = null

    if (recognition) {
      recognition.onend = null
      recognition.onerror = null
      recognition.onresult = null
      recognition.stop()
    }

    const phrase = voicePhraseRef.current
    voicePhraseRef.current = ""
    if (phrase) {
      void saveGesturePhrase(phrase, Number(videoRef.current?.currentTime) || Number(playback.currentTimelineAnchor) || 0)
    }
  }

  const startVoiceHold = () => {
    if (recognitionRef.current || typeof window === "undefined") return

    const speechWindow = window as AxisSpeechWindow
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const phrase = cleanGesturePhrase(result?.[0]?.transcript || "")

        if (phrase) voicePhraseRef.current = phrase
      }
    }
    recognition.onerror = () => {
      recognitionRef.current = null
      setGestureMode((mode) => (mode === "voice" ? "hold" : mode))
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setGestureMode((mode) => (mode === "voice" ? "idle" : mode))
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setGestureMode("voice")
      pulseHaptic([8, 22, 8])
    } catch {
      recognitionRef.current = null
    }
  }

  const scheduleDragSeek = useCallback((targetTime: number, shouldResume: boolean) => {
    dragTargetRef.current = targetTime

    if (dragSeekFrameRef.current) return

    dragSeekFrameRef.current = window.requestAnimationFrame(() => {
      dragSeekFrameRef.current = null
      const nextTarget = dragTargetRef.current
      dragTargetRef.current = null

      if (typeof nextTarget === "number") {
        void seekReplayToAnchor(nextTarget, null, shouldResume)
      }
    })
  }, [seekReplayToAnchor])

  const toggleReplayAwareness = () => {
    const video = videoRef.current
    if (!video) return

    if (useAxisChronologyStore.getState().playback.isSeeking) {
      resumeAfterSeekRef.current = true
      return
    }

    if (video.paused) {
      setReplaySettled(false)
      warmRoom(0.08)
      holdUnresolvedReplay(video.currentTime, thermalHeatRef.current + 0.08)
      void video.play().catch(() => undefined)
    } else {
      holdUnresolvedReplay(video.currentTime, thermalHeatRef.current + 0.12)
      video.pause()
    }
  }

  const openRadialIntent = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (radialTimerRef.current) window.clearTimeout(radialTimerRef.current)
    setRadialIntent({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
    pulseHaptic(8)
    warmRoom(0.1)
    holdUnresolvedReplay(videoRef.current?.currentTime || Number(playback.currentTimelineAnchor) || 0, thermalHeatRef.current + 0.1)
    onRitualPractice()
    radialTimerRef.current = window.setTimeout(() => {
      radialTimerRef.current = null
      setRadialIntent(null)
    }, 1400)
  }

  const commitRitualIntent = (intent: RitualIntent) => {
    setRadialIntent(null)
    onRitualPractice()

    if (intent === "Mark" || intent === "Link") {
      void saveCurrentFrameToTrainingSet()
      return
    }

    if (intent === "Watch") {
      toggleReplayAwareness()
      return
    }

    if (intent === "Observe") {
      resumeAfterSeekRef.current = false
      holdUnresolvedReplay(videoRef.current?.currentTime || Number(playback.currentTimelineAnchor) || 0, thermalHeatRef.current + 0.14)
      videoRef.current?.pause()
      pulseHaptic(9)
      return
    }

    const state = useAxisChronologyStore.getState()
    if (state.activeEventId) {
      setReplaySettled(false)
      state.requestEventJump(state.activeEventId)
      pulseHaptic(7)
    }
  }

  const handleReplayTap = (event: MouseEvent<HTMLDivElement>) => {
    if (holdTriggeredRef.current) {
      holdTriggeredRef.current = false
      return
    }

    if (tapTimerRef.current) {
      window.clearTimeout(tapTimerRef.current)
      tapTimerRef.current = null
      openRadialIntent(event)
      return
    }

    tapTimerRef.current = window.setTimeout(() => {
      tapTimerRef.current = null
      toggleReplayAwareness()
      onRitualPractice()
    }, 220)
  }

  const startHoldObservation = () => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
    if (voiceHoldTimerRef.current) window.clearTimeout(voiceHoldTimerRef.current)
    holdTriggeredRef.current = false
    holdTimerRef.current = window.setTimeout(() => {
      const video = videoRef.current
      holdTriggeredRef.current = true
      resumeAfterSeekRef.current = false
      setGestureMode("hold")
      warmRoom(0.12)
      holdUnresolvedReplay(video?.currentTime || Number(playback.currentTimelineAnchor) || 0, thermalHeatRef.current + 0.12)
      setHoldActive(true)
      video?.pause()
      pulseHaptic(10)
      onRitualPractice()
    }, 520)
    voiceHoldTimerRef.current = window.setTimeout(() => {
      holdTriggeredRef.current = true
      setHoldActive(true)
      startVoiceHold()
      onRitualPractice()
    }, 960)
  }

  const endHoldObservation = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    stopVoiceHold()
    setHoldActive(false)
    holdUnresolvedReplay(videoRef.current?.currentTime || Number(playback.currentTimelineAnchor) || 0, thermalHeatRef.current + 0.06)
    setGestureMode((mode) => (mode === "hold" || mode === "voice" ? "idle" : mode))
  }

  const handleGestureStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return

    event.currentTarget.setPointerCapture(event.pointerId)
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    setGestureMode("press")
    warmRoom(0.03)

    if (activePointersRef.current.size === 1) {
      dragStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: videoRef.current?.currentTime || Number(playback.currentTimelineAnchor) || 0,
        wasPlaying: Boolean(videoRef.current && !videoRef.current.paused),
      }
      startHoldObservation()
      return
    }

    if (activePointersRef.current.size === 2) {
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
      if (voiceHoldTimerRef.current) window.clearTimeout(voiceHoldTimerRef.current)
      holdTriggeredRef.current = true
      const pointers = [...activePointersRef.current.values()]
      twoFingerCloseRef.current = {
        initialDistance: pointerDistance(pointers[0], pointers[1]),
        committed: false,
      }
      setGestureMode("close")
    }
  }

  const handleGestureMove = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = activePointersRef.current.get(event.pointerId)
    if (!pointer) return

    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })

    if (activePointersRef.current.size === 2 && twoFingerCloseRef.current) {
      const pointers = [...activePointersRef.current.values()]
      const distance = pointerDistance(pointers[0], pointers[1])
      const closeDelta = twoFingerCloseRef.current.initialDistance - distance

      if (!twoFingerCloseRef.current.committed && closeDelta > 54) {
        twoFingerCloseRef.current.committed = true
        setRadialIntent(null)
        onSetInspectionDepth(1)
        setGestureMode("close")
        warmRoom(0.08)
        holdUnresolvedReplay(videoRef.current?.currentTime || Number(playback.currentTimelineAnchor) || 0, thermalHeatRef.current + 0.08)
        pulseHaptic([9, 18, 9])
        onRitualPractice()
      }
      return
    }

    const dragStart = dragStartRef.current
    const video = videoRef.current
    if (!dragStart || !video) return

    const deltaX = event.clientX - dragStart.x
    const deltaY = event.clientY - dragStart.y
    const dragDistance = Math.hypot(deltaX, deltaY)

    if (dragDistance < 18 || Math.abs(deltaX) < Math.abs(deltaY) * 1.12) return

    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
    if (voiceHoldTimerRef.current) window.clearTimeout(voiceHoldTimerRef.current)
    holdTriggeredRef.current = true
    setHoldActive(false)
    setGestureMode("drag")
    warmRoom(0.06)

    const bounds = event.currentTarget.getBoundingClientRect()
    const duration = Number.isFinite(video.duration) ? video.duration : Number(session.duration_seconds) || 0
    const rawSecondsDelta = (deltaX / Math.max(bounds.width, 1)) * Math.max(duration, 1) * 0.42
    const roughTarget = Math.min(Math.max(0, dragStart.time + rawSecondsDelta), Math.max(duration, 0))
    const density = memoryDensityAt(roughTarget, pressureAnchors, duration)
    const resistance = 1 + Math.min(0.72, density * 0.14)
    const targetTime = Math.min(
      Math.max(0, dragStart.time + rawSecondsDelta / resistance),
      Math.max(duration, 0)
    )

    scheduleDragSeek(targetTime, dragStart.wasPlaying)
    holdUnresolvedReplay(targetTime, thermalHeatRef.current + Math.min(0.16, 0.05 + density * 0.025))
    pulseHaptic(density > 1.3 ? hapticForDensity(density) : 4)
  }

  const handleGestureEnd = (event: PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (activePointersRef.current.size === 0) {
      endHoldObservation()
      dragStartRef.current = null
      twoFingerCloseRef.current = null
      window.setTimeout(() => {
        setGestureMode("idle")
      }, 120)
    }
  }

  useEffect(() => {
    if (!currentTimelineAnchor || !isInternalSeeking) return

    void seekReplayToAnchor(
      currentTimelineAnchor.targetTime,
      currentTimelineAnchor.eventId,
      resumeAfterSeekRef.current || (!videoRef.current?.paused && !videoRef.current?.ended)
    )
  }, [currentTimelineAnchor, isInternalSeeking, seekReplayToAnchor])

  useEffect(() => {
    const restoreFromChronology = () => {
      const state = useAxisChronologyStore.getState()
      if (!state.currentTimelineAnchor) return

      void seekReplayToAnchor(
        state.currentTimelineAnchor.targetTime,
        state.currentTimelineAnchor.eventId,
        !videoRef.current?.paused
      )
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible") restoreFromChronology()
    }

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("pageshow", restoreFromChronology)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("pageshow", restoreFromChronology)
    }
  }, [seekReplayToAnchor])

  useEffect(() => {
    const tick = () => {
      const video = videoRef.current
      const store = useAxisChronologyStore.getState()

      if (video && !video.paused && !store.playback.isSeeking) {
        syncMediaPlayback({
          currentTime: video.currentTime,
          currentTimelineAnchor: video.currentTime,
          paused: false,
          isPlaying: true,
          readyState: video.readyState,
        })
      }

      playbackClockFrameRef.current = window.requestAnimationFrame(tick)
    }

    playbackClockFrameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (playbackClockFrameRef.current) {
        window.cancelAnimationFrame(playbackClockFrameRef.current)
      }
    }
  }, [syncMediaPlayback])

  useEffect(() => {
    const cooling = window.setInterval(() => {
      setThermalHeat((heat) => {
        const nextHeat = clampThermalHeat(heat - (replaySettled ? 0.004 : 0.007))
        thermalHeatRef.current = nextHeat
        return nextHeat
      })
    }, 1400)

    return () => window.clearInterval(cooling)
  }, [replaySettled])

  useEffect(() => {
    const persistence = window.setInterval(() => {
      const time =
        videoRef.current?.currentTime ??
        Number(useAxisChronologyStore.getState().playback.currentTimelineAnchor) ??
        0
      holdUnresolvedReplay(time, thermalHeatRef.current)
    }, 1800)

    return () => window.clearInterval(persistence)
  }, [holdUnresolvedReplay])

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current)
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
      if (voiceHoldTimerRef.current) window.clearTimeout(voiceHoldTimerRef.current)
      if (radialTimerRef.current) window.clearTimeout(radialTimerRef.current)
      if (dragSeekFrameRef.current) window.cancelAnimationFrame(dragSeekFrameRef.current)
      recognitionRef.current?.stop()
    }
  }, [])

  if (!playbackUrl) {
    return (
      <div className="axis-replay-surface aspect-video" />
    )
  }

  return (
    <div className="overflow-hidden bg-black">
      <div
        className={`axis-replay-surface relative overflow-hidden transition duration-[140ms] ease-[cubic-bezier(0.2,0,0.18,1)] ${
          memoryPulse
            ? "brightness-[1.03]"
            : replaySettled
              ? "brightness-[1.015]"
              : ""
        }`}
        onClick={handleReplayTap}
        onContextMenu={(event) => event.preventDefault()}
        onPointerEnter={() => warmRoom(0.05)}
        onPointerDown={handleGestureStart}
        onPointerMove={handleGestureMove}
        onPointerLeave={handleGestureEnd}
        onPointerCancel={handleGestureEnd}
        onPointerUp={handleGestureEnd}
      >
        <div className="pointer-events-none absolute -inset-10 z-0 opacity-80">
          <div className="absolute inset-x-20 top-8 h-px bg-gradient-to-r from-transparent via-[#f2f1ed]/8 to-transparent" />
          <div className="absolute bottom-10 left-20 right-20 h-px bg-gradient-to-r from-transparent via-[#d7c08a]/12 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_62%,rgba(93,62,42,0.12),transparent_54%),radial-gradient(circle_at_82%_14%,rgba(78,64,112,0.05),transparent_42%)]" />
          {pressureAnchors.slice(0, 14).map((anchor) => {
            const left = Math.min(92, Math.max(8, (anchor.time / Math.max(Number(session.duration_seconds) || 1, 1)) * 84 + 8))
            const intensity = densityWarmth(memoryDensityAt(anchor.time, pressureAnchors, Number(session.duration_seconds) || 0))

            return (
              <span
                key={`${anchor.source}-residue-${anchor.id}`}
                className="absolute top-1/2 h-56 w-24 -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(215,192,138,0.22),transparent_68%)] blur-xl"
                style={{
                  left: `${left}%`,
                  opacity: intensity,
                }}
              />
            )
          })}
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(215,192,138,0.16),transparent_64%)]"
            style={{
              opacity: roomTemperature * 0.42,
            }}
          />
        </div>
        <video
          ref={videoRef}
          src={playbackUrl}
          playsInline
          preload="auto"
          onLoadedMetadata={(event) => {
            if (!restoredReplayRef.current && unresolvedReplayRef.current) {
              const duration = Number.isFinite(event.currentTarget.duration)
                ? event.currentTarget.duration
                : Number(session.duration_seconds) || 0
              const restoredTime = Math.min(
                Math.max(0, unresolvedReplayRef.current.time),
                Math.max(duration - 0.25, 0)
              )

              if (restoredTime > 0.2) {
                event.currentTarget.currentTime = restoredTime
                setUnresolvedAnchorTime(restoredTime)
              }
              restoredReplayRef.current = true
            }
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              paused: event.currentTarget.paused,
              isPlaying: !event.currentTarget.paused,
              readyState: event.currentTarget.readyState,
            })
          }}
          onTimeUpdate={(event) => {
            if (useAxisChronologyStore.getState().playback.isSeeking) return

            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              paused: event.currentTarget.paused,
              isPlaying: !event.currentTarget.paused,
              readyState: event.currentTarget.readyState,
            })
          }}
          onPause={(event) => {
            holdUnresolvedReplay(event.currentTarget.currentTime, thermalHeatRef.current + 0.1)
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              isPlaying: false,
              paused: true,
              isSeeking: false,
              readyState: event.currentTarget.readyState,
            })
          }}
          onPlay={(event) => {
            setReplaySettled(false)
            holdUnresolvedReplay(event.currentTarget.currentTime, thermalHeatRef.current + 0.08)
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              isPlaying: true,
              paused: false,
              isSeeking: false,
              readyState: event.currentTarget.readyState,
            })
          }}
          onSeeking={(event) => {
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              isPlaying: false,
              isSeeking: true,
              paused: true,
              readyState: event.currentTarget.readyState,
            })
          }}
          onSeeked={(event) => {
            setReplaySettled(false)
            holdUnresolvedReplay(event.currentTarget.currentTime, thermalHeatRef.current + 0.08)
            useAxisChronologyStore.getState().completeSeekTransaction(event.currentTarget.currentTime)
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              isPlaying: !event.currentTarget.paused,
              isSeeking: false,
              paused: event.currentTarget.paused,
              readyState: event.currentTarget.readyState,
            })
            completeInternalSeek()
          }}
          onCanPlay={(event) => {
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              isPlaying: !event.currentTarget.paused,
              isSeeking: false,
              paused: event.currentTarget.paused,
              readyState: event.currentTarget.readyState,
            })
          }}
          onEnded={(event) => {
            setReplaySettled(true)
            warmRoom(0.34)
            holdUnresolvedReplay(event.currentTarget.currentTime, thermalHeatRef.current + 0.34)
            syncMediaPlayback({
              currentTime: event.currentTarget.currentTime,
              currentTimelineAnchor: event.currentTarget.currentTime,
              isPlaying: false,
              isSeeking: false,
              paused: true,
              readyState: event.currentTarget.readyState,
            })
          }}
          className={`relative z-10 aspect-video w-full bg-black object-contain transition duration-[140ms] ease-[cubic-bezier(0.2,0,0.18,1)] ${
            memoryPulse ? "brightness-[1.12] contrast-[1.08]" : "brightness-[0.96]"
          }`}
          style={{
            transform: `scale(${inspectionDepth})`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_50%_58%,rgba(242,241,237,0.032),transparent_34%),radial-gradient(circle_at_48%_100%,rgba(215,192,138,0.075),transparent_48%),linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.58))]" />
        <div
          className="pointer-events-none absolute inset-0 z-20 transition duration-[900ms]"
          style={{
            background: `radial-gradient(circle at 50% 62%, rgba(215,192,138,${
              densityWarmth(currentDensity) + roomTemperature * 0.09
            }), transparent 44%)`,
          }}
        />
        {replaySettled ? (
          <div
            className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_center,rgba(215,192,138,0.11),transparent_58%),linear-gradient(180deg,transparent,rgba(9,7,6,0.26))] transition duration-[1400ms]"
            style={{
              opacity: 0.42 + roomTemperature * 0.42,
            }}
          />
        ) : null}
        {holdActive ? (
          <div
            className={`pointer-events-none absolute inset-0 z-30 transition duration-200 ${
              gestureMode === "voice"
                ? "bg-[#0c0704]/38 shadow-[inset_0_0_120px_rgba(215,192,138,0.08)]"
                : "bg-[#0c0704]/28"
            }`}
          />
        ) : null}
        {gestureMode === "drag" || gestureMode === "close" ? (
          <div className="pointer-events-none absolute inset-x-10 top-1/2 z-30 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[#f2f1ed]/24 to-transparent shadow-[0_0_26px_rgba(242,241,237,0.18)]" />
        ) : null}
        {radialIntent ? (
          <RadialIntentField
            x={radialIntent.x}
            y={radialIntent.y}
            phase={ritualPhase}
            onCommit={commitRitualIntent}
          />
        ) : null}
        {memoryPulse ? (
          <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-[#d7c08a]/[0.045]">
            <div className="absolute inset-x-16 top-1/2 h-px bg-gradient-to-r from-transparent via-[#d7c08a]/30 to-transparent" />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function EventRail({
  trainingMemories,
}: {
  trainingMemories: TrainingMemoryRecord[]
}) {
  const { events, duration, activeEventId, requestEventJump, sessionId, playback } =
    useAxisChronologyStore(
      useShallow((state) => ({
        events: state.events,
        duration: state.duration,
        activeEventId: state.activeEventId,
        requestEventJump: state.requestEventJump,
        sessionId: state.sessionId,
        playback: state.playback,
      }))
    )
  const safeDuration = Math.max(duration, 1)
  const densityAnchors = buildDevelopmentalAnchors({
    events,
    trainingMemories,
    activeEventId,
  })
  const visibleEvents = events.filter((event) => event.type === "SNAPSHOT")
  const densityRegions = densityAnchors
    .map((anchor) => ({
      ...anchor,
      density: memoryDensityAt(anchor.time, densityAnchors, safeDuration),
    }))
    .filter((anchor) => anchor.density >= 1)
  const [dragging, setDragging] = useState(false)
  const lastDenseEventRef = useRef<string | null>(null)
  const suppressClickRef = useRef(false)
  const playheadPosition = Math.min(
    100,
    Math.max(0, (Number(playback.currentTimelineAnchor) / safeDuration) * 100)
  )
  const jumpToNearestAtPosition = (clientX: number, rail: HTMLDivElement) => {
    if (!densityAnchors.length) return

    const bounds = rail.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width))
    const targetTime = ratio * safeDuration
    const nearestAnchor = densityAnchors.reduce((nearest, anchor) => {
      const nearestDistance = Math.abs(nearest.time - targetTime)
      const anchorDistance = Math.abs(anchor.time - targetTime)
      return anchorDistance < nearestDistance ? anchor : nearest
    }, densityAnchors[0])
    const nearestEvent =
      nearestAnchor.source === "event"
        ? events.find((event) => event.id === nearestAnchor.id)
        : visibleEvents.reduce((nearest, event) => {
            const nearestDistance = Math.abs(Number(nearest.session_time) - nearestAnchor.time)
            const eventDistance = Math.abs(Number(event.session_time) - nearestAnchor.time)
            return eventDistance < nearestDistance ? event : nearest
          }, visibleEvents[0])

    if (nearestEvent && lastDenseEventRef.current !== nearestAnchor.id) {
      requestEventJump(nearestEvent.id)
      lastDenseEventRef.current = nearestAnchor.id
      pulseHaptic(hapticForDensity(memoryDensityAt(targetTime, densityAnchors, safeDuration)))
      if (sessionId) {
        recordReplayNegotiation({
          sessionId,
          sessionTime: nearestAnchor.time,
          type: "RAIL_JUMP",
        })
      }
    }
  }

  return (
    <div className="mt-8 px-1 py-4">
      <div
        className={`relative h-16 touch-none overflow-hidden transition-opacity duration-150 ${
          dragging ? "opacity-100" : "opacity-82"
        }`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          suppressClickRef.current = true
          setDragging(true)
          jumpToNearestAtPosition(event.clientX, event.currentTarget)
        }}
        onPointerMove={(event) => {
          if (!dragging) return
          jumpToNearestAtPosition(event.clientX, event.currentTarget)
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId)
          setDragging(false)
          lastDenseEventRef.current = null
          window.setTimeout(() => {
            suppressClickRef.current = false
          }, 0)
        }}
        onPointerCancel={() => {
          setDragging(false)
          lastDenseEventRef.current = null
          suppressClickRef.current = false
        }}
        onClick={(event) => {
          if (suppressClickRef.current) return
          jumpToNearestAtPosition(event.clientX, event.currentTarget)
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-14 -translate-y-1/2 overflow-hidden">
          {densityRegions.map((anchor) => {
            const position = Math.min(100, Math.max(0, (anchor.time / safeDuration) * 100))
            const width = Math.min(24, 7 + anchor.density * 4.5)
            const height = Math.min(56, 18 + anchor.density * 12)

            return (
              <span
                key={`pressure-${anchor.source}-${anchor.id}`}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(215,192,138,0.16),rgba(242,241,237,0.026)_44%,transparent_72%)] blur-[1px]"
                style={{
                  left: `${position}%`,
                  width: `${width}%`,
                  height,
                  opacity: Math.min(0.72, 0.16 + anchor.density * 0.12),
                }}
              />
            )
          })}
        </div>
        <div className="absolute left-0 right-0 top-1/2 h-8 -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(215,192,138,0.046),transparent)] opacity-80" />
        <span
          className="pointer-events-none absolute top-1/2 h-9 w-px -translate-y-1/2 bg-[#d7c08a]/34 shadow-[0_0_22px_rgba(215,192,138,0.18)]"
          style={{
            left: `${playheadPosition}%`,
          }}
        />
        {visibleEvents.map((event) => {
          const position = Math.min(
            100,
            Math.max(0, (Number(event.session_time) / safeDuration) * 100)
          )
          const active = event.id === activeEventId

          return (
            <button
              key={event.id}
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                requestEventJump(event.id)
                pulseHaptic(hapticForDensity(memoryDensityAt(Number(event.session_time) || 0, densityAnchors, safeDuration)))
                if (sessionId) {
                  recordReplayNegotiation({
                    sessionId,
                    sessionTime: Number(event.session_time) || 0,
                    type: "EVENT_JUMP",
                  })
                }
              }}
              aria-label={`Back to ${formatClock(event.session_time)}`}
              className={`axis-optical-transition absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-[0] transition ${
                active
                  ? "bg-[#d7c08a]/58 shadow-[0_0_22px_rgba(215,192,138,0.22)]"
                  : "bg-[#d7c08a]/14 hover:bg-[#d7c08a]/42"
              }`}
              style={{
                left: `${position}%`,
                borderRadius: "999px",
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function InspectionDepthControl({
  inspectionDepth,
  setInspectionDepth,
}: {
  inspectionDepth: InspectionDepth
  setInspectionDepth: (depth: InspectionDepth) => void
}) {
  return (
    <div className="mt-3 flex justify-center">
      <div className="axis-climate-surface grid grid-cols-4">
        {inspectionDepths.map((depth) => {
          const active = depth === inspectionDepth

          return (
            <button
              key={depth}
              type="button"
              onClick={() => setInspectionDepth(depth)}
              className={`axis-mono axis-optical-transition h-8 min-w-12 px-3 text-[10px] font-semibold transition ${
                active
                  ? "axis-type-emergent bg-[#d7c08a]/28"
                  : "axis-type-dormant bg-transparent hover:bg-[#d7c08a]/[0.035]"
              }`}
            >
              {depth}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ChronologyEdge({
  trainingMemories,
}: {
  trainingMemories: TrainingMemoryRecord[]
}) {
  const { events, duration, requestEventJump } = useAxisChronologyStore(
    useShallow((state) => ({
      events: state.events,
      duration: state.duration,
      requestEventJump: state.requestEventJump,
    }))
  )
  const safeDuration = Math.max(Number(duration) || 0, 1)
  const anchors = events
    .filter((event) => event.type === "SNAPSHOT")
    .slice(0, 18)
    .map((event) => ({
      id: event.id,
      time: Number(event.session_time) || 0,
      weight: 0.45,
      type: "event" as const,
    }))
  const memories = trainingMemories.slice(0, 12).map((memory) => ({
    id: memory.id,
    time: Number(memory.replay_time) || 0,
    weight: 0.82,
    type: "memory" as const,
  }))
  const nodes = [...anchors, ...memories].sort((a, b) => a.time - b.time)
  const pressureZones = nodes
    .map((node) => ({
      ...node,
      density: memoryDensityAt(node.time, nodes, safeDuration),
    }))
    .filter((node) => node.density >= 1.1)

  return (
    <div className="pointer-events-none fixed inset-y-0 right-0 z-10 hidden w-12 md:block">
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#2f1d13]/14 to-transparent" />
      <div className="absolute inset-y-16 right-6 w-px bg-gradient-to-b from-transparent via-[#d7c08a]/10 to-transparent" />
      {pressureZones.map((zone) => {
        const top = Math.min(92, Math.max(8, (zone.time / safeDuration) * 84 + 8))
        const height = Math.min(96, 24 + zone.density * 18)

        return (
          <span
            key={`zone-${zone.type}-${zone.id}`}
            className="absolute right-0 w-12 -translate-y-1/2 bg-[radial-gradient(ellipse_at_right,rgba(215,192,138,0.11),transparent_70%)]"
            style={{
              top: `${top}%`,
              height,
              opacity: Math.min(0.8, 0.2 + zone.density * 0.12),
            }}
          />
        )
      })}
      {nodes.map((node) => {
        const top = Math.min(92, Math.max(8, (node.time / safeDuration) * 84 + 8))
        const height = node.type === "memory" ? 22 : 10
        const density = memoryDensityAt(node.time, nodes, safeDuration)

        return (
          <button
            key={`${node.type}-${node.id}`}
            type="button"
            aria-label={`Back to ${formatClock(node.time)}`}
            onClick={() => {
              if (node.type === "event") {
                requestEventJump(node.id)
              } else {
                const nearest = anchors.reduce<typeof anchors[number] | null>((selected, anchor) => {
                  if (!selected) return anchor

                  return Math.abs(anchor.time - node.time) < Math.abs(selected.time - node.time)
                    ? anchor
                    : selected
                }, null)

                if (nearest) requestEventJump(nearest.id)
              }
              pulseHaptic(hapticForDensity(density))
            }}
            className="pointer-events-auto absolute right-5 w-1 -translate-y-1/2 bg-[#d7c08a]/22 transition hover:bg-[#d7c08a]/52"
            style={{
              top: `${top}%`,
              height: height + Math.min(12, density * 3),
              opacity: node.weight,
              boxShadow:
                node.type === "memory"
                  ? "0 0 22px rgba(215,192,138,0.16)"
                  : "0 0 10px rgba(215,192,138,0.07)",
            }}
          />
        )
      })}
    </div>
  )
}

function DeviceExportControl({ session }: { session: TemporalSessionRecord }) {
  const { exportStatus, executeNativeExport, playback } = useAxisChronologyStore(
    useShallow((state) => ({
      exportStatus: state.exportStatus,
      executeNativeExport: state.executeNativeExport,
      playback: state.playback,
    }))
  )
  const isWorking = exportStatus === "DOWNLOADING" || exportStatus === "PREPARING_TRANSFER"
  const canExport = Boolean(session.playback_url) && !isWorking

  if (!session.playback_url) return null

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <button
        type="button"
        disabled={!canExport}
        onClick={() => {
          if (!session.playback_url) return
          recordReplayNegotiation({
            sessionId: session.id,
            sessionTime: Number(playback.currentTimelineAnchor) || 0,
            type: "EXPORT",
          })
          void executeNativeExport(session.playback_url, `axis-record-${session.id}`)
        }}
        aria-label="Keep recording"
        className="axis-mono axis-optical-transition axis-climate-surface axis-type-control px-4 py-3 text-[10px] font-bold lowercase tracking-[0.14em] transition disabled:cursor-wait"
      >
        keep
      </button>
    </div>
  )
}

function DevelopmentalInputBar({
  trainingMemories,
}: {
  trainingMemories: TrainingMemoryRecord[]
}) {
  const { events, snapshots, requestEventJump, sessionId, playback } =
    useAxisChronologyStore(
      useShallow((state) => ({
        events: state.events,
        snapshots: state.snapshots,
        requestEventJump: state.requestEventJump,
        sessionId: state.sessionId,
        playback: state.playback,
      }))
  )
  const [attention, setAttention] = useState("")
  const [orientationPulse, setOrientationPulse] = useState(false)

  const placeAttention = () => {
    const normalized = attention.trim().toLowerCase()
    const currentTime = Number(playback.currentTimelineAnchor) || 0
    const densityAnchors = buildDevelopmentalAnchors({
      events,
      trainingMemories,
      activeEventId: null,
    })

    const languageEvents = normalized
      ? events.filter((event) => {
          const payloadText = JSON.stringify(event.payload || {}).toLowerCase()
          return (
            payloadText.includes(normalized) ||
            String(event.type).toLowerCase().includes(normalized)
          )
        })
      : []
    const hesitationMemories = normalized.includes("hesitation")
      ? trainingMemories.filter((memory) =>
          memoryProgressionContext(memory).toLowerCase().includes("drive")
        )
      : []
    const recoveryMemories = normalized.includes("recover")
      ? trainingMemories.filter((memory) =>
          memoryProgressionContext(memory).toLowerCase().includes("recover")
        )
      : []
    const rhythmSnapshots =
      normalized.includes("rhythm") || normalized.includes("continuity")
        ? [...snapshots].slice(0, 6)
        : []
    const memoryTarget = [...hesitationMemories, ...recoveryMemories][0]
    const nearestEvent = events.reduce<typeof events[number] | null>((nearest, event) => {
      if (!nearest) return event

      return Math.abs(Number(event.session_time) - currentTime) <
        Math.abs(Number(nearest.session_time) - currentTime)
        ? event
        : nearest
    }, null)
    const nearestDensity = densityAnchors.reduce<DevelopmentalAnchor | null>((nearest, anchor) => {
      if (!nearest) return anchor

      return Math.abs(anchor.time - currentTime) < Math.abs(nearest.time - currentTime)
        ? anchor
        : nearest
    }, null)
    const densityEvent = nearestDensity
      ? events.reduce<typeof events[number] | null>((nearest, event) => {
          if (!nearest) return event

          return Math.abs(Number(event.session_time) - nearestDensity.time) <
            Math.abs(Number(nearest.session_time) - nearestDensity.time)
            ? event
            : nearest
        }, null)
      : null

    const targetEvent =
      languageEvents[0] ||
      (rhythmSnapshots[0]
        ? events.find(
            (event) =>
              event.type === "SNAPSHOT" &&
              Math.abs(Number(event.session_time) - Number(rhythmSnapshots[0].session_time)) <= 0.5
          )
        : null) ||
      (memoryTarget
        ? events.reduce<typeof events[number] | null>((nearest, event) => {
            if (!nearest) return event

            return Math.abs(Number(event.session_time) - Number(memoryTarget.replay_time)) <
              Math.abs(Number(nearest.session_time) - Number(memoryTarget.replay_time))
              ? event
              : nearest
          }, null)
        : null) ||
      densityEvent ||
      nearestEvent

    if (targetEvent) {
      requestEventJump(targetEvent.id)
      if (sessionId) {
        recordReplayNegotiation({
          sessionId,
          sessionTime: Number(targetEvent.session_time) || 0,
          type: "LANGUAGE_ROUTE",
        })
      }
    }

    setOrientationPulse(true)
    window.setTimeout(() => setOrientationPulse(false), 720)
  }

  return (
    <section className="mx-auto mt-12 w-full max-w-4xl px-2 pb-2">
      <div
        className={`axis-climate-surface relative overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(215,192,138,0.052),transparent_72%)] py-4 transition duration-500 ${
          orientationPulse ? "shadow-[0_0_80px_rgba(215,192,138,0.08)]" : ""
        }`}
      >
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[#d7c08a]/18 to-transparent" />
        <label className="sr-only">Place attention</label>
        <input
          value={attention}
          onChange={(event) => setAttention(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") placeAttention()
          }}
          placeholder="attention"
          className="axis-mono axis-climate-text axis-type-field relative z-10 min-h-12 w-full border-0 bg-transparent px-5 py-2 text-[14px] outline-none"
        />
      </div>
    </section>
  )
}

function DevelopmentalMemoryStrip({
  trainingMemories,
}: {
  trainingMemories: TrainingMemoryRecord[]
}) {
  const { snapshots, requestEventJump, events, updateSnapshotAnnotation, sessionId } =
    useAxisChronologyStore(
      useShallow((state) => ({
        snapshots: state.snapshots,
        requestEventJump: state.requestEventJump,
        events: state.events,
        updateSnapshotAnnotation: state.updateSnapshotAnnotation,
        sessionId: state.sessionId,
      }))
    )

  if (!snapshots.length && !trainingMemories.length) return null

  const jumpToMoment = (sessionTime: number, snapshotId?: string | null) => {
    const snapshotEvent = events.find(
      (event) =>
        event.type === "SNAPSHOT" &&
        (snapshotId
          ? event.payload?.snapshot_id === snapshotId
          : Math.abs(Number(event.session_time) - Number(sessionTime)) <= 0.5)
    )

    if (snapshotEvent) requestEventJump(snapshotEvent.id)
    if (sessionId) {
      recordReplayNegotiation({
        sessionId,
        sessionTime: Number(sessionTime) || 0,
        type: "SNAPSHOT_JUMP",
      })
    }
  }

  const chapterForSnapshot = (snapshot: AxisSnapshot): BasketballReconstructionChapter | null => {
    const basketballEvent = events.find((event) => {
      if (event.type !== "BASKETBALL_EVENT") return false

      return (
        event.payload?.snapshot_id === snapshot.id ||
        Math.abs(Number(event.session_time) - Number(snapshot.session_time)) < 0.01
      )
    })
    const event = basketballEvent?.payload?.basketball_event
    const chapter = basketballEvent?.payload?.reconstruction_chapter

    if (typeof chapter === "string") return chapter as BasketballReconstructionChapter

    return typeof event === "string" && basketballEvents.includes(event as BasketballEvent)
      ? reconstructionChapterForEvent(event as BasketballEvent)
      : null
  }

  return (
    <section className="mt-14">
      <div className="mb-3 flex justify-end">
        <Link
          href="/training-set"
          className="axis-mono axis-type-dormant text-[9px] font-black lowercase tracking-[0.14em] transition hover:opacity-70"
        >
          held
        </Link>
      </div>
      <div className="relative overflow-hidden px-1 py-2">
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-[#d7c08a]/10 to-transparent" />
        <div className="relative flex gap-2 overflow-x-auto pb-1">
          {trainingMemories.map((memory, index) => {
            const progressionContext = memoryProgressionContext(memory)

            return (
              <button
                key={memory.id}
                type="button"
                onClick={() => jumpToMoment(Number(memory.replay_time))}
                className="axis-optical-transition axis-climate-surface group relative min-w-44 overflow-hidden text-left transition hover:bg-[#d7c08a]/[0.035]"
              >
                <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.54))]" />
                <div className="axis-mono axis-type-residue pointer-events-none absolute left-3 top-3 z-20 text-[8px] font-black lowercase tracking-[0.12em]">
                  held {String(index + 1).padStart(2, "0")}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={memory.frame_url}
                  alt={`${memory.label} saved at ${formatClock(memory.replay_time)}`}
                  className="aspect-video w-44 object-cover grayscale-[16%] opacity-82 transition duration-150 group-hover:brightness-110 group-hover:opacity-100"
                />
                <div className="relative z-20 space-y-2 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="axis-mono axis-type-emergent text-[10px] font-black uppercase tracking-[0.14em]">
                      {memory.label}
                    </p>
                    <p className="axis-mono axis-type-residue text-[9px] font-black">
                      {formatClock(memory.replay_time)}
                    </p>
                  </div>
                  <p className="axis-mono axis-type-dormant text-[8px] font-semibold uppercase tracking-[0.14em]">
                    {progressionContext}
                  </p>
                </div>
              </button>
            )
          })}
        {snapshots.map((snapshot) => {
          const source = snapshot.image_url || snapshot.localUrl
          const chapter = chapterForSnapshot(snapshot)

          return (
            <div
              key={snapshot.id}
              className="axis-climate-surface min-w-32"
            >
              <button
                type="button"
                onClick={() => jumpToMoment(Number(snapshot.session_time), snapshot.id)}
                className="axis-optical-transition block text-left transition active:bg-white/10"
              >
                {source ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={source}
                    alt={`Marked at ${formatClock(snapshot.session_time)}`}
                    className="aspect-video w-32 object-cover grayscale-[32%] opacity-72"
                  />
                ) : (
                  <div className="axis-replay-surface aspect-video w-32" />
                )}
              </button>
              <div className="px-2 py-2">
                <p className="axis-mono axis-type-dormant text-[10px] font-bold">
                  {formatClock(snapshot.session_time)}
                </p>
                {chapter ? (
                  <p className="axis-mono axis-type-residue mt-1 text-[9px] font-black uppercase tracking-[0.14em]">
                    {chapter}
                  </p>
                ) : null}
                <input
                  type="text"
                  value={snapshot.annotation}
                  onChange={(event) =>
                    updateSnapshotAnnotation(snapshot.id, event.currentTarget.value)
                  }
                  onBlur={() => {
                    if (!sessionId || !snapshot.annotation.trim()) return
                    recordReplayNegotiation({
                      sessionId,
                      sessionTime: Number(snapshot.session_time) || 0,
                      type: "ANNOTATION",
                    })
                  }}
                  placeholder="note"
                  maxLength={120}
                  aria-label={`Snapshot note at ${formatClock(snapshot.session_time)}`}
                  className="axis-mono axis-optical-transition axis-type-field axis-type-emergent mt-2 w-full border-0 border-b border-[#d7c08a]/10 bg-transparent px-0 py-1 text-[11px] font-semibold lowercase outline-none transition focus:border-[#d7c08a]/42"
                />
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </section>
  )
}

export function SessionReplayCanvas({ session }: { session: TemporalSessionRecord }) {
  const [inspectionDepth, setInspectionDepth] = useState<InspectionDepth>(1)
  const [trainingMemories, setTrainingMemories] = useState<TrainingMemoryRecord[]>([])
  const [ritualPhase, setRitualPhase] = useState<RitualPhase>("apprentice")
  const { hydrateChronology, hydrateSnapshots, setUiStatus, events, activeEventId } = useAxisChronologyStore(
    useShallow((state) => ({
      hydrateChronology: state.hydrateChronology,
      hydrateSnapshots: state.hydrateSnapshots,
      setUiStatus: state.setUiStatus,
      events: state.events,
      activeEventId: state.activeEventId,
    }))
  )
  const densityAnchors = buildDevelopmentalAnchors({
    events,
    trainingMemories,
    activeEventId,
  })
  const climateDensity = densityAnchors.reduce(
    (warmth, anchor) =>
      Math.max(
        warmth,
        memoryDensityAt(anchor.time, densityAnchors, Number(session.duration_seconds) || 1)
      ),
    0
  )
  const climateWarmth = densityWarmth(climateDensity)
  const climatePressure = Math.min(0.9, 0.12 + climateDensity * 0.09)
  const climateResidue = Math.min(0.82, 0.16 + densityAnchors.length * 0.018)
  const climateDepth = Math.min(0.95, 0.7 + climateDensity * 0.035)
  const climateGrain = Math.min(0.72, 0.1 + climateResidue * 0.42)
  const typeEmergence = Math.min(0.78, 0.18 + climateDensity * 0.08)
  const typeDormancy = Math.max(0.18, 0.38 - climateDensity * 0.018)
  const typeFocus = Math.min(0.82, 0.18 + (activeEventId ? 0.18 : 0) + climateDensity * 0.052)
  const typeDecay = Math.min(0.84, 0.5 + climateResidue * 0.24)
  const typeContrast = Math.min(0.76, 0.38 + climateWarmth * 0.8)
  const typeVisibility = Math.min(0.72, 0.32 + typeFocus * 0.22 + climateWarmth * 0.5)
  const typeResidue = Math.min(0.68, 0.16 + climateResidue * 0.36)
  const climateStyle: AxisClimateStyle = {
    "--axis-climate-warmth": climateWarmth,
    "--axis-climate-pressure": climatePressure,
    "--axis-climate-residue": climateResidue,
    "--axis-climate-depth": climateDepth,
    "--axis-climate-grain": climateGrain,
    "--axis-type-emergence": typeEmergence,
    "--axis-type-dormancy": typeDormancy,
    "--axis-type-focus": typeFocus,
    "--axis-type-decay": typeDecay,
    "--axis-type-contrast": typeContrast,
    "--axis-type-visibility": typeVisibility,
    "--axis-type-residue": typeResidue,
  }

  useEffect(() => {
    hydrateChronology({
      sessionId: session.id,
      duration: Number(session.duration_seconds) || 0,
      events: [],
    })
    setUiStatus("loading")
  }, [hydrateChronology, session.duration_seconds, session.id, setUiStatus])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRitualPhase(readRitualPhase())
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  const markRitual = () => {
    setRitualPhase(markRitualPractice())
  }

  useEffect(() => {
    let active = true

    async function loadEvents() {
      try {
        const response = await fetch(`/api/live/session/${session.id}`, {
          cache: "no-store",
        })
        const payload = (await response.json().catch(() => ({}))) as SessionPayload

        if (!active) return
        hydrateChronology({
          sessionId: session.id,
          duration: Number(session.duration_seconds) || 0,
          events: payload.events || [],
        })
        hydrateSnapshots(payload.snapshots || [])
        setTrainingMemories(payload.trainingMemories || [])
      } finally {
        return
      }
    }

    void loadEvents()

    return () => {
      active = false
    }
  }, [hydrateChronology, hydrateSnapshots, session.duration_seconds, session.id])

  return (
    <main
      className="axis-display axis-climate-root min-h-dvh overflow-hidden"
      style={climateStyle}
    >
      <section className="axis-climate-field pointer-events-none fixed inset-0" />
      <ChronologyEdge trainingMemories={trainingMemories} />
      <section className="relative mx-auto flex min-h-dvh w-full max-w-[92rem] flex-col px-4 py-6 sm:px-8">
        <header className="py-3">
          <div className="flex items-center justify-between gap-6">
            <Link
              href="/live"
              aria-label="Return live"
              className="axis-mono axis-type-dormant text-[10px] font-semibold lowercase tracking-[0.14em] transition hover:opacity-70"
            >
              live
            </Link>
          </div>
        </header>

        <div className="flex flex-col gap-4 py-12 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="axis-type-presence mt-2 text-5xl font-bold leading-none tracking-normal sm:text-6xl">
              {formatPreciseClock(session.duration_seconds)}
            </p>
            <p className="axis-mono axis-type-residue mt-5 text-[10px] font-semibold uppercase tracking-[0.18em]">
              {formatEnvironmentalTimestamp(session.created_at)}
            </p>
          </div>
          <DeviceExportControl session={session} />
        </div>

        <div className="grid flex-1 gap-5 py-4">
          <section className="min-w-0">
            <ReplayVideo
              playbackUrl={session.playback_url}
              inspectionDepth={inspectionDepth}
              session={session}
              ritualPhase={ritualPhase}
              densityAnchors={densityAnchors}
              onRitualPractice={markRitual}
              onTrainingMemoryStored={(memory) =>
                setTrainingMemories((current) => {
                  if (current.some((item) => item.id === memory.id)) return current
                  return [...current, memory].sort(
                    (a, b) => Number(a.replay_time) - Number(b.replay_time)
                  )
                })
              }
              onSetInspectionDepth={setInspectionDepth}
            />
            <InspectionDepthControl
              inspectionDepth={inspectionDepth}
              setInspectionDepth={setInspectionDepth}
            />
            <EventRail trainingMemories={trainingMemories} />
            <DevelopmentalInputBar trainingMemories={trainingMemories} />
            <DevelopmentalMemoryStrip trainingMemories={trainingMemories} />
          </section>
        </div>
      </section>
    </main>
  )
}
