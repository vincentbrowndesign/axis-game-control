import type { ReplayMarker } from "./types"

export type ReplayRevealPhase =
  | "withholding"
  | "emerging"
  | "revealed"

export type ReplayReveal = ReplayMarker & {
  phase: ReplayRevealPhase
  revealDelay: number
  emphasis: number
}

const TYPE_WEIGHT: Record<ReplayMarker["type"], number> = {
  cadence: 0.96,
  rhythm: 0.92,
  continuity: 0.86,
  repetition: 0.82,
  stabilization: 0.72,
  burst: 0.68,
  reset: 0.62,
}

export function buildReplayReveals({
  markers,
  currentTime,
}: {
  markers: ReplayMarker[]
  currentTime: number
}): ReplayReveal[] {
  return markers
    .map((marker, index) => {
      const revealDelay = 1.2 + index * 1.65
      const isInsideWindow =
        currentTime >= marker.startTime &&
        currentTime <= marker.endTime
      const hasPassedReveal = currentTime >= revealDelay
      const isApproaching =
        currentTime >= Math.max(0, marker.startTime - 1.4)
      const phase: ReplayRevealPhase = hasPassedReveal
        ? "revealed"
        : isApproaching || isInsideWindow
          ? "emerging"
          : "withholding"

      return {
        ...marker,
        revealDelay,
        phase,
        emphasis:
          (isInsideWindow ? 0.35 : 0) +
          marker.confidence * 0.45 +
          TYPE_WEIGHT[marker.type] * 0.2,
      }
    })
    .sort((a, b) => {
      if (b.emphasis !== a.emphasis) return b.emphasis - a.emphasis

      return a.startTime - b.startTime
    })
}

export function describeReveal(reveals: ReplayReveal[]) {
  const revealed = reveals.find((reveal) => reveal.phase === "revealed")
  const emerging = reveals.find((reveal) => reveal.phase === "emerging")

  if (revealed) return `${revealed.label.toLowerCase()} returning.`
  if (emerging) return `${emerging.label.toLowerCase()} emerging.`

  return "Memory structure returning."
}
