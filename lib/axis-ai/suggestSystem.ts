type SystemSuggestion = {
  system: string
  reason: string
}

const SYSTEM_RULES: {
  system: string
  reason: string
  terms: string[]
}[] = [
  {
    system: "High PNR",
    reason: "Screen navigation language",
    terms: ["screen", "pick", "pnr", "force you", "reject"],
  },
  {
    system: "Weak-Side Tag",
    reason: "Help and recover language",
    terms: ["tag", "closeout", "run back out", "low man", "corner"],
  },
  {
    system: "Closeout Attack",
    reason: "Closeout and first step language",
    terms: ["closeout", "catch", "first step", "stay low"],
  },
  {
    system: "Slot Drive",
    reason: "Drive and kick language",
    terms: ["slot", "drive", "kick", "paint", "help committed"],
  },
  {
    system: "Transition Defense",
    reason: "Sprint and matchup language",
    terms: ["sprint", "matchup", "back", "spot", "transition"],
  },
]

export function suggestSystem(behaviorPhrase: string): SystemSuggestion {
  const phrase = behaviorPhrase.toLowerCase()
  const match = SYSTEM_RULES.find((rule) =>
    rule.terms.some((term) => phrase.includes(term))
  )

  return match
    ? {
        system: match.system,
        reason: match.reason,
      }
    : {
        system: "Review",
        reason: "Coach confirms folder later",
      }
}
