import { tacticalSystemForSession } from "@/lib/axis/reinforcement"
import type { ReplaySessionView } from "@/types/memory"

function isSession(value: string | ReplaySessionView): value is ReplaySessionView {
  return typeof value !== "string"
}

const TRIGGER_RULES: {
  trigger: string
  terms: string[]
}[] = [
  {
    trigger: "ICE",
    terms: ["screen", "pick", "force you", "send you"],
  },
  {
    trigger: "LOW",
    terms: ["tag", "low", "closeout", "run back out"],
  },
  {
    trigger: "SINK",
    terms: ["stay low", "catch", "hips", "explode"],
  },
  {
    trigger: "HIT",
    terms: ["beat him", "spot", "contact"],
  },
  {
    trigger: "HOLD",
    terms: ["float", "drift", "wide", "retreat"],
  },
  {
    trigger: "MATCH",
    terms: ["sprint", "back", "matchup", "transition"],
  },
]

export function suggestTrigger(value: string | ReplaySessionView) {
  if (isSession(value)) {
    if (value.triggerWord?.trim()) {
      return value.triggerWord.trim().toUpperCase()
    }

    if (value.coachNote?.trim()) {
      return suggestTrigger(value.coachNote)
    }

    return tacticalSystemForSession(value).defaultTrigger
  }

  const phrase = value.toLowerCase()
  const match = TRIGGER_RULES.find((rule) =>
    rule.terms.some((term) => phrase.includes(term))
  )

  return match?.trigger || "REVIEW"
}
