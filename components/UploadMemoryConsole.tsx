"use client"

import { useEffect, useRef, useState } from "react"
import {
  Archive,
  Camera,
  Download,
  FileText,
  Pause,
  Play,
  Share2,
  Undo2,
  Upload,
  X,
} from "lucide-react"
import { buildBehaviorInference } from "@/lib/behavior/inference"
import {
  calculateStreamMetrics,
  emptyStreamMetrics,
} from "@/lib/metrics/calculateMetrics"
import { compareSessions } from "@/lib/progression/compareSessions"
import { applySessionEvent } from "@/lib/session/applySessionEvent"
import { formatElapsedMs } from "@/lib/session/clock"
import { createSessionState } from "@/lib/session/createSessionState"
import type {
  SessionSetupInput,
  StoredSessionSummary,
  Stream,
} from "@/lib/session/types"
import { undoSessionEvent } from "@/lib/session/undoSessionEvent"
import { createClient } from "@/lib/supabase/client"
import {
  parseUploadResponseText,
  type AxisUploadResponse,
} from "@/lib/uploadResponse"

const storageKey = "axis-stream-session-history"
type UploadSource = "camera" | "upload"

const initialSetup: SessionSetupInput = {
  sessionName: "Corner threes",
  streamLabels: ["Coach V", "AJ", "Black"],
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

function uploadStatus(data: AxisUploadResponse) {
  if (data.ok || data.recovery || data.stored) return "Attached."
  if (data.error) return "Saving."

  return "Saving."
}

function safeStorageName(name: string) {
  const cleanName = name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60)
  const extension = name.includes(".")
    ? name.split(".").pop()?.toLowerCase() || "mov"
    : "mov"

  return `${Date.now()}_${cleanName || "axis_upload"}.${extension}`
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
      environment: "practice",
      mission: "Behavior ledger",
      player: "Unassigned",
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
  const uploadName = file.name || `axis-mobile-${Date.now()}.mov`
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

function readPreviousSession() {
  if (typeof window === "undefined") return undefined

  try {
    const raw = window.localStorage.getItem(storageKey)
    const history = raw ? (JSON.parse(raw) as StoredSessionSummary[]) : []

    return history[0]
  } catch {
    return undefined
  }
}

function writeSessionSummary(summary: StoredSessionSummary) {
  if (typeof window === "undefined") return

  try {
    const raw = window.localStorage.getItem(storageKey)
    const history = raw ? (JSON.parse(raw) as StoredSessionSummary[]) : []
    const next = [summary, ...history.filter((item) => item.sessionId !== summary.sessionId)]

    window.localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 8)))
  } catch {
    return
  }
}

function setupFromIdentities(sessionName: string, identities: string[]): SessionSetupInput {
  const clean = identities.map((value) => value.trim()).filter(Boolean)

  return {
    sessionName,
    streamLabels: clean.length ? clean : ["Coach V"],
  }
}

function createIdentity(label: string): Stream {
  return {
    id: crypto.randomUUID(),
    label,
    attempts: 0,
    makes: 0,
    misses: 0,
    metrics: emptyStreamMetrics,
  }
}

function archiveFileName(sessionName: string, extension: "png" | "pdf") {
  return `${sessionName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "axis"}-archive.${extension}`
}

export default function UploadMemoryConsole() {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const recordInputRef = useRef<HTMLInputElement | null>(null)
  const evidenceVideoRef = useRef<HTMLVideoElement | null>(null)
  const archiveRef = useRef<HTMLDivElement | null>(null)
  const localVideoUrlRef = useRef<string | null>(null)
  const [sessionName, setSessionName] = useState(initialSetup.sessionName)
  const [identityNames, setIdentityNames] = useState(initialSetup.streamLabels)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionState, setSessionState] = useState(() =>
    createSessionState(initialSetup)
  )
  const [previousSession] = useState<StoredSessionSummary | undefined>(() =>
    readPreviousSession()
  )
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [playbackUrl, setPlaybackUrl] = useState("")
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveGenerating, setArchiveGenerating] = useState(false)
  const [archiveSaving, setArchiveSaving] = useState(false)

  useEffect(
    () => () => {
      if (localVideoUrlRef.current) {
        URL.revokeObjectURL(localVideoUrlRef.current)
      }
    },
    []
  )

  useEffect(() => {
    if (!sessionState.timerRunning) return

    const interval = window.setInterval(() => {
      setSessionState((state) => {
        if (!state.timerRunning) return state

        const elapsedMs = state.elapsedMs + 1000
        const streams = state.streams.map((stream) => ({
          ...stream,
          metrics: calculateStreamMetrics({
            events: state.timeline,
            streamId: stream.id,
            elapsedMs,
          }),
        }))
        const activeStream =
          streams.find((stream) => stream.id === state.activeStreamId) || streams[0]

        return {
          ...state,
          elapsedMs,
          streams,
          progression: activeStream
            ? compareSessions({
                current: activeStream,
                previous: previousSession,
              })
            : state.progression,
          updatedAt: Date.now(),
        }
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [previousSession, sessionState.timerRunning])

  useEffect(() => {
    if (!sessionStarted || !sessionState.timeline.length) return

    writeSessionSummary({
      sessionId: sessionState.sessionId,
      sessionName: sessionState.sessionName,
      completedAt: Date.now(),
      streams: sessionState.streams.map((stream) => ({
        label: stream.label,
        metrics: stream.metrics,
      })),
    })
  }, [sessionStarted, sessionState])

  function startSession() {
    const setup = setupFromIdentities(sessionName, identityNames)
    const next = createSessionState(setup)

    setSessionState({
      ...next,
      timerRunning: true,
    })
    setSessionStarted(true)
    setStatus("")
    setUploadProgress(0)
  }

  function addSetupIdentity() {
    setIdentityNames((names) => [...names, ""])
  }

  function updateSetupIdentity(index: number, label: string) {
    setIdentityNames((names) =>
      names.map((name, itemIndex) => (itemIndex === index ? label : name))
    )
  }

  function addLiveIdentity() {
    setSessionState((state) => {
      const label = `Identity ${state.streams.length + 1}`
      const identity = createIdentity(label)

      return {
        ...state,
        activeStreamId: identity.id,
        streams: [...state.streams, identity],
        updatedAt: Date.now(),
      }
    })
  }

  function updateLiveIdentity(streamId: string, label: string) {
    setSessionState((state) => ({
      ...state,
      streams: state.streams.map((stream) =>
        stream.id === streamId ? { ...stream, label } : stream
      ),
      timeline: state.timeline.map((event) =>
        event.streamId === streamId ? { ...event, streamLabel: label } : event
      ),
      updatedAt: Date.now(),
    }))
  }

  function currentReplayTimestamp() {
    return Math.max(0, Math.floor(evidenceVideoRef.current?.currentTime || 0))
  }

  function setActiveIdentity(streamId: string) {
    setSessionState((state) => {
      const activeStream = state.streams.find((stream) => stream.id === streamId)

      return {
        ...state,
        activeStreamId: streamId,
        progression: activeStream
          ? compareSessions({
              current: activeStream,
              previous: previousSession,
            })
          : state.progression,
      }
    })
  }

  function mark(type: "INCREMENT" | "DECREMENT") {
    setSessionState((state) => {
      const next = applySessionEvent({
        state,
        event: {
          streamId: state.activeStreamId,
          type,
          replayTimestamp: currentReplayTimestamp(),
        },
      })
      const activeStream =
        next.streams.find((stream) => stream.id === next.activeStreamId) ||
        next.streams[0]

      return {
        ...next,
        progression: activeStream
          ? compareSessions({
              current: activeStream,
              previous: previousSession,
            })
          : next.progression,
      }
    })
  }

  function undoEvent() {
    setSessionState((state) => {
      const next = undoSessionEvent(state)
      const activeStream =
        next.streams.find((stream) => stream.id === next.activeStreamId) ||
        next.streams[0]

      return {
        ...next,
        progression: activeStream
          ? compareSessions({
              current: activeStream,
              previous: previousSession,
            })
          : next.progression,
      }
    })
  }

  function toggleTimer() {
    setSessionState((state) => ({
      ...state,
      timerRunning: !state.timerRunning,
      updatedAt: Date.now(),
    }))
  }

  async function openArchive() {
    setArchiveOpen(true)
    setArchiveGenerating(true)
    await new Promise((resolve) => window.setTimeout(resolve, 650))
    setArchiveGenerating(false)
  }

  async function archivePng(share = false) {
    if (!archiveRef.current) return

    setArchiveSaving(true)
    const { toPng } = await import("html-to-image")
    const dataUrl = await toPng(archiveRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#0a0907",
    })
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const file = new File([blob], archiveFileName(sessionState.sessionName, "png"), {
      type: "image/png",
    })

    if (
      share &&
      navigator.canShare?.({
        files: [file],
      })
    ) {
      await navigator.share({
        files: [file],
        title: `${sessionState.sessionName} Archive`,
      })
      setArchiveSaving(false)
      return
    }

    const link = document.createElement("a")
    link.href = dataUrl
    link.download = file.name
    link.click()
    setArchiveSaving(false)
  }

  function archivePdf() {
    if (!archiveRef.current) return

    const popup = window.open("", "_blank", "noopener,noreferrer")

    if (!popup) return

    popup.document.write(`
      <html>
        <head>
          <title>${sessionState.sessionName} Archive</title>
          <style>
            body { margin: 0; background: #0a0907; color: #f5efe3; font-family: Arial, sans-serif; }
            @page { size: portrait; margin: 0; }
            .print { min-height: 100vh; padding: 56px; box-sizing: border-box; }
            ${archiveCss()}
          </style>
        </head>
        <body><div class="print">${archiveRef.current.innerHTML}</div></body>
      </html>
    `)
    popup.document.close()
    popup.focus()
    popup.print()
  }

  async function chooseFile(file: File | undefined, source: UploadSource = "upload") {
    if (!file || isUploading) return

    setIsUploading(true)
    setStatus("Attaching.")
    setUploadProgress(0)
    const uploadInfo = mobileUploadInfo(file)

    try {
      if (localVideoUrlRef.current) {
        URL.revokeObjectURL(localVideoUrlRef.current)
      }

      const localUrl = URL.createObjectURL(file)
      localVideoUrlRef.current = localUrl
      setPlaybackUrl(localUrl)
      setStatus("Attached.")
      setSessionState((state) => ({
        ...state,
        playback: {
          ...state.playback,
          videoUrl: localUrl,
          attachedAt: Date.now(),
        },
        updatedAt: Date.now(),
      }))

      const metadata = await readVideoMetadata(localUrl)
      setSessionState((state) => ({
        ...state,
        playback: {
          ...state.playback,
          durationSeconds: metadata.duration,
        },
        updatedAt: Date.now(),
      }))
      setUploadProgress(12)

      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error(userError?.message || "Sign in required")
      }

      const filePath = `${user.id}/${safeStorageName(uploadInfo.uploadName)}`
      const clientDebug = {
        clientTraceId: uploadInfo.traceId,
        clientName: file.name || uploadInfo.uploadName,
        clientType: file.type || uploadInfo.uploadType,
        clientSize: file.size,
        clientLastModified: file.lastModified || 0,
        clientUserAgent: uploadInfo.userAgent,
        clientIsMobile: uploadInfo.isMobile,
        clientIsIOS: uploadInfo.isIOS,
        clientIsSafari: uploadInfo.isSafari,
        clientViewport: uploadInfo.viewport,
      }

      const uploaded = await supabase.storage
        .from("axis-replays")
        .upload(filePath, uploadInfo.uploadFile, {
          contentType: uploadInfo.uploadType,
          upsert: false,
        })

      if (uploaded.error) throw uploaded.error

      setUploadProgress(78)
      const signed = await supabase.storage
        .from("axis-replays")
        .createSignedUrl(filePath, 60 * 60 * 24 * 7)

      if (!signed.error && signed.data?.signedUrl) {
        setPlaybackUrl(signed.data.signedUrl)
        setSessionState((state) => ({
          ...state,
          playback: {
            ...state.playback,
            videoUrl: signed.data.signedUrl,
          },
          updatedAt: Date.now(),
        }))
      }

      const result = await completeUpload({
        traceId: uploadInfo.traceId,
        filePath,
        fileName: uploadInfo.uploadName,
        contentType: uploadInfo.uploadType,
        sizeBytes: file.size,
        durationSeconds: metadata.duration,
        source,
        client: clientDebug,
      })

      setUploadProgress(100)
      setStatus(uploadStatus(result))
      if (result.videoUrl) {
        setPlaybackUrl(result.videoUrl)
        setSessionState((state) => ({
          ...state,
          playback: {
            ...state.playback,
            replayId: result.replayId,
            videoUrl: result.videoUrl,
          },
          updatedAt: Date.now(),
        }))
      }
    } catch (error) {
      console.error("AXIS EVIDENCE FAILED", error)
      setStatus("Local.")
    } finally {
      setIsUploading(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ""
      if (recordInputRef.current) recordInputRef.current.value = ""
    }
  }

  const activeIdentity =
    sessionState.streams.find((stream) => stream.id === sessionState.activeStreamId) ||
    sessionState.streams[0]
  const metrics = activeIdentity.metrics
  const inference = buildBehaviorInference({
    events: sessionState.timeline,
    streamId: activeIdentity.id,
    metrics,
  })
  const recentEvents = sessionState.timeline
    .filter((event) => event.streamId === activeIdentity.id)
    .slice(0, 6)

  return (
    <main className="min-h-screen bg-[#0a0907] px-4 py-5 text-[#f5efe3] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <span className="text-sm font-black text-[#f5efe3]/80">Axis</span>
          <div className="flex items-center gap-2">
            {sessionStarted ? (
              <span className="font-mono text-sm font-black text-[#d8bd72]/80">
                {formatElapsedMs(sessionState.elapsedMs)}
              </span>
            ) : null}
            {sessionStarted ? (
              <button
                type="button"
                onClick={() => void openArchive()}
                aria-label="Archive"
                className="grid h-10 w-10 place-items-center rounded-full border border-[#f5efe3]/10 text-[#f5efe3]/46 transition hover:border-[#d8bd72]/35 hover:text-[#d8bd72]"
              >
                <Archive className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </header>

        <section className="grid min-h-[78vh] gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div>
            {!sessionStarted ? (
              <div className="mt-10 grid gap-6 sm:max-w-2xl">
                <input
                  value={sessionName}
                  onChange={(event) => setSessionName(event.target.value)}
                  placeholder="Session title"
                  className="bg-transparent text-6xl font-black leading-none tracking-[-0.06em] text-[#f5efe3] outline-none placeholder:text-[#f5efe3]/20 sm:text-8xl"
                />
                <div className="flex flex-wrap gap-2 border-y border-[#f5efe3]/10 py-5">
                  {identityNames.map((name, index) => (
                    <input
                      key={index}
                      value={name}
                      onChange={(event) =>
                        updateSetupIdentity(index, event.target.value)
                      }
                      placeholder="Identity"
                      className="h-12 w-32 rounded-full border border-[#f5efe3]/10 bg-[#f5efe3]/[0.025] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#f5efe3]/80 outline-none placeholder:text-[#f5efe3]/22"
                    />
                  ))}
                  <button
                    type="button"
                    onClick={addSetupIdentity}
                    aria-label="Add identity"
                    className="grid h-12 w-12 place-items-center rounded-full border border-[#f5efe3]/10 text-2xl font-black text-[#f5efe3]/46 transition hover:border-[#d8bd72]/35 hover:text-[#d8bd72]"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={startSession}
                  className="h-16 w-fit rounded-full bg-[#d8bd72] px-8 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:bg-[#f0d98f]"
                >
                  Begin
                </button>
              </div>
            ) : (
              <div className="mt-8">
                <input
                  value={sessionState.sessionName}
                  onChange={(event) =>
                    setSessionState((state) => ({
                      ...state,
                      sessionName: event.target.value,
                      updatedAt: Date.now(),
                    }))
                  }
                  className="w-full bg-transparent text-6xl font-black leading-none tracking-[-0.06em] text-[#f5efe3] outline-none sm:text-8xl"
                />

                <div className="mt-8 flex flex-wrap items-center gap-2 border-y border-[#f5efe3]/10 py-4">
                  {sessionState.streams.map((identity) => (
                    <button
                      key={identity.id}
                      type="button"
                      onClick={() => setActiveIdentity(identity.id)}
                      className={`rounded-full border px-4 py-3 transition ${
                        identity.id === activeIdentity.id
                          ? "border-[#d8bd72]/60 bg-[#d8bd72]/12 text-[#f5efe3]"
                          : "border-[#f5efe3]/10 bg-[#f5efe3]/[0.025] text-[#f5efe3]/46 hover:text-[#f5efe3]/70"
                      }`}
                    >
                      <input
                        value={identity.label}
                        onChange={(event) =>
                          updateLiveIdentity(identity.id, event.target.value)
                        }
                        onClick={(event) => event.stopPropagation()}
                        aria-label="Identity"
                        className="w-24 bg-transparent text-center text-xs font-black uppercase tracking-[0.12em] outline-none"
                      />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={addLiveIdentity}
                    aria-label="Add identity"
                    className="grid h-11 w-11 place-items-center rounded-full border border-[#f5efe3]/10 text-xl font-black text-[#f5efe3]/42 transition hover:border-[#d8bd72]/35 hover:text-[#d8bd72]"
                  >
                    +
                  </button>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => mark("INCREMENT")}
                    className="min-h-48 rounded-lg bg-[#d8bd72] p-6 text-left text-black transition active:scale-[0.99] hover:bg-[#f0d98f]"
                  >
                    <span className="block text-sm font-black uppercase tracking-[0.2em]">
                      Make
                    </span>
                    <span className="mt-6 block font-mono text-8xl font-black leading-none tracking-[-0.06em]">
                      {metrics.makes}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => mark("DECREMENT")}
                    className="min-h-48 rounded-lg border border-[#f5efe3]/10 bg-[#f5efe3]/[0.045] p-6 text-left text-[#f5efe3] transition active:scale-[0.99] hover:bg-[#f5efe3]/[0.07]"
                  >
                    <span className="block text-sm font-black uppercase tracking-[0.2em] text-[#f5efe3]/56">
                      Miss
                    </span>
                    <span className="mt-6 block font-mono text-8xl font-black leading-none tracking-[-0.06em]">
                      {metrics.misses}
                    </span>
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-2xl font-black text-[#f5efe3]/78">
                      {formatElapsedMs(sessionState.elapsedMs)}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#f5efe3]/30">
                      {activeIdentity.label}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-[#f5efe3]/10 bg-[#f5efe3]/[0.025] p-1">
                    <IconButton
                      label="Camera"
                      onClick={() => recordInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Camera className="h-4 w-4 stroke-[1.5]" />
                    </IconButton>
                    <IconButton
                      label="Upload"
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Upload className="h-4 w-4 stroke-[1.5]" />
                    </IconButton>
                    <IconButton label="Timer" onClick={toggleTimer} active>
                      {sessionState.timerRunning ? (
                        <Pause className="h-4 w-4 stroke-[1.5]" />
                      ) : (
                        <Play className="h-4 w-4 stroke-[1.5]" />
                      )}
                    </IconButton>
                    <IconButton label="Undo" onClick={undoEvent}>
                      <Undo2 className="h-4 w-4 stroke-[1.5]" />
                    </IconButton>
                    <IconButton label="Archive" onClick={() => void openArchive()}>
                      <Archive className="h-4 w-4 stroke-[1.5]" />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-8 grid gap-3 text-2xl font-black tracking-[-0.04em] text-[#d8bd72]">
                  {inference.archiveLines.slice(0, 4).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-3 sm:max-w-xl">
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

              {status ? (
                <div className="text-sm font-bold text-[#f5efe3]/42">
                  <p>{status}</p>
                  {isUploading || uploadProgress > 0 ? (
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#f5efe3]/10">
                      <div
                        className="h-full rounded-full bg-[#d8bd72] transition-all duration-500"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {sessionStarted ? (
            <aside className="border-t border-[#f5efe3]/10 pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f5efe3]/30">
                Fingerprint
              </p>
              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6">
                {inference.fingerprints.map((item) => (
                  <div key={item.label}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f5efe3]/28">
                      {item.label}
                    </p>
                    <p className="mt-1 text-lg font-black leading-tight text-[#f5efe3]/86">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 border-t border-[#f5efe3]/10 pt-6">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f5efe3]/30">
                  Spurts
                </p>
                <div className="mt-4 grid gap-3">
                  {inference.spurts.map((spurt) => (
                    <div
                      key={spurt.kind}
                      className="grid grid-cols-[96px_1fr] gap-3 border-b border-[#f5efe3]/8 pb-3"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d8bd72]/64">
                        {spurt.label}
                      </p>
                      <p className="text-sm font-black text-[#f5efe3]/78">
                        {spurt.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 border-t border-[#f5efe3]/10 pt-6">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f5efe3]/30">
                  Chronology
                </p>
                <div className="mt-4 grid gap-2">
                  {recentEvents.length ? (
                    recentEvents.map((event) => (
                      <div
                        key={event.id}
                        className="grid grid-cols-[64px_1fr] gap-3 font-mono text-sm font-black text-[#f5efe3]/54"
                      >
                        <span>{event.elapsedLabel}</span>
                        <span>{event.type === "INCREMENT" ? "MAKE" : "MISS"}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm font-bold text-[#f5efe3]/34">No attempts.</p>
                  )}
                </div>
              </div>
            </aside>
          ) : null}

          {playbackUrl ? (
            <video
              ref={evidenceVideoRef}
              src={playbackUrl}
              className="hidden"
              controls
              playsInline
              preload="metadata"
            />
          ) : null}
        </section>
      </div>

      {archiveOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050403] px-4 py-5 text-[#f5efe3] sm:px-6">
          {archiveGenerating ? (
            <div className="grid min-h-screen place-items-center">
              <div className="text-center">
                <div className="mx-auto h-16 w-16 rounded-full border border-[#d8bd72]/30 bg-[#d8bd72]/10 animate-pulse" />
                <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-[#f5efe3]/48">
                  Generating Archive...
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_auto]">
              <ArchiveArtifact
                refNode={archiveRef}
                sessionName={sessionState.sessionName}
                identity={activeIdentity.label}
                elapsed={formatElapsedMs(sessionState.elapsedMs)}
                metrics={metrics}
                inference={inference}
              />
              <div className="flex gap-2 lg:flex-col">
                <IconButton label="Save" onClick={() => void archivePng(false)}>
                  <Download className="h-4 w-4 stroke-[1.5]" />
                </IconButton>
                <IconButton label="Share" onClick={() => void archivePng(true)}>
                  <Share2 className="h-4 w-4 stroke-[1.5]" />
                </IconButton>
                <IconButton label="PDF" onClick={archivePdf}>
                  <FileText className="h-4 w-4 stroke-[1.5]" />
                </IconButton>
                <IconButton label="Close" onClick={() => setArchiveOpen(false)}>
                  <X className="h-4 w-4 stroke-[1.5]" />
                </IconButton>
                {archiveSaving ? (
                  <span className="self-center text-xs font-black uppercase tracking-[0.18em] text-[#f5efe3]/36">
                    Saving
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </main>
  )
}

function IconButton({
  label,
  onClick,
  disabled = false,
  active = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-full transition hover:bg-[#f5efe3]/[0.06] hover:text-[#d8bd72] disabled:opacity-30 ${
        active ? "text-[#d8bd72]/80" : "text-[#f5efe3]/46"
      }`}
    >
      {children}
    </button>
  )
}

function ArchiveArtifact({
  refNode,
  sessionName,
  identity,
  elapsed,
  metrics,
  inference,
}: {
  refNode: React.RefObject<HTMLDivElement | null>
  sessionName: string
  identity: string
  elapsed: string
  metrics: Stream["metrics"]
  inference: ReturnType<typeof buildBehaviorInference>
}) {
  return (
    <div
      ref={refNode}
      className="min-h-[calc(100vh-2.5rem)] bg-[#0a0907] p-7 text-[#f5efe3] sm:p-12"
    >
      <div className="flex items-start justify-between gap-6 border-b border-[#f5efe3]/12 pb-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f5efe3]/38">
            Axis Archive
          </p>
          <h2 className="mt-8 max-w-3xl text-6xl font-black leading-[0.86] tracking-[-0.06em] text-[#f5efe3] sm:text-8xl">
            {sessionName}
          </h2>
        </div>
        <p className="font-mono text-2xl font-black text-[#d8bd72]">{elapsed}</p>
      </div>

      <div className="grid gap-7 border-b border-[#f5efe3]/12 py-8 sm:grid-cols-[1fr_1fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f5efe3]/34">
            Identity
          </p>
          <p className="mt-3 text-4xl font-black tracking-[-0.04em]">{identity}</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <ArchiveNumber label="Make" value={metrics.makes} />
          <ArchiveNumber label="Miss" value={metrics.misses} />
          <ArchiveNumber label="Rate" value={`${Math.round(metrics.makeRate * 100)}`} />
        </div>
      </div>

      <div className="grid gap-8 py-8 lg:grid-cols-[1.2fr_.8fr]">
        <div className="grid gap-4">
          {inference.archiveLines.map((line) => (
            <p
              key={line}
              className="border-b border-[#f5efe3]/8 pb-4 text-3xl font-black leading-tight tracking-[-0.04em] text-[#d8bd72]"
            >
              {line}
            </p>
          ))}
        </div>
        <div className="grid content-start gap-4">
          {inference.fingerprints.map((item) => (
            <div
              key={item.label}
              className="grid grid-cols-[120px_1fr] gap-4 border-b border-[#f5efe3]/8 pb-3"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f5efe3]/32">
                {item.label}
              </p>
              <p className="text-sm font-black text-[#f5efe3]/82">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 border-t border-[#f5efe3]/12 pt-8 sm:grid-cols-2 lg:grid-cols-5">
        {inference.spurts.map((spurt) => (
          <div key={spurt.kind}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f5efe3]/30">
              {spurt.label}
            </p>
            <p className="mt-2 text-lg font-black leading-tight text-[#f5efe3]/84">
              {spurt.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 border-t border-[#f5efe3]/12 pt-8">
        <p className="font-mono text-sm font-black uppercase tracking-[0.18em] text-[#f5efe3]/42">
          {inference.predictionLine}
        </p>
      </div>
    </div>
  )
}

function ArchiveNumber({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f5efe3]/32">
        {label}
      </p>
      <p className="mt-2 font-mono text-5xl font-black leading-none text-[#f5efe3]">
        {value}
      </p>
    </div>
  )
}

function archiveCss() {
  return `
    .print > div { min-height: 100vh; background: #0a0907; color: #f5efe3; }
    p, h2 { margin: 0; }
    .grid { display: grid; }
    .flex { display: flex; }
    .items-start { align-items: flex-start; }
    .justify-between { justify-content: space-between; }
    .gap-6 { gap: 24px; }
    .gap-7 { gap: 28px; }
    .gap-8 { gap: 32px; }
    .gap-4 { gap: 16px; }
    .border-b { border-bottom: 1px solid rgba(245, 239, 227, .12); }
    .border-t { border-top: 1px solid rgba(245, 239, 227, .12); }
    .pb-8 { padding-bottom: 32px; }
    .py-8 { padding-top: 32px; padding-bottom: 32px; }
    .pt-8 { padding-top: 32px; }
    .mt-2 { margin-top: 8px; }
    .mt-3 { margin-top: 12px; }
    .mt-8 { margin-top: 32px; }
    .mt-10 { margin-top: 40px; }
    .text-xs { font-size: 12px; }
    .text-sm { font-size: 14px; }
    .text-lg { font-size: 18px; }
    .text-2xl { font-size: 24px; }
    .text-3xl { font-size: 30px; }
    .text-4xl { font-size: 36px; }
    .text-5xl { font-size: 48px; }
    .text-6xl { font-size: 60px; }
    .text-8xl { font-size: 96px; }
    .font-black { font-weight: 900; }
    .font-mono { font-family: monospace; }
    .uppercase { text-transform: uppercase; }
    .leading-none { line-height: 1; }
    .leading-tight { line-height: 1.15; }
  `
}
