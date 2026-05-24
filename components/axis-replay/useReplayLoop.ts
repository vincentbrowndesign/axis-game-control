"use client"

import { createAtmosphericState, setAtmosphereHover, updateAtmosphere } from "@/lib/axis-replay/atmosphere"
import {
  createReplayMachine,
  enterReplayWindow,
  nearestReplayKnot,
  seekWithInertia,
  updateReplayMachine,
} from "@/lib/axis-replay/replayState"
import { nearestKnot, renderAtmosphereLayer, renderTopologyRail, timeFromRailX } from "@/lib/axis-replay/renderers"
import { sampleAt, telemetryDuration, type TelemetrySample } from "@/lib/axis-replay/telemetry"
import { useCallback, useEffect, useRef, type RefObject } from "react"

type ReplayLoopInput = {
  atmosphereCanvasRef: RefObject<HTMLCanvasElement | null>
  railCanvasRef: RefObject<HTMLCanvasElement | null>
  telemetryRef: RefObject<TelemetrySample[]>
  videoRef: RefObject<HTMLVideoElement | null>
}

export function useReplayLoop({ atmosphereCanvasRef, railCanvasRef, telemetryRef, videoRef }: ReplayLoopInput) {
  const atmosphereRef = useRef(createAtmosphericState())
  const replayRef = useRef(createReplayMachine())
  const pointerRef = useRef({ active: false, lastX: 0, lastTime: 0, velocity: 0 })

  const enterWindowAt = useCallback((timestampMs: number) => {
    const video = videoRef.current
    enterReplayWindow(replayRef.current, Math.max(0, timestampMs), telemetryRef.current)
    if (video) void video.play().catch(() => undefined)
  }, [telemetryRef, videoRef])

  const seekToMs = useCallback((timestampMs: number, push = 0) => {
    const video = videoRef.current
    const durationMs = currentDuration(video, telemetryRef.current)
    seekWithInertia(replayRef.current, clamp(timestampMs, 0, durationMs), push)
    if (video) void video.play().catch(() => undefined)
  }, [telemetryRef, videoRef])

  const seekToKnot = useCallback((direction: -1 | 1) => {
    const video = videoRef.current
    const currentMs = (video?.currentTime ?? 0) * 1000
    const knot = nearestReplayKnot(telemetryRef.current, currentMs, direction)
    if (knot === null) return
    enterWindowAt(knot)
  }, [enterWindowAt, telemetryRef, videoRef])

  useEffect(() => {
    const railCanvas = railCanvasRef.current
    const atmosphereCanvas = atmosphereCanvasRef.current
    if (!railCanvas || !atmosphereCanvas) return

    const railContext = railCanvas.getContext("2d", { alpha: false })
    const atmosphereContext = atmosphereCanvas.getContext("2d")
    if (!railContext || !atmosphereContext) return

    let rafId = 0
    let lastNow = performance.now()
    let size = { height: 0, width: 0 }

    const resize = () => {
      const rect = railCanvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      size = { height: rect.height, width: rect.width }
      syncCanvas(railCanvas, rect.width, rect.height, dpr)
      syncCanvas(atmosphereCanvas, rect.width, rect.height, dpr)
      railContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      atmosphereContext.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(railCanvas)
    resize()

    const onPointerMove = (event: PointerEvent) => {
      const rect = railCanvas.getBoundingClientRect()
      const frames = telemetryRef.current
      const durationMs = currentDuration(videoRef.current, frames)
      const x = clamp(event.clientX - rect.left, 0, rect.width)
      const now = performance.now()
      const pointer = pointerRef.current
      const dt = Math.max(1, now - pointer.lastTime)
      pointer.velocity = (x - pointer.lastX) / dt
      pointer.lastX = x
      pointer.lastTime = now
      pointer.active = true
      setAtmosphereHover(atmosphereRef.current, timeFromRailX(x, rect.width, durationMs))
    }

    const onPointerLeave = () => {
      pointerRef.current.active = false
      setAtmosphereHover(atmosphereRef.current, null)
    }

    const onPointerDown = (event: PointerEvent) => {
      const rect = railCanvas.getBoundingClientRect()
      const frames = telemetryRef.current
      const durationMs = currentDuration(videoRef.current, frames)
      const x = clamp(event.clientX - rect.left, 0, rect.width)
      const knot = nearestKnot(frames, durationMs, x, rect.width)

      if (knot !== null) {
        enterReplayWindow(replayRef.current, knot, frames)
        void videoRef.current?.play().catch(() => undefined)
      } else {
        const push = pointerRef.current.velocity * 9000
        seekWithInertia(replayRef.current, timeFromRailX(x, rect.width, durationMs), push)
        void videoRef.current?.play().catch(() => undefined)
      }
    }

    railCanvas.addEventListener("pointermove", onPointerMove)
    railCanvas.addEventListener("pointerleave", onPointerLeave)
    railCanvas.addEventListener("pointerdown", onPointerDown)

    const tick = (now: number) => {
      const frames = telemetryRef.current
      const video = videoRef.current
      const durationMs = currentDuration(video, frames)
      const deltaSeconds = Math.min(0.05, (now - lastNow) / 1000)
      lastNow = now

      if (video) updateReplayMachine(replayRef.current, video, deltaSeconds)

      const readMs = video ? video.currentTime * 1000 : 0
      const sample = sampleAt(frames, readMs)
      updateAtmosphere(atmosphereRef.current, sample, readMs, now)

      renderTopologyRail(railContext, {
        atmosphere: atmosphereRef.current,
        durationMs,
        frames,
        height: size.height,
        hoverMs: atmosphereRef.current.hoverMs,
        readMs,
        width: size.width,
      })
      renderAtmosphereLayer(atmosphereContext, {
        atmosphere: atmosphereRef.current,
        durationMs,
        frames,
        height: size.height,
        hoverMs: atmosphereRef.current.hoverMs,
        readMs,
        width: size.width,
      })

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      railCanvas.removeEventListener("pointermove", onPointerMove)
      railCanvas.removeEventListener("pointerleave", onPointerLeave)
      railCanvas.removeEventListener("pointerdown", onPointerDown)
    }
  }, [atmosphereCanvasRef, railCanvasRef, telemetryRef, videoRef])

  return {
    enterWindowAt,
    seekToKnot,
    seekToMs,
  }
}

function syncCanvas(canvas: HTMLCanvasElement, width: number, height: number, dpr: number) {
  const nextWidth = Math.max(1, Math.round(width * dpr))
  const nextHeight = Math.max(1, Math.round(height * dpr))
  if (canvas.width !== nextWidth) canvas.width = nextWidth
  if (canvas.height !== nextHeight) canvas.height = nextHeight
}

function currentDuration(video: HTMLVideoElement | null, frames: TelemetrySample[]) {
  const videoDuration = video && Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : 0
  return Math.max(videoDuration, telemetryDuration(frames))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
