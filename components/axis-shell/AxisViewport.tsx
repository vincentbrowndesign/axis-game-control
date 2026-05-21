"use client"

import { useEffect, useRef, useState } from "react"
import { useAxisStore, type AxisResponsivePrompt } from "@/store/useAxisStore"
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
  const perceptionCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null)
  const previousMotionRef = useRef(0)
  const responsivePrompt = useAxisStore((state) => state.responsivePrompt)
  const ingestPerceptionSample = useAxisStore((state) => state.ingestPerceptionSample)
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

  useEffect(() => {
    if (!cameraActive) return

    let disposed = false
    const sampleEveryMs = 900
    const width = 48
    const height = 27
    const canvas = perceptionCanvasRef.current ?? document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    perceptionCanvasRef.current = canvas
    const context = canvas.getContext("2d", {
      alpha: false,
      willReadFrequently: true,
    })
    if (!context) return
    const drawingContext = context

    function sampleFrame() {
      if (disposed) return
      const video = cameraRef.current
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

      drawingContext.drawImage(video, 0, 0, width, height)
      const data = drawingContext.getImageData(0, 0, width, height).data
      const previous = previousFrameRef.current
      const current = new Uint8ClampedArray(width * height)
      let totalDiff = 0
      let leftDiff = 0
      let rightDiff = 0

      for (let index = 0; index < current.length; index += 1) {
        const dataIndex = index * 4
        const luminance = data[dataIndex] * 0.299 + data[dataIndex + 1] * 0.587 + data[dataIndex + 2] * 0.114
        current[index] = luminance

        if (!previous) continue

        const diff = Math.abs(luminance - previous[index]) / 255
        totalDiff += diff
        if (index % width < width / 2) leftDiff += diff
        else rightDiff += diff
      }

      previousFrameRef.current = current
      if (!previous) return

      const motion = Math.min(1, totalDiff / current.length * 5.2)
      const acceleration = Math.max(0, motion - previousMotionRef.current)
      previousMotionRef.current = motion
      const sideDelta = leftDiff - rightDiff
      const sideBias = Math.abs(sideDelta) < totalDiff * 0.12 ? "center" : sideDelta > 0 ? "left" : "right"
      const pressure = Math.min(1, motion * 0.72 + acceleration * 1.85)

      ingestPerceptionSample({
        acceleration,
        at: Date.now(),
        motion,
        pressure,
        sideBias,
      })
    }

    const timer = window.setInterval(sampleFrame, sampleEveryMs)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [cameraActive, ingestPerceptionSample])

  return (
    <div className={styles.liveWorld}>
      <div className={styles.nativeLens} data-camera={cameraActive ? "active" : "idle"} aria-label="Live camera memory field">
        <video ref={cameraRef} className={styles.liveCameraFeed} playsInline muted autoPlay aria-hidden="true" />
        <div className={styles.cameraAtmosphere} aria-hidden="true" />
        <div className={styles.livePulseLayer}>
          {responsivePrompt ? <ResponsiveContinuityPrompt prompt={responsivePrompt} /> : null}
        </div>
      </div>
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
