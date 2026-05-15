import type { ReplayReveal } from "./revealEngine"
import type { ReplayMarker } from "./types"

export type ReplayReward = {
  found: string
  nextRep: string
  focus: ReplayMarker | null
}

function sentence(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

function rewardFromMarker(marker: ReplayMarker): ReplayReward {
  if (marker.type === "cadence" || marker.type === "rhythm") {
    return {
      found:
        marker.type === "cadence"
          ? "Rhythm returned after the reset."
          : "Strongest rhythm window surfaced.",
      nextRep: "Repeat the return and hold it longer.",
      focus: marker,
    }
  }

  if (marker.type === "reset") {
    return {
      found: "A reset broke the rhythm.",
      nextRep: "Shorten the reset and return faster.",
      focus: marker,
    }
  }

  if (marker.type === "burst") {
    return {
      found: "Movement burst surfaced.",
      nextRep: "Start slower and match that burst cleanly.",
      focus: marker,
    }
  }

  if (marker.type === "stabilization") {
    return {
      found: "The frame held steady.",
      nextRep: "Keep that hold while the movement repeats.",
      focus: marker,
    }
  }

  if (marker.type === "repetition") {
    return {
      found: `${sentence(marker.label)} detected.`,
      nextRep: "Repeat the same rep once more.",
      focus: marker,
    }
  }

  return {
    found: "Movement continuity surfaced.",
    nextRep: "Hold the window and repeat the return.",
    focus: marker,
  }
}

export function getReplayReward(
  reveals: ReplayReveal[]
): ReplayReward {
  const revealed = reveals.find((reveal) => reveal.phase === "revealed")
  const emerging = reveals.find((reveal) => reveal.phase === "emerging")
  const fallback = reveals[0]
  const focus = revealed || emerging || fallback

  if (!focus) {
    return {
      found: "Movement stored.",
      nextRep: "Repeat the same rep once more for a cleaner read.",
      focus: null,
    }
  }

  return rewardFromMarker(focus)
}
