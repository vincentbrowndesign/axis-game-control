"use client"

import { useReplayLoop } from "@/components/axis-replay/useReplayLoop"
import { createFallbackTelemetry, parseTelemetryStream, type TelemetrySample } from "@/lib/axis-replay/telemetry"
import { useEffect, useRef, useState } from "react"
import { AtmosphereLayer } from "./AtmosphereLayer"
import styles from "./BehavioralTelemetryPlayer.module.css"
import { TopologyRail } from "./TopologyRail"

export function BehavioralTelemetryPlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const railCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const atmosphereCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const telemetryRef = useRef<TelemetrySample[]>(createFallbackTelemetry())
  const objectUrlRef = useRef<string | null>(null)
  const [videoName, setVideoName] = useState("Choose File")
  const [telemetryName, setTelemetryName] = useState("fallback stream")
  const [timecode, setTimecode] = useState("00:00")
  const [hasVideo, setHasVideo] = useState(false)

  useReplayLoop({ atmosphereCanvasRef, railCanvasRef, telemetryRef, videoRef })

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
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

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

  return (
    <main className={styles.surface}>
      <header className={styles.topTelemetry}>
        <div className={styles.identity}>
          <span className={styles.eyebrow}>AXIS REPLAY</span>
          <span className={styles.title}>Behavioral terrain</span>
        </div>
        <span className={styles.timecode}>{timecode}</span>
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
          {!hasVideo ? <div className={styles.emptySignal}>choose practice film to wake the rail</div> : null}
        </div>
      </section>

      <section className={styles.railZone} aria-label="Replay memory terrain">
        <div className={styles.railStack}>
          <TopologyRail canvasRef={railCanvasRef} />
          <AtmosphereLayer canvasRef={atmosphereCanvasRef} />
        </div>

        <div className={styles.bottomControls}>
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
