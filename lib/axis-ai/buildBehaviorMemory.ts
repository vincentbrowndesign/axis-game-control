import {
  clusterCoachingLanguage,
  type CoachingPhrase,
} from "@/lib/axis-ai/clusterCoachingLanguage"
import { connectClipsToPhrases } from "@/lib/axis-ai/connectClipsToPhrases"
import { buildReviewQueue } from "@/lib/axis-ai/buildReviewQueue"
import type { ReplaySessionView } from "@/types/memory"

function phraseFromClip(session: ReplaySessionView): CoachingPhrase | null {
  const phrase =
    session.coachNote ||
    session.behaviorSentence ||
    session.coachCorrection ||
    session.coachFlaw ||
    ""

  if (!phrase.trim()) return null

  return {
    id: session.id,
    phrase,
    createdAt: session.createdAt,
    sessionId: session.id,
    workflowStage: session.workflowStage,
  }
}

export function buildBehaviorMemory({
  sessions,
  phrases = [],
}: {
  sessions: ReplaySessionView[]
  phrases?: CoachingPhrase[]
}) {
  const phraseList = [
    ...sessions.map(phraseFromClip).filter((item): item is CoachingPhrase => Boolean(item)),
    ...phrases,
  ]
  const clusters = clusterCoachingLanguage(phraseList)
  const links = connectClipsToPhrases({
    clips: sessions,
    phrases: phraseList,
  })
  const top = clusters.slice(0, 3).map((cluster) => cluster.label)

  return {
    clusters,
    links,
    reviewQueue: buildReviewQueue(sessions),
    summary: top.length
      ? `Most repeated: ${top.join(", ")}`
      : "No repeated phrases yet.",
  }
}
