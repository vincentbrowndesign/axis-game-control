import { PossessionEvent, SpurtsSession, TeamSide } from "../session/types";

export function addEvent(
  session: SpurtsSession,
  team: TeamSide,
  value: 0 | 1 | 2 | 3
): SpurtsSession {
  const event: PossessionEvent = {
    id: crypto.randomUUID(),
    type: "possession",
    team,
    value,
    createdAt: Date.now(),
    sessionTime: Date.now() - session.createdAt,
  };

  return {
    ...session,
    events: [...session.events, event],
  };
}