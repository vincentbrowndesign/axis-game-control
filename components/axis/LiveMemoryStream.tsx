"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type LiveStatus =
  | "READY"
  | "STARTING"
  | "LIVE"
  | "FINALIZING"
  | "ARCHIVED"
  | "FAILED"

type ArchivedRecording = {
  id: string
  startedAt: string
  endedAt: string
  duration: number
  videoUrl: string
  storagePath: string
  status: "ARCHIVED"
}

const archiveStorageKey = "axis-live-v1-archive"

const recorderTypes = [
  "video/mp4;codecs=h264,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm",
]

function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
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

function loadArchivedRecording() {
  if (typeof window === "undefined") return null

  try {
    const stored = window.localStorage.getItem(archiveStorageKey)
    if (!stored) return null

    const parsed = JSON.parse(stored) as Partial<ArchivedRecording>

    if (
      typeof parsed.id !== "string" ||
      typeof parsed.videoUrl !== "string" ||
      typeof parsed.storagePath !== "string" ||
      typeof parsed.duration !== "number" ||
      parsed.status !== "ARCHIVED"
    ) {
      return null
    }

    return parsed as ArchivedRecording
  } catch {
    window.localStorage.removeItem(archiveStorageKey)
    return null
  }
}

export function LiveMemoryStream() {
  const [status, setStatus] = useState<LiveStatus>("READY")
  const [elapsed, setElapsed] = useState(0)
  const [errorMessage, setErrorMessage] = useState("")
  const [archivedRecording, setArchivedRecording] = useState<ArchivedRecording | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const sessionIdRef = useRef("")
  const startedAtRef = useRef("")
  const startedAtMsRef = useRef(0)
  const elapsedTimerRef = useRef<number | null>(null)
  const openingCameraRef = useRef(false)
  const finalizingRef = useRef(false)
  const hardStoppedRef = useRef(false)

  const setFailure = useCallback((message: string) => {
    setErrorMessage(message)
    setStatus("FAILED")
  }, [])

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      window.clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
  }, [])

  const cleanupCamera = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
  }, [])

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
        track.addEventListener("ended", () => {
          if (!hardStoppedRef.current) setFailure("Camera stopped")
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
  }, [setFailure])

  const startElapsedTimer = useCallback(() => {
    stopElapsedTimer()
    elapsedTimerRef.current = window.setInterval(() => {
      if (!startedAtMsRef.current) return
      setElapsed((Date.now() - startedAtMsRef.current) / 1000)
    }, 500)
  }, [stopElapsedTimer])

  const startSession = async () => {
    if (status === "STARTING" || status === "LIVE" || status === "FINALIZING") return

    try {
      setErrorMessage("")
      setStatus("STARTING")
      hardStoppedRef.current = false
      chunksRef.current = []

      const stream = await openCamera()
      if (!stream) throw new Error("Camera unavailable")

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
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => setFailure("Recording failed")

      sessionIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `axis-${Date.now()}`
      startedAtMsRef.current = Date.now()
      startedAtRef.current = new Date(startedAtMsRef.current).toISOString()
      recorderRef.current = recorder
      recorder.start(1000)
      setElapsed(0)
      startElapsedTimer()
      setStatus("LIVE")
    } catch (error) {
      stopElapsedTimer()
      cleanupCamera()
      setFailure(error instanceof Error ? error.message : "Session failed")
    }
  }

  const finalizeSession = async () => {
    if (status !== "LIVE" || !recorderRef.current) return

    setStatus("FINALIZING")
    stopElapsedTimer()
    finalizingRef.current = true
    hardStoppedRef.current = true

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
        : elapsed
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
      const fileName = safeFileName(`axis-live-${sessionIdRef.current}.${extension}`)
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
          traceId: sessionIdRef.current,
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

      const archived: ArchivedRecording = {
        id: result.replayId || sessionIdRef.current,
        startedAt: startedAtRef.current,
        endedAt,
        duration,
        videoUrl: result.videoUrl,
        storagePath,
        status: "ARCHIVED",
      }

      window.localStorage.setItem(archiveStorageKey, JSON.stringify(archived))
      setArchivedRecording(archived)
      setElapsed(duration)
      setStatus("ARCHIVED")
    } catch (error) {
      cleanupCamera()
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
      if (document.visibilityState === "visible" && !localStreamRef.current) {
        openCamera().catch((error) => {
          setFailure(error instanceof Error ? error.message : "Camera failed")
        })
      }
    }

    const handlePageHide = () => {
      if (finalizingRef.current) return
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.requestData()
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      window.clearTimeout(hydrationTimer)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("pagehide", handlePageHide)
      stopElapsedTimer()
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop()
      }
      cleanupCamera()
    }
  }, [cleanupCamera, openCamera, setFailure, stopElapsedTimer])

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

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.72),transparent_32%,transparent_68%,rgba(0,0,0,0.82))]" />

        <header className="absolute left-4 right-4 top-4 z-20 border-b border-white/10 bg-black/42 px-4 py-3 backdrop-blur-sm">
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
              <a
                href={archivedRecording.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-100"
              >
                View record
              </a>
            ) : null}
          </div>
        </header>

        {status === "ARCHIVED" && archivedRecording ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/76 px-6 text-center backdrop-blur-sm">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
                ARCHIVED
              </p>
              <p className="mt-5 font-mono text-5xl font-black uppercase text-zinc-100 sm:text-7xl">
                {formatClock(archivedRecording.duration)}
              </p>
              <div className="mt-7 flex justify-center gap-3">
                <a
                  href={archivedRecording.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="border border-white/10 bg-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black"
                >
                  Open file
                </a>
                <a
                  href={`/session/${archivedRecording.id}`}
                  className="border border-white/10 bg-black/40 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100"
                >
                  View record
                </a>
              </div>
            </div>
          </div>
        ) : null}

        {status === "FAILED" ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/76 px-6 text-center backdrop-blur-sm">
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
                  setStatus("READY")
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

            {status === "STARTING" || status === "FINALIZING" ? (
              <div className="w-full border border-white/10 bg-black/50 px-5 py-4 text-center text-[11px] font-black uppercase tracking-[0.24em] text-zinc-300">
                {status}
              </div>
            ) : null}

            {status === "LIVE" ? (
              <button
                type="button"
                onClick={() => void finalizeSession()}
                className="w-full border border-white/10 bg-black/58 px-5 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-zinc-100 active:bg-white/10"
              >
                End
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </main>
  )
}
