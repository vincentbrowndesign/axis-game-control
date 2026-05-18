"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, Download, FileText, Timer, Undo2, Upload } from "lucide-react"
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
  streamLabels: ["Makes", "Misses"],
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

function rushLine(value: number) {
  if (!value) return "No response shift yet."

  return `${Math.abs(value)}% ${value > 0 ? "faster" : "slower"} after -`
}

function setupFromTallies(sessionName: string, tallyNames: string[]): SessionSetupInput {
  return {
    sessionName,
    streamLabels: cleanTallyNames(tallyNames),
  }
}

function cleanTallyNames(tallyNames: string[]) {
  const clean = tallyNames.map((value) => value.trim()).filter(Boolean)

  return clean.length ? clean : ["Tally"]
}

function createTally(label: string): Stream {
  return {
    id: crypto.randomUUID(),
    label,
    attempts: 0,
    makes: 0,
    misses: 0,
    metrics: emptyStreamMetrics,
  }
}

function tallyValue(stream: Stream) {
  return stream.makes - stream.misses
}

export default function UploadMemoryConsole() {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const recordInputRef = useRef<HTMLInputElement | null>(null)
  const evidenceVideoRef = useRef<HTMLVideoElement | null>(null)
  const archiveRef = useRef<HTMLDivElement | null>(null)
  const localVideoUrlRef = useRef<string | null>(null)
  const [sessionName, setSessionName] = useState(initialSetup.sessionName)
  const [tallyNames, setTallyNames] = useState(initialSetup.streamLabels)
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
    const setup = setupFromTallies(sessionName, tallyNames)
    const next = createSessionState(setup)

    setSessionState({
      ...next,
      timerRunning: true,
    })
    setSessionStarted(true)
    setStatus("")
    setUploadProgress(0)
  }

  function addSetupTally() {
    setTallyNames((names) => [...names, `Tally ${names.length + 1}`])
  }

  function updateSetupTally(index: number, label: string) {
    setTallyNames((names) =>
      names.map((name, itemIndex) => (itemIndex === index ? label : name))
    )
  }

  function addLiveTally() {
    setSessionState((state) => {
      const label = `Tally ${state.streams.length + 1}`
      const tally = createTally(label)

      return {
        ...state,
        activeStreamId: tally.id,
        streams: [...state.streams, tally],
        updatedAt: Date.now(),
      }
    })
  }

  function currentReplayTimestamp() {
    return Math.max(0, Math.floor(evidenceVideoRef.current?.currentTime || 0))
  }

  function setActiveStream(streamId: string) {
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

  async function archivePng() {
    if (!archiveRef.current) return

    setStatus("Crystallizing.")
    const { toPng } = await import("html-to-image")
    const dataUrl = await toPng(archiveRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#0a0907",
    })
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const file = new File([blob], `${sessionState.sessionName}-axis.png`, {
      type: "image/png",
    })

    if (
      navigator.canShare?.({
        files: [file],
      })
    ) {
      await navigator.share({
        files: [file],
      })
      setStatus("Saved.")
      return
    }

    const link = document.createElement("a")
    link.href = dataUrl
    link.download = file.name
    link.click()
    setStatus("Saved.")
  }

  function archivePdf() {
    const active = activeStream
    const html = `
      <html>
        <head>
          <title>${sessionState.sessionName} Axis Archive</title>
          <style>
            body { margin: 0; background: #0a0907; color: #f5efe3; font-family: Arial, sans-serif; }
            main { padding: 56px; }
            h1 { font-size: 56px; line-height: .9; margin: 0 0 40px; letter-spacing: -3px; }
            .row { display: flex; justify-content: space-between; border-top: 1px solid rgba(245,239,227,.18); padding: 22px 0; font-size: 28px; font-weight: 800; text-transform: uppercase; }
            .metric { margin-top: 36px; color: #e8d39b; font-size: 30px; font-weight: 900; }
            @media print { body { background: #0a0907; color: #f5efe3; } }
          </style>
        </head>
        <body>
          <main>
            <h1>${sessionState.sessionName}</h1>
            ${sessionState.streams
              .map(
                (stream) =>
                  `<div class="row"><span>${stream.label}</span><span>${tallyValue(
                    stream
                  )}</span></div>`
              )
              .join("")}
            <div class="metric">${formatElapsedMs(sessionState.elapsedMs)}</div>
            <div class="metric">${active.metrics.intervalRange}</div>
            <div class="metric">${active.metrics.longestDroughtSeconds}s longest drought</div>
            <div class="metric">${rushLine(active.metrics.rushAfterMissPct)}</div>
            <div class="metric">Best spurt: ${active.metrics.bestSpurt.makes} in ${active.metrics.bestSpurt.seconds}s</div>
          </main>
        </body>
      </html>
    `
    const popup = window.open("", "_blank", "noopener,noreferrer")

    if (!popup) return

    popup.document.write(html)
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

    console.info("AXIS EVIDENCE UPLOAD", {
      traceId: uploadInfo.traceId,
      source,
      file: {
        name: file.name,
        type: file.type || "missing",
        size: file.size,
      },
      mobile: {
        isMobile: uploadInfo.isMobile,
        isIOS: uploadInfo.isIOS,
        isSafari: uploadInfo.isSafari,
        viewport: uploadInfo.viewport,
      },
    })

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

      try {
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
        console.warn("AXIS EVIDENCE RETRY", {
          traceId: uploadInfo.traceId,
          error,
        })
        setStatus("Retrying.")
        setUploadProgress(18)
        await new Promise((resolve) => window.setTimeout(resolve, 900))

        const retryPath = `${user.id}/${safeStorageName(uploadInfo.uploadName)}`
        const retry = await supabase.storage
          .from("axis-replays")
          .upload(retryPath, uploadInfo.uploadFile, {
            contentType: uploadInfo.uploadType,
            upsert: false,
          })

        if (retry.error) throw retry.error

        setUploadProgress(82)
        const signed = await supabase.storage
          .from("axis-replays")
          .createSignedUrl(retryPath, 60 * 60 * 24 * 7)

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
          filePath: retryPath,
          fileName: uploadInfo.uploadName,
          contentType: uploadInfo.uploadType,
          sizeBytes: file.size,
          durationSeconds: metadata.duration,
          source,
          client: {
            ...clientDebug,
            retry: true,
          },
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

  const activeStream =
    sessionState.streams.find((stream) => stream.id === sessionState.activeStreamId) ||
    sessionState.streams[0]
  const metrics = activeStream.metrics

  return (
    <main className="min-h-screen bg-[#0a0907] px-4 py-5 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <span className="text-sm font-black text-white/85">Axis</span>
          {sessionStarted ? (
            <span className="font-mono text-sm font-black text-amber-100/78">
              {formatElapsedMs(sessionState.elapsedMs)}
            </span>
          ) : null}
        </header>

        <section className="grid min-h-[78vh] gap-8 py-8 lg:grid-cols-[1fr_340px] lg:items-start">
          <div>
            {!sessionStarted ? (
              <div className="mt-8 grid gap-5 sm:max-w-xl">
                <input
                  value={sessionName}
                  onChange={(event) => setSessionName(event.target.value)}
                  placeholder="Session name"
                  className="bg-transparent text-5xl font-black leading-none tracking-[-0.06em] text-white outline-none placeholder:text-white/22 sm:text-7xl"
                />
                <div className="grid gap-2 border-y border-white/10 py-5">
                  {tallyNames.map((name, index) => (
                    <input
                      key={index}
                      value={name}
                      onChange={(event) => updateSetupTally(index, event.target.value)}
                      placeholder="Tally"
                      className="bg-transparent py-2 text-3xl font-black uppercase tracking-[0.06em] text-white/78 outline-none placeholder:text-white/20"
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addSetupTally}
                    aria-label="Add tally"
                    className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.025] text-2xl font-black text-white/48 transition hover:border-amber-100/30 hover:text-amber-100"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={startSession}
                    aria-label="Enter"
                    className="grid h-12 w-12 place-items-center rounded-full bg-amber-200 text-2xl font-black text-black transition hover:bg-amber-100"
                  >
                    &rarr;
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 max-w-xl">
                <p className="text-5xl font-black leading-none tracking-[-0.06em] text-white sm:text-7xl">
                  {sessionState.sessionName}
                </p>
                <div className="mt-8 grid gap-3 border-y border-white/10 py-6">
                  {sessionState.streams.map((stream) => (
                    <button
                      key={stream.id}
                      type="button"
                      onClick={() => setActiveStream(stream.id)}
                      className={`grid grid-cols-[1fr_auto] items-end gap-5 text-left transition ${
                        stream.id === activeStream.id
                          ? "text-white"
                          : "text-white/34 hover:text-white/60"
                      }`}
                    >
                      <span className="text-2xl font-black uppercase tracking-[0.14em]">
                        {stream.label}
                      </span>
                      <span className="font-mono text-8xl font-black leading-[0.8] tracking-[-0.06em] sm:text-9xl">
                        {tallyValue(stream)}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={addLiveTally}
                    aria-label="Add tally"
                    className="mt-2 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.025] text-2xl font-black text-white/42 transition hover:border-amber-100/30 hover:text-amber-100"
                  >
                    +
                  </button>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <p className="font-mono text-xl font-black text-white/68">
                    {formatElapsedMs(sessionState.elapsedMs)}
                  </p>
                  <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.025] p-1">
                    <button
                      type="button"
                      onClick={() => recordInputRef.current?.click()}
                      disabled={isUploading}
                      aria-label="Camera"
                      className="grid h-10 w-10 place-items-center rounded-full text-white/42 transition hover:bg-white/[0.06] hover:text-amber-100 disabled:opacity-30"
                    >
                      <Camera className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={isUploading}
                      aria-label="Upload"
                      className="grid h-10 w-10 place-items-center rounded-full text-white/42 transition hover:bg-white/[0.06] hover:text-amber-100 disabled:opacity-30"
                    >
                      <Upload className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleTimer}
                      aria-label="Timer"
                      className={`grid h-10 w-10 place-items-center rounded-full transition hover:bg-white/[0.06] hover:text-amber-100 ${
                        sessionState.timerRunning ? "text-amber-100/72" : "text-white/42"
                      }`}
                    >
                      <Timer className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={undoEvent}
                      aria-label="Undo"
                      className="grid h-10 w-10 place-items-center rounded-full text-white/42 transition hover:bg-white/[0.06] hover:text-amber-100"
                    >
                      <Undo2 className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void archivePng()}
                      aria-label="Save archive"
                      className="grid h-10 w-10 place-items-center rounded-full text-white/42 transition hover:bg-white/[0.06] hover:text-amber-100"
                    >
                      <Download className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={archivePdf}
                      aria-label="Print archive"
                      className="grid h-10 w-10 place-items-center rounded-full text-white/42 transition hover:bg-white/[0.06] hover:text-amber-100"
                    >
                      <FileText className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="mt-7 grid gap-3 text-2xl font-black tracking-[-0.04em] text-amber-100/86">
                  <p>{metrics.intervalRange}</p>
                  <p>{metrics.longestDroughtSeconds}s longest drought</p>
                  <p>{rushLine(metrics.rushAfterMissPct)}</p>
                </div>

                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/30">
                    Best spurt
                  </p>
                  <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-white">
                    {metrics.bestSpurt.makes} makes in {metrics.bestSpurt.seconds} seconds
                  </p>
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

              {sessionStarted ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => mark("INCREMENT")}
                      aria-label="Add event"
                      className="min-h-32 rounded-[0.75rem] bg-amber-200 text-6xl font-black text-black transition hover:bg-amber-100"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => mark("DECREMENT")}
                      aria-label="Subtract event"
                      className="min-h-32 rounded-[0.75rem] bg-white/[0.06] text-6xl font-black text-white transition hover:bg-white/[0.1]"
                    >
                      -
                    </button>
                  </div>
                </>
              ) : null}

              {status ? (
                <div className="text-sm font-bold text-white/42">
                  <p>{status}</p>
                  {isUploading || uploadProgress > 0 ? (
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-amber-100 transition-all duration-500"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

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
          <div
            ref={archiveRef}
            className="pointer-events-none fixed -left-[9999px] top-0 w-[1080px] bg-[#0a0907] p-16 text-stone-100"
          >
            <p className="text-2xl font-black uppercase tracking-[0.28em] text-white/38">
              Axis
            </p>
            <h2 className="mt-10 text-8xl font-black leading-[0.86] tracking-[-0.06em] text-white">
              {sessionState.sessionName}
            </h2>
            <div className="mt-14 grid gap-5 border-y border-white/12 py-10">
              {sessionState.streams.map((stream) => (
                <div
                  key={stream.id}
                  className="grid grid-cols-[1fr_auto] items-end gap-8"
                >
                  <p className="text-4xl font-black uppercase tracking-[0.12em] text-white/54">
                    {stream.label}
                  </p>
                  <p className="font-mono text-8xl font-black leading-none text-white">
                    {tallyValue(stream)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-12 grid gap-5 text-4xl font-black tracking-[-0.04em] text-amber-100">
              <p>{formatElapsedMs(sessionState.elapsedMs)}</p>
              <p>{metrics.intervalRange}</p>
              <p>{metrics.longestDroughtSeconds}s longest drought</p>
              <p>{rushLine(metrics.rushAfterMissPct)}</p>
              <p>
                Best spurt: {metrics.bestSpurt.makes} in{" "}
                {metrics.bestSpurt.seconds}s
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
