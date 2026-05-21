"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { AxisMemoryStream } from "@/components/axis-shell/AxisMemoryStream"
import { AxisOverlayLayer } from "@/components/axis-shell/AxisOverlayLayer"
import { AxisReplayView } from "@/components/axis-shell/AxisReplayView"
import { machineObservationsFromMemory, observationClosure, observationConfidence } from "@/lib/axis/perception/machineObservations"
import { useAxisStore, type AxisMemoryNode } from "@/store/useAxisStore"
import styles from "./AxisShell.module.css"

const HOLD_MS = 3600
const MIGRATE_MS = 1100
const FADE_IN_MS = 420
const PULSE_INTERVAL_MS = 1900
const MAX_VIEWPORT_STACK = 3

type LivePulseSignal = {
  id: string
  label: string
  context: string
  intensity: number
  replayLinked: boolean
  machineObserved: boolean
}

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
  const memories = useAxisStore((state) => state.memoryState.nodes)
  const subjectFramesEnabled = useAxisStore((state) => state.worldOverlayState.subjectFrames)
  const [pulseIndex, setPulseIndex] = useState(0)
  const [cameraActive, setCameraActive] = useState(false)
  const signals = useMemo(
    () => [...continuityObserverSignals(memories), ...memories.slice(0, 6).flatMap(toLivePulseSignals)],
    [memories],
  )
  const visibleSignals = useMemo(() => {
    if (!signals.length) return []
    return Array.from({ length: Math.min(MAX_VIEWPORT_STACK, signals.length) }, (_, index) => {
      const signal = signals[(pulseIndex + index) % signals.length]
      return {
        ...signal,
        stackIndex: index,
      }
    })
  }, [pulseIndex, signals])
  const activeSignal = visibleSignals[0] ?? null

  useEffect(() => {
    if (signals.length <= 1) return
    const timer = window.setInterval(() => {
      setPulseIndex((index) => (index + 1) % signals.length)
    }, PULSE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [signals.length])

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
        {activeSignal?.replayLinked ? (
          <div
            key={`replay-${activeSignal.id}-${pulseIndex}`}
            className={styles.atmosphericReplay}
            style={{
              "--pulse-intensity": activeSignal.intensity,
              "--fade-in-ms": `${FADE_IN_MS}ms`,
              "--hold-ms": `${HOLD_MS}ms`,
              "--migrate-ms": `${MIGRATE_MS}ms`,
            } as CSSProperties}
          >
            <div className={styles.replayMemoryFrame}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.replayMemoryCaption}>
              <span>{activeSignal.context}</span>
              <strong>{activeSignal.label}</strong>
            </div>
            <div className={styles.replayMemoryProgress} />
          </div>
        ) : null}
        <div className={styles.livePulseLayer}>
          {visibleSignals.map((signal) => (
            <div
              key={`${signal.id}-${pulseIndex}-${signal.stackIndex}`}
              className={styles.livePulseSignal}
              data-depth={signal.stackIndex}
              data-observer={signal.machineObserved ? "machine" : "coach"}
              style={{
                "--pulse-intensity": signal.intensity,
                "--fade-in-ms": `${FADE_IN_MS}ms`,
                "--hold-ms": `${HOLD_MS}ms`,
                "--migrate-ms": `${MIGRATE_MS}ms`,
              } as CSSProperties}
            >
              <span>{signal.context}</span>
              <strong>{signal.label}</strong>
            </div>
          ))}
        </div>
        <span />
      </div>
      <p>Live</p>
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

function toLivePulseSignals(memory: AxisMemoryNode): LivePulseSignal[] {
  const coachSignal: LivePulseSignal = {
    id: memory.id,
    label: coachShorthand(memory.label, memory.tags),
    context: memory.time,
    intensity: signalIntensity(memory.tags),
    replayLinked: memory.replayLinked,
    machineObserved: false,
  }

  const observations = machineObservationsFromMemory(memory)
  if (!observations.length) {
    const observerSignal = observerPrompt(memory, coachSignal)
    return observerSignal ? [observerSignal, coachSignal] : [coachSignal]
  }

  const observationSignals = observations.slice(0, 1).map((item) => ({
    id: item.id,
    label: observationClosure(item.label, coachSignal.label, item.confidence),
    context: observerContext(item.label, item.confidence, memory.time),
    intensity: Math.min(1, signalIntensity(memory.tags) + item.confidence * 0.16),
    replayLinked: memory.replayLinked,
    machineObserved: true,
  }))

  return [...observationSignals, coachSignal]
}

function continuityObserverSignals(memories: AxisMemoryNode[]): LivePulseSignal[] {
  const recent = memories.slice(0, 6)
  const weakSideCount = recent.filter((memory) => /\bweak[- ]side|late help|no help\b/i.test(memory.label)).length
  const transitionCount = recent.filter((memory) => memory.tags.includes("turnover") || /\bpush|outlet|transition\b/i.test(memory.label)).length
  const downhillCount = recent.filter((memory) => /\bdownhill|easy rim|layup\b/i.test(memory.label)).length
  const leftSidePressure = recent.filter((memory) => /\bleft side|left wing|weak[- ]side\b/i.test(memory.label)).length

  if (weakSideCount >= 2) {
    return [observerSignal(recent[0], "same weak side again?", 0.68)]
  }

  if (transitionCount >= 3) {
    return [observerSignal(recent[0], "transition heavy tonight?", 0.72)]
  }

  if (downhillCount >= 2) {
    return [observerSignal(recent[0], "downhill again?", 0.7)]
  }

  if (leftSidePressure >= 2) {
    return [observerSignal(recent[0], "pressure rising left side", 0.78)]
  }

  return []
}

function observerPrompt(memory: AxisMemoryNode, coachSignal: LivePulseSignal): LivePulseSignal | null {
  const tags = new Set(memory.tags.map((tag) => tag.toLowerCase()))
  const normalized = memory.label.toLowerCase()

  if (tags.has("turnover")) {
    return observerSignal(memory, "push after TO?", coachSignal.intensity + 0.1)
  }

  if (tags.has("stop")) {
    return observerSignal(memory, "watch weak side", coachSignal.intensity + 0.08)
  }

  if (tags.has("rebound")) {
    return observerSignal(memory, "same action again?", coachSignal.intensity + 0.06)
  }

  if (tags.has("scoring") && /\bwing|corner|right side|3|three\b/.test(normalized)) {
    return observerSignal(memory, "late close-out", coachSignal.intensity + 0.08)
  }

  return null
}

function observerSignal(memory: AxisMemoryNode, label: string, intensity: number): LivePulseSignal {
  return {
    id: `${memory.id}-observer`,
    label,
    context: "watch",
    intensity: Math.min(1, intensity),
    replayLinked: false,
    machineObserved: true,
  }
}

function observerContext(label: string, confidence: number, time: string) {
  if (observationConfidence(confidence) !== "high") return "watch"
  if (label === "dead ball" || label === "and-1" || label === "early foul") return time
  return "watch"
}

function coachShorthand(label: string, tags: string[]) {
  const normalized = label.toLowerCase()
  if (/\bnae\b/.test(normalized) && tags.includes("rebound")) return "Nae board -> quick push"
  if (tags.includes("turnover") && /\bcorner|3|three\b/.test(normalized)) return "Push after TO -> corner 3"
  if (tags.includes("turnover")) return "Bad switch -> easy rim"
  if (tags.includes("stop") || /\bsteal\b/.test(normalized)) return "Press break -> layup"
  if (tags.includes("rebound")) return "Board -> early push"
  if (tags.includes("scoring") && /\bright side|wing\b/.test(normalized)) return "Late help -> open wing"
  if (tags.includes("scoring")) return "Weak closeout -> cash"
  return label
}

function signalIntensity(tags: string[]) {
  let intensity = 0.42
  if (tags.includes("replay")) intensity += 0.12
  if (tags.includes("turnover") || tags.includes("stop")) intensity += 0.18
  if (tags.includes("rebound")) intensity += 0.12
  if (tags.includes("scoring")) intensity += 0.14
  return Math.min(1, intensity)
}
