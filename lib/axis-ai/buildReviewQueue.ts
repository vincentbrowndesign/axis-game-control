import { suggestBehaviorTags } from "@/lib/axis-ai/suggestBehaviorTags"
import { stageForSession } from "@/lib/axis-ai/mapWorkflowStage"
import type { ReplaySessionView } from "@/types/memory"

export type ReviewQueueItem = {
  session: ReplaySessionView
  reason: string
  tags: string[]
}

function behaviorText(session: ReplaySessionView) {
  return (
    session.coachNote ||
    session.behaviorSentence ||
    session.coachCorrection ||
    session.coachFlaw ||
    ""
  ).trim()
}

export function buildReviewQueue(sessions: ReplaySessionView[]) {
  return [...sessions]
    .map<ReviewQueueItem>((session) => {
      const text = behaviorText(session)
      const tags =
        session.aiSuggestedTags?.length
          ? session.aiSuggestedTags
          : suggestBehaviorTags(text)
      const stage = stageForSession(session)
      const needsSentence = !text
      const pressureClip = stage === "SCRIMMAGE" || stage === "GAME"

      return {
        session,
        reason: needsSentence
          ? "Needs a sentence"
          : pressureClip
            ? "Check under pressure"
            : "Watch again",
        tags,
      }
    })
    .sort((a, b) => {
      const aNeedsSentence = a.reason === "Needs a sentence" ? 0 : 1
      const bNeedsSentence = b.reason === "Needs a sentence" ? 0 : 1

      return aNeedsSentence - bNeedsSentence || b.session.createdAt - a.session.createdAt
    })
}
