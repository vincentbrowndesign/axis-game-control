"use client"

import { useEffect, useRef, useState } from "react"
import { AxisMemoryStream } from "@/components/axis-shell/AxisMemoryStream"
import { AxisOverlayLayer } from "@/components/axis-shell/AxisOverlayLayer"
import { AxisReplayView } from "@/components/axis-shell/AxisReplayView"
import { useAxisStore, type AxisResponsivePrompt } from "@/store/useAxisStore"
import styles from "./AxisShell.module.css"

export function AxisViewport() {
  const mode = useAxisStore((state) => state.mode)
  const activeOverlay = useAxisStore((state) => state.activeOverlay)

  return (
    <section className={styles.viewport} aria-label="Axis center viewport">
      {mode === "live" ? <LiveMemoryWorld /> : null}
      {mode === "memory" ? <AxisMemoryStream /> : null}
      {mode === "replay" ? <AxisReplayView /> : null}
      {mode === "inspect" ? <InspectView label={activeOverlay?.label ?? "Form"} /> : null}
      <AxisOverlayLayer />
    </section>
  )
}

function LiveMemoryWorld() {
  const cameraRef = useRef<HTMLVideoElement>(null)
  const responsivePrompt = useAxisStore((state) => state.responsivePrompt)
  const subjectFramesEnabled = useAxisStore((state) => state.worldOverlayState.subjectFrames)
  const [cameraActive, setCameraActive] = useState(false)

  useEffect(() => {
    let disposed = false
    let stream: MediaStream | null = null

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) return

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "environment",
            width: {
              ideal: 1920,
            },
            height: {
              ideal: 1080,
            },
          },
        })

        if (disposed) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        const video = cameraRef.current
        if (!video) return
        video.srcObject = stream
        video.muted = true
        await video.play()
        setCameraActive(true)
      } catch {
        setCameraActive(false)
      }
    }

    startCamera()

    return () => {
      disposed = true
      setCameraActive(false)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return (
    <div className={styles.liveWorld}>
      <div className={styles.nativeLens} data-camera={cameraActive ? "active" : "idle"} aria-label="Live camera memory field">
        <video ref={cameraRef} className={styles.liveCameraFeed} playsInline muted autoPlay aria-hidden="true" />
        <div className={styles.cameraAtmosphere} aria-hidden="true" />
        <div className={styles.pressureMap}>
          <span />
          <span />
          <span />
        </div>
        {subjectFramesEnabled ? <SubjectFrameOverlay /> : null}
        <div className={styles.livePulseLayer}>
          {responsivePrompt ? <ResponsiveContinuityPrompt prompt={responsivePrompt} /> : null}
        </div>
        <span />
      </div>
      <p>Live</p>
    </div>
  )
}

function ResponsiveContinuityPrompt({ prompt }: { prompt: AxisResponsivePrompt }) {
  return (
    <div key={prompt.id} className={styles.responsiveContinuityPrompt}>
      <span>{prompt.context}</span>
      <strong>{prompt.label}</strong>
    </div>
  )
}

function SubjectFrameOverlay() {
  return (
    <div className={styles.subjectFrameLayer} aria-hidden="true">
      <span className={styles.subjectFrame} data-subject="primary" />
      <span className={styles.subjectFrame} data-subject="trail" />
      <span className={styles.subjectFrame} data-subject="weak" />
    </div>
  )
}

function InspectView({ label }: { label: string }) {
  return (
    <div className={styles.inspect}>
      <span>Inspect</span>
      <p>{label}</p>
    </div>
  )
}
