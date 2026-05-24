"use client"

import { useReplayLoop } from "@/components/axis-replay/useReplayLoop"
import { createFallbackTelemetry, parseTelemetryStream, type TelemetrySample } from "@/lib/axis-replay/telemetry"
import { useEffect, useRef, useState } from "react"
import { AtmosphereLayer } from "./AtmosphereLayer"
import styles from "./BehavioralTelemetryPlayer.module.css"
import { TopologyRail } from "./TopologyRail"

type BehavioralTelemetryPlayerProps = {
  sessionId?: string | null
}

type ReplayResponse = {
  session?: {
    title?: string
    videoUrl?: string
    fileName?: string
    telemetry?: {
      url?: string
      fileName?: string
    } | null
  }
}

export function BehavioralTelemetryPlayer({
  sessionId,
}: BehavioralTelemetryPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const railCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const atmosphereCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const telemetryRef = useRef<TelemetrySample[]>(createFallbackTelemetry())
  const objectUrlRef = useRef<string | null>(null)
  const [videoName, setVideoName] = useState("Choose File")
  const [telemetryName, setTelemetryName] = useState("fallback stream")
  const [timecode, setTimecode] = useState("00:00")
  const [durationCode, setDurationCode] = useState("00:00")
  const [hasVideo, setHasVideo] = useState(false)
  const [loadState, setLoadState] = useState("Choose File")
  const [isPlaying, setIsPlaying] = useState(false)

  const replayControls = useReplayLoop({ atmosphereCanvasRef, railCanvasRef, telemetryRef, videoRef })

  useEffect(() => {
    let rafId = 0
    let lastSecond = -1

    const tick = () => {
      const video = videoRef.current
      const nextSecond = Math.floor(video?.currentTime ?? 0)
      if (nextSecond !== lastSecond) {
        lastSecond = nextSecond
        setTimecode(formatTime(nextSecond))
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onLoadedMetadata = () => {
      const duration = Number.isFinite(video.duration) ? Math.floor(video.duration) : 0
      setDurationCode(formatTime(duration))
    }

    video.addEventListener("play", onPlay)
    video.addEventListener("pause", onPause)
    video.addEventListener("ended", onPause)
    video.addEventListener("loadedmetadata", onLoadedMetadata)

    return () => {
      video.removeEventListener("play", onPlay)
      video.removeEventListener("pause", onPause)
      video.removeEventListener("ended", onPause)
      video.removeEventListener("loadedmetadata", onLoadedMetadata)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false

    const loadSession = async () => {
      try {
        setLoadState("Loading replay")
        const response = await fetch(`/api/replay/${encodeURIComponent(sessionId)}`)
        const payload = (await response.json()) as ReplayResponse
        const session = payload.session

        if (cancelled || !response.ok || !session?.videoUrl) {
          setLoadState("Replay unavailable")
          return
        }

        const video = videoRef.current
        if (!video) return

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = null
        }

        video.src = session.videoUrl
        video.currentTime = 0
        setVideoName(session.fileName || session.title || "Saved replay")
        setHasVideo(true)
        setLoadState("Saved replay")

        if (session.telemetry?.url) {
          const telemetryResponse = await fetch(session.telemetry.url)
          if (telemetryResponse.ok) {
            const text = await telemetryResponse.text()
            const parsed = parseTelemetryStream(text)
            if (parsed.length > 0) {
              telemetryRef.current = parsed
              setTelemetryName(session.telemetry.fileName || "saved telemetry")
            }
          }
        }

        void video.play().catch(() => undefined)
      } catch {
        if (!cancelled) setLoadState("Replay unavailable")
      }
    }

    void loadSession()

    return () => {
      cancelled = true
    }
  }, [sessionId])

  const onVideoFile = (file: File | null) => {
    if (!file) return
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setVideoName(file.name)
    setHasVideo(true)

    const video = videoRef.current
    if (!video) return
    video.src = url
    video.currentTime = 0
    void video.play().catch(() => undefined)
  }

  const onTelemetryFile = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    const parsed = parseTelemetryStream(text)
    if (parsed.length === 0) return
    telemetryRef.current = parsed
    setTelemetryName(file.name)
  }

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video || !hasVideo) return

    if (video.paused) {
      void video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }

  const replayFromStart = () => {
    if (!hasVideo) return
    replayControls.seekToMs(0)
  }

  return (
    <main className={styles.surface}>
      <header className={styles.topTelemetry}>
        <div className={styles.identity}>
          <span className={styles.eyebrow}>AXIS REPLAY</span>
          <span className={styles.title}>Game replay</span>
        </div>
        <span className={styles.timecode}>{timecode} / {durationCode}</span>
      </header>

      <section className={styles.world} aria-label="Replay video memory">
        <div className={styles.videoShell}>
          <video
            className={styles.video}
            controls={false}
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            muted
            playsInline
            preload="metadata"
            ref={videoRef}
          />
          {!hasVideo ? <div className={styles.emptySignal}>{loadState.toLowerCase()}</div> : null}
        </div>
      </section>

      <section className={styles.railZone} aria-label="Replay memory terrain">
        <div className={styles.railStack}>
          <TopologyRail canvasRef={railCanvasRef} />
          <AtmosphereLayer canvasRef={atmosphereCanvasRef} />
        </div>

        <div className={styles.bottomControls}>
          <button
            className={styles.transportButton}
            disabled={!hasVideo}
            onClick={() => replayControls.seekToKnot(-1)}
            type="button"
          >
            Prev
          </button>
          <button
            className={styles.primaryTransport}
            disabled={!hasVideo}
            onClick={togglePlayback}
            type="button"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            className={styles.transportButton}
            disabled={!hasVideo}
            onClick={() => replayControls.seekToKnot(1)}
            type="button"
          >
            Next
          </button>
          <button
            className={styles.transportButton}
            disabled={!hasVideo}
            onClick={replayFromStart}
            type="button"
          >
            Start
          </button>
          <label className={styles.chooseFile}>
            Choose File
            <input className={styles.fileInput} type="file" accept="video/*" onChange={(event) => onVideoFile(event.target.files?.[0] ?? null)} />
          </label>
          <label className={styles.chooseFile}>
            Telemetry
            <input
              className={styles.fileInput}
              type="file"
              accept=".ndjson,.json,application/json"
              onChange={(event) => void onTelemetryFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <span className={styles.fileLabel}>{videoName}</span>
          <span className={styles.fileLabel}>{telemetryName}</span>
        </div>
      </section>
    </main>
  )
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}
