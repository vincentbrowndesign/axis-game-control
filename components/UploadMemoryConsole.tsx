"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ControlBar } from "@/components/axis/ControlBar"
import { ControlPad } from "@/components/axis/ControlPad"
import { RunHeader } from "@/components/axis/RunHeader"
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
  const localVideoUrlRef = useRef<string | null>(null)
  const [run, setRun] = useState<Run>(() => createRun())
  const [now, setNow] = useState(() => Date.now())
  const [status, setStatus] = useState("")
  const [isUploading, setIsUploading] = useState(false)
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
      if (localVideoUrlRef.current && typeof URL !== "undefined") {
        URL.revokeObjectURL(localVideoUrlRef.current)
      }
    },
    []
  )

  const elapsedMs = elapsedRunMs(run, now)
  const elapsed = formatRunTime(elapsedMs)
  const axisState = useMemo(() => deriveAxisState(run, elapsedMs), [run, elapsedMs])
  const systemValue = useMemo(() => calculateSystemPlusMinus(run), [run])
  const scoreboard = useMemo(() => scoreFor(run), [run])
  const localTrack = useMemo(() => localTrackIntelligence(run), [run])
  const visibleTrack = openAiTrack || localTrack
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

  function updateName(side: SignalSide, value: string) {
    setRun((current) => ({
      ...current,
      [side]: value || (side === "home" ? "Home" : "Away"),
    }))
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

  function attachMedia(media: RunMedia) {
    setRun((current) => ({
      ...current,
      media,
    }))
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

      if (localVideoUrlRef.current) URL.revokeObjectURL(localVideoUrlRef.current)

      const localUrl = URL.createObjectURL(file)
      localVideoUrlRef.current = localUrl
      const metadata = await readVideoMetadata(localUrl)
      attachMedia(
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
        attachMedia(
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
        attachMedia(
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

  return (
    <main
      data-axis-mode={initialMode}
      className="axis-shell min-h-screen px-4 pb-28 pt-5 text-zinc-100 sm:px-6"
    >
      <div className="mx-auto grid max-w-4xl gap-5">
        <RunHeader
          run={run}
          elapsed={elapsed}
          isRunning={isRunning}
          homeScore={scoreboard.home}
          awayScore={scoreboard.away}
          systemLabel={systemValue.label}
          systemValue={Math.round(systemValue.netValue)}
          onName={updateName}
          onScore={addScore}
          onPause={pauseClock}
          onResume={resumeClock}
          onReset={resetClock}
        />
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
        <ReplayMemoryRail run={run} track={visibleTrack} />
        <StateBar state={axisState} status={status} />
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

function ReplayMemoryRail({ run, track }: { run: Run; track: TrackIntelligence }) {
  const signals = run.signals.slice(-18)
  const momentsBySignal = new Map<string, TrackMoment>()

  for (const moment of track.moments) {
    for (const signalId of moment.signalIds) momentsBySignal.set(signalId, moment)
  }

  return (
    <section className="axis-panel rounded-lg px-3 py-3">
      <div className="flex min-h-8 items-center gap-1.5 overflow-hidden rounded-full border border-zinc-900 bg-black px-2">
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
