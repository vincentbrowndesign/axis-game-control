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

export type AxisTraceSourceContext = {
  backgroundType: "live-camera" | "clip"
  replayTime: number
  roomId: string
}

export type AxisGestureMetadata = {
  averagePressure: number
  durationMs: number
  pointCount: number
  redrawCount: number
}

export type AxisCorrectionMetadata = {
  ghostedBySequence: number | null
  revisedAt: number | null
  wipeId: string | null
}

export type AxisRoomStroke = {
  createdAt: number
  gesture: AxisGestureMetadata
  ghosted: boolean
  id: string
  intensity: number
  points: AxisPoint[]
  sequence: number
  source: AxisTraceSourceContext
  correction: AxisCorrectionMetadata
}

export type AxisRoomDot = AxisPoint & {
  createdAt: number
  gesture: AxisGestureMetadata
  ghosted: boolean
  id: string
  sequence: number
  source: AxisTraceSourceContext
  correction: AxisCorrectionMetadata
}

type AxisViewportProps = {
  activeTool: AxisRoomTool
  dots: AxisRoomDot[]
  nextSequence: () => number
  roomId: string
  scrubProgress: number
  setDots: Dispatch<SetStateAction<AxisRoomDot[]>>
  setStrokes: Dispatch<SetStateAction<AxisRoomStroke[]>>
  strokes: AxisRoomStroke[]
}

export function AxisViewport({ activeTool, dots, nextSequence, roomId, scrubProgress, setDots, setStrokes, strokes }: AxisViewportProps) {
  return (
    <section className={styles.viewport} aria-label="Axis room video">
      <LiveRoomWorld
        activeTool={activeTool}
        dots={dots}
        nextSequence={nextSequence}
        roomId={roomId}
        scrubProgress={scrubProgress}
        setDots={setDots}
        setStrokes={setStrokes}
        strokes={strokes}
      />
    </section>
  )
}

function LiveRoomWorld({ activeTool, dots, nextSequence, roomId, scrubProgress, setDots, setStrokes, strokes }: AxisViewportProps) {
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
      const sequence = nextSequence()
      setDots((current) =>
        [
          ...current,
          {
            id: `dot-${Date.now().toString(36)}`,
            correction: emptyCorrection(),
            createdAt: Date.now(),
            gesture: {
              averagePressure: point.pressure,
              durationMs: 0,
              pointCount: 1,
              redrawCount: countNearbyDots(current, point),
            },
            ghosted: false,
            sequence,
            source: traceSource(roomId, scrubProgress),
            ...point,
          },
        ].slice(-36),
      )
      return
    }

    const id = `stroke-${Date.now().toString(36)}`
    activeStrokeRef.current = id
    const sequence = nextSequence()
    setStrokes((current) =>
      [
        ...current,
        {
          id,
          correction: emptyCorrection(),
          createdAt: Date.now(),
          gesture: {
            averagePressure: point.pressure,
            durationMs: 0,
            pointCount: 1,
            redrawCount: countOverlappingStrokes(current, point),
          },
          ghosted: false,
          intensity: point.pressure,
          points: [point],
          sequence,
          source: traceSource(roomId, scrubProgress),
        },
      ].slice(-24),
    )
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
              gesture: updateGesture(stroke, point),
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
          {buildRecurringRegions(strokes, dots).map((region) => (
            <circle
              key={region.id}
              className={styles.recurrenceRegion}
              cx={region.x * 100}
              cy={region.y * 100}
              r={region.r * 100}
              vectorEffect="non-scaling-stroke"
            />
          ))}
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

function emptyCorrection(): AxisCorrectionMetadata {
  return {
    ghostedBySequence: null,
    revisedAt: null,
    wipeId: null,
  }
}

function traceSource(roomId: string, replayProgress: number): AxisTraceSourceContext {
  return {
    backgroundType: "live-camera",
    replayTime: Math.round(replayProgress * 1000) / 1000,
    roomId,
  }
}

function updateGesture(stroke: AxisRoomStroke, point: AxisPoint): AxisGestureMetadata {
  const nextCount = stroke.points.length + 1
  return {
    ...stroke.gesture,
    averagePressure: (stroke.gesture.averagePressure * stroke.points.length + point.pressure) / nextCount,
    durationMs: Math.max(0, point.t - stroke.points[0].t),
    pointCount: nextCount,
  }
}

function countNearbyDots(dots: AxisRoomDot[], point: AxisPoint) {
  return dots.filter((dot) => !dot.ghosted && distance(dot, point) < 0.08).length
}

function countOverlappingStrokes(strokes: AxisRoomStroke[], point: AxisPoint) {
  return strokes.filter((stroke) => !stroke.ghosted && stroke.points.some((tracePoint) => distance(tracePoint, point) < 0.1)).length
}

function distance(a: AxisPoint, b: AxisPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function buildRecurringRegions(strokes: AxisRoomStroke[], dots: AxisRoomDot[]) {
  const points: Array<Pick<AxisPoint, "x" | "y"> & { ghosted: boolean }> = [
    ...dots.map((dot) => ({ x: dot.x, y: dot.y, ghosted: dot.ghosted })),
    ...strokes.flatMap((stroke) => stroke.points.filter((_, index) => index % 12 === 0).map((point) => ({ x: point.x, y: point.y, ghosted: stroke.ghosted }))),
  ]

  return points
    .map((point, index) => {
      const nearby = points.filter((other) => spatialDistance(point, other) < 0.11)
      return {
        id: `recurrence-${index}`,
        x: point.x,
        y: point.y,
        r: Math.min(0.12, 0.045 + nearby.length * 0.008),
        weight: nearby.length + (point.ghosted ? 0.35 : 0),
      }
    })
    .filter((region) => region.weight >= 4)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
}

function spatialDistance(a: Pick<AxisPoint, "x" | "y">, b: Pick<AxisPoint, "x" | "y">) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
