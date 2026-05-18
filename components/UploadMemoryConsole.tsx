"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ControlBar } from "@/components/axis/ControlBar"
import { ControlPad } from "@/components/axis/ControlPad"
import { RunHeader } from "@/components/axis/RunHeader"
import { StateBar } from "@/components/axis/StateBar"
import { inferTrack } from "@/lib/engine/inference"
import { buildMemories, buildMoments } from "@/lib/engine/memory"
import { deriveAxisState } from "@/lib/engine/state"
import {
  createRun,
  createRunId,
  elapsedRunMs,
  formatRunTime,
  type Run,
} from "@/lib/run/runState"
import {
  readStoredRun,
  storeRun,
  writeStoredRun,
} from "@/lib/run/runStore"
import type { SignalResult, SignalSide } from "@/lib/run/signals"
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

function artifactName(run: Run, extension: "png" | "pdf") {
  return `${run.home}-vs-${run.away}-axis-archive`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .concat(`.${extension}`)
}

function mediaName(run: Run, extension: string) {
  return `${run.home}-vs-${run.away}-axis-memory`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .concat(`.${extension}`)
}

function extensionForType(type: string, fallback: string) {
  if (type.includes("quicktime")) return "mov"
  if (type.includes("mp4")) return "mp4"
  if (type.includes("png")) return "png"
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg"

  return fallback
}

function createShareFile(blob: Blob, name: string, type: string) {
  if (typeof File === "undefined") return null

  try {
    return new File([blob], name, {
      type,
      lastModified: Date.now(),
    })
  } catch {
    return null
  }
}

function canNativeShareFile(file: File) {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  )
}

async function nativeShareFile(file: File, title: string, text: string) {
  if (!canNativeShareFile(file)) return false

  await navigator.share({
    files: [file],
    title,
    text,
  })

  return true
}

function waitForPaint() {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  })
}

async function fetchBlobWithTimeout(url: string, timeoutMs = 12_000) {
  const controller = new AbortController()
  const timeout =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : undefined

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(`Media fetch ${response.status}`)

    const blob = await response.blob()

    if (!blob.size) throw new Error("Empty media blob")

    return blob
  } finally {
    if (timeout) window.clearTimeout(timeout)
  }
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
    const makes = signals.filter((signal) => signal.result === "make").length
    const misses = signals.length - makes
    const label =
      makes >= 3 && makes >= misses
        ? "SPURT"
        : misses >= 3
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
  return {
    type: "track",
    run: {
      id: run.id,
      home: run.home,
      away: run.away,
      startedAt: run.startedAt,
      playbackId: playbackId || null,
    },
    signals: run.signals.map((signal, index) => {
      const previous = run.signals[index - 1]

      return {
        id: signal.id,
        side: signal.side,
        result: signal.result,
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

  useEffect(() => {
    if (typeof window === "undefined") return

    const interval = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const timeout = window.setTimeout(() => {
      const stored = readStoredRun()

      if (stored) setRun(stored)
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
  const track = useMemo(() => inferTrack(run), [run])
  const localTrack = useMemo(() => localTrackIntelligence(run), [run])
  const visibleTrack = openAiTrack || localTrack

  useEffect(() => {
    if (run.signals.length < 3) return
    if (typeof window === "undefined") return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      fetch("/api/infer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(trackPayload(run, playbackId)),
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data?.track?.moments || !Array.isArray(data.track.moments)) return

          setOpenAiTrack({
            moments: data.track.moments.slice(0, 4),
            source: data.track.source === "openai" ? "openai" : "local",
          })
        })
        .catch(() => {
          setOpenAiTrack(null)
        })
    }, 900)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [playbackId, run])

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

  function tapSignal(side: SignalSide, result: SignalResult) {
    if (run.pausedAt) resumeClock()

    const signal = {
      id: createRunId(),
      side,
      result,
      time: elapsedMs,
    }

    updateRun({
      ...run,
      signals: [...run.signals, signal],
    })
    setOpenAiTrack(null)
    setStatus("")
  }

  function undoSignal() {
    updateRun({
      ...run,
      signals: run.signals.slice(0, -1),
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

  function storeCurrentRun() {
    const next = {
      ...run,
      moments: buildMoments(run.signals),
      memories: buildMemories(
        {
          ...run,
          moments: buildMoments(run.signals),
        },
        playbackId
      ),
    }

    storeRun(next)
    setRun(next)
    setStatus("Run archived.")
  }

  function renderExportArtifact() {
    if (typeof document === "undefined") return null

    const artifact = document.createElement("div")
    artifact.style.position = "fixed"
    artifact.style.left = "-1200px"
    artifact.style.top = "0"
    artifact.style.width = "720px"
    artifact.style.background = "#050505"
    artifact.style.color = "#f4f4f5"
    artifact.style.padding = "32px"
    artifact.style.pointerEvents = "none"
    artifact.style.zIndex = "-1"
    artifact.innerHTML = `
      <div style="font-family: Arial, sans-serif;">
        <p style="margin:0;color:#6ee7b7;font-size:11px;font-weight:900;letter-spacing:0.28em;text-transform:uppercase;">Axis Archive</p>
        <h1 style="margin:28px 0 0;font-size:52px;line-height:0.9;font-weight:900;letter-spacing:-0.05em;">${escapeHtml(run.home)} / ${escapeHtml(run.away)}</h1>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:30px;padding:22px 0;border-top:1px solid #27272a;border-bottom:1px solid #27272a;">
          ${artifactNumberHtml("Signals", run.signals.length)}
          ${artifactNumberHtml("Moments", run.moments.length)}
          ${artifactNumberHtml("State", axisState.label)}
        </div>
        <div style="display:grid;gap:12px;margin-top:28px;font-size:28px;line-height:1;font-weight:900;letter-spacing:-0.04em;">
          <p style="margin:0;color:#fdba74;">${escapeHtml(track.control)}</p>
          <p style="margin:0;color:#7dd3fc;">${escapeHtml(track.momentum)}</p>
          <p style="margin:0;color:#f4f4f5;">${escapeHtml(track.pressure)}</p>
          <p style="margin:0;color:#6ee7b7;">${escapeHtml(track.strongestMoment)}</p>
        </div>
      </div>
    `
    document.body.appendChild(artifact)

    return artifact
  }

  async function generateArchiveImageBlob() {
    if (typeof document === "undefined") return null
    let artifact: HTMLDivElement | null = null

    try {
      artifact = renderExportArtifact()

      if (!artifact) return null

      await waitForPaint()
      const { toBlob } = await import("html-to-image")
      const blob = await toBlob(artifact, {
        cacheBust: true,
        pixelRatio: 1,
        backgroundColor: "#050505",
        canvasWidth: 720,
        canvasHeight: artifact.scrollHeight,
      })

      if (!blob?.size || !blob.type.startsWith("image/")) return null

      return blob
    } catch {
      return null
    } finally {
      artifact?.remove()
    }
  }

  async function shareArchiveImage() {
    storeCurrentRun()
    setStatus("Preparing share.")
    const blob = await generateArchiveImageBlob()

    if (!blob) {
      setStatus("Share unavailable.")
      return false
    }

    const file = createShareFile(blob, artifactName(run, "png"), "image/png")

    if (file) {
      try {
        const shared = await nativeShareFile(file, "Axis Memory", "Axis replay memory")

        if (shared) {
          setStatus("Shared.")
          return true
        }
      } catch {
        setStatus("Share canceled.")
        return false
      }
    }

    setStatus("Share unavailable.")

    return false
  }

  async function shareReplayVideo() {
    if (!playbackId) return false

    try {
      setStatus("Preparing share.")
      const blob = await fetchBlobWithTimeout(playbackId)
      const type = blob.type || "video/mp4"

      if (!blob.size || (!type.startsWith("video/") && !type.includes("octet-stream"))) {
        return false
      }

      const shareType = type.includes("octet-stream") ? "video/mp4" : type
      const extension = extensionForType(shareType, "mp4")
      const file = createShareFile(blob, mediaName(run, extension), shareType)

      if (file) {
        const shared = await nativeShareFile(file, "Axis Replay", "Axis replay memory")

        if (shared) {
          setStatus("Shared.")
          return true
        }
      }

      setStatus("Share unavailable.")

      return false
    } catch {
      return false
    }
  }

  async function shareBestMedia(preferVideo = false) {
    if (isUploading) return

    const videoShared = preferVideo ? await shareReplayVideo() : false

    if (videoShared) return

    await shareArchiveImage()
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
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setPlaybackId(localUrl)
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

      if (!signed.error && signed.data?.signedUrl) setPlaybackId(signed.data.signedUrl)

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
      if (result.videoUrl) setPlaybackId(result.videoUrl)
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
      className="min-h-screen bg-[#050505] px-4 pb-28 pt-5 text-zinc-100 sm:px-6"
    >
      <div className="mx-auto grid max-w-4xl gap-5">
        <RunHeader
          run={run}
          elapsed={elapsed}
          isRunning={isRunning}
          homeScore={axisState.home.makes}
          awayScore={axisState.away.makes}
          onName={updateName}
          onPause={pauseClock}
          onResume={resumeClock}
          onReset={resetClock}
        />
        <ControlPad home={run.home} away={run.away} onSignal={tapSignal} onUndo={undoSignal} />
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

      <ControlBar
        onCamera={() => recordInputRef.current?.click()}
        onUpload={() => uploadInputRef.current?.click()}
        onSave={() => void shareBestMedia(true)}
        onShare={() => void shareBestMedia(true)}
        disabled={isUploading}
      />
    </main>
  )
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function artifactNumberHtml(label: string, value: number | string) {
  return `
    <div>
      <p style="margin:0;color:#71717a;font-size:10px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;">${escapeHtml(label)}</p>
      <p style="margin:8px 0 0;color:#f4f4f5;font-family:monospace;font-size:38px;line-height:1;font-weight:900;">${escapeHtml(value)}</p>
    </div>
  `
}

function ReplayMemoryRail({ run, track }: { run: Run; track: TrackIntelligence }) {
  const signals = run.signals.slice(-18)
  const momentsBySignal = new Map<string, TrackMoment>()

  for (const moment of track.moments) {
    for (const signalId of moment.signalIds) momentsBySignal.set(signalId, moment)
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-3">
      <div className="flex min-h-8 items-center gap-1.5 overflow-hidden">
        {signals.length ? (
          signals.map((signal) => {
            const moment = momentsBySignal.get(signal.id)
            const tone =
              signal.side === "home"
                ? signal.result === "make"
                  ? "bg-orange-300"
                  : "border border-orange-400/40 bg-orange-950"
                : signal.result === "make"
                  ? "bg-sky-300"
                  : "border border-sky-400/40 bg-sky-950"

            return (
              <span
                key={signal.id}
                title={moment?.name || signal.result}
                className={`block rounded-full transition ${
                  moment ? "h-4 w-4 shadow-[0_0_14px_rgba(244,244,245,0.25)]" : "h-2.5 w-2.5"
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
