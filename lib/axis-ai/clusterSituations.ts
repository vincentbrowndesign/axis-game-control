import { tacticalSystemForSession } from "@/lib/axis/reinforcement"
import type { ReplaySessionView } from "@/types/memory"

export function clusterSituations(sessions: ReplaySessionView[]) {
  const clusters = new Map<string, ReplaySessionView[]>()

  for (const session of sessions) {
    const system = tacticalSystemForSession(session).name
    clusters.set(system, [...(clusters.get(system) || []), session])
  }

  return [...clusters.entries()].map(([system, clips]) => ({
    system,
    clips,
  }))
}
