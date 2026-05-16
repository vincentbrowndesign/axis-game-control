"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useSessionStore } from "@/store/useSessionStore"
import { normalizeReplay } from "@/lib/normalizeReplay"
import { buildBaseline } from "@/lib/calibration/buildBaseline"
import type { CalibrationBaseline } from "@/lib/calibration/types"
import { MemoryCinemaLayer } from "@/components/MemoryCinemaLayer"
import { generateReplayMarkers } from "@/lib/replay/generateReplayMarkers"
import { getReplayReward } from "@/lib/replay/getReplayReward"
import {
  buildReplayReveals,
} from "@/lib/replay/revealEngine"
import { memoryCinemaState } from "@/lib/replay/memoryCinema"
import { getCalibrationMissions } from "@/lib/missions/getCalibrationMissions"
import { segmentCalibrationMemory } from "@/lib/segments/segmentCalibrationMemory"
import type { SegmentedMemory } from "@/lib/segments/types"
import { summarizePoseLandmarks } from "@/lib/vision/mediapipe/extractPoseLandmarks"
import { MediaPipePoseProvider } from "@/lib/vision/mediapipe/poseProvider"
import type {
  PoseFrame,
  PoseLandmarkRead,
} from "@/lib/vision/mediapipe/types"
import { getActiveTwin } from "@/lib/twin/getOrCreateTwin"
import { recordWarmupMemory } from "@/lib/twin/warmupChains"
import type {
  DigitalTwin,
  WarmupChainProgress,
} from "@/lib/twin/types"
import {
  getNextWarmupFromMission,
  getWarmupById,
} from "@/lib/world/getNextWarmup"
import { getPendingMemory } from "@/lib/video/recordingPersistence"
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

type LiveSignalLabel =
  | "SIGNAL RECORDED"
  | "ACTIVITY DETECTED"
  | "ACTIVITY WAITING"
  | "BRIGHTNESS SHIFT"
  | "AUDIO ENERGY"
  | "SIGNAL RETURNED"
  | "SIGNAL INITIALIZING"
  | "READ BUILDING"

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
const POSE_SAMPLE_INTERVAL_MS = 900
const REPLAY_FOCUS_REVEAL_MS = 1000
const REPLAY_STATE_REVEAL_MS = 2200
const REPLAY_NEXT_REVEAL_MS = 4200
const REPLAY_FORWARD_REVEAL_MS = 6200
const calibrationMissions = getCalibrationMissions()

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

function ReplayReward({
  nextAction,
}: {
  nextAction: string
}) {
  return (
    <section className="mt-6 text-center">
      <p className="text-[10px] uppercase tracking-[0.5em] text-white/25">
        Memory
      </p>
      <p className="mt-3 text-[clamp(1.6rem,5vw,3.2rem)] font-black uppercase leading-[0.95] tracking-[-0.04em] text-white">
        {nextAction}
      </p>
    </section>
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

function createPoseRead(status: PoseLandmarkRead["status"]): PoseLandmarkRead {
  return {
    status,
    provider: "mediapipePoseProvider",
    frameCount: 0,
    confidence: 0,
    persistence: 0,
    observations: [],
    summary:
      status === "unavailable"
        ? "Memory stored. Read still building."
        : "Landmark signal initializing.",
  }
}

function missionFromSession(session: ReplaySessionView) {
  return calibrationMissions.find((mission) =>
    session.mission?.includes(mission.title)
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
  const poseProviderRef = useRef<MediaPipePoseProvider | null>(null)
  const poseFramesRef = useRef<PoseFrame[]>([])
  const poseInitializingRef = useRef(false)
  const poseUnavailableRef = useRef(false)
  const lastPoseSampleRef = useRef(0)
  const recordedWarmupKeyRef = useRef<string | null>(null)
  const pendingObjectUrlRef = useRef<string | null>(null)
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
  const [replayOpenElapsed, setReplayOpenElapsed] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [replayStatus, setReplayStatus] = useState<
    "ready" | "recovering" | "recovered" | "failed"
  >("ready")
  const [, setLiveSignalEvents] = useState<
    LiveSignalEvent[]
  >([])
  const [, setLiveMetrics] = useState<FrameSignal>({
    motionAmount: 0,
    cameraMovement: 0,
    averageBrightness: 0,
    audioEnergy: 0,
  })
  const [, setAudioReady] = useState(false)
  const [, setSignalStatus] =
    useState<SignalReadiness>("initializing")
  const [, setMotionStatus] =
    useState<SignalChannelStatus>("waiting")
  const [, setCameraStatus] =
    useState<SignalChannelStatus>("waiting")
  const [, setAudioStatus] =
    useState<SignalChannelStatus>("waiting")
  const [, setBaseline] = useState<CalibrationBaseline | null>(null)
  const [segmentedMemory, setSegmentedMemory] =
    useState<SegmentedMemory | null>(null)
  const [, setPoseRead] = useState<PoseLandmarkRead | null>(null)
  const [, setMemoryOwner] =
    useState<DigitalTwin | null>(null)
  const [, setWarmupProgress] =
    useState<WarmupChainProgress | null>(null)

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

  const updatePoseRead = useCallback(
    (activeSession: ReplaySessionView | null) => {
      if (!activeSession) return

      try {
        setPoseRead(
          summarizePoseLandmarks({
            missionId: activeSession.mission || "None",
            frames: poseFramesRef.current,
          })
        )
      } catch (error) {
        console.warn("AXIS LANDMARK SUMMARY WAITING", error)
        setPoseRead(createPoseRead("unavailable"))
      }
    },
    []
  )

  const initializePoseProvider = useCallback(async () => {
    if (
      poseProviderRef.current ||
      poseInitializingRef.current ||
      poseUnavailableRef.current
    ) {
      return
    }

    poseInitializingRef.current = true
    setPoseRead(createPoseRead("initializing"))

    try {
      poseProviderRef.current = await MediaPipePoseProvider.create()
    } catch (error) {
      console.warn("AXIS LANDMARK SIGNAL UNAVAILABLE", error)
      poseUnavailableRef.current = true
      setPoseRead(createPoseRead("unavailable"))
    } finally {
      poseInitializingRef.current = false
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

  const updateWarmupProgress = useCallback(
    (activeSession: ReplaySessionView | null) => {
      if (!activeSession) return

      const owner = getActiveTwin(activeSession.player)
      const mission = missionFromSession(activeSession)

      setMemoryOwner(owner)

      if (!mission) {
        setWarmupProgress(null)
        return
      }

      const sessionId = activeSession.id || playbackId
      const recordKey = `${owner.id}:${mission.id}:${sessionId}`

      if (recordedWarmupKeyRef.current === recordKey) return

      recordedWarmupKeyRef.current = recordKey
      const progress = recordWarmupMemory({
        twinId: owner.id,
        twinName: owner.displayName,
        warmupId: mission.id,
        sessionId,
        unlockAfter: mission.unlockAfter,
      })

      setWarmupProgress(progress)
      setBaseline((currentBaseline) =>
        currentBaseline
          ? {
              ...currentBaseline,
              missionType: activeSession.mission,
              missionCompletionCount: progress.completedCount,
            }
          : currentBaseline
      )
    },
    [playbackId]
  )

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    return () => {
      poseProviderRef.current?.close()
      poseProviderRef.current = null
      if (pendingObjectUrlRef.current) {
        URL.revokeObjectURL(pendingObjectUrlRef.current)
        pendingObjectUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (isLoading || !session?.videoUrl) {
      return
    }

    let frameId = 0
    const startedAt = performance.now()

    function tick(now: number) {
      const elapsed = now - startedAt

      setReplayOpenElapsed(elapsed)

      if (elapsed < REPLAY_FORWARD_REVEAL_MS + 1200) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [isLoading, playbackId, session?.videoUrl])

  useEffect(() => {
    setPlaybackId(playbackId)
    signalAccumulatorRef.current = createSignalAccumulator(
      initialSession?.duration || 0
    )
    clearSignalTimeouts()
    previousFrameRef.current = null
    frameSamplingUnavailableRef.current = false
    poseFramesRef.current = []
    lastPoseSampleRef.current = 0
    poseUnavailableRef.current = false
    recordedWarmupKeyRef.current = null

    let cancelled = false

    queueMicrotask(() => {
      async function hydrateReplay() {
        const localSession = safeParseSession(
          localStorage.getItem(`axis-session-${playbackId}`)
        )
        const normalizedSession =
          normalizeSession(initialSession) ||
          normalizeSession(localSession)

        if (normalizedSession) {
          if (!cancelled) {
            setSession(normalizedSession)
            setExtractedSignals(initialSession?.signalRead || null)
            setIsLoading(false)
          }
          return
        }

        const pendingMemory = await getPendingMemory(playbackId)

        if (!pendingMemory) {
          if (!cancelled) {
            setSession(null)
            setExtractedSignals(null)
            setIsLoading(false)
          }
          return
        }

        if (pendingObjectUrlRef.current) {
          URL.revokeObjectURL(pendingObjectUrlRef.current)
        }

        const videoUrl = URL.createObjectURL(pendingMemory.blob)
        pendingObjectUrlRef.current = videoUrl
        const warmup = getWarmupById(pendingMemory.warmupId)
        const owner = getActiveTwin()
        const pendingSession = normalizeSession({
          id: pendingMemory.id,
          createdAt: pendingMemory.createdAt,
          source: "camera",
          videoUrl,
          title: "Memory",
          mission: warmup
            ? `WARMUP ${warmup.order
                .toString()
                .padStart(2, "0")} - ${warmup.title}`
            : "Open Session",
          player: owner.displayName,
          environment: warmup ? "mission" : "practice",
          duration: pendingMemory.duration,
          status: "MEMORY STORED",
          fileName: pendingMemory.filename,
          tags: [],
          memoryCount: 1,
          archiveStatus: "Active",
          context: "Memory stored. Replay ready.",
          ambientLine: "Memory carries forward.",
        })

        if (!cancelled) {
          setSession(pendingSession)
          setExtractedSignals(null)
          setReplayStatus("recovered")
          setIsLoading(false)
        }
      }

      setLiveSignalEvents([])
      signalReadyRef.current = false
      setSignalStatus("initializing")
      setMotionStatus("waiting")
      setCameraStatus("waiting")
      setAudioStatus("waiting")
      setAudioReady(false)
      setSegmentedMemory(null)
      setBaseline(null)
      setPoseRead(null)
      setWarmupProgress(null)
      void hydrateReplay()
    })

    return () => {
      cancelled = true
    }
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
        updateWarmupProgress(session)
        updateSegmentedMemory(session)
        void initializePoseProvider()
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
    initializePoseProvider,
    isLoading,
    session,
    updateSegmentedMemory,
    updateWarmupProgress,
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
              "READ BUILDING",
              "Memory stored. Read still building.",
              "zinc"
            )
          }
        } else if (!context && !frameSamplingUnavailableRef.current) {
          frameSamplingUnavailableRef.current = true
          setMotionStatus("unavailable")
          setCameraStatus("unavailable")
          markSignalUnavailableIfEmpty()
          emitSignal(
            "READ BUILDING",
            "Memory stored. Read still building.",
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

        const poseProvider = poseProviderRef.current

        if (
          poseProvider &&
          now - lastPoseSampleRef.current > POSE_SAMPLE_INTERVAL_MS
        ) {
          lastPoseSampleRef.current = now

          try {
            const poseFrame = poseProvider.detect(
              video,
              Math.round(video.currentTime * 1000)
            )

            if (poseFrame) {
              poseFramesRef.current = [
                ...poseFramesRef.current,
                poseFrame,
              ].slice(-90)
              updatePoseRead(sessionRef.current)
            }
          } catch (error) {
            console.warn("AXIS LANDMARK FRAME UNAVAILABLE", error)
            poseUnavailableRef.current = true
            setPoseRead(createPoseRead("unavailable"))
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
    updatePoseRead,
    updateSegmentedMemory,
  ])

  const duration = session?.duration || 0
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

  const displaySignals = extractedSignals || session.signalRead || null
  const replayMarkers = generateReplayMarkers({
    session,
    signals: displaySignals,
    segmentedMemory,
  })
  const replayReveals = buildReplayReveals({
    markers: replayMarkers,
    currentTime,
  })
  const cinemaState = memoryCinemaState(replayReveals)
  const replayReward = getReplayReward(replayReveals)
  const nextWarmup = getNextWarmupFromMission(session.mission)
  const showFocus = replayOpenElapsed >= REPLAY_FOCUS_REVEAL_MS
  const showState = replayOpenElapsed >= REPLAY_STATE_REVEAL_MS
  const showNext = replayOpenElapsed >= REPLAY_NEXT_REVEAL_MS
  const showForward = replayOpenElapsed >= REPLAY_FORWARD_REVEAL_MS
  const focusStart =
    replayReward.focus && duration > 0
      ? Math.max(
          0,
          Math.min(100, (replayReward.focus.startTime / duration) * 100)
        )
      : 0
  const focusWidth =
    replayReward.focus && duration > 0
      ? Math.max(
          4,
          Math.min(
            100 - focusStart,
            ((replayReward.focus.endTime -
              replayReward.focus.startTime) /
              duration) *
              100
          )
        )
      : 0

  return (
    <div
      className={`axis-atmosphere min-h-screen overflow-hidden bg-black text-white ${className}`}
    >
      <div className="px-5 py-8 lg:px-8 lg:py-10">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-between">
          <div
            className={`text-center transition-opacity duration-1000 ${
              showState ? "opacity-100" : "opacity-0"
            }`}
          >
            <p className="text-[10px] uppercase tracking-[0.55em] text-white/30">
              Returning
            </p>
            <p className="mt-4 text-[clamp(2rem,7vw,5.8rem)] font-black uppercase leading-[0.88] tracking-[-0.06em] text-white">
              {replayReward.found}
            </p>
          </div>

          <div className="relative my-8 overflow-hidden border border-white/10 bg-white/[0.03] shadow-[0_0_80px_rgba(255,255,255,0.04)]">
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

            {showFocus ? (
              <MemoryCinemaLayer
                reveals={replayReveals}
                state={cinemaState}
              />
            ) : null}

            <canvas
              ref={canvasRef}
              width={96}
              height={54}
              className="hidden"
            />

            <div className="pointer-events-none absolute inset-x-5 bottom-5 h-1 bg-white/15">
              <div
                className="absolute h-full bg-lime-300 shadow-[0_0_22px_rgba(190,242,100,0.55)] transition-all duration-500"
                style={{
                  left: `${focusStart}%`,
                  width: `${focusWidth}%`,
                  opacity: showFocus && replayReward.focus ? 1 : 0,
                }}
              />
            </div>
          </div>

          <div
            className={`transition-opacity duration-1000 ${
              showNext ? "opacity-100" : "opacity-0"
            }`}
          >
            <ReplayReward
              nextAction={replayReward.nextAction}
            />
          </div>

          <div
            className={`mt-8 flex justify-center transition-opacity duration-1000 ${
              showForward ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <Link
              href={nextWarmup ? `/?warmup=${nextWarmup.id}` : "/"}
              className="bg-white px-6 py-4 text-center text-xs font-black uppercase tracking-[0.24em] text-black transition hover:bg-lime-300"
            >
              Next Warmup
            </Link>
          </div>

        </section>
      </div>

    </div>
  )
}
