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
          ? "Rhythm clip ready."
          : "Related rhythm ready.",
      nextAction: "Leave a note.",
      focus: marker,
    }
  }

  if (marker.type === "reset") {
    return {
      found: "Reset clip ready.",
      nextAction: "Review the footwork.",
      focus: marker,
    }
  }

  if (marker.type === "burst") {
    return {
      found: "Practice movement ready.",
      nextAction: "Open archive.",
      focus: marker,
    }
  }

  if (marker.type === "stabilization") {
    return {
      found: "Clip ready for review.",
      nextAction: "Leave a note.",
      focus: marker,
    }
  }

  if (marker.type === "repetition") {
    return {
      found: `${sentence(marker.label)} ready.`,
      nextAction: "Tag for repeat.",
      focus: marker,
    }
  }

  return {
    found: "Clip added.",
    nextAction: "Review this clip.",
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
      found: "Session saved.",
      nextAction: "Review this clip.",
      focus: null,
    }
  }

  return rewardFromMarker(focus)
}
