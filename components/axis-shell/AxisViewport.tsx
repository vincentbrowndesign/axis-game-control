"use client"

import { type CSSProperties, type Dispatch, type PointerEvent, type SetStateAction, useEffect, useRef, useState } from "react"
import styles from "./AxisShell.module.css"

export type AxisRoomTool = "draw" | "dot" | "voice" | "scrub"

type AxisPoint = {
  pressure: number
  t: number
  x: number
  y: number
}

export type AxisRoomStroke = {
  ghosted: boolean
  id: string
  intensity: number
  points: AxisPoint[]
  revisedAt: number | null
}

export type AxisRoomDot = AxisPoint & {
  ghosted: boolean
  id: string
  revisedAt: number | null
}

type AxisViewportProps = {
  activeTool: AxisRoomTool
  dots: AxisRoomDot[]
  setDots: Dispatch<SetStateAction<AxisRoomDot[]>>
  setStrokes: Dispatch<SetStateAction<AxisRoomStroke[]>>
  strokes: AxisRoomStroke[]
}

export function AxisViewport({ activeTool, dots, setDots, setStrokes, strokes }: AxisViewportProps) {
  return (
    <section className={styles.viewport} aria-label="Axis room video">
      <LiveRoomWorld activeTool={activeTool} dots={dots} setDots={setDots} setStrokes={setStrokes} strokes={strokes} />
    </section>
  )
}

function LiveRoomWorld({ activeTool, dots, setDots, setStrokes, strokes }: AxisViewportProps) {
  const cameraRef = useRef<HTMLVideoElement>(null)
  const activeStrokeRef = useRef<string | null>(null)
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

  function readPoint(event: PointerEvent<SVGSVGElement>): AxisPoint {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      pressure: Math.max(0.18, event.pressure || 0.42),
      t: performance.now(),
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    }
  }

  function startInteraction(event: PointerEvent<SVGSVGElement>) {
    if (activeTool !== "draw" && activeTool !== "dot") return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = readPoint(event)

    if (activeTool === "dot") {
      setDots((current) => [...current, { id: `dot-${Date.now().toString(36)}`, ghosted: false, revisedAt: null, ...point }].slice(-28))
      return
    }

    const id = `stroke-${Date.now().toString(36)}`
    activeStrokeRef.current = id
    setStrokes((current) => [...current, { id, ghosted: false, intensity: point.pressure, points: [point], revisedAt: null }].slice(-18))
  }

  function moveInteraction(event: PointerEvent<SVGSVGElement>) {
    if (activeTool !== "draw" || !activeStrokeRef.current) return
    const point = readPoint(event)
    const id = activeStrokeRef.current
    setStrokes((current) =>
      current.map((stroke) =>
        stroke.id === id
          ? {
              ...stroke,
              intensity: Math.min(1, stroke.intensity * 0.88 + point.pressure * 0.28),
              points: [...stroke.points, point].slice(-128),
            }
          : stroke,
      ),
    )
  }

  function endInteraction(event: PointerEvent<SVGSVGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    activeStrokeRef.current = null
  }

  return (
    <div className={styles.liveWorld}>
      <div className={styles.nativeLens} data-camera={cameraActive ? "active" : "idle"} aria-label="Live room video">
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
        <svg
          className={styles.roomInk}
          data-tool={activeTool}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Shared room drawing layer"
          onPointerCancel={endInteraction}
          onPointerDown={startInteraction}
          onPointerMove={moveInteraction}
          onPointerUp={endInteraction}
        >
          {strokes.map((stroke) => (
            <polyline
              key={stroke.id}
              data-ghosted={stroke.ghosted ? "true" : "false"}
              points={stroke.points.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
              style={{ "--stroke-force": stroke.intensity } as CSSProperties & Record<"--stroke-force", number>}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {dots.map((dot) => (
            <circle
              key={dot.id}
              cx={dot.x * 100}
              cy={dot.y * 100}
              data-ghosted={dot.ghosted ? "true" : "false"}
              r={0.62 + dot.pressure * 0.62}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
    </div>
  )
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}
