"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSessionStore } from "@/store/useSessionStore"
import { normalizeReplay } from "@/lib/normalizeReplay"
import { readBasketballSignal } from "@/lib/basketball/readBasketballSignal"
import type { BasketballSignalState } from "@/lib/basketball/types"
import { buildBaseline } from "@/lib/calibration/buildBaseline"
import type { CalibrationBaseline } from "@/lib/calibration/types"
import { getCalibrationMissions } from "@/lib/missions/getCalibrationMissions"
import { segmentCalibrationMemory } from "@/lib/segments/segmentCalibrationMemory"
import type { SegmentedMemory } from "@/lib/segments/types"
import {
  addAudioSignalSample,
  addFrameSignalSample,
  createSignalAccumulator,
  extractSignals,
  readFrameSignalSample,
  setSignalDuration,
} from "@/lib/signals/extractSignals"
import type {
  ExtractedReplaySignals,
  SignalChannelStatus,
  SignalReadiness,
} from "@/lib/signals/types"
import type { BrowserSignalRead } from "@/lib/vision/providers/types"
import type { ReplaySessionView } from "@/types/memory"

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

type Props = {
  playbackId: string
  initialSession?: ReplaySessionView | null
  className?: string
}

type Marker = {
  time: string
  label: string
  detail: string
  tone: "lime" | "cyan" | "zinc"
}

type LiveSignalLabel =
  | "SIGNAL RECORDED"
  | "ACTIVITY DETECTED"
  | "ACTIVITY WAITING"
  | "BRIGHTNESS SHIFT"
  | "AUDIO ENERGY"
  | "SIGNAL RETURNED"
  | "SIGNAL INITIALIZING"
  | "SIGNAL UNAVAILABLE"

type LiveSignalEvent = {
  label: LiveSignalLabel
  time: number
  detail: string
  tone: "lime" | "cyan" | "zinc"
}

type FrameSignal = {
  motionAmount: number
  cameraMovement: number
  averageBrightness: number
  audioEnergy: number
}

const SIGNAL_ATTEMPT_DELAY_MS = 2000
const SIGNAL_UNAVAILABLE_TIMEOUT_MS = 5000
const calibrationMissions = getCalibrationMissions()

function formatClock(seconds?: number) {
  if (!seconds || Number.isNaN(seconds)) return "00:00"

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`
}

function formatDuration(seconds?: number) {
  if (!seconds || Number.isNaN(seconds)) return "0:00"

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatMemoryCount(count?: number) {
  return Math.max(count || 1, 1)
    .toString()
    .padStart(2, "0")
}

function capitalize(value?: string) {
  if (!value) return "Unknown"

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function safeParseSession(raw: string | null) {
  if (!raw) return null

  try {
    return JSON.parse(raw) as ReplaySessionView
  } catch {
    return null
  }
}

function normalizeSession(
  value: ReplaySessionView | null | undefined
) {
  if (!value) return null

  return normalizeReplay(value)
}

function pushLiveSignal(
  events: LiveSignalEvent[],
  event: LiveSignalEvent
) {
  const previous = events[0]

  if (
    previous?.label === event.label &&
    Math.abs(previous.time - event.time) < 4
  ) {
    return events
  }

  return [event, ...events].slice(0, 8)
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 py-3 last:border-b-0">
      <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">
        {label}
      </span>
      <span className="max-w-[58%] text-right text-sm font-medium text-white/80">
        {value}
      </span>
    </div>
  )
}

function MarkerCard({ marker }: { marker: Marker }) {
  const toneClass =
    marker.tone === "lime"
      ? "text-lime-300"
      : marker.tone === "cyan"
        ? "text-cyan-300"
        : "text-white/55"

  return (
    <div className="border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p
          className={`text-[11px] uppercase tracking-[0.28em] ${toneClass}`}
        >
          {marker.label}
        </p>
        <p className="font-mono text-xs text-white/35">
          {marker.time}
        </p>
      </div>

      <p className="text-sm leading-relaxed text-white/55">
        {marker.detail}
      </p>
    </div>
  )
}

function mergeBaseline(
  baseline: CalibrationBaseline | undefined,
  signals: ExtractedReplaySignals | null
): CalibrationBaseline {
  const memoryCount = baseline?.memoryCount || 1

  return {
    status:
      memoryCount <= 1
        ? signals?.frameSampleCount
          ? "BASELINE STARTED"
          : "NOT ENOUGH MEMORY"
        : signals?.frameSampleCount
          ? "MEMORY ADDED"
          : baseline?.status || "COMPARISON LOCKED",
    averageSessionDuration: baseline?.averageSessionDuration || 0,
    averageMotionIntensity:
      signals?.motionIntensity ?? baseline?.averageMotionIntensity ?? null,
    averageAudioEnergy:
      signals?.audioEnergy ?? baseline?.averageAudioEnergy ?? null,
    usualSource: baseline?.usualSource || "upload",
    memoryCount,
    firstMemoryDate: baseline?.firstMemoryDate ?? null,
    latestMemoryDate: baseline?.latestMemoryDate ?? null,
    missionType: baseline?.missionType ?? null,
    missionCompletionCount: baseline?.missionCompletionCount || 0,
    missionSessions: baseline?.missionSessions || [],
  }
}

function createWaitingBaseline(
  session: ReplaySessionView | null
): CalibrationBaseline {
  return {
    status: "NOT ENOUGH MEMORY",
    averageSessionDuration: session?.duration || 0,
    averageMotionIntensity: null,
    averageAudioEnergy: null,
    usualSource: session?.source || "upload",
    memoryCount: Math.max(session?.memoryCount || 1, 1),
    firstMemoryDate: session?.createdAt || null,
    latestMemoryDate: session?.createdAt || null,
    missionType:
      session?.mission && session.mission !== "None"
        ? session.mission
        : null,
    missionCompletionCount:
      session?.mission && session.mission !== "None" ? 1 : 0,
    missionSessions:
      session?.mission && session.mission !== "None"
        ? [
            {
              missionType: session.mission,
              duration: session.duration || 0,
              motionLevel: null,
              audioLevel: null,
              completionCount: 1,
              timestamp: session.createdAt,
            },
          ]
        : [],
  }
}

function displaySignalLabel(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function channelValue(status: SignalChannelStatus) {
  if (status === "recorded") return "Recorded"
  if (status === "unavailable") return "Unavailable"

  return "Waiting"
}

function percentValue(value: number | null | undefined) {
  if (value == null) return "Waiting"

  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function countValue(value: number | null | undefined, label: string) {
  if (value == null) return "Waiting"

  return `${value} ${label}`
}

function segmentationValue(value: number, fallback = "Waiting") {
  return value > 0 ? String(value) : fallback
}

function clipValue(
  state: BasketballSignalState,
  status: SignalReadiness
) {
  if (status === "initializing") return "Waiting"

  return displaySignalLabel(state.clipType)
}

function missionValue(session: ReplaySessionView) {
  return session.mission && session.mission !== "None"
    ? session.mission
    : "Open Session"
}

function missionFromSession(session: ReplaySessionView) {
  return calibrationMissions.find((mission) =>
    session.mission?.includes(mission.title)
  )
}

function baselineProgress({
  session,
  baseline,
}: {
  session: ReplaySessionView
  baseline: CalibrationBaseline
}) {
  const mission = missionFromSession(session)
  const unlockAfter = mission?.unlockAfter || 3
  const count = Math.min(
    baseline.missionCompletionCount || 0,
    unlockAfter
  )
  const ready = count >= unlockAfter

  return {
    label: ready ? "BASELINE READY" : "BASELINE BUILDING",
    comparison: ready ? "COMPARISON UNLOCKED" : "COMPARISON LOCKED",
    progress: `${count} / ${unlockAfter} memories`,
    detail: ready
      ? "Axis can compare this memory to your normal rhythm."
      : `Record ${unlockAfter - count} more to unlock read.`,
    baselineName: mission?.baselineName || "Movement Baseline",
  }
}

function missionWatchRows({
  session,
  signals,
  segmentedMemory,
}: {
  session: ReplaySessionView
  signals?: ExtractedReplaySignals | null
  segmentedMemory?: SegmentedMemory | null
}) {
  const mission = missionFromSession(session)
  const read: BrowserSignalRead | undefined = signals?.browserSignals

  if (!mission) {
    return [
      ["Motion", percentValue(read?.motionDelta)],
      ["Camera Stability", percentValue(read?.cameraStability)],
      ["Audio", percentValue(read?.audioEnergy)],
    ]
  }

  if (mission.title === "HANDLE") {
    const dribbleCycles =
      segmentedMemory?.segments.filter(
        (segment) => segment.type === "dribble_cycle"
      ).length || 0
    const activityWindows =
      segmentedMemory?.segments.filter(
        (segment) => segment.type === "activity_window"
      ).length || 0
    const cadenceState = segmentedMemory?.cadenceEstimate.state
    const hasEnoughSignal = (segmentedMemory?.confidence || 0) >= 0.5

    return [
      [
        "Bounce Rhythm",
        hasEnoughSignal
          ? "Found"
          : segmentedMemory
            ? "Not Enough Signal"
            : "Waiting",
      ],
      ["Rep Segments", segmentationValue(dribbleCycles)],
      [
        "Cadence",
        cadenceState === "stable"
          ? "Stable"
          : cadenceState === "uneven"
            ? "Uneven"
            : "Waiting",
      ],
      ["Activity Windows", segmentationValue(activityWindows)],
    ]
  }

  if (mission.title === "FOOTWORK") {
    return [
      ["Direction Changes", countValue(read?.directionChanges, "changes")],
      ["Movement Bursts", countValue(read?.movementBursts, "bursts")],
      ["Camera Stability", percentValue(read?.cameraStability)],
    ]
  }

  if (mission.title === "SHOOTING FORM") {
    return [
      ["Repeated Motion", percentValue(read?.repeatedMotion)],
      ["Framing Consistency", percentValue(read?.framingConsistency)],
      ["Release Rhythm", percentValue(read?.repeatedMotion)],
    ]
  }

  if (mission.title === "LIVE MOVEMENT") {
    return [
      ["Motion Density", percentValue(read?.motionDensity)],
      ["Pace Changes", countValue(read?.paceChanges, "changes")],
      ["Camera Movement", percentValue(read?.cameraMovement)],
    ]
  }

  return [
    ["Acceleration Burst", percentValue(read?.accelerationBurst)],
    ["Movement Intensity", percentValue(read?.motionDelta)],
    ["Camera Movement", percentValue(read?.cameraMovement)],
  ]
}

function basketballSentence({
  state,
  baseline,
  signals,
  session,
  signalStatus,
  segmentedMemory,
}: {
  state: BasketballSignalState
  baseline: CalibrationBaseline
  signals?: ExtractedReplaySignals | null
  session: ReplaySessionView
  signalStatus: SignalReadiness
  segmentedMemory?: SegmentedMemory | null
}) {
  const lines: string[] = []
  const progress = baselineProgress({ session, baseline })

  if (signalStatus === "initializing") {
    return "Signal initializing. Replay remains available."
  }

  if (signalStatus === "unavailable") {
    return "Signal unavailable. Replay remains available."
  }

  if (
    session.mission?.includes("HANDLE") &&
    segmentedMemory &&
    segmentedMemory.confidence < 0.5
  ) {
    return "Not enough signal. Replay remains available."
  }

  if (state.clipType === "SHORT CLIP") {
    lines.push("Short clip stored.")
  } else if (session.mission && session.mission !== "None") {
    lines.push("Movement archived.")
  } else if ((signals?.duration || session.duration) && session.player !== "Unassigned") {
    lines.push("Replay added to player memory.")
  } else if (signals?.duration || session.duration) {
    lines.push("Replay added to memory.")
  }

  if (signals?.frameSampleCount && state.activityState === "ACTIVE MOTION") {
    lines.push("Active motion recorded.")
  } else if (signals?.frameSampleCount) {
    lines.push("Low activity recorded.")
  }

  if (
    signals?.cameraMovement != null &&
    state.evidence.some((item) => item.startsWith("Camera"))
  ) {
    lines.push("Camera movement recorded.")
  }

  if (progress.comparison === "COMPARISON LOCKED") {
    if (
      session.mission?.includes("HANDLE") &&
      segmentedMemory?.confidence &&
      segmentedMemory.confidence >= 0.5
    ) {
      lines.push(`Cadence found. ${progress.detail}`)
    } else {
      lines.push("Comparison locked. More memory needed.")
    }
  } else {
    lines.push("Comparison unlocked.")
  }

  if (state.headline === "PLAYER UNASSIGNED") {
    lines.push("Player not assigned.")
  }

  return lines[0]
    ? lines.slice(0, 2).join(" ")
    : "Waiting for replay frames."
}

function BasketballRead({
  session,
  signals,
  baseline,
  signalStatus,
  motionStatus,
  cameraStatus,
  audioStatus,
  segmentedMemory,
}: {
  session: ReplaySessionView
  signals: ExtractedReplaySignals | null
  baseline: CalibrationBaseline
  signalStatus: SignalReadiness
  motionStatus: SignalChannelStatus
  cameraStatus: SignalChannelStatus
  audioStatus: SignalChannelStatus
  segmentedMemory: SegmentedMemory | null
}) {
  const displaySignals = signals || session.signalRead
  const progress = baselineProgress({ session, baseline })
  const watchRows = missionWatchRows({
    session,
    signals: displaySignals,
    segmentedMemory,
  })
  const basketballState =
    signalStatus === "recorded"
      ? readBasketballSignal({
          session,
          signals: displaySignals,
          baseline,
        })
      : {
          headline:
            signalStatus === "initializing"
              ? "SIGNAL INITIALIZING"
              : "SIGNAL UNAVAILABLE",
          courtState: "CAMERA STABLE",
          activityState: "LOW ACTIVITY",
          clipType: "CLIP STORED",
          evidence: [],
          confidence: 0,
        }

  return (
    <div className="mt-5 border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.45em] text-white/25">
          Basketball Read
        </p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-lime-300">
          {basketballState.headline}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DetailRow
          label="Clip"
          value={clipValue(basketballState, signalStatus)}
        />
        <DetailRow
          label="Motion"
          value={channelValue(motionStatus)}
        />
        <DetailRow
          label="Camera"
          value={channelValue(cameraStatus)}
        />
        <DetailRow
          label="Audio"
          value={channelValue(audioStatus)}
        />
        <DetailRow
          label="Baseline"
          value={progress.label}
        />
        <DetailRow
          label="Builds"
          value={progress.baselineName}
        />
        <DetailRow
          label="Comparison"
          value={progress.comparison}
        />
        <DetailRow
          label="Milestone"
          value={progress.progress}
        />
        <DetailRow
          label="Mission"
          value={missionValue(session)}
        />
        <DetailRow
          label="Memory"
          value={formatMemoryCount(baseline.memoryCount)}
        />
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        <p className="mb-2 text-[10px] uppercase tracking-[0.45em] text-white/25">
          Axis Watches
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {watchRows.map(([label, value]) => (
            <div
              key={label}
              className="border border-white/10 bg-black/30 p-4"
            >
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/30">
                {label}
              </p>
              <p className="mt-3 text-lg font-black text-white">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-white/50">
        {basketballSentence({
          state: basketballState,
          baseline,
          signals: signalStatus === "recorded" ? displaySignals : null,
          session,
          signalStatus,
          segmentedMemory,
        })}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/35">
        {progress.detail}
      </p>
    </div>
  )
}

function EmptyReplay() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-5 text-white">
      <div className="w-full max-w-xl border border-white/10 bg-white/[0.03] p-8">
        <p className="text-[10px] uppercase tracking-[0.45em] text-white/30">
          Axis Replay System
        </p>
        <h1 className="mt-5 text-[clamp(3rem,14vw,6rem)] font-black leading-[0.88] tracking-[-0.06em]">
          NO
          <br />
          SIGNAL
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-white/50">
          No replay memory was found on this device for the requested session.
        </p>
      </div>
    </div>
  )
}

export default function AxisReplayClient({
  playbackId,
  initialSession = null,
  className = "",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null)
  const lastActivityRef = useRef(0)
  const lastSignalLabelRef = useRef<LiveSignalLabel | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioSourceReadyRef = useRef(false)
  const audioPeakRef = useRef(0)
  const signalAccumulatorRef = useRef(createSignalAccumulator(0))
  const signalReadyRef = useRef(false)
  const sessionRef = useRef<ReplaySessionView | null>(null)
  const metadataTimeoutRef = useRef<number | null>(null)
  const frameSampleTimeoutRef = useRef<number | null>(null)
  const frameSamplingUnavailableRef = useRef(false)
  const setPlaybackId = useSessionStore(
    (state) => state.setPlaybackId
  )
  const setCurrentTime = useSessionStore(
    (state) => state.setCurrentTime
  )
  const setPlaying = useSessionStore(
    (state) => state.setPlaying
  )

  const [session, setSession] =
    useState<ReplaySessionView | null>(
      normalizeSession(initialSession)
    )
  const [extractedSignals, setExtractedSignals] =
    useState<ExtractedReplaySignals | null>(
      initialSession?.signalRead || null
    )
  const [currentTime, setLocalCurrentTime] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [replayStatus, setReplayStatus] = useState<
    "ready" | "recovering" | "recovered" | "failed"
  >("ready")
  const [liveSignalEvents, setLiveSignalEvents] = useState<
    LiveSignalEvent[]
  >([])
  const [liveMetrics, setLiveMetrics] = useState<FrameSignal>({
    motionAmount: 0,
    cameraMovement: 0,
    averageBrightness: 0,
    audioEnergy: 0,
  })
  const [audioReady, setAudioReady] = useState(false)
  const [signalStatus, setSignalStatus] =
    useState<SignalReadiness>("initializing")
  const [motionStatus, setMotionStatus] =
    useState<SignalChannelStatus>("waiting")
  const [cameraStatus, setCameraStatus] =
    useState<SignalChannelStatus>("waiting")
  const [audioStatus, setAudioStatus] =
    useState<SignalChannelStatus>("waiting")
  const [baseline, setBaseline] = useState<CalibrationBaseline | null>(null)
  const [segmentedMemory, setSegmentedMemory] =
    useState<SegmentedMemory | null>(null)

  const clearSignalTimeouts = useCallback(() => {
    if (metadataTimeoutRef.current != null) {
      window.clearTimeout(metadataTimeoutRef.current)
      metadataTimeoutRef.current = null
    }

    if (frameSampleTimeoutRef.current != null) {
      window.clearTimeout(frameSampleTimeoutRef.current)
      frameSampleTimeoutRef.current = null
    }
  }, [])

  const markSignalRecorded = useCallback(() => {
    setSignalStatus("recorded")
  }, [])

  const markSignalUnavailableIfEmpty = useCallback(() => {
    setSignalStatus((current) =>
      current === "recorded" ? current : "unavailable"
    )
  }, [])

  const finalizeUnavailableChannels = useCallback(() => {
    setMotionStatus((current) =>
      current === "waiting" ? "unavailable" : current
    )
    setCameraStatus((current) =>
      current === "waiting" ? "unavailable" : current
    )
    setAudioStatus((current) =>
      current === "waiting" ? "unavailable" : current
    )

    const hasUsableSignal =
      signalAccumulatorRef.current.frameSamples.length > 0 ||
      signalAccumulatorRef.current.audioSamples.length > 0

    if (!hasUsableSignal) {
      setSignalStatus("unavailable")
    }
  }, [])

  const updateSegmentedMemory = useCallback(
    (activeSession: ReplaySessionView | null) => {
      if (!activeSession?.mission || activeSession.mission === "None") {
        setSegmentedMemory(null)
        return
      }

      try {
        const accumulator = signalAccumulatorRef.current

        setSegmentedMemory(
          segmentCalibrationMemory({
            missionId: activeSession.mission,
            clipDuration:
              accumulator.duration || activeSession.duration || 0,
            frameSamples: accumulator.frameSamples,
            audioSamples: accumulator.audioSamples,
          })
        )
      } catch (error) {
        console.warn("AXIS SEGMENTATION WAITING", error)
        setSegmentedMemory(null)
      }
    },
    []
  )

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    setPlaybackId(playbackId)
    signalAccumulatorRef.current = createSignalAccumulator(
      initialSession?.duration || 0
    )
    clearSignalTimeouts()
    previousFrameRef.current = null
    frameSamplingUnavailableRef.current = false

    queueMicrotask(() => {
      setLiveSignalEvents([])
      signalReadyRef.current = false
      setSignalStatus("initializing")
      setMotionStatus("waiting")
      setCameraStatus("waiting")
      setAudioStatus("waiting")
      setAudioReady(false)
      setSegmentedMemory(null)
      setBaseline(null)
      const localSession = safeParseSession(
        localStorage.getItem(`axis-session-${playbackId}`)
      )

      setSession(
        normalizeSession(initialSession) ||
          normalizeSession(localSession)
      )
      setExtractedSignals(initialSession?.signalRead || null)
      setIsLoading(false)
    })
  }, [clearSignalTimeouts, initialSession, playbackId, setPlaybackId])

  useEffect(() => {
    if (!session?.videoUrl || !videoRef.current || isLoading) return

    let cancelled = false
    setSignalStatus("initializing")
    setMotionStatus("waiting")
    setCameraStatus("waiting")
    setAudioStatus("waiting")
    frameSamplingUnavailableRef.current = false
    clearSignalTimeouts()

    queueMicrotask(() => {
      if (cancelled) return

      try {
        signalAccumulatorRef.current = createSignalAccumulator(
          session.duration || 0
        )
        previousFrameRef.current = null
        setBaseline(
          buildBaseline({
            session,
            previousSessions: [],
            signals: null,
          })
        )
        updateSegmentedMemory(session)
        signalReadyRef.current = true
        setSignalStatus("initializing")

        metadataTimeoutRef.current = window.setTimeout(() => {
          if (cancelled) return
          setSignalStatus((current) =>
            current === "recorded" ? current : "initializing"
          )
        }, SIGNAL_ATTEMPT_DELAY_MS)

        frameSampleTimeoutRef.current = window.setTimeout(() => {
          if (cancelled) return
          finalizeUnavailableChannels()
        }, SIGNAL_UNAVAILABLE_TIMEOUT_MS)
      } catch (error) {
        console.warn("AXIS SIGNAL INITIALIZATION WAITING", error)
        signalReadyRef.current = false
        setSignalStatus("unavailable")
      }
    })

    return () => {
      cancelled = true
      clearSignalTimeouts()
    }
  }, [
    clearSignalTimeouts,
    finalizeUnavailableChannels,
    isLoading,
    session,
    updateSegmentedMemory,
  ])

  async function recoverReplay() {
    if (replayStatus === "recovering") return

    try {
      setReplayStatus("recovering")

      const response = await fetch(`/api/replay/${playbackId}`)

      if (!response.ok) {
        setReplayStatus("failed")
        return
      }

      const data = (await response.json()) as {
        session?: ReplaySessionView
      }

      if (!data.session?.videoUrl) {
        setReplayStatus("failed")
        return
      }

      setSession(normalizeSession(data.session))
      setExtractedSignals(data.session.signalRead || null)
      localStorage.setItem(
        `axis-session-${playbackId}`,
        JSON.stringify(normalizeSession(data.session))
      )
      setReplayStatus("recovered")
    } catch {
      setReplayStatus("failed")
    }
  }

  async function connectAudioSignal() {
    if (audioSourceReadyRef.current || !videoRef.current) return

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext
      const context =
        audioContextRef.current || new AudioContextClass()

      if (context.state === "suspended") {
        await context.resume()
      }

      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.82

      const source = context.createMediaElementSource(
        videoRef.current
      )
      source.connect(analyser)
      analyser.connect(context.destination)

      audioContextRef.current = context
      analyserRef.current = analyser
      audioSourceReadyRef.current = true
      setAudioReady(true)
    } catch (error) {
      console.warn("AXIS AUDIO SIGNAL UNAVAILABLE", error)
      setAudioReady(false)
      setAudioStatus("unavailable")
      markSignalUnavailableIfEmpty()
    }
  }

  useEffect(() => {
    let frameId = 0
    let lastSample = 0
    const audioData = new Uint8Array(128)

    function emitSignal(
      label: LiveSignalLabel,
      detail: string,
      tone: "lime" | "cyan" | "zinc"
    ) {
      const video = videoRef.current
      const time = video?.currentTime || 0

      if (
        lastSignalLabelRef.current === label &&
        Math.abs(time - lastActivityRef.current) < 3
      ) {
        return
      }

      lastSignalLabelRef.current = label
      setLiveSignalEvents((events) =>
        pushLiveSignal(events, {
          label,
          time,
          detail,
          tone,
        })
      )
    }

    function sample(now: number) {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (
        signalReadyRef.current &&
        video &&
        canvas &&
        !video.paused &&
        !video.ended &&
        video.readyState >= 2 &&
        now - lastSample > 420
      ) {
        lastSample = now
        const context = canvas.getContext("2d", {
          willReadFrequently: true,
        })

        if (context && !frameSamplingUnavailableRef.current) {
          try {
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            const frame = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            ).data
            const signal = readFrameSignalSample({
              data: frame,
              previousFrame: previousFrameRef.current,
              timestamp: video.currentTime,
            })
            previousFrameRef.current = new Uint8ClampedArray(frame)
            addFrameSignalSample(signalAccumulatorRef.current, signal)
            setMotionStatus("recorded")
            setCameraStatus("recorded")
            markSignalRecorded()
            if (frameSampleTimeoutRef.current != null) {
              window.clearTimeout(frameSampleTimeoutRef.current)
              frameSampleTimeoutRef.current = null
            }
            setSignalDuration(
              signalAccumulatorRef.current,
              video.duration || 0
            )

            const extracted = extractSignals(
              signalAccumulatorRef.current
            )
            setExtractedSignals(extracted)
            updateSegmentedMemory(sessionRef.current)
            setBaseline((currentBaseline) => {
              const activeSession = sessionRef.current

              if (!activeSession) return currentBaseline

              return currentBaseline
                ? mergeBaseline(currentBaseline, extracted)
                : buildBaseline({
                    session: activeSession,
                    previousSessions: [],
                    signals: extracted,
                  })
            })
            setLiveMetrics((metrics) => ({
              ...metrics,
              motionAmount: signal.motionIntensity,
              cameraMovement: signal.cameraMovement,
              averageBrightness: signal.brightness,
            }))

            if (signal.motionIntensity > 0.34) {
              lastActivityRef.current = video.currentTime
              emitSignal(
                "ACTIVITY DETECTED",
                "Motion increased in replay.",
                "lime"
              )
            } else if (
              video.currentTime - lastActivityRef.current > 4 &&
              signal.motionIntensity < 0.08
            ) {
              emitSignal(
                "ACTIVITY WAITING",
                "Footage is holding low movement.",
                "zinc"
              )
            } else if (signal.motionIntensity < 0.12) {
              emitSignal(
                "ACTIVITY WAITING",
                "Low movement detected.",
                "zinc"
              )
            }

            if (signal.brightnessShift > 0.28) {
              emitSignal(
                "BRIGHTNESS SHIFT",
                "Brightness changed in replay.",
                "cyan"
              )
            }

            if (signal.cameraMovement > 0.5) {
              emitSignal(
                "SIGNAL RETURNED",
                "Camera movement increased.",
                "cyan"
              )
            }
          } catch (error) {
            console.warn("AXIS FRAME SIGNAL UNAVAILABLE", error)
            frameSamplingUnavailableRef.current = true
            setMotionStatus("unavailable")
            setCameraStatus("unavailable")
            markSignalUnavailableIfEmpty()
            emitSignal(
              "SIGNAL UNAVAILABLE",
              "Frame sampling unavailable.",
              "zinc"
            )
          }
        } else if (!context && !frameSamplingUnavailableRef.current) {
          frameSamplingUnavailableRef.current = true
          setMotionStatus("unavailable")
          setCameraStatus("unavailable")
          markSignalUnavailableIfEmpty()
          emitSignal(
            "SIGNAL UNAVAILABLE",
            "Frame sampling unavailable.",
            "zinc"
          )
        }

        const analyser = analyserRef.current

        if (analyser) {
          analyser.getByteTimeDomainData(audioData)

          const peak = audioData.reduce((max, value) => {
            return Math.max(max, Math.abs(value - 128))
          }, 0)

          audioPeakRef.current = peak
          const energy = Math.min(1, peak / 80)
          setAudioStatus("recorded")
          markSignalRecorded()
          addAudioSignalSample(signalAccumulatorRef.current, {
            timestamp: video.currentTime,
            energy,
          })
          const extracted = extractSignals(signalAccumulatorRef.current)
          setExtractedSignals(extracted)
          updateSegmentedMemory(sessionRef.current)
          setBaseline((currentBaseline) => {
            const activeSession = sessionRef.current

            if (!activeSession) return currentBaseline

            return currentBaseline
              ? mergeBaseline(currentBaseline, extracted)
              : buildBaseline({
                  session: activeSession,
                  previousSessions: [],
                  signals: extracted,
                })
          })
          setLiveMetrics((metrics) => ({
            ...metrics,
            audioEnergy: energy,
          }))

          if (peak > 42) {
            emitSignal(
              "AUDIO ENERGY",
              "Audio spike detected.",
              "cyan"
            )
          }
        }
      }

      frameId = requestAnimationFrame(sample)
    }

    frameId = requestAnimationFrame(sample)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [
    markSignalRecorded,
    markSignalUnavailableIfEmpty,
    updateSegmentedMemory,
  ])

  const duration = session?.duration || 0
  const progress =
    duration > 0
      ? Math.min(100, (currentTime / duration) * 100)
      : session
        ? 100
        : 0

  const markers: Marker[] =
    Array.isArray(session?.timeline) && session.timeline.length
      ? session.timeline.map((event) => ({
          time: event.time || "00:00",
          label: event.label || "SIGNAL FOUND",
          detail: event.detail || "Session memory expanded.",
          tone: "cyan",
        }))
      : [
          {
            time: "00:00",
            label: "FOOTAGE ACCEPTED",
            detail: "Replay linked to player archive.",
            tone: "cyan",
          },
          {
            time: formatClock(Math.max(duration * 0.33, 1)),
            label: "SIGNAL RECORDED",
            detail: "Signal read starts when frames are available.",
            tone: "zinc",
          },
          {
            time: formatClock(duration),
            label:
              session?.mission && session.mission !== "None"
                ? "MOVEMENT ARCHIVED"
                : "ARCHIVE ACTIVE",
            detail:
              session?.mission && session.mission !== "None"
                ? "Mission memory added to baseline."
                : "Replay added to archive.",
            tone: "lime",
          },
        ]

  const replayStatusLabel =
    replayStatus === "recovering"
      ? "Memory Indexing"
      : replayStatus === "recovered"
        ? "Replay Unlocked"
        : replayStatus === "failed"
          ? "Signal Unavailable"
          : session?.memoryState?.status
            ? session.memoryState.status
            : extractedSignals?.frameSampleCount
              ? "Signal Recorded"
              : "Context Building"

  const contextPanelLine =
    replayStatus === "recovering"
      ? "MEMORY INDEXING"
      : replayStatus === "recovered"
        ? "REPLAY UNLOCKED"
        : replayStatus === "failed"
          ? "SIGNAL UNAVAILABLE"
          : session?.memoryState?.contextLine ||
            session?.context ||
            "Replay linked. Session added. Memory available."

  const liveMarkers: Marker[] = liveSignalEvents.map((event) => ({
    time: formatClock(event.time),
    label: event.label,
    detail: event.detail,
    tone: event.tone,
  }))
  const displayMarkers = liveMarkers.length
    ? [...liveMarkers, ...markers].slice(0, 10)
    : markers
  const latestLiveSignal = liveSignalEvents[0]?.label || replayStatusLabel
  const displayBaseline = baseline
    ? mergeBaseline(baseline, extractedSignals)
    : createWaitingBaseline(session)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black px-5 py-8 text-white">
        <div className="h-2 w-full overflow-hidden bg-white/10">
          <div className="h-full w-1/3 animate-pulse bg-lime-300" />
        </div>
      </div>
    )
  }

  if (!session) return <EmptyReplay />

  return (
    <div
      className={`min-h-screen overflow-hidden bg-black text-white ${className}`}
    >
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.45em] text-white/30">
              Axis Replay System
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">
              {session?.memoryState?.headline || "Memory Online"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_18px_rgba(190,242,100,0.8)]" />
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">
              {replayStatusLabel}
            </p>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[292px_minmax(0,1fr)_320px]">
        <aside className="hidden border-r border-white/10 p-5 lg:block">
          <p className="mb-4 text-[10px] uppercase tracking-[0.45em] text-white/25">
            Session Thread
          </p>

          <div className="space-y-3">
            {displayMarkers.map((marker) => (
              <MarkerCard
                key={`${marker.time}-${marker.label}`}
                marker={marker}
              />
            ))}
          </div>
        </aside>

        <section className="min-w-0 px-5 py-8 lg:px-8 lg:py-10">
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.5em] text-white/30">
              Axis Memory Replay
            </p>
            <h2 className="mt-4 max-w-4xl text-[clamp(3.7rem,9vw,8rem)] font-black leading-[0.86] tracking-[-0.06em] text-white">
              AXIS
              <br />
              REPLAY
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/50">
              {session.memoryState?.ambientLine ||
                session.ambientLine ||
                "Context building."}
            </p>
          </div>

          <div className="relative overflow-hidden border border-white/10 bg-white/[0.03]">
            <video
              ref={videoRef}
              src={session.videoUrl}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-black object-cover"
              onLoadedMetadata={(event) => {
                if (!signalReadyRef.current) return

                try {
                  if (metadataTimeoutRef.current != null) {
                    window.clearTimeout(metadataTimeoutRef.current)
                    metadataTimeoutRef.current = null
                  }
                  setSignalDuration(
                    signalAccumulatorRef.current,
                    event.currentTarget.duration || duration
                  )
                  setExtractedSignals(
                    extractSignals(signalAccumulatorRef.current)
                  )
                  updateSegmentedMemory(sessionRef.current)
                } catch (error) {
                  console.warn("AXIS SIGNAL METADATA WAITING", error)
                  setSignalStatus("unavailable")
                }
              }}
              onTimeUpdate={(event) => {
                const time = event.currentTarget.currentTime

                setLocalCurrentTime(time)
                setCurrentTime(time)
              }}
              onPlay={() => {
                setPlaying(true)
                void connectAudioSignal()
              }}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={recoverReplay}
            />

            <div className="pointer-events-none absolute left-5 top-5 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-lime-300" />
              <p className="text-xs uppercase tracking-[0.35em] text-white/55">
                {latestLiveSignal}
              </p>
            </div>

            <canvas
              ref={canvasRef}
              width={96}
              height={54}
              className="hidden"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
                Memory Count
              </p>
              <p className="mt-3 text-2xl font-black text-lime-300">
                {formatMemoryCount(session.memoryCount)}
              </p>
            </div>

            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
                Last Signal
              </p>
              <p className="mt-3 text-2xl font-black text-white">
                {latestLiveSignal}
              </p>
            </div>

            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
                Archive Status
              </p>
              <p className="mt-3 text-2xl font-black text-lime-300">
                {session.memoryState?.archiveStatus ||
                  session.archiveStatus ||
                  "Active"}
              </p>
            </div>
          </div>

          <BasketballRead
            session={session}
            signals={extractedSignals}
            baseline={displayBaseline}
            signalStatus={signalStatus}
            motionStatus={motionStatus}
            cameraStatus={cameraStatus}
            audioStatus={audioStatus}
            segmentedMemory={segmentedMemory}
          />

          <div className="mt-8 space-y-3 lg:hidden">
            {displayMarkers.map((marker) => (
              <MarkerCard
                key={`${marker.time}-${marker.label}-mobile`}
                marker={marker}
              />
            ))}
          </div>
        </section>

        <aside className="border-t border-white/10 p-5 lg:border-l lg:border-t-0">
          <p className="mb-4 text-[10px] uppercase tracking-[0.45em] text-white/25">
            Session Metadata
          </p>

          <div className="border border-white/10 bg-white/[0.03] p-5">
            <DetailRow
              label="Player"
              value={session.player || "Unassigned"}
            />
            <DetailRow
              label="Session"
              value={new Date(session.createdAt).toLocaleDateString()}
            />
            <DetailRow
              label="Environment"
              value={capitalize(session.environment || "practice")}
            />
            <DetailRow
              label="Mission"
              value={missionValue(session)}
            />
            <DetailRow
              label="Memory Count"
              value={formatMemoryCount(session.memoryCount)}
            />
            <DetailRow
              label="Duration"
              value={formatDuration(duration)}
            />
            <DetailRow
              label="Replay Status"
              value="Replay Linked"
            />
            <DetailRow
              label="Motion"
              value={`${Math.round(liveMetrics.motionAmount * 100)}%`}
            />
            <DetailRow
              label="Camera"
              value={`${Math.round(liveMetrics.cameraMovement * 100)}%`}
            />
            <DetailRow
              label="Brightness"
              value={`${Math.round(liveMetrics.averageBrightness * 100)}%`}
            />
            <DetailRow
              label="Audio"
              value={
                audioReady
                  ? `${Math.round(liveMetrics.audioEnergy * 100)}%`
                  : channelValue(audioStatus)
              }
            />
          </div>

          <div className="mt-5 border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-[0.45em] text-white/25">
              Player Context
            </p>
            <h3 className="mt-4 text-2xl font-black leading-tight text-white">
              {session.memoryCount && session.memoryCount > 1
                ? "Previous session located."
                : session.context || "Replay added to archive."}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              {contextPanelLine}
            </p>
          </div>
        </aside>
      </div>

      <footer className="sticky bottom-0 border-t border-white/10 bg-black/85 px-5 py-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-3">
          <p className="text-[10px] uppercase tracking-[0.45em] text-white/30">
            Session Continuity
          </p>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="h-2 overflow-hidden bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-lime-300 via-cyan-300 to-white transition-all duration-300"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="mt-3 flex justify-between font-mono text-xs text-white/40">
          <span>{formatClock(currentTime)}</span>
          <span>{formatClock(duration)}</span>
        </div>
      </footer>
    </div>
  )
}
