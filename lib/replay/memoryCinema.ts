import type { ReplayReveal } from "./revealEngine"

export type MemoryCinemaState = {
  headline: string
  tone: "quiet" | "rhythm" | "continuity" | "reset"
  depth: number
}

export function memoryCinemaState(
  reveals: ReplayReveal[]
): MemoryCinemaState {
  const active = reveals.find((reveal) => reveal.phase === "revealed")
  const emerging = reveals.find((reveal) => reveal.phase === "emerging")
  const reveal = active || emerging

  if (!reveal) {
    return {
      headline: "CLIP READY",
      tone: "quiet",
      depth: 0.18,
    }
  }

  if (reveal.type === "cadence" || reveal.type === "rhythm") {
    return {
      headline: "REVIEW READY",
      tone: "rhythm",
      depth: reveal.emphasis,
    }
  }

  if (reveal.type === "reset") {
    return {
      headline: "RESET FOUND",
      tone: "reset",
      depth: reveal.emphasis,
    }
  }

  return {
    headline: "STRUCTURE FOUND",
    tone: "continuity",
    depth: reveal.emphasis,
  }
}
