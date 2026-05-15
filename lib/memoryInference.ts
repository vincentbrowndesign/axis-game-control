import type {
  MemoryState,
  MemoryTimelineEvent,
  ReplaySessionView,
} from "@/types/memory"

type BuildMemoryStateInput = {
  session: ReplaySessionView
  previousSessions?: ReplaySessionView[]
  player?: string | null
}

function hasAssignedPlayer(player?: string | null) {
  return Boolean(player && player.trim() && player !== "Unassigned")
}

function samePlayer(
  session: ReplaySessionView,
  player: string | null
) {
  if (!hasAssignedPlayer(player)) {
    return !hasAssignedPlayer(session.player)
  }

  return session.player === player
}

function formatClock(seconds?: number) {
  if (!seconds || Number.isNaN(seconds)) return "00:00"

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`
}

function addEvent(
  events: MemoryTimelineEvent[],
  event: MemoryTimelineEvent
) {
  if (!events.some((item) => item.label === event.label)) {
    events.push(event)
  }
}

export function buildMemoryState({
  session,
  previousSessions = [],
  player = session.player,
}: BuildMemoryStateInput): MemoryState {
  const assigned = hasAssignedPlayer(player)
  const relatedPrevious = previousSessions.filter((item) =>
    samePlayer(item, assigned ? player : null)
  )
  const memoryCount = relatedPrevious.length + 1
  const duration = session.duration || 0
  const hasTags = Array.isArray(session.tags) && session.tags.length > 0
  const sameEnvironmentBefore = relatedPrevious.some(
    (item) => item.environment === session.environment
  )
  const previousWithin24Hours = relatedPrevious.some(
    (item) =>
      Math.abs(session.createdAt - item.createdAt) <=
      24 * 60 * 60 * 1000
  )

  let contextLine = "Session added to archive."

  if (!assigned) {
    contextLine = "Replay stored. Player not assigned."
  } else if (duration > 0 && duration < 5) {
    contextLine = "Short memory stored."
  } else if (memoryCount === 1) {
    contextLine = "First session stored."
  } else if (memoryCount > 1) {
    contextLine = "Previous session located."
  }

  if (assigned && duration >= 30) {
    contextLine = "Session added to archive."
  }

  let ambientLine = "Context building."

  if (!assigned && relatedPrevious.length > 0) {
    ambientLine = "Unassigned memory stored."
  } else if (previousWithin24Hours) {
    ambientLine = "Signal returned."
  } else if (hasTags) {
    ambientLine = "Tagged memory available."
  } else if (sameEnvironmentBefore) {
    ambientLine = "Environment recognized."
  } else if (memoryCount > 1) {
    ambientLine = "Session continuity found."
  } else if (assigned) {
    ambientLine = "Player context active."
  }

  const events: MemoryTimelineEvent[] = []

  addEvent(events, {
    label:
      session.source === "camera"
        ? "LIVE CAPTURE STORED"
        : "FOOTAGE ACCEPTED",
    time: "00:00",
    body:
      session.source === "camera"
        ? "Live capture added to memory."
        : "Existing footage added to memory.",
    tone: "cyan",
  })

  addEvent(events, {
    label: assigned ? "PLAYER LINKED" : "PLAYER NOT ASSIGNED",
    time: "00:00",
    body: assigned
      ? "Replay connected to player context."
      : "Replay stored without a player link.",
    tone: assigned ? "lime" : "zinc",
  })

  if (sameEnvironmentBefore) {
    addEvent(events, {
      label: "ENVIRONMENT RECOGNIZED",
      time: formatClock(Math.max(duration * 0.25, 1)),
      body: `${session.environment} memory found before.`,
      tone: "cyan",
    })
  }

  if (memoryCount > 1) {
    addEvent(events, {
      label: "PREVIOUS SESSION LOCATED",
      time: formatClock(Math.max(duration * 0.4, 1)),
      body: "Archive contains earlier memory.",
      tone: "lime",
    })
  } else {
    addEvent(events, {
      label: "CONTEXT BUILDING",
      time: formatClock(Math.max(duration * 0.4, 1)),
      body: "New memory context started.",
      tone: "zinc",
    })
  }

  addEvent(events, {
    label: duration >= 30 ? "SESSION ADDED" : "MEMORY STORED",
    time: formatClock(duration),
    body:
      duration >= 30
        ? "Session added to archive."
        : "Memory stored.",
    tone: "lime",
  })

  addEvent(events, {
    label: "ARCHIVE ACTIVE",
    time: formatClock(duration),
    body: "Replay available in memory.",
    tone: "lime",
  })

  const confidence =
    50 +
    (assigned ? 15 : 0) +
    (memoryCount > 1 ? 15 : 0) +
    (sameEnvironmentBefore ? 10 : 0) +
    (hasTags ? 5 : 0) +
    (duration >= 5 ? 5 : 0)

  return {
    headline: "Memory Online",
    status: "Memory Stored",
    ambientLine,
    contextLine,
    archiveStatus: memoryCount > 0 ? "Archive Active" : "Archive Ready",
    memoryCount,
    timelineEvents: events,
    confidence: Math.min(confidence, 95),
  }
}
