"use client"

import {
  createAbstractReplayState,
  updateAbstractReplayFromDetections,
  type AbstractReplayFrame,
  type NormalizedDetection,
} from "@/lib/axis/abstractReplay"
import { useEffect, useRef, useState } from "react"

type RfTestSurfaceProps = {
  roboflowConfigured: boolean
}

type CameraStatus = "idle" | "starting" | "active" | "unavailable"

const testEntities: NormalizedDetection[] = [
  { confidence: 0.86, height: 0.12, sourceId: "o1", teamHint: "O", width: 0.05, x: 0.5, y: 0.22 },
  { confidence: 0.82, height: 0.12, sourceId: "o2", teamHint: "O", width: 0.05, x: 0.28, y: 0.42 },
  { confidence: 0.82, height: 0.12, sourceId: "o3", teamHint: "O", width: 0.05, x: 0.72, y: 0.42 },
  { confidence: 0.8, height: 0.12, sourceId: "o4", teamHint: "O", width: 0.05, x: 0.2, y: 0.74 },
  { confidence: 0.8, height: 0.12, sourceId: "o5", teamHint: "O", width: 0.05, x: 0.8, y: 0.74 },
  { confidence: 0.76, height: 0.12, sourceId: "x1", teamHint: "X", width: 0.05, x: 0.5, y: 0.34 },
  { confidence: 0.74, height: 0.12, sourceId: "x2", teamHint: "X", width: 0.05, x: 0.34, y: 0.52 },
  { confidence: 0.74, height: 0.12, sourceId: "x3", teamHint: "X", width: 0.05, x: 0.66, y: 0.52 },
  { confidence: 0.72, height: 0.12, sourceId: "x4", teamHint: "X", width: 0.05, x: 0.34, y: 0.76 },
  { confidence: 0.72, height: 0.12, sourceId: "x5", teamHint: "X", width: 0.05, x: 0.66, y: 0.76 },
]

export function RfTestSurface({ roboflowConfigured }: RfTestSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<AbstractReplayFrame | null>(null)
  const rafRef = useRef<number>(0)
  const stateRef = useRef(createAbstractReplayState())
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle")

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasElement = canvas

    const context = canvasElement.getContext("2d")
    if (!context) return
    const canvasContext = context

    function resize() {
      const rect = canvasElement.getBoundingClientRect()
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      canvasElement.width = Math.round(rect.width * dpr)
      canvasElement.height = Math.round(rect.height * dpr)
      canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function frame() {
      const rect = canvasElement.getBoundingClientRect()
      const detections = testEntities.map((entity, index) => driftDetection(entity, index, performance.now()))
      frameRef.current = updateAbstractReplayFromDetections(stateRef.current, detections, performance.now())
      drawOverlay(canvasContext, rect.width, rect.height, frameRef.current)
      rafRef.current = window.requestAnimationFrame(frame)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvasElement)
    resize()
    frame()

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(rafRef.current)
      stopStream(streamRef.current)
    }
  }, [])

  async function startCamera() {
    if (!roboflowConfigured || cameraStatus === "starting" || cameraStatus === "active") return

    try {
      setCameraStatus("starting")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          height: { ideal: 1080 },
          width: { ideal: 1920 },
        },
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraStatus("active")
    } catch {
      stopStream(streamRef.current)
      streamRef.current = null
      setCameraStatus("unavailable")
    }
  }

  function stopCamera() {
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraStatus("idle")
  }

  const unavailableMessage = !roboflowConfigured ? "Roboflow test not configured." : cameraStatus === "unavailable" ? "Camera unavailable." : null

  return (
    <main className="fixed inset-0 isolate overflow-hidden bg-[#050505] text-white selection:bg-transparent">
      <video
        aria-label="Live camera feed"
        autoPlay
        className="absolute inset-0 h-full w-full object-cover opacity-80"
        muted
        playsInline
        ref={videoRef}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),rgba(0,0,0,0.34)_54%,rgba(0,0,0,0.7))]" />
      <canvas
        aria-label="Abstract continuity overlay"
        className="absolute inset-0 h-full w-full"
        ref={canvasRef}
      />

      {unavailableMessage ? (
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center text-sm font-medium tracking-[0.12em] text-white/72">
          {unavailableMessage}
        </div>
      ) : null}

      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/36 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <button
          className="rounded-full bg-white px-5 py-2 text-xs font-semibold tracking-[0.16em] text-black disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/38"
          disabled={!roboflowConfigured || cameraStatus === "starting" || cameraStatus === "active"}
          onClick={startCamera}
          type="button"
        >
          START
        </button>
        <button
          className="rounded-full px-5 py-2 text-xs font-semibold tracking-[0.16em] text-white/62 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-white/24"
          disabled={cameraStatus !== "active"}
          onClick={stopCamera}
          type="button"
        >
          STOP
        </button>
      </div>
    </main>
  )
}

function drawOverlay(context: CanvasRenderingContext2D, width: number, height: number, frame: AbstractReplayFrame | null) {
  context.clearRect(0, 0, width, height)
  if (!frame) return

  context.save()
  context.lineCap = "round"
  context.lineJoin = "round"

  for (const relationship of frame.relationships) {
    if (relationship.kind !== "pressure") continue

    const from = frame.entities.find((entity) => entity.id === relationship.fromId)
    const to = frame.entities.find((entity) => entity.id === relationship.toId)
    if (!from || !to) continue

    context.strokeStyle = `rgba(255,255,255,${0.025 + relationship.pressure * 0.055})`
    context.lineWidth = Math.max(1, Math.min(width, height) * 0.0018)
    context.beginPath()
    context.moveTo(from.x * width, from.y * height)
    context.lineTo(to.x * width, to.y * height)
    context.stroke()
  }

  for (const entity of frame.entities) {
    const x = entity.x * width
    const y = entity.y * height
    const radius = Math.max(18, Math.min(width, height) * 0.032)
    const speed = Math.hypot(entity.vx, entity.vy)
    const glow = context.createRadialGradient(x, y, 0, x, y, radius * (1.4 + speed * 28))
    glow.addColorStop(0, `rgba(255,255,255,${0.075 + speed * 1.6})`)
    glow.addColorStop(1, "rgba(255,255,255,0)")
    context.fillStyle = glow
    context.beginPath()
    context.arc(x, y, radius * 1.25, 0, Math.PI * 2)
    context.fill()

    drawSymbol(context, entity.symbol, x, y, radius)
  }

  context.restore()
}

function drawSymbol(context: CanvasRenderingContext2D, symbol: "O" | "X", x: number, y: number, radius: number) {
  context.save()
  context.strokeStyle = "rgba(255,255,255,0.76)"
  context.lineWidth = Math.max(2.2, radius * 0.14)
  context.shadowBlur = radius * 0.24
  context.shadowColor = "rgba(255,255,255,0.18)"

  if (symbol === "O") {
    context.beginPath()
    context.arc(x, y, radius * 0.48, 0, Math.PI * 2)
    context.stroke()
  } else {
    const inset = radius * 0.44
    context.beginPath()
    context.moveTo(x - inset, y - inset)
    context.lineTo(x + inset, y + inset)
    context.moveTo(x + inset, y - inset)
    context.lineTo(x - inset, y + inset)
    context.stroke()
  }

  context.restore()
}

function driftDetection(entity: NormalizedDetection, index: number, now: number): NormalizedDetection {
  const phase = now / 1800 + index * 0.71
  const pressure = index < 5 ? 0.012 : 0.008

  return {
    ...entity,
    x: clamp01(entity.x + Math.sin(phase) * pressure + Math.cos(phase * 0.7) * pressure * 0.5),
    y: clamp01(entity.y + Math.cos(phase * 0.82) * pressure),
  }
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}
