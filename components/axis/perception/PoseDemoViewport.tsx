"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { GhostPoseOverlay } from "@/components/axis/perception/GhostPoseOverlay"

export function PoseDemoViewport() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
      },
      audio: false,
    })
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = stream

    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    video.muted = true
    await video.play()
    setActive(true)
  }

  async function loadClip(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    const url = URL.createObjectURL(file)
    objectUrlRef.current = url

    const video = videoRef.current
    if (!video) return
    video.srcObject = null
    video.src = url
    video.loop = true
    video.muted = true
    await video.play()
    setActive(true)
  }

  return (
    <main style={styles.page}>
      <section style={styles.viewport} aria-label="Axis ghost pose demo">
        <video
          ref={videoRef}
          playsInline
          muted
          controls={false}
          style={styles.video}
          onCanPlay={() => setActive(true)}
        />
        <GhostPoseOverlay videoRef={videoRef} active={active} />
        <div style={styles.vignette} aria-hidden="true" />
      </section>

      <nav style={styles.controls} aria-label="Pose input">
        <button type="button" onClick={startCamera} style={styles.control}>
          Camera
        </button>
        <label style={styles.control}>
          Clip
          <input
            type="file"
            accept="video/*"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void loadClip(file)
            }}
            style={styles.file}
          />
        </label>
      </nav>
    </main>
  )
}

const styles = {
  page: {
    alignItems: "center",
    background:
      "radial-gradient(ellipse at 50% -14%, rgba(255,255,255,0.78), transparent 44%), linear-gradient(180deg, #f4f4ef 0%, #e7e7df 100%)",
    color: "#242424",
    display: "grid",
    height: "100dvh",
    justifyItems: "center",
    overflow: "hidden",
    padding: "max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom))",
  },
  viewport: {
    aspectRatio: "16 / 10",
    background: "#111",
    border: "1px solid rgba(36, 36, 36, 0.10)",
    borderRadius: "1.2rem",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.26), 0 30px 90px rgba(58,58,52,0.14)",
    maxHeight: "82dvh",
    maxWidth: "72rem",
    overflow: "hidden",
    position: "relative",
    width: "min(100%, 72rem)",
  },
  video: {
    display: "block",
    height: "100%",
    objectFit: "cover",
    width: "100%",
  },
  vignette: {
    background:
      "radial-gradient(ellipse at 50% 42%, transparent 48%, rgba(0,0,0,0.18)), linear-gradient(180deg, rgba(255,255,255,0.08), transparent 18%, rgba(0,0,0,0.18))",
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
  },
  controls: {
    alignItems: "center",
    bottom: "max(0.8rem, env(safe-area-inset-bottom))",
    display: "flex",
    gap: "0.44rem",
    left: "50%",
    position: "fixed",
    transform: "translateX(-50%)",
  },
  control: {
    backdropFilter: "blur(18px) saturate(1.02)",
    background: "rgba(255,255,255,0.42)",
    border: "1px solid rgba(36,36,36,0.10)",
    borderRadius: "999px",
    color: "rgba(36,36,36,0.68)",
    cursor: "pointer",
    font: "600 0.68rem var(--font-ibm-plex-mono), ui-monospace, monospace",
    letterSpacing: "0.04em",
    padding: "0.48rem 0.68rem",
    textTransform: "uppercase",
  },
  file: {
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    height: 1,
    overflow: "hidden",
    position: "absolute",
    whiteSpace: "nowrap",
    width: 1,
  },
} satisfies Record<string, CSSProperties>
