"use client"

import {
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { ControlBar } from "@/components/axis/ControlBar"
import { ControlPad } from "@/components/axis/ControlPad"
import { StateBar } from "@/components/axis/StateBar"
import {
  suggestAssistedEvents,
  type AssistedEventSuggestion,
} from "@/lib/automation/assistedSuggestions"
import { buildMemories, buildMoments } from "@/lib/engine/memory"
import { deriveAxisState } from "@/lib/engine/state"
import { calculateSystemPlusMinus } from "@/lib/engine/systemPlusMinus"
import {
  createRun,
  createRunId,
  elapsedRunMs,
  formatRunTime,
  type Run,
  type RunInterpretation,
  type RunMedia,
  type RunStoryBlock,
} from "@/lib/run/runState"
import {
  readStoredRun,
  writeStoredRun,
} from "@/lib/run/runStore"
import { removeScoreEvent, scoreFor } from "@/lib/run/score"
import {
  isNegativeSignal,
  isPositiveSignal,
  polarityForResult,
  signalEventLabel,
  type SignalStat,
  type SignalResult,
  type SignalSide,
} from "@/lib/run/signals"
import { createClient } from "@/lib/supabase/client"
import {
  parseUploadResponseText,
  type AxisUploadResponse,
} from "@/lib/uploadResponse"

type AxisMode = "tap" | "track" | "archive"
type UploadSource = "camera" | "upload"

type TrackMoment = {
  id: string
  label: "HOT" | "COLD" | "SPURT" | "SWING" | string
  name: string
  summary: string
  start: number
  end: number
  signalIds: string[]
}

type TrackIntelligence = {
  moments: TrackMoment[]
  source: "local" | "openai"
}

type ClientUploadInfo = {
  traceId: string
  uploadFile: File | Blob
  uploadName: string
  uploadType: string
  isMobile: boolean
  isIOS: boolean
  isSafari: boolean
  userAgent: string
  viewport: string
}

function safeParseUploadResponse(text: string) {
  try {
    return parseUploadResponseText(text)
  } catch {
    return {
      ok: false,
      error: "Upload response unreadable",
    } satisfies AxisUploadResponse
  }
}

function uploadStatus(data: AxisUploadResponse) {
  if (data.ok || data.recovery || data.stored) return "Attached."
  if (data.error) return "Local."

  return "Local."
}

function safeStorageName(name: string) {
  const cleanName = name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60)
  const extension = name.includes(".")
    ? name.split(".").pop()?.toLowerCase() || "mov"
    : "mov"

  return `${Date.now()}_${cleanName || "axis_memory"}.${extension}`
}

function mobileUploadInfo(file: File): ClientUploadInfo {
  const userAgent =
    typeof navigator !== "undefined" ? navigator.userAgent || "" : ""
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent)
  const isMobile =
    isIOS ||
    /Android|Mobi|Mobile/i.test(userAgent) ||
    (typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches)
  const inferredType =
    file.type ||
    (file.name.toLowerCase().endsWith(".mov")
      ? "video/quicktime"
      : file.name.toLowerCase().endsWith(".m4v")
        ? "video/x-m4v"
        : "video/mp4")
  const uploadName = file.name || `axis-memory-${Date.now()}.mov`
  let uploadFile: File | Blob = file

  try {
    uploadFile =
      typeof File !== "undefined"
        ? new File([file], uploadName, {
            type: inferredType,
            lastModified: file.lastModified || Date.now(),
          })
        : new Blob([file], {
            type: inferredType,
          })
  } catch {
    uploadFile = new Blob([file], {
      type: inferredType,
    })
  }

  return {
    traceId: createRunId(),
    uploadFile,
    uploadName,
    uploadType: inferredType,
    isMobile,
    isIOS,
    isSafari,
    userAgent,
    viewport:
      typeof window !== "undefined"
        ? `${window.innerWidth}x${window.innerHeight}`
        : "unknown",
  }
}

function readVideoMetadata(url: string) {
  return new Promise<{ duration: number; url: string }>((resolve) => {
    if (typeof document === "undefined") {
      resolve({
        duration: 0,
        url,
      })
      return
    }

    const video = document.createElement("video")

    video.preload = "metadata"
    video.onloadedmetadata = () => {
      resolve({
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        url,
      })
    }
    video.onerror = () => {
      resolve({
        duration: 0,
        url,
      })
    }
    video.src = url
  })
}

async function completeUpload({
  traceId,
  filePath,
  fileName,
  contentType,
  sizeBytes,
  durationSeconds,
  source,
  client,
}: {
  traceId: string
  filePath: string
  fileName: string
  contentType: string
  sizeBytes: number
  durationSeconds: number
  source: UploadSource
  client: Record<string, unknown>
}) {
  const response = await fetch("/api/upload/complete", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      traceId,
      filePath,
      fileName,
      contentType,
      sizeBytes,
      durationSeconds,
      source,
      environment: "tap",
      mission: "Strongest signal memory",
      player: "Run",
      client,
    }),
  })
  const text = await response.text()
  const result = safeParseUploadResponse(text)

  if (!response.ok && !result.ok) {
    throw new Error(result.detail || result.error || `Complete ${response.status}`)
  }

  return result
}

function compactTime(value: number) {
  const totalSeconds = Math.max(0, Math.round(value / 1000))

  return `${totalSeconds}s`
}

function localTrackIntelligence(run: Run): TrackIntelligence {
  const moments = run.moments.slice(0, 4).map((moment) => {
    const signals = run.signals.filter(
      (signal) => signal.time >= moment.start && signal.time <= moment.end
    )
    const positive = signals.filter((signal) => isPositiveSignal(signal.result)).length
    const negative = signals.filter((signal) => isNegativeSignal(signal.result)).length
    const label =
      positive >= 3 && positive >= negative
        ? "SPURT"
        : negative >= 3
          ? "COLD"
          : signals.some(
                (signal, index) => index > 0 && signal.side !== signals[index - 1].side
              )
            ? "SWING"
            : "HOT"

    return {
      id: moment.id,
      label,
      name:
        label === "SPURT"
          ? "Spurt"
          : label === "COLD"
            ? "Cold Stretch"
            : label === "SWING"
              ? "Momentum Swing"
              : "Hot Window",
      summary: `${signals.length} signals / ${compactTime(moment.end - moment.start)}`,
      start: moment.start,
      end: moment.end,
      signalIds: signals.map((signal) => signal.id),
    }
  })

  return {
    moments,
    source: "local",
  }
}

function trackPayload(run: Run, playbackId?: string) {
  const score = scoreFor(run)

  return {
    type: "track",
    run: {
      id: run.id,
      home: run.home,
      away: run.away,
      startedAt: run.startedAt,
      playbackId: playbackId || null,
      score,
      scoreEvents: run.scoreEvents,
    },
    signals: run.signals.map((signal, index) => {
      const previous = run.signals[index - 1]

      return {
        id: signal.id,
        side: signal.side,
        result: signal.result,
        polarity: signal.polarity,
        stat: signal.stat,
        playerId: signal.playerId,
        time: signal.time,
        order: index + 1,
        interval: previous ? signal.time - previous.time : 0,
      }
    }),
    moments: run.moments.map((moment) => ({
      id: moment.id,
      label: moment.label,
      start: moment.start,
      end: moment.end,
      time: moment.time,
    })),
  }
}

function activeMedia({
  file,
  url,
  metadata,
  source,
}: {
  file: File
  url: string
  metadata: { duration: number }
  source: UploadSource
}): RunMedia {
  return {
    id: createRunId(),
    name: file.name || "Active footage",
    url,
    durationSeconds: metadata.duration,
    contentType: file.type || "video/mp4",
    source,
    attachedAt: Date.now(),
  }
}

function storySticker(label: string) {
  if (label === "SPURT") return "SPURT"
  if (label === "COLD") return "FLOW BROKE"
  if (label === "SWING") return "CONTROL SHIFT"
  if (label === "HOT") return "HOT"
  if (label === "BREAK") return "THINGS GOT MESSY"

  return "RESPONSE"
}

function trackInterpretations(
  moments: TrackMoment[],
  source: TrackIntelligence["source"]
): RunInterpretation[] {
  const generatedAt = Date.now()

  return moments.map((moment) => ({
    id: moment.id,
    label: moment.label,
    name: moment.name,
    summary: moment.summary,
    start: moment.start,
    end: moment.end,
    signalIds: moment.signalIds,
    source,
    generatedAt,
  }))
}

export default function UploadMemoryConsole({
  initialMode = "tap",
}: {
  initialMode?: AxisMode
}) {
  const recordInputRef = useRef<HTMLInputElement | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const liveVideoRef = useRef<HTMLVideoElement | null>(null)
  const liveStreamRef = useRef<MediaStream | null>(null)
  const localVideoUrlsRef = useRef<Set<string>>(new Set())
  const [run, setRun] = useState<Run>(() => createRun())
  const [now, setNow] = useState(() => Date.now())
  const [status, setStatus] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [isSavingMoment, setIsSavingMoment] = useState(false)
  const [isLiveReady, setIsLiveReady] = useState(false)
  const [savedMediaId, setSavedMediaId] = useState<string | null>(null)
  const [playbackId, setPlaybackId] = useState<string | undefined>()
  const [hasLoadedStoredRun, setHasLoadedStoredRun] = useState(false)
  const [openAiTrack, setOpenAiTrack] = useState<TrackIntelligence | null>(null)
  const isRunning = !run.pausedAt
  const signalSignature = useMemo(
    () => run.signals.map((signal) => signal.id).join("|"),
    [run.signals]
  )
  const trackRun = useMemo(
    () => ({
      id: run.id,
      home: run.home,
      away: run.away,
      startedAt: run.startedAt,
      pausedAt: run.pausedAt,
      pausedMs: run.pausedMs,
      signals: run.signals,
      scoreEvents: run.scoreEvents,
      players: run.players,
      moments: run.moments,
      memories: run.memories,
      media: run.media,
      storyBlocks: run.storyBlocks,
      openAiInterpretations: [],
    }),
    [
      run.away,
      run.home,
      run.id,
      run.media,
      run.memories,
      run.moments,
      run.pausedAt,
      run.pausedMs,
      run.players,
      run.scoreEvents,
      run.signals,
      run.storyBlocks,
      run.startedAt,
    ]
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    const interval = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const timeout = window.setTimeout(() => {
      const stored = readStoredRun()

      if (stored) {
        setRun(stored)
        if (stored.media?.url) setPlaybackId(stored.media.url)
      }
      setHasLoadedStoredRun(true)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (!hasLoadedStoredRun) return

    writeStoredRun(run)
  }, [hasLoadedStoredRun, run])

  useEffect(
    () => () => {
      if (typeof URL !== "undefined") {
        for (const url of localVideoUrlsRef.current) URL.revokeObjectURL(url)
      }
      liveStreamRef.current?.getTracks().forEach((track) => track.stop())
    },
    []
  )

  useEffect(() => {
    if (typeof navigator === "undefined") return
    if (!navigator.mediaDevices?.getUserMedia) return
    if (liveStreamRef.current) return

    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: {
          facingMode: {
            ideal: "environment",
          },
          width: {
            ideal: 1280,
          },
          height: {
            ideal: 720,
          },
        },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        liveStreamRef.current = stream

        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream
          liveVideoRef.current.muted = true
          void liveVideoRef.current.play().catch(() => {})
        }

        setIsLiveReady(true)
      })
      .catch(() => {
        setIsLiveReady(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const elapsedMs = elapsedRunMs(run, now)
  const elapsed = formatRunTime(elapsedMs)
  const axisState = useMemo(() => deriveAxisState(run, elapsedMs), [run, elapsedMs])
  const systemValue = useMemo(() => calculateSystemPlusMinus(run), [run])
  const scoreboard = useMemo(() => scoreFor(run), [run])
  const localTrack = useMemo(() => localTrackIntelligence(run), [run])
  const visibleTrack = openAiTrack || localTrack
  const storyBlocks = run.storyBlocks ?? []
  const assistedSuggestions = useMemo(
    () => suggestAssistedEvents(run, now),
    [run, now]
  )

  useEffect(() => {
    if (trackRun.signals.length < 3) return
    if (typeof window === "undefined") return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      fetch("/api/infer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(trackPayload(trackRun, playbackId)),
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data?.track?.moments || !Array.isArray(data.track.moments)) return
          const source = data.track.source === "openai" ? "openai" : "local"
          const moments = data.track.moments.slice(0, 4)

          setOpenAiTrack({
            moments,
            source,
          })
          setRun((current) => ({
            ...current,
            openAiInterpretations: trackInterpretations(moments, source),
          }))
        })
        .catch(() => {
          setOpenAiTrack(null)
        })
    }, 900)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [playbackId, signalSignature, trackRun])

  function updateRun(next: Run) {
    setRun({
      ...next,
      moments: buildMoments(next.signals),
      memories: buildMemories(
        {
          ...next,
          moments: buildMoments(next.signals),
        },
        playbackId
      ),
    })
  }

  function tapSignal(
    side: SignalSide,
    result: SignalResult,
    detail: { stat: SignalStat; playerId?: string }
  ) {
    if (run.pausedAt) resumeClock()

    const signal = {
      id: createRunId(),
      side,
      result,
      polarity: polarityForResult(result),
      stat: detail.stat,
      playerId: detail.playerId,
      time: elapsedMs,
    }
    const scoreEvent =
      detail.stat === "PTS"
        ? {
            id: createRunId(),
            signalId: signal.id,
            team: side,
            points: 1,
            timestamp: elapsedMs,
          }
        : null

    updateRun({
      ...run,
      signals: [...run.signals, signal],
      scoreEvents: scoreEvent
        ? [...(run.scoreEvents ?? []), scoreEvent]
        : run.scoreEvents,
    })
    setOpenAiTrack(null)
    setStatus("")
  }

  function undoSignal() {
    const latest = run.signals[run.signals.length - 1]

    updateRun({
      ...run,
      signals: run.signals.slice(0, -1),
      scoreEvents: latest
        ? removeScoreEvent(run.scoreEvents, latest.id)
        : run.scoreEvents,
    })
    setOpenAiTrack(null)
    setStatus("")
  }

  function pauseClock() {
    setRun((current) =>
      current.pausedAt
        ? current
        : {
            ...current,
            pausedAt: Date.now(),
          }
    )
    setStatus("")
  }

  function resumeClock() {
    setRun((current) => {
      if (!current.pausedAt) return current

      return {
        ...current,
        pausedMs: (current.pausedMs ?? 0) + Date.now() - current.pausedAt,
        pausedAt: undefined,
      }
    })
    setStatus("")
  }

  function resetClock() {
    setRun((current) => ({
      ...createRun(),
      home: current.home,
      away: current.away,
    }))
    setOpenAiTrack(null)
    setStatus("")
  }

  function addScore(side: SignalSide, points: number) {
    setRun((current) => ({
      ...current,
      scoreEvents: [
        ...(current.scoreEvents ?? []),
        {
          id: createRunId(),
          team: side,
          points,
          timestamp: elapsedRunMs(current),
        },
      ],
    }))
    setStatus("")
  }

  function addPlayer(
    side: SignalSide,
    player: {
      number: string
      name?: string
    }
  ) {
    const nextPlayer = {
      id: createRunId(),
      team: side,
      number: player.number.trim().slice(0, 4),
      name: player.name?.trim().slice(0, 24) || undefined,
    }

    setRun((current) => ({
      ...current,
      players: [...current.players, nextPlayer],
    }))

    return nextPlayer
  }

  function createStoryBlock(media: RunMedia, current: Run): RunStoryBlock {
    const currentElapsed = elapsedRunMs(current)
    const nearbySignals = current.signals.filter(
      (signal) => Math.abs(signal.time - currentElapsed) <= 18_000
    )
    const label = calculateSystemPlusMinus(current).label
    const score = scoreFor(current)
    const audioIntensity = current.audioContext
      ? Math.max(0, Math.min(1, current.audioContext.escalation + current.audioContext.pacing * 0.08))
      : 0

    return {
      id: createRunId(),
      media,
      start: Math.max(0, currentElapsed - 4000),
      end: currentElapsed + Math.max(2000, media.durationSeconds * 1000),
      capturedAt: Date.now(),
      score,
      continuityLabel: label,
      sticker: storySticker(label),
      signalIds: nearbySignals.map((signal) => signal.id),
      audioIntensity,
      buffer: {
        preRollSeconds: 4,
        tailSeconds: 2,
      },
    }
  }

  function attachStoryMedia(media: RunMedia) {
    setSavedMediaId(media.id)

    if (typeof window !== "undefined") {
      window.setTimeout(() => setSavedMediaId(null), 1800)
    }

    setRun((current) => {
      const storyBlock = createStoryBlock(media, current)

      return {
        ...current,
        media,
        storyBlocks: [...(current.storyBlocks ?? []), storyBlock].slice(-24),
      }
    })
  }

  async function chooseFile(file: File | undefined, source: UploadSource) {
    if (!file || isUploading) return

    setIsUploading(true)
    setStatus("Memory attaching.")
    const uploadInfo = mobileUploadInfo(file)

    try {
      if (typeof URL === "undefined") {
        setStatus("Memory unavailable.")
        return
      }

      const localUrl = URL.createObjectURL(file)
      localVideoUrlsRef.current.add(localUrl)
      const metadata = await readVideoMetadata(localUrl)
      attachStoryMedia(
        activeMedia({
          file,
          url: localUrl,
          metadata,
          source,
        })
      )
      setPlaybackId(localUrl)
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setStatus("Memory local.")
        return
      }

      const filePath = `${user.id}/${safeStorageName(uploadInfo.uploadName)}`
      const uploaded = await supabase.storage
        .from("axis-replays")
        .upload(filePath, uploadInfo.uploadFile, {
          contentType: uploadInfo.uploadType,
          upsert: false,
        })

      if (uploaded.error) throw uploaded.error

      const signed = await supabase.storage
        .from("axis-replays")
        .createSignedUrl(filePath, 60 * 60 * 24 * 7)

      if (!signed.error && signed.data?.signedUrl) {
        setPlaybackId(signed.data.signedUrl)
        attachStoryMedia(
          activeMedia({
            file,
            url: signed.data.signedUrl,
            metadata,
            source,
          })
        )
      }

      const result = await completeUpload({
        traceId: uploadInfo.traceId,
        filePath,
        fileName: uploadInfo.uploadName,
        contentType: uploadInfo.uploadType,
        sizeBytes: file.size,
        durationSeconds: metadata.duration,
        source,
        client: {
          runId: run.id,
          signalCount: run.signals.length,
          clientTraceId: uploadInfo.traceId,
          clientName: file.name || uploadInfo.uploadName,
          clientType: file.type || uploadInfo.uploadType,
          clientSize: file.size,
          clientUserAgent: uploadInfo.userAgent,
          clientIsMobile: uploadInfo.isMobile,
          clientIsIOS: uploadInfo.isIOS,
          clientIsSafari: uploadInfo.isSafari,
          clientViewport: uploadInfo.viewport,
        },
      })

      setStatus(uploadStatus(result))
      if (result.videoUrl) {
        setPlaybackId(result.videoUrl)
        attachStoryMedia(
          activeMedia({
            file,
            url: result.videoUrl,
            metadata,
            source,
          })
        )
      }
    } catch {
      setStatus("Memory local.")
    } finally {
      setIsUploading(false)
      if (recordInputRef.current) recordInputRef.current.value = ""
      if (uploadInputRef.current) uploadInputRef.current.value = ""
    }
  }

  async function saveLiveMoment() {
    if (isSavingMoment) return

    const stream = liveStreamRef.current

    if (
      typeof window === "undefined" ||
      !stream ||
      typeof MediaRecorder === "undefined"
    ) {
      recordInputRef.current?.click()
      return
    }

    setIsSavingMoment(true)
    setStatus("Saved.")

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm",
      })
      const chunks: BlobPart[] = []
      const blob = await new Promise<Blob>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop()
        }, 2400)

        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data)
        }
        recorder.onerror = () => {
          window.clearTimeout(timeout)
          reject(new Error("Moment unavailable"))
        }
        recorder.onstop = () => {
          window.clearTimeout(timeout)
          resolve(
            new Blob(chunks, {
              type: recorder.mimeType || "video/webm",
            })
          )
        }
        recorder.start()
      })

      if (!blob.size) {
        recordInputRef.current?.click()
        return
      }

      const file =
        typeof File !== "undefined"
          ? new File([blob], `axis-moment-${Date.now()}.webm`, {
              type: blob.type || "video/webm",
              lastModified: Date.now(),
            })
          : undefined

      if (!file) {
        recordInputRef.current?.click()
        return
      }

      await chooseFile(file, "camera")
      setStatus("Saved.")
    } catch {
      recordInputRef.current?.click()
    } finally {
      window.setTimeout(() => {
        setIsSavingMoment(false)
        setStatus("")
      }, 1100)
    }
  }

  return (
    <main
      data-axis-mode={initialMode}
      className="axis-shell min-h-screen px-4 pb-28 pt-5 text-zinc-100 sm:px-6"
    >
      <div className="mx-auto grid max-w-4xl gap-5">
        <StoryMemoryCapture
          run={run}
          elapsed={elapsed}
          isRunning={isRunning}
          homeScore={scoreboard.home}
          awayScore={scoreboard.away}
          blocks={storyBlocks}
          liveVideoRef={liveVideoRef}
          isLiveReady={isLiveReady}
          isUploading={isUploading}
          isSavingMoment={isSavingMoment}
          savedMediaId={savedMediaId}
          flowLabel={systemValue.label}
          onCamera={() => recordInputRef.current?.click()}
          onUpload={() => uploadInputRef.current?.click()}
          onSaveMoment={() => void saveLiveMoment()}
          onScore={addScore}
          onPause={pauseClock}
          onResume={resumeClock}
          onReset={resetClock}
        >
          <ControlPad
            home={run.home}
            away={run.away}
            players={run.players}
            onSignal={tapSignal}
            onAddPlayer={addPlayer}
            onUndo={undoSignal}
          />
          <AssistedSuggestionStrip
            run={run}
            suggestions={assistedSuggestions}
            onConfirm={(suggestion) => {
              tapSignal(suggestion.side, suggestion.result, {
                stat: suggestion.stat,
              })
              setStatus("Suggested event confirmed.")
            }}
          />
          <ReplayMemoryRail run={run} track={visibleTrack} storyBlocks={storyBlocks} />
          <StateBar state={axisState} status={status} />
        </StoryMemoryCapture>
      </div>

      <input
        ref={recordInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void chooseFile(event.target.files?.[0], "camera")}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,video/*,.mov,.mp4,.m4v"
        className="hidden"
        onChange={(event) => void chooseFile(event.target.files?.[0], "upload")}
      />

      <ControlBar />
    </main>
  )
}

function StoryMemoryCapture({
  run,
  elapsed,
  isRunning,
  homeScore,
  awayScore,
  blocks,
  liveVideoRef,
  isLiveReady,
  isUploading,
  isSavingMoment,
  savedMediaId,
  flowLabel,
  onCamera,
  onUpload,
  onSaveMoment,
  onScore,
  onPause,
  onResume,
  onReset,
  children,
}: {
  run: Run
  elapsed: string
  isRunning: boolean
  homeScore: number
  awayScore: number
  blocks: RunStoryBlock[]
  liveVideoRef: RefObject<HTMLVideoElement | null>
  isLiveReady: boolean
  isUploading: boolean
  isSavingMoment: boolean
  savedMediaId: string | null
  flowLabel: string
  onCamera: () => void
  onUpload: () => void
  onSaveMoment: () => void
  onScore: (side: SignalSide, points: number) => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
  children: ReactNode
}) {
  const latest = blocks[blocks.length - 1]
  const liveState = isLiveReady ? "LIVE" : "CAMERA"
  const captureState = isSavingMoment
    ? "SAVING"
    : isUploading
      ? "ATTACHING"
      : isRunning
        ? "RUNNING"
        : "PAUSED"

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-zinc-900 bg-black shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
      <div className="relative min-h-[calc(100svh-6.5rem)] bg-black sm:min-h-[44rem]">
        <video
          ref={liveVideoRef}
          className={`absolute inset-0 h-full w-full object-cover transition duration-700 ${
            isLiveReady ? "opacity-85" : "opacity-0"
          }`}
          muted
          playsInline
          autoPlay
        />
        {!isLiveReady && latest ? (
          latest.media.contentType.startsWith("video/") ? (
            <video
              src={latest.media.url}
              className="absolute inset-0 h-full w-full object-cover opacity-78"
              muted
              playsInline
              loop
              autoPlay
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-cover bg-center opacity-82"
              style={{
                backgroundImage: `url(${latest.media.url})`,
              }}
            />
          )
        ) : null}
        {!isLiveReady && !latest ? (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(244,244,245,0.1),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.16),rgba(0,0,0,0.92))]" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/12 to-black/35" />

        <div className="absolute left-3 right-3 top-3 z-20 rounded-[1.25rem] border border-white/10 bg-black/42 px-3 py-2 backdrop-blur-md sm:left-4 sm:right-4 sm:top-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-left text-[10px] font-black uppercase tracking-[0.18em] text-orange-100/75">
                {run.home}
              </p>
              <button
                type="button"
                onClick={() => onScore("home", 1)}
                className="mt-1 rounded-full border border-orange-300/20 bg-orange-300/10 px-2.5 py-1 font-mono text-[10px] font-black text-orange-100 transition active:scale-[0.97]"
                aria-label={`${run.home} plus one`}
              >
                +1
              </button>
            </div>
            <div className="grid justify-items-center gap-1">
              <p className="font-mono text-2xl font-black leading-none text-zinc-100">
                <span className="text-orange-200">{homeScore}</span>
                <span className="px-1 text-zinc-600">-</span>
                <span className="text-sky-200">{awayScore}</span>
              </p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-[10px] font-black text-emerald-300">
                  {elapsed}
                </p>
                <span className="h-1 w-1 rounded-full bg-zinc-700" />
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  {captureState}
                </p>
              </div>
            </div>
            <div className="grid min-w-0 justify-items-end">
              <p className="truncate text-right text-[10px] font-black uppercase tracking-[0.18em] text-sky-100/75">
                {run.away}
              </p>
              <button
                type="button"
                onClick={() => onScore("away", 1)}
                className="mt-1 rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 font-mono text-[10px] font-black text-sky-100 transition active:scale-[0.97]"
                aria-label={`${run.away} plus one`}
              >
                +1
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isLiveReady
                    ? "bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.75)]"
                    : "bg-zinc-600"
                }`}
              />
              <span className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">
                {liveState}
              </span>
              <span className="truncate rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-300">
                {flowLabel || latest?.sticker || "SETTLED"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={isRunning ? onPause : onResume}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400 transition active:scale-[0.97] hover:text-zinc-100"
              >
                {isRunning ? "Pause" : "Start"}
              </button>
              <button
                type="button"
                onClick={onReset}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500 transition active:scale-[0.97] hover:text-zinc-100"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onScore("home", 1)}
          className="absolute bottom-40 left-0 top-32 z-10 w-10 rounded-r-full border-y border-r border-orange-300/10 bg-orange-300/[0.03] text-[9px] font-black uppercase tracking-[0.16em] text-orange-100/35 backdrop-blur-sm transition hover:bg-orange-300/10 hover:text-orange-100/80 active:bg-orange-300/15 sm:w-14"
          aria-label={`${run.home} edge score`}
        >
          +1
        </button>
        <button
          type="button"
          onClick={() => onScore("away", 1)}
          className="absolute bottom-40 right-0 top-32 z-10 w-10 rounded-l-full border-y border-l border-sky-300/10 bg-sky-300/[0.03] text-[9px] font-black uppercase tracking-[0.16em] text-sky-100/35 backdrop-blur-sm transition hover:bg-sky-300/10 hover:text-sky-100/80 active:bg-sky-300/15 sm:w-14"
          aria-label={`${run.away} edge score`}
        >
          +1
        </button>

        {latest ? (
          <div
            className={`absolute bottom-[20rem] left-4 z-20 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] backdrop-blur transition duration-500 ${
              savedMediaId === latest.media.id
                ? "border-emerald-300/40 bg-emerald-950/50 text-emerald-100 shadow-[0_0_30px_rgba(110,231,183,0.28)]"
                : "border-white/12 bg-black/45 text-zinc-200"
            }`}
          >
            {latest.sticker}
          </div>
        ) : null}

        <div className="absolute inset-x-3 bottom-4 z-20 grid gap-3 sm:inset-x-4">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-4xl font-black uppercase leading-none tracking-[-0.06em] text-zinc-100 sm:text-5xl">
                {isLiveReady ? "Watch." : "Open camera."}
              </p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Catch moments.
              </p>
            </div>
            <div className="grid shrink-0 justify-items-end gap-2">
              <button
                type="button"
                onClick={onSaveMoment}
                className="rounded-full border border-white/15 bg-zinc-100 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black shadow-[0_18px_50px_rgba(0,0,0,0.36)] transition active:scale-[0.98]"
              >
                {isSavingMoment ? "Saved" : "Save Moment"}
              </button>
              <div className="flex gap-2">
                <StoryButton label={isUploading ? "..." : "Camera"} onClick={onCamera} />
                <StoryButton label="Add" onClick={onUpload} />
              </div>
            </div>
          </div>
          <div className="grid gap-2 rounded-[1.5rem] border border-white/10 bg-black/46 p-2 shadow-[0_18px_70px_rgba(0,0,0,0.4)] backdrop-blur-md">
            {children}
          </div>
        </div>

        {blocks.length ? (
          <div className="absolute bottom-[18.5rem] right-4 z-20 flex max-w-[46%] gap-1.5 overflow-hidden">
            {blocks.slice(-4).map((block) => (
              <span
                key={`${block.id}-stack`}
                className={`h-12 w-8 shrink-0 overflow-hidden rounded-md border bg-zinc-950 transition duration-500 ${
                  savedMediaId === block.media.id
                    ? "scale-110 border-emerald-300/50 shadow-[0_0_28px_rgba(110,231,183,0.28)]"
                    : "border-white/10 shadow-[0_0_18px_rgba(0,0,0,0.35)]"
                }`}
                title={block.sticker}
              >
                {block.media.contentType.startsWith("video/") ? (
                  <video
                    src={block.media.url}
                    className="h-full w-full object-cover opacity-75"
                    muted
                    playsInline
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="block h-full w-full bg-cover bg-center opacity-75"
                    style={{
                      backgroundImage: `url(${block.media.url})`,
                    }}
                  />
                )}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function StoryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-zinc-700/70 bg-black/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200 backdrop-blur transition active:scale-[0.98] hover:border-zinc-300"
    >
      {label}
    </button>
  )
}

function AssistedSuggestionStrip({
  run,
  suggestions,
  onConfirm,
}: {
  run: Run
  suggestions: AssistedEventSuggestion[]
  onConfirm: (suggestion: AssistedEventSuggestion) => void
}) {
  if (!suggestions.length) return null

  return (
    <section className="axis-glass rounded-full px-3 py-2">
      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="shrink-0 rounded-full border border-zinc-800 bg-black px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">
          Assist
        </span>
        {suggestions.map((suggestion) => {
          const tone =
            suggestion.side === "home"
              ? suggestion.result === "plus"
                ? "border-orange-300/45 bg-orange-950/50 text-orange-100 shadow-[0_0_18px_rgba(251,146,60,0.12)]"
                : "border-orange-500/25 bg-black text-orange-300"
              : suggestion.result === "plus"
                ? "border-sky-300/45 bg-sky-950/50 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.12)]"
                : "border-sky-500/25 bg-black text-sky-300"
          const team = suggestion.side === "home" ? run.home : run.away

          return (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => onConfirm(suggestion)}
              className={`shrink-0 rounded-full border px-3 py-2 text-left transition active:scale-[0.98] hover:border-zinc-400 ${tone}`}
              title={`${team}: ${suggestion.reason}`}
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.16em]">
                {suggestion.label}
              </span>
              <span className="mt-0.5 block max-w-48 truncate text-[10px] font-bold text-zinc-500">
                {team} / {Math.round(suggestion.confidence * 100)}%
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ReplayMemoryRail({
  run,
  track,
  storyBlocks,
}: {
  run: Run
  track: TrackIntelligence
  storyBlocks: RunStoryBlock[]
}) {
  const signals = run.signals.slice(-18)
  const momentsBySignal = new Map<string, TrackMoment>()

  for (const moment of track.moments) {
    for (const signalId of moment.signalIds) momentsBySignal.set(signalId, moment)
  }

  return (
    <section className="axis-panel rounded-lg px-3 py-3">
      <div className="flex min-h-8 items-center gap-1.5 overflow-hidden rounded-full border border-zinc-900 bg-black px-2">
        {storyBlocks.slice(-4).map((block) => (
          <span
            key={`${block.id}-story-rail`}
            title={block.sticker}
            className="block h-5 w-8 shrink-0 rounded-full border border-zinc-500/60 bg-zinc-100/80 shadow-[0_0_18px_rgba(244,244,245,0.22)]"
          />
        ))}
        {signals.length ? (
          signals.map((signal) => {
            const moment = momentsBySignal.get(signal.id)
            const tone =
              signal.side === "home"
                ? isPositiveSignal(signal.result)
                  ? "bg-orange-300"
                  : "border border-orange-400/40 bg-orange-950"
                : isPositiveSignal(signal.result)
                  ? "bg-sky-300"
                  : "border border-sky-400/40 bg-sky-950"

            return (
              <span
                key={signal.id}
                title={moment?.name || signalEventLabel(signal)}
                className={`block rounded-full transition ${
                  moment ? "h-4 w-4 shadow-[0_0_16px_rgba(244,244,245,0.32)]" : "h-2.5 w-2.5"
                } ${tone}`}
              />
            )
          })
        ) : (
          <span className="h-1 w-full rounded-full bg-zinc-900" />
        )}
      </div>
    </section>
  )
}
