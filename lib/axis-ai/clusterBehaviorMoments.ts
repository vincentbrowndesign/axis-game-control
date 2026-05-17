import { suggestConstraint } from "@/lib/axis-ai/suggestConstraint"
import { suggestSystem } from "@/lib/axis-ai/suggestSystem"
import { suggestTrigger } from "@/lib/axis-ai/suggestTrigger"
import { coachingNoteLine } from "@/lib/archive/sessionRollup"
import type { ReplaySessionView } from "@/types/memory"

export type BehaviorMomentCluster = {
  behavior: string
  system: string
  constraint: string
  trigger: string
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
    const key = `${system}:${constraint}:${trigger}`
    const current = clusters.get(key)

    if (current) {
      current.clips.push(session)
    } else {
      clusters.set(key, {
        behavior,
        system,
        constraint,
        trigger,
        clips: [session],
      })
    }
  }

  return [...clusters.values()].sort((a, b) => b.clips.length - a.clips.length)
}
