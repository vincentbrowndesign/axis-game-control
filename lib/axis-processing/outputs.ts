export type AxisHighlightSequence = {
  clipIds: string[]
  durationMs: number
  id: string
  label: string
  reason: string
  weight: number
}

export type AxisBroadcastOutput = {
  createdAt: string
  headline: string
  highlights: AxisHighlightSequence[]
  sections: Array<{
    label: string
    value: string
  }>
  status: "ready"
  title: string
  type: "game-recap"
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function asRecordArray(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object"
  )
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export function buildHighlightSequences({
  clips,
  sessionId,
}: {
  clips: unknown
  sessionId: string
}): AxisHighlightSequence[] {
  const clipValues = asRecordArray(clips)
  const ranked = [...clipValues].sort(
    (first, second) => number(second.weight) - number(first.weight)
  )

  if (ranked.length === 0) {
    return [
      {
        clipIds: [],
        durationMs: 0,
        id: `${sessionId}-highlight-sequence-01`,
        label: "Game Story",
        reason: "Replay-ready sequence will appear after clips finish.",
        weight: 0,
      },
    ]
  }

  const top = ranked.slice(0, 5)
  const pressure = ranked.filter((clip) =>
    ["pressure_spike", "momentum_shift", "collapse_window"].includes(
      text(clip.reason)
    )
  )
  const scoring = ranked.filter((clip) =>
    ["shot_attempt", "transition", "turnover"].includes(text(clip.reason))
  )

  return [
    sequenceFromClips({
      clips: top,
      id: `${sessionId}-highlight-sequence-01`,
      label: "Game Story",
      reason: "Top replay moments from the game.",
    }),
    sequenceFromClips({
      clips: pressure.length ? pressure.slice(0, 4) : top.slice(0, 3),
      id: `${sessionId}-highlight-sequence-02`,
      label: "Momentum",
      reason: "Pressure and momentum changes.",
    }),
    sequenceFromClips({
      clips: scoring.length ? scoring.slice(0, 4) : top.slice(0, 3),
      id: `${sessionId}-highlight-sequence-03`,
      label: "Key Plays",
      reason: "Coach-friendly basketball moments.",
    }),
  ]
}

export function buildBroadcastOutput({
  clipCount,
  highlights,
  sessionTitle,
  stats,
}: {
  clipCount: number
  highlights: AxisHighlightSequence[]
  sessionTitle: string
  stats: unknown
}): AxisBroadcastOutput {
  const statRecord = asRecord(stats)
  const possessionCount = number(statRecord.possessionCount)
  const playerCount = number(statRecord.playerCount)

  return {
    createdAt: new Date().toISOString(),
    headline:
      clipCount > 0
        ? "Replay, clips, stats, and recap are ready."
        : "Replay and recap shell are ready.",
    highlights,
    sections: [
      {
        label: "Replay",
        value: "Ready",
      },
      {
        label: "Clips",
        value: String(clipCount),
      },
      {
        label: "Stats",
        value:
          possessionCount > 0
            ? `${possessionCount} possessions`
            : "Prepared",
      },
      {
        label: "Players",
        value: playerCount > 0 ? String(playerCount) : "Detected as available",
      },
    ],
    status: "ready",
    title: `${sessionTitle || "Game"} Recap`,
    type: "game-recap",
  }
}

export function buildOutputBundle({
  clips,
  metadata,
  replayHref,
  sessionId,
  sessionTitle,
}: {
  clips: unknown
  metadata: Record<string, unknown>
  replayHref: string
  sessionId: string
  sessionTitle: string
}) {
  const clipValues = asRecordArray(clips)
  const stats = asRecord(metadata.stats)
  const timeline = asRecord(metadata.timeline)
  const telemetry = asRecord(metadata.telemetry)
  const highlights = buildHighlightSequences({
    clips: clipValues,
    sessionId,
  })
  const broadcast = buildBroadcastOutput({
    clipCount: clipValues.length,
    highlights,
    sessionTitle,
    stats,
  })

  return {
    broadcast,
    clips: {
      count: clipValues.length,
      values: clipValues,
    },
    highlights,
    readyAt: new Date().toISOString(),
    replay: {
      href: replayHref,
      rail: {
        status: text(telemetry.path) ? "ready" : "baseline",
        telemetryPath: text(telemetry.path),
      },
      status: "ready",
      topology: {
        clipWindowCount: number(timeline.clipWindowCount),
        eventCount: number(timeline.eventCount),
        path: text(timeline.path),
        possessionCount: number(timeline.possessionCount),
        status: text(timeline.path) ? "ready" : "baseline",
      },
    },
    stats: {
      path: text(stats.path),
      playerCount: number(stats.playerCount),
      possessionCount: number(stats.possessionCount),
      status: text(stats.path) ? "ready" : "baseline",
      teamCount: number(stats.teamCount),
    },
    status: "ready",
  }
}

function sequenceFromClips({
  clips,
  id,
  label,
  reason,
}: {
  clips: Record<string, unknown>[]
  id: string
  label: string
  reason: string
}): AxisHighlightSequence {
  return {
    clipIds: clips.map((clip) => text(clip.id, text(clip.path))).filter(Boolean),
    durationMs: clips.reduce(
      (total, clip) => total + number(clip.durationMs, number(clip.endMs) - number(clip.startMs)),
      0
    ),
    id,
    label,
    reason,
    weight: clips.reduce((total, clip) => total + number(clip.weight), 0) / Math.max(1, clips.length),
  }
}
