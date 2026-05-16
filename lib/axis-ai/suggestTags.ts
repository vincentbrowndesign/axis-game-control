import { tacticalSystemForSession } from "@/lib/axis/reinforcement"
import type { ReplaySessionView } from "@/types/memory"

export function suggestTags(session: ReplaySessionView) {
  const system = tacticalSystemForSession(session)
  const tags = [system.name]

  if (session.repeatTomorrow) tags.push("repeat")
  if (session.constraint) tags.push(session.constraint)
  if (session.stressPhase) tags.push(session.stressPhase)

  return [...new Set(tags)]
}
