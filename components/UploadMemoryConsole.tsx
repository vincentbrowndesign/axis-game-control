"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ControlBar } from "@/components/axis/ControlBar"
import { ControlPad } from "@/components/axis/ControlPad"
import { RunHeader } from "@/components/axis/RunHeader"
import { StateBar } from "@/components/axis/StateBar"
import { inferTrack } from "@/lib/engine/inference"
import { buildMemories, buildMoments } from "@/lib/engine/memory"
import { deriveAxisState } from "@/lib/engine/state"
import { createRun, elapsedRunMs, formatRunTime, type Run } from "@/lib/run/runState"
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
  if (data.ok || data.recovery || data.stored) return "Memory attached."
  if (data.error) return "Memory local."

  return "Memory local."
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
  const userAgent = navigator.userAgent || ""
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent)
  const isMobile =
    isIOS ||
    /Android|Mobi|Mobile/i.test(userAgent) ||
    window.matchMedia("(pointer: coarse)").matches
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
    uploadFile = new File([file], uploadName, {
      type: inferredType,
      lastModified: file.lastModified || Date.now(),
    })
  } catch {
    uploadFile = new Blob([file], {
      type: inferredType,
    })
  }

  return {
    traceId: crypto.randomUUID(),
    uploadFile,
    uploadName,
    uploadType: inferredType,
    isMobile,
    isIOS,
    isSafari,
    userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  }
}

function readVideoMetadata(url: string) {
  return new Promise<{ duration: number; url: string }>((resolve) => {
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

export default function UploadMemoryConsole({
  initialMode = "tap",
}: {
  initialMode?: AxisMode
}) {
  const recordInputRef = useRef<HTMLInputElement | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const artifactRef = useRef<HTMLDivElement | null>(null)
  const localVideoUrlRef = useRef<string | null>(null)
  const [run, setRun] = useState<Run>(() => readStoredRun() || createRun())
  const [now, setNow] = useState(() => Date.now())
  const [status, setStatus] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [playbackId, setPlaybackId] = useState<string | undefined>()
  const isRunning = !run.pausedAt

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    writeStoredRun(run)
  }, [run])

  useEffect(
    () => () => {
      if (localVideoUrlRef.current) {
        URL.revokeObjectURL(localVideoUrlRef.current)
      }
    },
    []
  )

  const elapsedMs = elapsedRunMs(run, now)
  const elapsed = formatRunTime(elapsedMs)
  const axisState = useMemo(() => deriveAxisState(run, elapsedMs), [run, elapsedMs])
  const track = useMemo(() => inferTrack(run), [run])

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
      id: crypto.randomUUID(),
      side,
      result,
      time: elapsedMs,
    }

    updateRun({
      ...run,
      signals: [...run.signals, signal],
    })
    setStatus("")
  }

  function undoSignal() {
    updateRun({
      ...run,
      signals: run.signals.slice(0, -1),
    })
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

  async function exportPng(share = false) {
    if (!artifactRef.current) return

    storeCurrentRun()
    setStatus("Archive rendering.")
    const { toPng } = await import("html-to-image")
    const dataUrl = await toPng(artifactRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#050505",
    })
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const validBlob = blob.size > 0 && blob.type.startsWith("image/")

    if (!validBlob) {
      setStatus("Archive unavailable.")
      return
    }

    const file = new File([blob], artifactName(run, "png"), {
      type: "image/png",
    })
    const nativeReady =
      navigator.canShare?.({ files: [file] }) &&
      (share ||
        /iPad|iPhone|iPod|Android|Mobi|Mobile/i.test(navigator.userAgent || "") ||
        window.matchMedia("(pointer: coarse)").matches)

    if (nativeReady) {
      try {
        await navigator.share({
          files: [file],
          title: "Axis Archive",
          text: "Tap. Track. Archive.",
        })
        setStatus("Archive shared.")
        return
      } catch {
        setStatus("Archive save fallback.")
      }
    }

    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = file.name
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    setStatus("Archive saved.")
  }

  async function chooseFile(file: File | undefined, source: UploadSource) {
    if (!file || isUploading) return

    setIsUploading(true)
    setStatus("Memory attaching.")
    const uploadInfo = mobileUploadInfo(file)

    try {
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
          onName={updateName}
          onPause={pauseClock}
          onResume={resumeClock}
          onReset={resetClock}
        />
        <ControlPad home={run.home} away={run.away} onSignal={tapSignal} onUndo={undoSignal} />
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
        accept="video/*"
        className="hidden"
        onChange={(event) => void chooseFile(event.target.files?.[0], "upload")}
      />

      <div
        ref={artifactRef}
        className="pointer-events-none fixed -left-[9999px] top-0 w-[1080px] bg-[#050505] p-14 text-zinc-100"
      >
        <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
          Axis Archive
        </p>
        <h1 className="mt-8 text-7xl font-black leading-none tracking-[-0.06em]">
          {run.home} / {run.away}
        </h1>
        <div className="mt-10 grid grid-cols-3 gap-5 border-y border-zinc-800 py-8">
          <ArtifactNumber label="Signals" value={run.signals.length} />
          <ArtifactNumber label="Moments" value={run.moments.length} />
          <ArtifactNumber label="State" value={axisState.label} />
        </div>
        <div className="mt-10 grid gap-5 text-4xl font-black leading-tight tracking-[-0.04em]">
          <p className="text-orange-300">{track.control}</p>
          <p className="text-sky-300">{track.momentum}</p>
          <p className="text-zinc-100">{track.pressure}</p>
          <p className="text-emerald-300">{track.strongestMoment}</p>
        </div>
      </div>

      <ControlBar
        onCamera={() => recordInputRef.current?.click()}
        onUpload={() => uploadInputRef.current?.click()}
        onUndo={undoSignal}
        onSave={() => void exportPng(false)}
        onShare={() => void exportPng(true)}
        disabled={isUploading}
      />
    </main>
  )
}

function ArtifactNumber({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 font-mono text-5xl font-black leading-none text-zinc-100">
        {value}
      </p>
    </div>
  )
}
