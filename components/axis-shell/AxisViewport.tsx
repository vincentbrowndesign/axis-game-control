"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { AxisMemoryStream } from "@/components/axis-shell/AxisMemoryStream"
import { AxisOverlayLayer } from "@/components/axis-shell/AxisOverlayLayer"
import { AxisReplayView } from "@/components/axis-shell/AxisReplayView"
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
  const memories = useAxisStore((state) => state.memoryState.nodes)
  const [pulseIndex, setPulseIndex] = useState(0)
  const signals = useMemo(() => memories.slice(0, 6).map(toLivePulseSignal), [memories])
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

  return (
    <div className={styles.liveWorld}>
      <div className={styles.nativeLens} aria-hidden="true">
        <div className={styles.pressureMap}>
          <span />
          <span />
          <span />
        </div>
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
        <div className={styles.settlingTrace} />
        <span />
      </div>
      <p>Live</p>
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

function toLivePulseSignal(memory: AxisMemoryNode): LivePulseSignal {
  return {
    id: memory.id,
    label: coachShorthand(memory.label, memory.tags),
    context: memory.replayLinked ? `${memory.time} - remembered` : memory.time,
    intensity: signalIntensity(memory.tags),
    replayLinked: memory.replayLinked,
  }
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
