export type OperationalSessionState =
  | "READY"
  | "STARTING"
  | "LIVE"
  | "RECONNECTING"
  | "RECOVERING"
  | "FINALIZING"
  | "ARCHIVED"
  | "FAILED"

export type TransportState =
  | "IDLE"
  | "ACQUIRING"
  | "PUBLISHING"
  | "INTERRUPTED"
  | "RECOVERING"
  | "CLOSED"
  | "FAILED"

export type ArchiveState =
  | "OPEN"
  | "FINALIZING"
  | "STORED"
  | "FAILED"

export type TemporalEventTier = "PRIMARY" | "SECONDARY" | "TERTIARY"

export type TemporalTeam = "HOME" | "AWAY" | null

export type TemporalEventSource =
  | "operator"
  | "system"
  | "transport"
  | "clock"
  | "future_inference"

export type PrimaryTemporalEventType =
  | "score"
  | "marker"
  | "snapshot"
  | "period"
  | "clock"
  | "session_start"
  | "session_end"

export type SecondaryTemporalEventType =
  | "system_state"
  | "reconnect"
  | "stabilization"
  | "orientation_change"
  | "motion_spike"
  | "audio_spike"
  | "timeout"
  | "substitution"
  | "undo"
  | "correction"

export type TertiaryTemporalEventType =
  | "inference"
  | "pressure_spike"
  | "momentum_swing"
  | "recovery"
  | "collapse"
  | "volatility"

export type TemporalEventType =
  | PrimaryTemporalEventType
  | SecondaryTemporalEventType
  | TertiaryTemporalEventType

export type ClipWindow = {
  before: number
  after: number
}

export type TemporalSession = {
  id: string
  createdAt: string
  startedAt: string | null
  endedAt: string | null
  operatorId: string | null
  status: OperationalSessionState
  duration: number
  transportState: TransportState
  archiveState: ArchiveState
}

export type TemporalEvent = {
  id: string
  type: TemporalEventType
  tier: TemporalEventTier
  order: number
  createdAt: string
  sessionTime: number
  gameClock: string
  period: number
  team: TemporalTeam
  confidence: number
  source: TemporalEventSource
  metadata: Record<string, unknown>
  clipWindow: ClipWindow
}

export type TemporalEventInput = {
  sessionId: string
  type: TemporalEventType
  tier?: TemporalEventTier
  order: number
  createdAt: string
  sessionTime: number
  gameClock: string
  period: number
  team?: TemporalTeam
  confidence?: number
  source?: TemporalEventSource
  metadata?: Record<string, unknown>
  clipWindow?: Partial<ClipWindow>
}

export type DensityRegionKind = "quiet" | "dense" | "clustered" | "volatility"

export type TemporalDensityRegion = {
  id: string
  kind: DensityRegionKind
  start: number
  end: number
  weight: number
  eventIds: string[]
}

export type TemporalEventIndex = {
  byType: Record<string, string[]>
  byTeam: Record<string, string[]>
  byPeriod: Record<string, string[]>
  byGameClock: Record<string, string[]>
  bySessionSecond: Record<string, string[]>
  byScoreDifferential: Record<string, string[]>
  byRailPosition: Record<string, string[]>
}

export type LiveMemory = {
  session: TemporalSession
  rawEvents: TemporalEvent[]
  densityMap: TemporalDensityRegion[]
}

export type ReplayMemory = {
  session: TemporalSession
  chronological: TemporalEvent[]
  index: TemporalEventIndex
  densityMap: TemporalDensityRegion[]
  rail: Array<{
    id: string
    eventId: string
    position: number
    weight: number
    type: TemporalEventType
  }>
}

export type ArchiveMemory = {
  session: TemporalSession
  videoAsset: {
    url: string | null
    playbackId: string | null
    liveSessionId: string | null
  }
  replayObject: ReplayMemory
  scoreHistory: TemporalEvent[]
  clockHistory: TemporalEvent[]
  eventMemory: TemporalEvent[]
  snapshots: TemporalEvent[]
  markers: TemporalEvent[]
  systemStates: TemporalEvent[]
  replayRail: ReplayMemory["rail"]
  densityMap: TemporalDensityRegion[]
}

const defaultClipWindow: ClipWindow = {
  before: 8,
  after: 8,
}

const emptyIndex = (): TemporalEventIndex => ({
  byType: {},
  byTeam: {},
  byPeriod: {},
  byGameClock: {},
  bySessionSecond: {},
  byScoreDifferential: {},
  byRailPosition: {},
})

function normalizeClock(clock: string) {
  return clock.trim() || "00:00"
}

function eventWeight(event: TemporalEvent) {
  if (event.type === "score") {
    const points = Number(event.metadata.points || 1)
    return Math.max(1, Math.min(3, points))
  }

  if (event.type === "snapshot") return 3
  if (event.tier === "TERTIARY") return 3
  if (event.type === "marker") return 1.4
  if (event.type === "reconnect") return 1.2
  if (event.type === "clock") return 0.65
  return 1
}

function addToIndex(index: Record<string, string[]>, key: string, eventId: string) {
  index[key] = [...(index[key] || []), eventId]
}

function compareEvents(a: TemporalEvent, b: TemporalEvent) {
  if (a.sessionTime !== b.sessionTime) return a.sessionTime - b.sessionTime
  if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt)
  if (a.order !== b.order) return a.order - b.order
  return a.id.localeCompare(b.id)
}

function scoreDifferentialForEvent(event: TemporalEvent) {
  const differential = Number(event.metadata.scoreDifferential)
  if (Number.isFinite(differential)) return String(differential)
  return "0"
}

export function createTemporalSession({
  id,
  createdAt,
  operatorId = null,
}: {
  id: string
  createdAt: string
  operatorId?: string | null
}): TemporalSession {
  return {
    id,
    createdAt,
    startedAt: null,
    endedAt: null,
    operatorId,
    status: "READY",
    duration: 0,
    transportState: "IDLE",
    archiveState: "OPEN",
  }
}

export function transitionTemporalSession({
  session,
  status,
  at,
  duration,
  transportState,
  archiveState,
}: {
  session: TemporalSession
  status: OperationalSessionState
  at: string
  duration: number
  transportState?: TransportState
  archiveState?: ArchiveState
}): TemporalSession {
  return {
    ...session,
    status,
    startedAt:
      session.startedAt || (status === "STARTING" || status === "LIVE" ? at : null),
    endedAt: status === "ARCHIVED" || status === "FAILED" ? at : session.endedAt,
    duration,
    transportState: transportState || session.transportState,
    archiveState: archiveState || session.archiveState,
  }
}

export function createTemporalEvent({
  sessionId,
  type,
  tier = "PRIMARY",
  order,
  createdAt,
  sessionTime,
  gameClock,
  period,
  team = null,
  confidence = 1,
  source = "operator",
  metadata = {},
  clipWindow = {},
}: TemporalEventInput): TemporalEvent {
  const safeSessionTime = Math.max(0, Number.isFinite(sessionTime) ? sessionTime : 0)
  const stableTime = Math.round(safeSessionTime * 1000).toString(36)
  const id = `${sessionId}-${type}-${stableTime}-${order}`

  return {
    id,
    type,
    tier,
    order,
    createdAt,
    sessionTime: safeSessionTime,
    gameClock: normalizeClock(gameClock),
    period: Math.max(1, period || 1),
    team,
    confidence: Math.max(0, Math.min(1, confidence)),
    source,
    metadata,
    clipWindow: {
      before: clipWindow.before ?? defaultClipWindow.before,
      after: clipWindow.after ?? defaultClipWindow.after,
    },
  }
}

export function orderTemporalEvents(events: TemporalEvent[]) {
  return [...events].sort(compareEvents)
}

export function appendTemporalEvent(events: TemporalEvent[], event: TemporalEvent) {
  if (events.some((existing) => existing.id === event.id)) {
    return orderTemporalEvents(events)
  }

  return orderTemporalEvents([...events, event])
}

export function isTemporalEvent(value: unknown): value is TemporalEvent {
  if (!value || typeof value !== "object") return false

  const event = value as Partial<TemporalEvent>

  return (
    typeof event.id === "string" &&
    typeof event.type === "string" &&
    typeof event.createdAt === "string" &&
    typeof event.sessionTime === "number" &&
    typeof event.gameClock === "string" &&
    typeof event.period === "number" &&
    typeof event.order === "number" &&
    typeof event.metadata === "object"
  )
}

export function buildEventIndex({
  events,
  duration,
}: {
  events: TemporalEvent[]
  duration: number
}): TemporalEventIndex {
  const index = emptyIndex()
  const safeDuration = Math.max(1, duration)

  for (const event of orderTemporalEvents(events)) {
    addToIndex(index.byType, event.type, event.id)
    addToIndex(index.byPeriod, String(event.period), event.id)
    addToIndex(index.byGameClock, event.gameClock, event.id)
    addToIndex(index.bySessionSecond, String(Math.floor(event.sessionTime)), event.id)
    addToIndex(index.byScoreDifferential, scoreDifferentialForEvent(event), event.id)
    addToIndex(
      index.byRailPosition,
      String(Math.round((event.sessionTime / safeDuration) * 100)),
      event.id
    )

    if (event.team) addToIndex(index.byTeam, event.team, event.id)
  }

  return index
}

export function buildDensityMap({
  events,
  duration,
}: {
  events: TemporalEvent[]
  duration: number
}): TemporalDensityRegion[] {
  const chronological = orderTemporalEvents(events)
  const safeDuration = Math.max(duration, chronological.at(-1)?.sessionTime || 0, 1)
  const windowSize = Math.max(8, Math.min(24, safeDuration / 8 || 8))
  const regionCount = Math.max(1, Math.ceil(safeDuration / windowSize))
  const regions: TemporalDensityRegion[] = []

  for (let index = 0; index < regionCount; index += 1) {
    const start = index * windowSize
    const end = start + windowSize
    const regionEvents = chronological.filter(
      (event) => event.sessionTime >= start && event.sessionTime < end
    )
    const weight = regionEvents.reduce((total, event) => total + eventWeight(event), 0)
    const types = new Set(regionEvents.map((event) => event.type))
    const hasVolatility =
      regionEvents.some((event) => event.type === "reconnect") ||
      types.has("score") && types.has("marker") && regionEvents.length >= 4

    regions.push({
      id: `density-${index + 1}`,
      kind:
        weight === 0
          ? "quiet"
          : hasVolatility
            ? "volatility"
            : regionEvents.length >= 4
              ? "clustered"
              : weight >= 3
                ? "dense"
                : "quiet",
      start,
      end,
      weight,
      eventIds: regionEvents.map((event) => event.id),
    })
  }

  return regions
}

export function buildReplayMemory({
  session,
  events,
}: {
  session: TemporalSession
  events: TemporalEvent[]
}): ReplayMemory {
  const chronological = orderTemporalEvents(events)
  const duration = Math.max(session.duration, chronological.at(-1)?.sessionTime || 0, 1)

  return {
    session,
    chronological,
    index: buildEventIndex({ events: chronological, duration }),
    densityMap: buildDensityMap({ events: chronological, duration }),
    rail: chronological.map((event) => ({
      id: `rail-${event.id}`,
      eventId: event.id,
      position: Math.max(0, Math.min(100, (event.sessionTime / duration) * 100)),
      weight: eventWeight(event),
      type: event.type,
    })),
  }
}

export function buildLiveMemory({
  session,
  events,
}: {
  session: TemporalSession
  events: TemporalEvent[]
}): LiveMemory {
  return {
    session,
    rawEvents: orderTemporalEvents(events),
    densityMap: buildDensityMap({ events, duration: session.duration }),
  }
}

export function buildArchiveMemory({
  session,
  events,
  playbackId,
  liveSessionId,
}: {
  session: TemporalSession
  events: TemporalEvent[]
  playbackId: string | null
  liveSessionId: string | null
}): ArchiveMemory {
  const replayObject = buildReplayMemory({ session, events })

  return {
    session,
    videoAsset: {
      url: playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null,
      playbackId,
      liveSessionId,
    },
    replayObject,
    scoreHistory: replayObject.chronological.filter((event) => event.type === "score"),
    clockHistory: replayObject.chronological.filter((event) => event.type === "clock"),
    eventMemory: replayObject.chronological,
    snapshots: replayObject.chronological.filter((event) => event.type === "snapshot"),
    markers: replayObject.chronological.filter((event) => event.type === "marker"),
    systemStates: replayObject.chronological.filter(
      (event) => event.type === "system_state" || event.type === "reconnect"
    ),
    replayRail: replayObject.rail,
    densityMap: replayObject.densityMap,
  }
}
