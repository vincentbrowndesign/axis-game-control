import {
  normalizeCoachingPhrase,
  type CoachingLanguageCluster,
} from "@/lib/axis-ai/clusterCoachingLanguage"
import type { AxisVoiceNote } from "@/types/memory"

export type LandmarkMemory = {
  note: AxisVoiceNote
  normalizedPhrase: string
  recurrenceCount: number
  similarMoments: AxisVoiceNote[]
  resurfacingPriority: number
}

export function buildLandmarkMemory({
  note,
  notes,
  clusters,
  score,
}: {
  note: AxisVoiceNote
  notes: AxisVoiceNote[]
  clusters: CoachingLanguageCluster[]
  score: number
}) {
  const normalizedPhrase =
    note.normalized_phrase || normalizeCoachingPhrase(note.phrase)
  const cluster = clusters.find((current) =>
    current.phrases.some((phrase) => phrase.id === note.id)
  )
  const similarIds = new Set(
    cluster?.phrases
      .map((phrase) => phrase.id)
      .filter((id): id is string => Boolean(id)) || []
  )
  const similarMoments = notes
    .filter((current) => current.id !== note.id && similarIds.has(current.id))
    .slice(0, 6)

  return {
    note,
    normalizedPhrase,
    recurrenceCount: cluster?.count || 1,
    similarMoments,
    resurfacingPriority: score,
  } satisfies LandmarkMemory
}
