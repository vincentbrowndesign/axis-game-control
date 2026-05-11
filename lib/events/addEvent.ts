import { SpurtsEvent } from "./eventTypes";

import { SpurtsSession } from "../session/types";

export function addEvent(
  session: SpurtsSession,
  event: SpurtsEvent
): SpurtsSession {
  return {
    ...session,

    events: [...session.events, event],
  };
}