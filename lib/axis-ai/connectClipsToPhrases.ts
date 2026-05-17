import type { CoachingPhrase } from "@/lib/axis-ai/clusterCoachingLanguage"
import type { ReplaySessionView } from "@/types/memory"

export type ClipPhraseLink = {
  sessionId: string
  phrase: string
  phraseId?: string
  confidence: number
  reason: string
}

export function connectClipsToPhrases({
  clips,
  phrases,
}: {
  clips: ReplaySessionView[]
  phrases: CoachingPhrase[]
}) {
  const sortedPhrases = [...phrases].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  )

  return clips.flatMap<ClipPhraseLink>((clip) => {
    const direct = sortedPhrases.find((phrase) => phrase.sessionId === clip.id)
    const nearby = sortedPhrases.find((phrase) => {
      if (!phrase.createdAt) return false

      return Math.abs(clip.createdAt - phrase.createdAt) <= 1000 * 60 * 8
    })
    const match = direct || nearby

    if (!match) return []

    return [
      {
        sessionId: clip.id,
        phrase: match.phrase,
        phraseId: match.id,
        confidence: direct ? 0.92 : 0.72,
        reason: direct ? "same clip" : "nearby practice phrase",
      },
    ]
  })
}
