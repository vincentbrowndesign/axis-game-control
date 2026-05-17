type ConstraintSuggestion = {
  constraint: string
  reason: string
}

const CONSTRAINT_RULES: {
  constraint: string
  reason: string
  terms: string[]
}[] = [
  {
    constraint: "Reject screen",
    reason: "Avoid being sent into the pick",
    terms: ["screen", "pick", "force you", "reject"],
  },
  {
    constraint: "Tag before closeout",
    reason: "Help responsibility before recovery",
    terms: ["tag", "closeout", "run back out", "low man"],
  },
  {
    constraint: "2 dribbles max",
    reason: "Fast advantage decision",
    terms: ["explode", "attack", "first step", "drive"],
  },
  {
    constraint: "No retreat dribble",
    reason: "Hold space under pressure",
    terms: ["drift", "float", "retreat", "wide"],
  },
  {
    constraint: "Sprint matchups",
    reason: "Early transition responsibility",
    terms: ["sprint", "matchup", "back", "beat him"],
  },
]

export function suggestConstraint(behaviorPhrase: string): ConstraintSuggestion {
  const phrase = behaviorPhrase.toLowerCase()
  const match = CONSTRAINT_RULES.find((rule) =>
    rule.terms.some((term) => phrase.includes(term))
  )

  return match
    ? {
        constraint: match.constraint,
        reason: match.reason,
      }
    : {
        constraint: "Confirm in review",
        reason: "Coach keeps final meaning",
      }
}
