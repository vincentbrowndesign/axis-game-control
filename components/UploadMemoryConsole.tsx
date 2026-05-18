"use client"

import { useEffect, useRef, useState } from "react"
import { Upload, Video } from "lucide-react"
import { calculateStreamMetrics } from "@/lib/metrics/calculateMetrics"
import { compareSessions } from "@/lib/progression/compareSessions"
import { applySessionEvent } from "@/lib/session/applySessionEvent"
import { formatElapsedMs } from "@/lib/session/clock"
import { createSessionState } from "@/lib/session/createSessionState"
import type { SessionSetupInput, StoredSessionSummary } from "@/lib/session/types"
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
  streamLabels: ["AJ"],
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
  if (data.ok || data.recovery || data.stored) return "Replay evidence attached."
  if (data.error) return "Replay evidence is still saving."

  return "Replay evidence is still saving."
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
  if (!value) return "No post-miss response yet."

  return `${Math.abs(value)}% ${value > 0 ? "faster" : "slower"} after misses`
}

function setupFromText(sessionName: string, streamText: string): SessionSetupInput {
  const streamLabels = streamText
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  return {
    sessionName,
    streamLabels: streamLabels.length ? streamLabels : ["AJ"],
  }
}

export default function UploadMemoryConsole() {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const recordInputRef = useRef<HTMLInputElement | null>(null)
  const evidenceVideoRef = useRef<HTMLVideoElement | null>(null)
  const localVideoUrlRef = useRef<string | null>(null)
  const [sessionName, setSessionName] = useState(initialSetup.sessionName)
  const [streamText, setStreamText] = useState(initialSetup.streamLabels.join(", "))
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
    const setup = setupFromText(sessionName, streamText)
    const next = createSessionState(setup)

    setSessionState({
      ...next,
      timerRunning: true,
    })
    setSessionStarted(true)
    setStatus("")
    setUploadProgress(0)
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

  function mark(type: "MAKE" | "MISS") {
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

  async function chooseFile(file: File | undefined, source: UploadSource = "upload") {
    if (!file || isUploading) return

    setIsUploading(true)
    setStatus("Attaching replay evidence.")
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
      setStatus("Replay evidence ready locally.")
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
        setStatus("Replay evidence is retrying quietly.")
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
      setStatus("Replay evidence stays local for now.")
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
  const streamSpurts = sessionState.spurts
    .filter((spurt) => spurt.streamId === activeStream.id)
    .slice(0, 4)

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

        <section className="grid min-h-[78vh] gap-8 py-8 lg:grid-cols-[1fr_380px] lg:items-start">
          <div>
            <p className="text-sm font-bold text-white/38">Basketball ledger</p>
            <h1 className="mt-4 max-w-4xl text-6xl font-black leading-[0.9] tracking-[-0.065em] text-white sm:text-8xl">
              Tally. Time. Behavior.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/48">
              Axis measures basketball behavior with marks and elapsed time.
            </p>

            {!sessionStarted ? (
              <div className="mt-8 grid gap-3 sm:max-w-xl">
                <input
                  value={sessionName}
                  onChange={(event) => setSessionName(event.target.value)}
                  placeholder="Session name"
                  className="rounded-[0.75rem] bg-white/[0.06] px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
                />
                <input
                  value={streamText}
                  onChange={(event) => setStreamText(event.target.value)}
                  placeholder="Streams: Black, Gold, AJ"
                  className="rounded-[0.75rem] bg-white/[0.06] px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
                />
                <button
                  type="button"
                  onClick={startSession}
                  className="min-h-16 rounded-[0.75rem] bg-amber-200 px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:bg-amber-100"
                >
                  Start ledger
                </button>
              </div>
            ) : (
              <div className="mt-8 max-w-xl rounded-[0.75rem] bg-white/[0.04] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/32">
                  {sessionState.sessionName}
                </p>
                <div className="mt-3 text-6xl font-black leading-none tracking-[-0.06em] text-white sm:text-7xl">
                  {metrics.makes} / {metrics.attempts}
                </div>
                <p className="mt-2 text-sm font-bold text-white/44">
                  {formatElapsedMs(sessionState.elapsedMs)} elapsed
                </p>

                <div className="mt-6 grid gap-3 text-2xl font-black tracking-[-0.04em] text-amber-100/86">
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
              {sessionStarted ? (
                <div className="flex flex-wrap gap-2">
                  {sessionState.streams.map((stream) => (
                    <button
                      key={stream.id}
                      type="button"
                      onClick={() => setActiveStream(stream.id)}
                      className={`min-h-12 rounded-[0.75rem] px-4 text-sm font-black uppercase tracking-[0.12em] transition ${
                        stream.id === activeStream.id
                          ? "bg-amber-200 text-black"
                          : "bg-white/[0.06] text-white/58 hover:bg-white/[0.1]"
                      }`}
                    >
                      {stream.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => recordInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex min-h-20 items-center justify-center gap-3 rounded-[0.75rem] bg-amber-200 px-6 py-5 text-xs font-black uppercase tracking-[0.14em] text-black transition hover:bg-amber-100 disabled:opacity-50"
                >
                  <Video className="h-4 w-4" aria-hidden="true" />
                  Record play
                </button>
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex min-h-20 items-center justify-center gap-3 rounded-[0.75rem] bg-stone-100 px-6 py-5 text-xs font-black uppercase tracking-[0.14em] text-black transition hover:bg-white disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Upload clip
                </button>
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

              {sessionStarted ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => mark("MAKE")}
                      className="min-h-28 rounded-[0.75rem] bg-amber-200 text-3xl font-black uppercase tracking-[0.12em] text-black transition hover:bg-amber-100"
                    >
                      Make
                    </button>
                    <button
                      type="button"
                      onClick={() => mark("MISS")}
                      className="min-h-28 rounded-[0.75rem] bg-white/[0.06] text-3xl font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/[0.1]"
                    >
                      Miss
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={undoEvent}
                      className="min-h-14 rounded-[0.75rem] bg-white/[0.04] text-xs font-black uppercase tracking-[0.12em] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      onClick={toggleTimer}
                      className="min-h-14 rounded-[0.75rem] bg-white/[0.04] text-xs font-black uppercase tracking-[0.12em] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      {sessionState.timerRunning ? "Pause time" : "Start time"}
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

          <aside className="grid gap-4">
            <section className="rounded-[0.75rem] bg-[#16120d] p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/30">
                Compared to last session
              </p>
              <div className="mt-4 grid gap-3">
                {sessionState.progression.map((item) => (
                  <p key={item.id} className="text-lg font-black tracking-[-0.03em] text-white">
                    {item.label}
                  </p>
                ))}
              </div>
            </section>

            <section className="rounded-[0.75rem] bg-[#16120d] p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/30">
                Spurts
              </p>
              <div className="mt-4 grid gap-3">
                {streamSpurts.length ? (
                  streamSpurts.map((spurt) => (
                    <article key={spurt.id} className="border-t border-white/10 pt-3">
                      <p className="text-sm font-black uppercase tracking-[0.12em] text-amber-100/70">
                        {spurt.label}
                      </p>
                      <p className="mt-1 text-2xl font-black tracking-[-0.05em] text-white">
                        {spurt.type === "LONGEST_DROUGHT"
                          ? `0 makes in ${spurt.seconds} seconds`
                          : `${spurt.count} ${
                              spurt.type === "EMPTY_SPURT" ? "misses" : "makes"
                            } in ${spurt.seconds} seconds`}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm font-bold text-white/38">
                    Spurts appear when the stream changes shape.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[0.75rem] bg-[#16120d] p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/30">
                Replay evidence
              </p>
              <p className="mt-3 text-sm font-bold text-white/44">
                {playbackUrl ? "Attached quietly." : "Optional."}
              </p>
              {playbackUrl ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-amber-100/70">
                    Open replay
                  </summary>
                  <video
                    ref={evidenceVideoRef}
                    src={playbackUrl}
                    className="mt-4 aspect-video w-full rounded-[0.75rem] bg-black object-cover"
                    controls
                    playsInline
                    preload="metadata"
                  />
                </details>
              ) : null}
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
