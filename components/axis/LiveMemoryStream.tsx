"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  type LiveArchiveSession,
  type LiveIngestEvent,
  type LiveIngestEventType,
  type LiveSessionStatus,
  loadArchivedRecording,
  saveArchivedRecording,
} from "@/lib/liveArchive"
import { defaultReplayWindow, type TemporalEventType } from "@/lib/temporalEventGraph"

type WorkingSession = {
  id: string
  status: Exclude<LiveSessionStatus, "ARCHIVED">
  startedAt: string
  endedAt: string | null
  duration: number
  playbackUrl: string | null
  storagePath: string | null
  createdAt: string
}

const recorderTypes = [
  "video/mp4;codecs=h264,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm",
]

const reconnectDebounceMs = 1400
const trackFailureGraceMs = 5200

function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function createId(prefix = "axis") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getRecorderType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return ""
  }

  return recorderTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
}

function extensionForType(type: string) {
  return type.includes("mp4") ? "mp4" : "webm"
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as T & {
    ok?: boolean
    error?: string
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "REQUEST_FAILED")
  }

  return data
}

export function LiveMemoryStream() {
  const [status, setStatus] = useState<LiveSessionStatus>("READY")
  const [elapsed, setElapsed] = useState(0)
  const [errorMessage, setErrorMessage] = useState("")
  const [archivedRecording, setArchivedRecording] = useState<LiveArchiveSession | null>(null)

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const workingSessionRef = useRef<WorkingSession | null>(null)
  const eventsRef = useRef<LiveIngestEvent[]>([])
  const eventSequenceRef = useRef(0)
  const startedAtMsRef = useRef(0)
  const elapsedRef = useRef(0)
  const elapsedTimerRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const trackFailureTimerRef = useRef<number | null>(null)
  const openingCameraRef = useRef(false)
  const finalizingRef = useRef(false)
  const hardStoppedRef = useRef(false)
  const statusRef = useRef<LiveSessionStatus>("READY")

  const setLiveStatus = useCallback((nextStatus: LiveSessionStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
    if (workingSessionRef.current && nextStatus !== "ARCHIVED") {
      workingSessionRef.current.status = nextStatus as WorkingSession["status"]
    }
  }, [])

  const emitEvent = useCallback(
    (type: LiveIngestEventType, metadata?: Record<string, unknown>) => {
      const event: LiveIngestEvent = {
        id: `${workingSessionRef.current?.id ?? "pending"}-${eventSequenceRef.current++}`,
        type,
        createdAt: new Date().toISOString(),
        sessionTime: elapsedRef.current,
        metadata,
      }

      eventsRef.current = [...eventsRef.current, event]
      return event
    },
    []
  )

  const appendTemporalEvent = useCallback(
    (type: TemporalEventType, metadata?: Record<string, unknown>) => {
      const session = workingSessionRef.current
      if (!session) return

      const sessionTime = elapsedRef.current
      const eventId = createId("axis-event")

      void postJson("/api/live/event", {
        id: eventId,
        sessionId: session.id,
        type,
        sessionTime,
        payload: {
          replay_window: defaultReplayWindow(),
          ...(metadata || {}),
        },
      }).catch(() => undefined)
    },
    []
  )

  const clearReconnectTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    if (trackFailureTimerRef.current) {
      window.clearTimeout(trackFailureTimerRef.current)
      trackFailureTimerRef.current = null
    }
  }, [])

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      window.clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
  }, [])

  const setFailure = useCallback(
    (message: string) => {
      clearReconnectTimers()
      emitEvent("session_failed", {
        reason: message,
      })
      setErrorMessage(message)
      setLiveStatus("FAILED")
    },
    [clearReconnectTimers, emitEvent, setLiveStatus]
  )

  const beginReconnect = useCallback(
    (reason: string) => {
      if (hardStoppedRef.current || finalizingRef.current) return
      if (statusRef.current !== "LIVE") return
      if (reconnectTimerRef.current) return

      emitEvent("reconnect_begin", {
        reason,
      })

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        if (statusRef.current === "LIVE") setLiveStatus("RECONNECTING")
      }, reconnectDebounceMs)
    },
    [emitEvent, setLiveStatus]
  )

  const resolveReconnect = useCallback(
    (reason: string) => {
      const wasReconciling = Boolean(reconnectTimerRef.current) || statusRef.current === "RECONNECTING"
      clearReconnectTimers()

      if (wasReconciling) {
        emitEvent("reconnect_success", {
          reason,
        })
      }

      if (statusRef.current === "RECONNECTING") setLiveStatus("LIVE")
    },
    [clearReconnectTimers, emitEvent, setLiveStatus]
  )

  const cleanupCamera = useCallback(() => {
    clearReconnectTimers()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
  }, [clearReconnectTimers])

  const openCamera = useCallback(async () => {
    if (localStreamRef.current || openingCameraRef.current) return localStreamRef.current

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera unavailable")
    }

    openingCameraRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
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

      localStreamRef.current = stream

      stream.getTracks().forEach((track) => {
        track.addEventListener("mute", () => beginReconnect("track_muted"))
        track.addEventListener("unmute", () => resolveReconnect("track_unmuted"))
        track.addEventListener("ended", () => {
          if (hardStoppedRef.current || finalizingRef.current) return
          beginReconnect("track_ended")
          trackFailureTimerRef.current = window.setTimeout(() => {
            if (!hardStoppedRef.current && !finalizingRef.current) {
              setFailure("Camera stopped")
            }
          }, trackFailureGraceMs)
        })
      })

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        await localVideoRef.current.play().catch(() => undefined)
      }

      return stream
    } finally {
      openingCameraRef.current = false
    }
  }, [beginReconnect, resolveReconnect, setFailure])

  const startElapsedTimer = useCallback(() => {
    stopElapsedTimer()
    elapsedTimerRef.current = window.setInterval(() => {
      if (!startedAtMsRef.current) return
      const nextElapsed = (Date.now() - startedAtMsRef.current) / 1000
      elapsedRef.current = nextElapsed
      setElapsed(nextElapsed)
    }, 500)
  }, [stopElapsedTimer])

  const startSession = async () => {
    if (statusRef.current === "STARTING" || statusRef.current === "LIVE" || statusRef.current === "FINALIZING") {
      return
    }

    try {
      setErrorMessage("")
      setLiveStatus("STARTING")
      hardStoppedRef.current = false
      chunksRef.current = []
      eventsRef.current = []
      eventSequenceRef.current = 0
      elapsedRef.current = 0

      const createdAt = new Date().toISOString()
      const sessionId = createId("axis-live")

      workingSessionRef.current = {
        id: sessionId,
        status: "STARTING",
        startedAt: createdAt,
        endedAt: null,
        duration: 0,
        playbackUrl: null,
        storagePath: null,
        createdAt,
      }

      await postJson("/api/live/session", {
        id: sessionId,
        startedAt: createdAt,
        status: "STARTING",
      })

      emitEvent("session_started")
      appendTemporalEvent("SESSION_STARTED")

      const stream = await openCamera()
      if (!stream) throw new Error("Camera unavailable")

      emitEvent("stream_connected", {
        tracks: stream.getTracks().map((track) => track.kind),
      })
      appendTemporalEvent("STREAM_CONNECTED", {
        tracks: stream.getTracks().map((track) => track.kind),
      })

      if (typeof MediaRecorder === "undefined") {
        throw new Error("Recording unavailable")
      }

      const recorderType = getRecorderType()
      const recorder = new MediaRecorder(
        stream,
        recorderType
          ? {
              mimeType: recorderType,
              videoBitsPerSecond: 2400000,
              audioBitsPerSecond: 128000,
            }
          : {
              videoBitsPerSecond: 2400000,
              audioBitsPerSecond: 128000,
            }
      )

      recorder.ondataavailable = (event) => {
        if (!event.data.size) return

        chunksRef.current.push(event.data)
        emitEvent("chunk_recorded", {
          index: chunksRef.current.length - 1,
          size: event.data.size,
          type: event.data.type,
        })
      }
      recorder.onerror = () => setFailure("Recording failed")

      startedAtMsRef.current = Date.now()
      recorderRef.current = recorder
      recorder.start(1000)
      setElapsed(0)
      startElapsedTimer()
      setLiveStatus("LIVE")
    } catch (error) {
      stopElapsedTimer()
      cleanupCamera()
      setFailure(error instanceof Error ? error.message : "Session failed")
    }
  }

  const finalizeSession = async () => {
    const session = workingSessionRef.current

    if (
      !session ||
      (statusRef.current !== "LIVE" && statusRef.current !== "RECONNECTING") ||
      !recorderRef.current
    ) {
      return
    }

    setLiveStatus("FINALIZING")
    stopElapsedTimer()
    clearReconnectTimers()
    finalizingRef.current = true
    hardStoppedRef.current = true
    emitEvent("archive_started")
    appendTemporalEvent("ARCHIVE_STARTED")

    try {
      const recorder = recorderRef.current
      const stopped = new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), {
          once: true,
        })
      })

      if (recorder.state !== "inactive") {
        recorder.requestData()
        recorder.stop()
        await stopped
      }

      cleanupCamera()

      const endedAt = new Date().toISOString()
      const duration = startedAtMsRef.current
        ? (Date.now() - startedAtMsRef.current) / 1000
        : elapsedRef.current
      const type = recorder.mimeType || chunksRef.current[0]?.type || "video/webm"
      const blob = new Blob(chunksRef.current, {
        type,
      })

      if (!blob.size) {
        throw new Error("No recording data saved")
      }

      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("Sign in required to archive")
      }

      const extension = extensionForType(type)
      const fileName = safeFileName(`axis-live-${session.id}.${extension}`)
      const storagePath = `${user.id}/live/${fileName}`
      const file =
        typeof File !== "undefined"
          ? new File([blob], fileName, {
              type,
              lastModified: Date.now(),
            })
          : blob

      const uploaded = await supabase.storage
        .from("axis-replays")
        .upload(storagePath, file, {
          cacheControl: "3600",
          contentType: type,
          upsert: false,
        })

      if (uploaded.error) throw uploaded.error

      const completed = await fetch("/api/upload/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          traceId: session.id,
          filePath: storagePath,
          fileName,
          contentType: type,
          sizeBytes: blob.size,
          durationSeconds: duration,
          source: "camera",
          environment: "practice",
          mission: "Live recording",
          client: {
            mode: "live-v1",
          },
        }),
      })

      const result = (await completed.json().catch(() => ({}))) as {
        ok?: boolean
        replayId?: string
        videoUrl?: string
        error?: string
      }

      if (!completed.ok || !result.ok || !result.videoUrl) {
        throw new Error(result.error || "Archive record failed")
      }

      const archiveResult = await postJson<{
        session?: {
          id: string
          playback_url?: string
        }
      }>("/api/live/archive", {
        sessionId: session.id,
        endedAt,
        durationSeconds: duration,
        playbackUrl: result.videoUrl,
        storagePath,
      })

      if (!archiveResult.session?.id) {
        throw new Error("Archive session failed")
      }

      const completedEvent = emitEvent("archive_completed", {
        replayId: result.replayId,
        size: blob.size,
        storagePath,
      })

      const archived: LiveArchiveSession = {
        id: session.id,
        startedAt: session.startedAt,
        endedAt,
        duration,
        playbackUrl: result.videoUrl,
        videoUrl: result.videoUrl,
        storagePath,
        status: "ARCHIVED",
        createdAt: session.createdAt,
        events: [...eventsRef.current.filter((event) => event.id !== completedEvent.id), completedEvent],
      }

      saveArchivedRecording(archived)
      setArchivedRecording(archived)
      elapsedRef.current = duration
      setElapsed(duration)
      workingSessionRef.current = null
      setLiveStatus("ARCHIVED")
    } catch (error) {
      cleanupCamera()
      emitEvent("archive_failed", {
        reason: error instanceof Error ? error.message : "Archive failed",
      })
      appendTemporalEvent("ARCHIVE_FAILED", {
        reason: error instanceof Error ? error.message : "Archive failed",
      })
      setFailure(error instanceof Error ? error.message : "Archive failed")
    } finally {
      finalizingRef.current = false
      recorderRef.current = null
      chunksRef.current = []
    }
  }

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const archived = loadArchivedRecording()
      if (archived) setArchivedRecording(archived)
    }, 0)

    openCamera().catch((error) => {
      setFailure(error instanceof Error ? error.message : "Camera failed")
    })

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.requestData()
        }
        beginReconnect("page_hidden")
        return
      }

      resolveReconnect("page_visible")
      if (!localStreamRef.current && statusRef.current !== "FINALIZING" && statusRef.current !== "ARCHIVED") {
        openCamera().catch((error) => {
          setFailure(error instanceof Error ? error.message : "Camera failed")
        })
      }
    }

    const requestRecorderData = () => {
      if (finalizingRef.current) return
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.requestData()
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("pagehide", requestRecorderData)
    window.addEventListener("beforeunload", requestRecorderData)

    return () => {
      window.clearTimeout(hydrationTimer)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("pagehide", requestRecorderData)
      window.removeEventListener("beforeunload", requestRecorderData)
      hardStoppedRef.current = true
      stopElapsedTimer()
      clearReconnectTimers()
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop()
      }
      cleanupCamera()
    }
  }, [
    beginReconnect,
    cleanupCamera,
    clearReconnectTimers,
    openCamera,
    resolveReconnect,
    setFailure,
    stopElapsedTimer,
  ])

  const hasRecentArchive = Boolean(archivedRecording)

  return (
    <main className="h-dvh overflow-hidden bg-black text-zinc-100">
      <section className="relative h-dvh overflow-hidden bg-black">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.76),transparent_31%,transparent_68%,rgba(0,0,0,0.86))]" />

        <header className="absolute left-4 right-4 top-4 z-20 border-b border-white/10 bg-black/46 px-4 py-3 backdrop-blur-sm">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-zinc-100">
              AXIS
            </p>
            <div className="h-px bg-white/16" />
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  status === "LIVE"
                    ? "bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.85)]"
                    : status === "RECONNECTING"
                      ? "bg-amber-200 shadow-[0_0_14px_rgba(253,230,138,0.62)]"
                      : status === "FAILED"
                        ? "bg-red-300"
                        : "bg-zinc-300/80"
                }`}
              />
              <span className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-100">
                {status}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Session
              </p>
              <p className="mt-1 font-mono text-4xl font-black leading-none text-zinc-100">
                {formatClock(elapsed)}
              </p>
            </div>
            {archivedRecording ? (
              <Link
                href={`/session/${archivedRecording.id}`}
                className="border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-100"
              >
                Last record
              </Link>
            ) : null}
          </div>
        </header>

        {status === "ARCHIVED" && archivedRecording ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/78 px-6 text-center backdrop-blur-sm">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
                ARCHIVED
              </p>
              <p className="mt-5 font-mono text-5xl font-black uppercase text-zinc-100 sm:text-7xl">
                {formatClock(archivedRecording.duration)}
              </p>
              <div className="mt-7 flex justify-center gap-3">
                <Link
                  href={`/session/${archivedRecording.id}`}
                  className="border border-white/10 bg-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black"
                >
                  Open recording
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage("")
                    setElapsed(0)
                    elapsedRef.current = 0
                    setLiveStatus("READY")
                    openCamera().catch((error) => {
                      setFailure(error instanceof Error ? error.message : "Camera failed")
                    })
                  }}
                  className="border border-white/10 bg-black/40 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100"
                >
                  New session
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {status === "FAILED" ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/78 px-6 text-center backdrop-blur-sm">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-red-200">
                FAILED
              </p>
              <p className="mt-4 max-w-sm text-sm font-bold uppercase tracking-[0.12em] text-zinc-300">
                {errorMessage || "Session failed"}
              </p>
              <button
                type="button"
                onClick={() => {
                  workingSessionRef.current = null
                  eventsRef.current = []
                  chunksRef.current = []
                  setLiveStatus("READY")
                  setErrorMessage("")
                  openCamera().catch((error) => {
                    setFailure(error instanceof Error ? error.message : "Camera failed")
                  })
                }}
                className="mt-7 border border-white/10 bg-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        <footer className="absolute bottom-5 left-4 right-4 z-20">
          <div className="mx-auto flex max-w-sm justify-center">
            {status === "READY" ? (
              <button
                type="button"
                onClick={() => void startSession()}
                className="w-full border border-white/10 bg-zinc-100 px-5 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-black active:bg-zinc-300"
              >
                Start
              </button>
            ) : null}

            {status === "STARTING" || status === "FINALIZING" || status === "RECONNECTING" ? (
              <div className="w-full border border-white/10 bg-black/54 px-5 py-4 text-center text-[11px] font-black uppercase tracking-[0.24em] text-zinc-300">
                {status}
              </div>
            ) : null}

            {status === "LIVE" ? (
              <div className="grid w-full grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => appendTemporalEvent("MARK")}
                  className="border border-white/10 bg-black/58 px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100 active:bg-white/10"
                >
                  Mark
                </button>
                <button
                  type="button"
                  onClick={() => appendTemporalEvent("SNAPSHOT")}
                  className="border border-white/10 bg-black/58 px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100 active:bg-white/10"
                >
                  Snap
                </button>
                <button
                  type="button"
                  onClick={() => appendTemporalEvent("TIMEOUT")}
                  className="border border-white/10 bg-black/58 px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100 active:bg-white/10"
                >
                  Timeout
                </button>
                <button
                  type="button"
                  onClick={() => void finalizeSession()}
                  className="border border-white/10 bg-zinc-100 px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black active:bg-zinc-300"
                >
                  End
                </button>
              </div>
            ) : null}
          </div>
          {hasRecentArchive && status === "READY" ? (
            <p className="mt-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Last recording stored
            </p>
          ) : null}
        </footer>
      </section>
    </main>
  )
}
