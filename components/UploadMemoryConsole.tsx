"use client"

import { useEffect, useRef, useState } from "react"
import { Upload, Video } from "lucide-react"
import { applySessionEvent } from "@/lib/session/applySessionEvent"
import { createSessionState } from "@/lib/session/createSessionState"
import { formatClockMs } from "@/lib/session/clock"
import { undoSessionEvent } from "@/lib/session/undoSessionEvent"
import type { SessionMode, SessionSetupInput, TeamSide } from "@/lib/session/types"
import { createClient } from "@/lib/supabase/client"
import {
  parseUploadResponseText,
  type AxisUploadResponse,
} from "@/lib/uploadResponse"

const waveformBars = [42, 72, 48, 86, 56, 64, 94, 44, 78, 52, 88, 60, 46, 82]
const showDebug = process.env.NODE_ENV !== "production"
type UploadSource = "camera" | "upload"
type ClockAction = "toggle" | "reset"

const gameSetup: SessionSetupInput = {
  mode: "GAME",
  sessionName: "Open run",
  leftLabel: "Black",
  rightLabel: "Gold",
  startingLeftScore: 0,
  startingRightScore: 0,
  clockEnabled: true,
  periodLengthMinutes: 8,
}

const repSetup: SessionSetupInput = {
  mode: "REP",
  drillName: "Corner threes",
  durationMinutes: 5,
  targetMakes: 25,
  clockEnabled: true,
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
  if (data.ok) return "Playback ready."
  if (data.recovery) return "Playback ready."
  if (data.stored) return "Playback ready."
  if (data.error) return "Still processing..."

  return "Still processing..."
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
      mission: "Replay memory",
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
      const duration = Number.isFinite(video.duration) ? video.duration : 0

      resolve({
        duration,
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

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** index

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

function modeSetup(mode: SessionMode): SessionSetupInput {
  return mode === "GAME" ? gameSetup : repSetup
}

export default function UploadMemoryConsole() {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const recordInputRef = useRef<HTMLInputElement | null>(null)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const localVideoUrlRef = useRef<string | null>(null)
  const [setup, setSetup] = useState<SessionSetupInput>(gameSetup)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionState, setSessionState] = useState(() => createSessionState(gameSetup))
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState("")
  const [processingLine, setProcessingLine] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [debugTraceId, setDebugTraceId] = useState("")
  const [playbackUrl, setPlaybackUrl] = useState("")
  const [playbackTitle, setPlaybackTitle] = useState("")
  const [durationLabel, setDurationLabel] = useState("0:00")
  const [fileSizeLabel, setFileSizeLabel] = useState("")
  const [createdLabel, setCreatedLabel] = useState("")
  const [debugLines, setDebugLines] = useState<string[]>([])

  function addDebug(line: string) {
    if (!showDebug) return

    setDebugLines((lines) => [...lines, line].slice(-12))
  }

  useEffect(
    () => () => {
      if (localVideoUrlRef.current) {
        URL.revokeObjectURL(localVideoUrlRef.current)
      }
    },
    []
  )

  useEffect(() => {
    if (!sessionState.clockEnabled || !sessionState.clockRunning) return

    const interval = window.setInterval(() => {
      setSessionState((state) => {
        if (!state.clockEnabled || !state.clockRunning) return state

        const nextClockMs = Math.max(0, state.clockMs - 1000)

        return {
          ...state,
          clockMs: nextClockMs,
          clockRunning: nextClockMs > 0,
          updatedAt: Date.now(),
        }
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [sessionState.clockEnabled, sessionState.clockRunning])

  function switchMode(mode: SessionMode) {
    const nextSetup = modeSetup(mode)

    setSetup(nextSetup)
    setSessionState(createSessionState(nextSetup))
    setSessionStarted(false)
  }

  function startSession() {
    setSessionState(createSessionState(setup))
    setSessionStarted(true)
    setStatus("")
  }

  function currentReplayTimestamp() {
    return Math.max(0, Math.floor(previewRef.current?.currentTime || 0))
  }

  function score(side: TeamSide, points: 1 | 2 | 3) {
    setSessionState((state) =>
      applySessionEvent({
        state,
        event: {
          type: "SCORE",
          side,
          points,
          replayTimestamp: currentReplayTimestamp(),
        },
      })
    )
  }

  function markRep(type: "MAKE" | "MISS") {
    setSessionState((state) =>
      applySessionEvent({
        state,
        event: {
          type,
          replayTimestamp: currentReplayTimestamp(),
        },
      })
    )
  }

  function undoEvent() {
    setSessionState((state) => undoSessionEvent(state))
  }

  function updateClock(action: ClockAction) {
    setSessionState((state) => {
      if (!state.clockEnabled) return state

      if (action === "reset") {
        return {
          ...state,
          clockRunning: false,
          clockMs: state.periodLengthMs || state.clockMs,
          updatedAt: Date.now(),
        }
      }

      return {
        ...state,
        clockRunning: !state.clockRunning,
        updatedAt: Date.now(),
      }
    })
  }

  async function chooseFile(file: File | undefined, source: UploadSource = "upload") {
    if (!file || isUploading) return

    setIsUploading(true)
    setStatus("Preparing playback")
    setProcessingLine("Reading the footage")
    setUploadProgress(0)
    setDebugTraceId("")
    setDebugLines([])
    setFileSizeLabel("")
    setCreatedLabel("")
    const uploadInfo = mobileUploadInfo(file)
    setDebugTraceId(uploadInfo.traceId)
    addDebug(`source: ${source}`)
    addDebug(`file selected: ${file.name || uploadInfo.uploadName}`)
    addDebug(`file type: ${file.type || uploadInfo.uploadType}`)
    addDebug(`file size: ${formatBytes(file.size)}`)

    console.info("AXIS MOBILE UPLOAD", {
      traceId: uploadInfo.traceId,
      stage: "upload-start",
      file: {
        name: file.name,
        type: file.type || "missing",
        size: file.size,
        lastModified: file.lastModified,
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
      setPlaybackTitle(file.name || "Basketball footage")
      setFileSizeLabel(formatBytes(file.size))
      setStatus("Playback ready. Saving video.")
      setProcessingLine("Your footage is safe here first.")
      setSessionState((state) => ({
        ...state,
        playback: {
          ...state.playback,
          videoUrl: localUrl,
          fileName: file.name || "Basketball footage",
        },
        updatedAt: Date.now(),
      }))
      void previewRef.current?.play().catch(() => undefined)

      const metadata = await readVideoMetadata(localUrl)
      const safeDuration = Math.max(0, Math.floor(metadata.duration))
      const minutes = Math.floor(safeDuration / 60)
      const seconds = safeDuration % 60
      setDurationLabel(`${minutes}:${seconds.toString().padStart(2, "0")}`)
      localVideoUrlRef.current = metadata.url
      setSessionState((state) => ({
        ...state,
        playback: {
          ...state.playback,
          durationSeconds: metadata.duration,
        },
        updatedAt: Date.now(),
      }))

      setStatus("Uploading video")
      setProcessingLine("Saving directly to playback storage.")
      setUploadProgress(12)
      addDebug("upload started")

      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error(userError?.message || "Sign in required")
      }

      const filePath = `${user.id}/${safeStorageName(uploadInfo.uploadName)}`
      addDebug(`storage path: ${filePath}`)
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

        if (uploaded.error) {
          addDebug(`storage failure: ${uploaded.error.message}`)
          throw uploaded.error
        }

        addDebug("storage success")
        setUploadProgress(78)
        setProcessingLine("Playback copy saved. Opening it now.")

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
          addDebug("playback URL created")
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
        setCreatedLabel(new Date(result.createdAt || Date.now()).toLocaleString())
        addDebug(
          result.replayId
            ? `database insert success: ${result.replayId}`
            : "database insert deferred"
        )
        setProcessingLine("Playback ready.")
      } catch (error) {
        addDebug(
          `storage failure: ${error instanceof Error ? error.message : "unknown"}`
        )
        console.warn("AXIS DIRECT UPLOAD RETRY", {
          traceId: uploadInfo.traceId,
          error,
        })
        setStatus("Still processing...")
        setProcessingLine("Connection paused. Retrying quietly.")
        setUploadProgress(18)
        await new Promise((resolve) => window.setTimeout(resolve, 900))

        const retryPath = `${user.id}/${safeStorageName(uploadInfo.uploadName)}`
        const retry = await supabase.storage
          .from("axis-replays")
          .upload(retryPath, uploadInfo.uploadFile, {
            contentType: uploadInfo.uploadType,
            upsert: false,
          })

        if (retry.error) {
          addDebug(`storage failure: ${retry.error.message}`)
          throw retry.error
        }

        addDebug("storage success")
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
          addDebug("playback URL created")
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
        setCreatedLabel(new Date(result.createdAt || Date.now()).toLocaleString())
        addDebug(
          result.replayId
            ? `database insert success: ${result.replayId}`
            : "database insert deferred"
        )
        setProcessingLine("Playback ready.")
      }
    } catch (error) {
      console.error("UPLOAD MEMORY FAILED", error)
      addDebug(
        `database insert failure: ${
          error instanceof Error ? error.message : "unknown"
        }`
      )
      setStatus("Still processing...")
      setProcessingLine("Playback stays here. Axis will keep trying.")
    } finally {
      setIsUploading(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ""
      if (recordInputRef.current) recordInputRef.current.value = ""
    }
  }

  const isGame = sessionState.mode === "GAME"
  const metrics = sessionState.metrics

  return (
    <main className="min-h-screen bg-[#0a0907] px-4 py-5 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <span className="text-sm font-black text-white/85">Axis</span>
        </header>

        <section
          id="upload"
          className="grid min-h-[78vh] gap-10 py-8 lg:grid-cols-[1fr_420px] lg:items-center"
        >
          <div>
            <p className="text-sm font-bold text-white/38">
              Basketball ledger
            </p>
            <h1 className="mt-4 max-w-4xl text-6xl font-black leading-[0.9] tracking-[-0.065em] text-white sm:text-8xl">
              Tally. Time. Replay.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/48">
              Every tap becomes a timestamp, a replay anchor, and a measurable
              basketball memory.
            </p>

            {!sessionStarted ? (
              <div className="mt-8 grid gap-3 sm:max-w-xl">
                <div className="grid grid-cols-2 gap-2">
                  {(["GAME", "REP"] as SessionMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => switchMode(mode)}
                      className={`min-h-14 rounded-[0.75rem] text-xs font-black uppercase tracking-[0.14em] transition ${
                        setup.mode === mode
                          ? "bg-amber-200 text-black"
                          : "bg-white/[0.06] text-white/58 hover:bg-white/[0.1]"
                      }`}
                    >
                      {mode} mode
                    </button>
                  ))}
                </div>

                {setup.mode === "GAME" ? (
                  <>
                    <input
                      value={setup.sessionName}
                      onChange={(event) =>
                        setSetup((value) =>
                          value.mode === "GAME"
                            ? { ...value, sessionName: event.target.value }
                            : value
                        )
                      }
                      placeholder="Session name"
                      className="rounded-[0.75rem] bg-white/[0.06] px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={setup.leftLabel}
                        onChange={(event) =>
                          setSetup((value) =>
                            value.mode === "GAME"
                              ? { ...value, leftLabel: event.target.value }
                              : value
                          )
                        }
                        placeholder="Left team name"
                        className="rounded-[0.75rem] bg-white/[0.06] px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
                      />
                      <input
                        value={setup.rightLabel}
                        onChange={(event) =>
                          setSetup((value) =>
                            value.mode === "GAME"
                              ? { ...value, rightLabel: event.target.value }
                              : value
                          )
                        }
                        placeholder="Right team name"
                        className="rounded-[0.75rem] bg-white/[0.06] px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <input
                        value={setup.startingLeftScore}
                        type="number"
                        min={0}
                        onChange={(event) =>
                          setSetup((value) =>
                            value.mode === "GAME"
                              ? {
                                  ...value,
                                  startingLeftScore: Number(event.target.value),
                                }
                              : value
                          )
                        }
                        placeholder="Left score"
                        className="rounded-[0.75rem] bg-white/[0.06] px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
                      />
                      <input
                        value={setup.startingRightScore}
                        type="number"
                        min={0}
                        onChange={(event) =>
                          setSetup((value) =>
                            value.mode === "GAME"
                              ? {
                                  ...value,
                                  startingRightScore: Number(event.target.value),
                                }
                              : value
                          )
                        }
                        placeholder="Right score"
                        className="rounded-[0.75rem] bg-white/[0.06] px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
                      />
                      <input
                        value={setup.periodLengthMinutes || ""}
                        type="number"
                        min={1}
                        onChange={(event) =>
                          setSetup((value) =>
                            value.mode === "GAME"
                              ? {
                                  ...value,
                                  periodLengthMinutes: Number(event.target.value),
                                }
                              : value
                          )
                        }
                        placeholder="Period min"
                        className="rounded-[0.75rem] bg-white/[0.06] px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      value={setup.drillName}
                      onChange={(event) =>
                        setSetup((value) =>
                          value.mode === "REP"
                            ? { ...value, drillName: event.target.value }
                            : value
                        )
                      }
                      placeholder="Drill name"
                      className="rounded-[0.75rem] bg-white/[0.06] px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={setup.durationMinutes}
                        type="number"
                        min={1}
                        onChange={(event) =>
                          setSetup((value) =>
                            value.mode === "REP"
                              ? {
                                  ...value,
                                  durationMinutes: Number(event.target.value),
                                }
                              : value
                          )
                        }
                        placeholder="Duration min"
                        className="rounded-[0.75rem] bg-white/[0.06] px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
                      />
                      <input
                        value={setup.targetMakes || ""}
                        type="number"
                        min={0}
                        onChange={(event) =>
                          setSetup((value) =>
                            value.mode === "REP"
                              ? {
                                  ...value,
                                  targetMakes: Number(event.target.value),
                                }
                              : value
                          )
                        }
                        placeholder="Target makes"
                        className="rounded-[0.75rem] bg-white/[0.06] px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-white/25"
                      />
                    </div>
                  </>
                )}

                <label className="flex items-center gap-3 text-sm font-bold text-white/58">
                  <input
                    type="checkbox"
                    checked={setup.clockEnabled}
                    onChange={(event) =>
                      setSetup((value) => ({
                        ...value,
                        clockEnabled: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-amber-200"
                  />
                  Enable clock: {setup.clockEnabled ? "YES" : "NO"}
                </label>
                <button
                  type="button"
                  onClick={startSession}
                  className="min-h-16 rounded-[0.75rem] bg-amber-200 px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:bg-amber-100"
                >
                  Start session
                </button>
              </div>
            ) : (
              <div className="mt-8 max-w-xl rounded-[0.75rem] bg-white/[0.04] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/32">
                  {sessionState.sessionName}
                </p>
                {isGame ? (
                  <div className="mt-3 text-4xl font-black leading-none tracking-[-0.05em] text-white sm:text-5xl">
                    {sessionState.leftLabel} {sessionState.leftScore} -{" "}
                    {sessionState.rightScore} {sessionState.rightLabel}
                  </div>
                ) : (
                  <div className="mt-3 text-5xl font-black leading-none tracking-[-0.05em] text-white sm:text-6xl">
                    {sessionState.makes || 0} makes / {sessionState.misses || 0} misses
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold text-amber-100/72">
                  {isGame ? <span>Q{sessionState.period}</span> : null}
                  <span>
                    {sessionState.clockEnabled
                      ? formatClockMs(sessionState.clockMs)
                      : "Open clock"}
                  </span>
                  <span>
                    {isGame
                      ? sessionState.runState.label
                      : `${metrics.attemptsPerMinute} attempts/min`}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-9 grid gap-3 sm:max-w-md">
              <button
                type="button"
                onClick={() => recordInputRef.current?.click()}
                disabled={isUploading}
                className="order-1 inline-flex min-h-24 items-center justify-center gap-3 rounded-[0.75rem] bg-amber-200 px-8 py-5 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:bg-amber-100 disabled:opacity-50 sm:order-2"
              >
                <Video className="h-4 w-4" aria-hidden="true" />
                Record play
              </button>
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isUploading}
                className="order-2 inline-flex min-h-24 items-center justify-center gap-3 rounded-[0.75rem] bg-stone-100 px-8 py-5 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:bg-white disabled:opacity-50 sm:order-1"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {isUploading ? "Uploading" : "Upload clip"}
              </button>
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
              {status ? <p className="text-sm font-bold text-white/42">{status}</p> : null}
            </div>
            {processingLine ? (
              <p className="mt-5 text-2xl font-black tracking-[-0.04em] text-amber-100/80">
                {processingLine}
              </p>
            ) : null}
            {isUploading || uploadProgress > 0 ? (
              <div className="mt-5 max-w-sm">
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-amber-100 transition-all duration-500"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-bold text-white/35">
                  {uploadProgress
                    ? `${uploadProgress}% uploaded`
                    : "Playback appears as soon as the video is ready"}
                </p>
                {debugTraceId ? (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/20">
                    trace {debugTraceId.slice(0, 8)}
                  </p>
                ) : null}
              </div>
            ) : null}
            {sessionStarted ? (
              <div className="mt-8 grid max-w-xl gap-4">
                {isGame ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/34">
                        {sessionState.leftLabel}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((points) => (
                          <button
                            key={`left-${points}`}
                            type="button"
                            onClick={() => score("LEFT", points as 1 | 2 | 3)}
                            className="min-h-16 rounded-[0.75rem] bg-white/[0.06] text-2xl font-black text-white transition hover:bg-amber-100 hover:text-black"
                          >
                            +{points}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/34">
                        {sessionState.rightLabel}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((points) => (
                          <button
                            key={`right-${points}`}
                            type="button"
                            onClick={() => score("RIGHT", points as 1 | 2 | 3)}
                            className="min-h-16 rounded-[0.75rem] bg-white/[0.06] text-2xl font-black text-white transition hover:bg-amber-100 hover:text-black"
                          >
                            +{points}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => markRep("MAKE")}
                      className="min-h-24 rounded-[0.75rem] bg-amber-200 text-2xl font-black uppercase tracking-[0.12em] text-black transition hover:bg-amber-100"
                    >
                      Make
                    </button>
                    <button
                      type="button"
                      onClick={() => markRep("MISS")}
                      className="min-h-24 rounded-[0.75rem] bg-white/[0.06] text-2xl font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/[0.1]"
                    >
                      Miss
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={undoEvent}
                    className="min-h-14 rounded-[0.75rem] bg-white/[0.04] text-xs font-black uppercase tracking-[0.12em] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={() => updateClock("toggle")}
                    disabled={!sessionState.clockEnabled}
                    className="min-h-14 rounded-[0.75rem] bg-white/[0.04] text-xs font-black uppercase tracking-[0.12em] text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
                  >
                    {sessionState.clockRunning ? "Stop clock" : "Start clock"}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateClock("reset")}
                    disabled={!sessionState.clockEnabled}
                    className="min-h-14 rounded-[0.75rem] bg-white/[0.04] text-xs font-black uppercase tracking-[0.12em] text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
                  >
                    Reset clock
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[1.5rem] bg-[#16120d] shadow-[0_42px_140px_rgba(0,0,0,0.55)]">
            <div className="aspect-[9/14] bg-[#0a0907]">
              {playbackUrl ? (
                <video
                  ref={previewRef}
                  src={playbackUrl}
                  className="h-full w-full object-cover opacity-80"
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_center,#2a2117_0%,#090806_68%)] px-8 text-center">
                  <p className="text-4xl font-black leading-none tracking-[-0.05em] text-white">
                    Playback appears here.
                  </p>
                </div>
              )}
            </div>
            <div className="p-6">
              <p className="text-sm font-bold text-amber-100/65">
                {durationLabel}
              </p>
              <p className="mt-3 text-4xl font-black leading-[0.95] tracking-[-0.05em] text-white">
                {playbackUrl ? "PLAYBACK READY" : "READY"}
              </p>
              <p className="mt-4 text-sm leading-6 text-white/42">
                {playbackTitle || "The saved video becomes watchable first."}
              </p>
              <div className="mt-5 grid gap-2 text-sm text-white/38">
                {fileSizeLabel ? <p>Size: {fileSizeLabel}</p> : null}
                {createdLabel ? <p>Saved: {createdLabel}</p> : null}
                {playbackUrl ? (
                  <p className="break-all">Playback URL: {playbackUrl}</p>
                ) : null}
              </div>
              {sessionStarted && !isGame ? (
                <div className="mt-6 grid gap-2 border-t border-white/10 pt-5 text-sm text-white/46">
                  <p>Attempts: {metrics.attempts}</p>
                  <p>Make rate: {percent(metrics.makeRate)}</p>
                  <p>Best stretch: {metrics.heatWindow.makes} makes in {metrics.heatWindow.seconds} seconds.</p>
                  <p>Longest empty stretch: {metrics.droughtSeconds} seconds.</p>
                  <p>
                    Shot changed from {percent(metrics.earlyRate)} early to{" "}
                    {percent(metrics.lateRate)} late.
                  </p>
                  <p>
                    {metrics.rushChange
                      ? `Shoots ${Math.abs(metrics.rushChange)}% ${
                          metrics.rushChange > 0 ? "faster" : "slower"
                        } after misses.`
                      : "No post-miss pace change yet."}
                  </p>
                  <p>{metrics.rhythmWindow}</p>
                </div>
              ) : null}
              {sessionState.timeline.length ? (
                <div className="mt-6 grid gap-3 border-t border-white/10 pt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/30">
                    Replay memory
                  </p>
                  {sessionState.timeline.slice(0, 6).map((event) => (
                    <article key={event.id} className="rounded-[0.75rem] bg-black/24 p-4">
                      <p className="text-xs font-bold text-amber-100/58">
                        [{event.gameClock}]
                      </p>
                      <p className="mt-2 text-lg font-black tracking-[-0.03em] text-white">
                        {event.type === "SCORE"
                          ? `${event.sideLabel} +${event.points}`
                          : event.type}
                      </p>
                      <p className="mt-1 text-sm text-white/42">{event.label}</p>
                    </article>
                  ))}
                </div>
              ) : null}
              <div className="mt-6 flex h-12 items-end gap-1">
                {waveformBars.map((height, index) => (
                  <span
                    key={`${height}-${index}`}
                    className={`w-full rounded-full transition ${
                      isUploading && index % 3 === 0
                        ? "bg-amber-100/70"
                        : "bg-white/16"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              {showDebug && debugLines.length ? (
                <div className="mt-6 border-t border-white/10 pt-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/24">
                    Debug
                  </p>
                  <div className="mt-3 grid gap-1 text-xs text-white/38">
                    {debugLines.map((line, index) => (
                      <p key={`${line}-${index}`}>{line}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
