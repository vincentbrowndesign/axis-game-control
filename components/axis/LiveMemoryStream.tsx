"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import MuxPlayer from "@mux/mux-player-react"

type LiveStatus =
  | "CONNECTING"
  | "LIVE"
  | "RECONNECTING"
  | "CAMERA BLOCKED"
  | "MUX PLAYBACK ID MISSING"

const recorderTypes = [
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm",
  "video/mp4;codecs=h264,mp4a.40.2",
  "video/mp4",
]

function getRecorderType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return ""
  }

  return recorderTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
}

export function LiveMemoryStream() {
  const fallbackPlaybackId = process.env.NEXT_PUBLIC_MUX_PLAYBACK_ID || ""
  const [playbackId, setPlaybackId] = useState(fallbackPlaybackId)
  const [status, setStatus] = useState<LiveStatus>("CONNECTING")
  const [muxPlaying, setMuxPlaying] = useState(false)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const sessionIdRef = useRef("")
  const chunkQueueRef = useRef<Promise<void>>(Promise.resolve())
  const startedRef = useRef(false)

  const footerText = useMemo(() => {
    if (status === "LIVE") return "LIVE MEMORY ACTIVE"
    if (status === "CONNECTING") return "CONNECTING"
    if (status === "RECONNECTING") return "RECONNECTING"
    return status
  }, [status])

  useEffect(() => {
    if (
      startedRef.current ||
      typeof window === "undefined" ||
      typeof navigator === "undefined"
    ) {
      return
    }

    let cancelled = false
    let localStream: MediaStream | null = null

    async function postChunk(chunk: Blob) {
      const sessionId = sessionIdRef.current

      if (!sessionId || !chunk.size) return

      const response = await fetch("/api/live/chunk", {
        method: "POST",
        headers: {
          "content-type": chunk.type || "application/octet-stream",
          "x-axis-live-session": sessionId,
        },
        body: chunk,
      })

      if (!response.ok) {
        setStatus("RECONNECTING")
        return
      }

      setStatus("LIVE")
    }

    async function startLiveCamera() {
      startedRef.current = true
      setStatus("CONNECTING")

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("CAMERA BLOCKED")
        return
      }

      localStream = await navigator.mediaDevices.getUserMedia({
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

      if (cancelled) {
        localStream.getTracks().forEach((track) => track.stop())
        return
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream
        await localVideoRef.current.play().catch(() => undefined)
      }

      const startResponse = await fetch("/api/live/start", {
        method: "POST",
      })

      if (!startResponse.ok) {
        if (!fallbackPlaybackId) setStatus("MUX PLAYBACK ID MISSING")
        else setStatus("RECONNECTING")
        return
      }

      const startData = (await startResponse.json()) as {
        sessionId?: string
        playbackId?: string
      }

      if (!startData.sessionId) {
        setStatus("RECONNECTING")
        return
      }

      sessionIdRef.current = startData.sessionId
      setPlaybackId(startData.playbackId || fallbackPlaybackId)

      const recorderType = getRecorderType()

      if (typeof MediaRecorder === "undefined") {
        setStatus("RECONNECTING")
        return
      }

      const recorder = new MediaRecorder(
        localStream,
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

        chunkQueueRef.current = chunkQueueRef.current
          .then(() => postChunk(event.data))
          .catch(() => {
            setStatus("RECONNECTING")
          })
      }
      recorder.onerror = () => setStatus("RECONNECTING")
      recorder.onstart = () => setStatus("LIVE")
      recorderRef.current = recorder
      recorder.start(1200)
    }

    startLiveCamera().catch(() => {
      setStatus(localStream ? "RECONNECTING" : "CAMERA BLOCKED")
    })

    return () => {
      cancelled = true

      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop()
      }

      localStream?.getTracks().forEach((track) => track.stop())

      const sessionId = sessionIdRef.current
      if (sessionId) {
        fetch("/api/live/stop", {
          method: "POST",
          headers: {
            "x-axis-live-session": sessionId,
          },
          keepalive: true,
        }).catch(() => undefined)
      }
    }
  }, [fallbackPlaybackId])

  return (
    <main className="h-dvh overflow-hidden bg-black text-zinc-100">
      <section className="relative h-dvh overflow-hidden bg-black">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            muxPlaying ? "opacity-0" : "opacity-100"
          }`}
        />

        {playbackId ? (
          <MuxPlayer
            playbackId={playbackId}
            streamType="live"
            autoPlay
            muted
            playsInline
            preferPlayback="mse"
            onPlaying={() => setMuxPlaying(true)}
            onError={() => setMuxPlaying(false)}
            className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
              muxPlaying ? "opacity-100" : "opacity-0"
            }`}
            style={{
              ["--media-object-fit" as string]: "cover",
            }}
          />
        ) : null}

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.64),transparent_24%,transparent_68%,rgba(0,0,0,0.82))]" />

        {!playbackId && status === "MUX PLAYBACK ID MISSING" ? (
          <div className="absolute inset-0 z-10 grid place-items-center px-6 text-center">
            <div>
              <p className="text-3xl font-black uppercase tracking-[-0.04em] text-zinc-100 sm:text-5xl">
                MUX PLAYBACK ID MISSING
              </p>
              <p className="mt-3 text-sm font-bold leading-6 text-zinc-500">
                Set NEXT_PUBLIC_MUX_PLAYBACK_ID or configure Mux live ingest.
              </p>
            </div>
          </div>
        ) : null}

        <header className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between rounded-full border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-md">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-100">
            AXIS
          </p>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                status === "LIVE"
                  ? "bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.85)]"
                  : "bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.65)]"
              }`}
            />
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-200">
              LIVE
            </span>
          </div>
        </header>

        <footer className="absolute bottom-5 left-4 right-4 z-20 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
            {footerText}
          </p>
        </footer>
      </section>
    </main>
  )
}
