"use client"

import { useEffect, useRef, type RefObject } from "react"
import { AxisMediapipePoseTracker } from "@/lib/axis/perception/mediapipePose"
import {
  AxisMotionSignatureTracker,
  type AxisMotionSignature,
} from "@/lib/axis/perception/motionSignatures"

type MotionSignatureOverlayProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  active: boolean
}

export function MotionSignatureOverlay({ videoRef, active }: MotionSignatureOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) return

    let disposed = false
    let frameId = 0
    let poseTracker: AxisMediapipePoseTracker | null = null
    const signatureTracker = new AxisMotionSignatureTracker()

    async function run() {
      poseTracker = await AxisMediapipePoseTracker.create()
      if (disposed) return

      const tick = () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (video && canvas) {
          syncCanvas(canvas, video)
          const pose = poseTracker?.detect(video) ?? null
          const signatures = pose ? signatureTracker.update(pose) : []
          drawMotionSignatures(canvas, signatures, performance.now())
        }
        frameId = window.requestAnimationFrame(tick)
      }

      tick()
    }

    run()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      poseTracker?.reset()
      signatureTracker.reset()
    }
  }, [active, videoRef])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        height: "100%",
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        width: "100%",
      }}
    />
  )
}

function syncCanvas(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
  const width = video.clientWidth
  const height = video.clientHeight
  const scale = window.devicePixelRatio || 1
  const nextWidth = Math.max(1, Math.floor(width * scale))
  const nextHeight = Math.max(1, Math.floor(height * scale))

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth
    canvas.height = nextHeight
  }
}

function drawMotionSignatures(canvas: HTMLCanvasElement, signatures: AxisMotionSignature[], now: number) {
  const context = canvas.getContext("2d")
  if (!context) return

  context.clearRect(0, 0, canvas.width, canvas.height)

  for (const signature of signatures) {
    const age = Math.max(0, now - signature.createdAt)
    const life = 1 - Math.min(1, age / signature.ttlMs)
    if (life <= 0) continue

    if (signature.type === "shot_arc") {
      drawShotArc(context, canvas, signature, life)
    } else {
      drawPressureStreak(context, canvas, signature, life)
    }
  }
}

function drawShotArc(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  signature: Extract<AxisMotionSignature, { type: "shot_arc" }>,
  life: number,
) {
  const [start, apex, end] = signature.points
  const alpha = (0.14 + signature.intensity * 0.26) * easeOut(life)

  context.save()
  context.lineCap = "round"
  context.lineJoin = "round"
  context.shadowBlur = 8
  context.shadowColor = `rgba(255, 246, 200, ${alpha * 0.46})`
  context.strokeStyle = `rgba(255, 248, 218, ${alpha})`
  context.lineWidth = Math.max(1, window.devicePixelRatio || 1)
  context.beginPath()
  context.moveTo(start.x * canvas.width, start.y * canvas.height)
  context.quadraticCurveTo(apex.x * canvas.width, apex.y * canvas.height, end.x * canvas.width, end.y * canvas.height)
  context.stroke()

  context.strokeStyle = `rgba(255, 248, 218, ${alpha * 0.28})`
  context.lineWidth = Math.max(1, (window.devicePixelRatio || 1) * 0.72)
  context.beginPath()
  context.moveTo(start.x * canvas.width, start.y * canvas.height)
  context.quadraticCurveTo(
    apex.x * canvas.width,
    (apex.y + 0.035) * canvas.height,
    end.x * canvas.width,
    (end.y + 0.025) * canvas.height,
  )
  context.stroke()
  context.restore()
}

function drawPressureStreak(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  signature: Extract<AxisMotionSignature, { type: "pressure_streak" }>,
  life: number,
) {
  const from = {
    x: signature.from.x * canvas.width,
    y: signature.from.y * canvas.height,
  }
  const to = {
    x: signature.to.x * canvas.width,
    y: signature.to.y * canvas.height,
  }
  const alpha = (0.1 + signature.intensity * 0.28) * easeOut(life)
  const gradient = context.createLinearGradient(from.x, from.y, to.x, to.y)
  gradient.addColorStop(0, `rgba(255, 248, 222, 0)`)
  gradient.addColorStop(0.42, `rgba(255, 248, 222, ${alpha * 0.64})`)
  gradient.addColorStop(1, `rgba(255, 248, 222, ${alpha})`)

  context.save()
  context.lineCap = "round"
  context.shadowBlur = 12
  context.shadowColor = `rgba(255, 246, 210, ${alpha * 0.34})`
  context.strokeStyle = gradient
  context.lineWidth = Math.max(1, (window.devicePixelRatio || 1) * (1 + signature.intensity * 1.4))
  context.beginPath()
  context.moveTo(from.x, from.y)
  context.lineTo(to.x, to.y)
  context.stroke()
  context.restore()
}

function easeOut(value: number) {
  return 1 - Math.pow(1 - value, 2)
}
