"use client"

import { useEffect, useRef, type RefObject } from "react"
import {
  AXIS_POSE_CONNECTIONS,
  AxisMediapipePoseTracker,
  type AxisPoseFrame,
  type AxisPoseLandmark,
} from "@/lib/axis/perception/mediapipePose"

type GhostPoseOverlayProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  active: boolean
}

export function GhostPoseOverlay({ videoRef, active }: GhostPoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) return

    let disposed = false
    let frameId = 0
    let tracker: AxisMediapipePoseTracker | null = null

    async function run() {
      tracker = await AxisMediapipePoseTracker.create()
      if (disposed) return

      const tick = () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (video && canvas) {
          syncCanvas(canvas, video)
          const pose = tracker?.detect(video) ?? null
          drawGhostPose(canvas, pose)
        }
        frameId = window.requestAnimationFrame(tick)
      }

      tick()
    }

    run()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      tracker?.reset()
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

function drawGhostPose(canvas: HTMLCanvasElement, pose: AxisPoseFrame | null) {
  const context = canvas.getContext("2d")
  if (!context) return

  context.clearRect(0, 0, canvas.width, canvas.height)
  if (!pose) return

  context.save()
  context.lineCap = "round"
  context.lineJoin = "round"
  context.shadowColor = "rgba(255, 246, 198, 0.24)"
  context.shadowBlur = 8
  context.strokeStyle = "rgba(255, 246, 210, 0.36)"
  context.lineWidth = Math.max(1, window.devicePixelRatio || 1)

  for (const [from, to] of AXIS_POSE_CONNECTIONS) {
    const start = pose.landmarks[from]
    const end = pose.landmarks[to]
    if (!isVisible(start) || !isVisible(end)) continue

    context.beginPath()
    context.moveTo(start.x * canvas.width, start.y * canvas.height)
    context.lineTo(end.x * canvas.width, end.y * canvas.height)
    context.stroke()
  }

  context.fillStyle = "rgba(255, 255, 238, 0.34)"
  for (const landmark of pose.landmarks) {
    if (!isVisible(landmark)) continue
    context.beginPath()
    context.arc(landmark.x * canvas.width, landmark.y * canvas.height, 1.35 * (window.devicePixelRatio || 1), 0, Math.PI * 2)
    context.fill()
  }

  context.restore()
}

function isVisible(landmark: AxisPoseLandmark | undefined) {
  return Boolean(landmark && (landmark.visibility === undefined || landmark.visibility >= 0.42))
}
