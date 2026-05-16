import type { ReplayReveal } from "./revealEngine"
import type { ReplayMarker } from "./types"

export type ReplayReward = {
  found: string
  nextAction: string
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
          ? "Similar rhythm returned."
          : "Related rhythm surfaced.",
      nextAction: "Add this to memory.",
      focus: marker,
    }
  }

  if (marker.type === "reset") {
    return {
      found: "Related reset found.",
      nextAction: "Keep the pattern.",
      focus: marker,
    }
  }

  if (marker.type === "burst") {
    return {
      found: "Practice movement linked.",
      nextAction: "Return to archive.",
      focus: marker,
    }
  }

  if (marker.type === "stabilization") {
    return {
      found: "Memory added to practice continuity.",
      nextAction: "Find related memory.",
      focus: marker,
    }
  }

  if (marker.type === "repetition") {
    return {
      found: `${sentence(marker.label)} returned.`,
      nextAction: "Link this memory.",
      focus: marker,
    }
  }

  return {
    found: "Memory added to archive.",
    nextAction: "Find what connects.",
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
      found: "Memory added to archive.",
      nextAction: "Find what connects.",
      focus: null,
    }
  }

  return rewardFromMarker(focus)
}
