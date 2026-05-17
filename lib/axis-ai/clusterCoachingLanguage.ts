export type CoachingPhrase = {
  id?: string
  phrase: string
  createdAt?: number
  sessionId?: string
  workflowStage?: string
}

export type CoachingLanguageCluster = {
  id: string
  label: string
  phrases: CoachingPhrase[]
  count: number
}

const LANGUAGE_RULES = [
  {
    id: "stay-low",
    label: "Stay low",
    terms: ["stay low", "get lower", "sink", "hips"],
  },
  {
    id: "sprint-back",
    label: "Sprint back",
    terms: ["sprint back", "get back", "transition"],
  },
  {
    id: "stop-drifting",
    label: "Stop drifting",
    terms: ["drift", "floating", "float", "wide"],
  },
  {
    id: "tag-first",
    label: "Tag first",
    terms: ["tag first", "tag", "before closing", "before closeout"],
  },
  {
    id: "beat-spot",
    label: "Beat him there",
    terms: ["beat him", "beat her", "spot", "there first"],
  },
]

export function normalizeCoachingPhrase(phrase: string) {
  return phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function clusterForPhrase(phrase: string) {
  const normalized = normalizeCoachingPhrase(phrase)
  const match = LANGUAGE_RULES.find((rule) =>
    rule.terms.some((term) => normalized.includes(term))
  )

  if (match) return match

  const firstWords = normalized.split(" ").slice(0, 3).join("-")

  return {
    id: firstWords || "review",
    label: phrase.trim() || "Review",
    terms: [],
  }
}

export function clusterCoachingLanguage(phrases: CoachingPhrase[]) {
  const clusters = new Map<string, CoachingLanguageCluster>()

  for (const phrase of phrases) {
    const text = phrase.phrase.trim()
    if (!text) continue

    const rule = clusterForPhrase(text)
    const current = clusters.get(rule.id)

    if (current) {
      current.phrases.push(phrase)
      current.count += 1
    } else {
      clusters.set(rule.id, {
        id: rule.id,
        label: rule.label,
        phrases: [phrase],
        count: 1,
      })
    }
  }

  return [...clusters.values()].sort((a, b) => b.count - a.count)
}
