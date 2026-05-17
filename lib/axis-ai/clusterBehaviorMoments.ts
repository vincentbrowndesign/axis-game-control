import { suggestConstraint } from "@/lib/axis-ai/suggestConstraint"
import { suggestSystem } from "@/lib/axis-ai/suggestSystem"
import { suggestTrigger } from "@/lib/axis-ai/suggestTrigger"
import { behaviorClusterId } from "@/lib/axis-ai/suggestBehaviorTags"
import { stageForSession } from "@/lib/axis-ai/mapWorkflowStage"
import { coachingNoteLine } from "@/lib/archive/sessionRollup"
import type { ReplaySessionView } from "@/types/memory"

export type BehaviorMomentCluster = {
  id: string
  behavior: string
  system: string
  constraint: string
  trigger: string
  stages: string[]
  clips: ReplaySessionView[]
}

function behaviorText(session: ReplaySessionView) {
  return (
    session.coachNote ||
    session.coachCorrection ||
    session.coachFlaw ||
    coachingNoteLine(session)
  ).trim()
}

export function clusterBehaviorMoments(
  sessions: ReplaySessionView[]
): BehaviorMomentCluster[] {
  const clusters = new Map<string, BehaviorMomentCluster>()

  for (const session of sessions) {
    const behavior = behaviorText(session)
    if (!behavior) continue

    const system = suggestSystem(behavior).system
    const constraint = suggestConstraint(behavior).constraint
    const trigger = suggestTrigger(behavior)
    const key = session.aiClusterId || behaviorClusterId(behavior)
    const current = clusters.get(key)

    if (current) {
      current.clips.push(session)
      current.stages = [
        ...new Set([...current.stages, stageForSession(session)]),
      ]
    } else {
      clusters.set(key, {
        id: key,
        behavior,
        system,
        constraint,
        trigger,
        stages: [stageForSession(session)],
        clips: [session],
      })
    }
  }

  return [...clusters.values()].sort((a, b) => b.clips.length - a.clips.length)
}
