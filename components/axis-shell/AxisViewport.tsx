"use client"

import { useEffect, useRef, useState } from "react"
import styles from "./AxisShell.module.css"

export function AxisViewport() {
  return (
    <section className={styles.viewport} aria-label="Axis live world">
      <LiveMemoryWorld />
    </section>
  )
}

function LiveMemoryWorld() {
  const cameraRef = useRef<HTMLVideoElement>(null)
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
        video.controls = false
        video.disablePictureInPicture = true
        video.disableRemotePlayback = true
        video.setAttribute("controlsList", "nodownload nofullscreen noremoteplayback")
        video.setAttribute("webkit-playsinline", "true")
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
        <video
          ref={cameraRef}
          className={styles.liveCameraFeed}
          playsInline
          muted
          autoPlay
          controls={false}
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
          onClick={(event) => event.preventDefault()}
          onContextMenu={(event) => event.preventDefault()}
          onDoubleClick={(event) => event.preventDefault()}
          onPause={(event) => {
            void event.currentTarget.play()
          }}
        />
        <div className={styles.cameraAtmosphere} aria-hidden="true" />
      </div>
    </div>
  )
}
