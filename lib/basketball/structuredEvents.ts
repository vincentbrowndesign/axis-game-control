import type { TelemetrySample } from "@/lib/axis-replay/telemetry"

export type CourtPoint = {
  x: number
  y: number
  z?: number
}

export type TrackedPlayer = CourtPoint & {
  id: string
  teamId?: string
  confidence?: number
}

export type BasketballTrackingFrame = {
  timestampMs: number
  ball?: CourtPoint & {
    confidence?: number
  }
  basket?: CourtPoint
  players?: TrackedPlayer[]
}

export type PossessionState = "controlled" | "loose" | "occluded"

export type StructuredBasketballEventType =
  | "possession_start"
  | "possession_end"
  | "shot_attempt"
  | "rebound"
  | "turnover"
  | "pressure_spike"
  | "transition"
  | "collapse_window"

export type StructuredBasketballEvent = {
  id: string
  type: StructuredBasketballEventType
  timestampMs: number
  confidence: number
  playerId?: string
  teamId?: string
  possessionId?: string
  clipWindow: ClipWindow
  metadata?: Record<string, number | string | boolean | null>
}

export type ClipWindow = {
  reason: StructuredBasketballEventType | "topology_knot" | "momentum_shift"
  startMs: number
  endMs: number
  anchorMs: number
  weight: number
}

export type PossessionSegment = {
  id: string
  startMs: number
  endMs: number
  state: PossessionState
  playerId: string | null
  teamId: string | null
  confidence: number
  touches: string[]
}

export type TraditionalStatsLine = {
  assists: number
  blocks: number
  fieldGoalPercentage: number
  points: number
  possessions: number
  rebounds: number
  shotAttempts: number
  shotMakes: number
  shotMisses: number
  steals: number
  touches: number
  turnovers: number
}

export type StatTimelineEntry = {
  id: string
  label: string
  playerId?: string
  possessionId?: string
  teamId?: string
  time: string
  timestampMs: number
  type:
    | "assist"
    | "make"
    | "miss"
    | "possession"
    | "rebound"
    | "steal"
    | "touch"
    | "turnover"
}

export type StructuredBasketballOutput = {
  clipWindows: ClipWindow[]
  events: StructuredBasketballEvent[]
  possessions: PossessionSegment[]
  stats: {
    possessions: number
    players: Record<string, TraditionalStatsLine>
    timeline: StatTimelineEntry[]
    teams: Record<string, TraditionalStatsLine>
  }
}

type WorkingPossession = {
  confidenceTotal: number
  endMs: number
  frames: number
  id: string
  playerId: string | null
  startMs: number
  state: PossessionState
  teamId: string | null
  touches: Set<string>
}

type HolderEstimate = {
  confidence: number
  playerId: string | null
  state: PossessionState
  teamId: string | null
}

type DetectionContext = {
  durationMs: number
  possessions: PossessionSegment[]
  telemetry: TelemetrySample[]
  tracking: BasketballTrackingFrame[]
}

const DEFAULT_BASKET: CourtPoint = { x: 0.5, y: 0.04 }

export function buildStructuredBasketballEvents({
  telemetry = [],
  tracking = [],
}: {
  telemetry?: TelemetrySample[]
  tracking?: BasketballTrackingFrame[]
}): StructuredBasketballOutput {
  const sortedTracking = [...tracking].sort((first, second) => first.timestampMs - second.timestampMs)
  const sortedTelemetry = [...telemetry].sort((first, second) => first.timestamp_ms - second.timestamp_ms)
  const durationMs = Math.max(sortedTracking.at(-1)?.timestampMs ?? 0, sortedTelemetry.at(-1)?.timestamp_ms ?? 0)
  const possessions = segmentPossessions(sortedTracking)
  const context: DetectionContext = {
    durationMs,
    possessions,
    telemetry: sortedTelemetry,
    tracking: sortedTracking,
  }

  const events = chronologicalEvents([
    ...eventsFromPossessions(possessions),
    ...detectShots(context),
    ...detectReboundsAndTurnovers(context),
    ...detectTelemetryEvents(context),
  ])
  const clipWindows = mergeClipWindows([...clipWindowsFromEvents(events, durationMs), ...clipWindowsFromTopology(sortedTelemetry, durationMs)])

  return {
    clipWindows,
    events,
    possessions,
    stats: buildTraditionalStats(events, possessions),
  }
}

export function segmentPossessions(frames: BasketballTrackingFrame[]): PossessionSegment[] {
  let active: WorkingPossession | null = null
  let lastHolder: HolderEstimate = { confidence: 0, playerId: null, state: "loose", teamId: null }
  const possessions: PossessionSegment[] = []

  for (const frame of frames) {
    const holder = estimateHolder(frame, lastHolder)

    if (!active) {
      active = createWorkingPossession(possessions.length + 1, frame.timestampMs, holder)
    } else if (shouldStartNewPossession(active, holder, frame.timestampMs)) {
      possessions.push(closePossession(active, frame.timestampMs))
      active = createWorkingPossession(possessions.length + 1, frame.timestampMs, holder)
    } else {
      extendPossession(active, frame.timestampMs, holder)
    }

    lastHolder = holder.state === "occluded" ? lastHolder : holder
  }

  if (active) possessions.push(closePossession(active, active.endMs))
  return possessions.filter((possession) => possession.endMs > possession.startMs)
}

function detectShots(context: DetectionContext): StructuredBasketballEvent[] {
  const events: StructuredBasketballEvent[] = []
  const frames = context.tracking
  if (frames.length < 4) return events

  for (let index = 2; index < frames.length - 2; index += 1) {
    const previous = frames[index - 1]
    const current = frames[index]
    const next = frames[index + 1]
    if (!previous.ball || !current.ball || !next.ball) continue

    const dtA = Math.max(1, current.timestampMs - previous.timestampMs)
    const dtB = Math.max(1, next.timestampMs - current.timestampMs)
    const vyA = (current.ball.y - previous.ball.y) / dtA
    const vyB = (next.ball.y - current.ball.y) / dtB
    const verticalAcceleration = Math.abs(vyB - vyA) * 1000
    const basket = current.basket ?? DEFAULT_BASKET
    const movingTowardBasket = distance(next.ball, basket) < distance(previous.ball, basket)
    const leavingHolder = holderDistance(current) > 0.085
    const highArc = Number(next.ball.z ?? 0) > Number(current.ball.z ?? 0) || verticalAcceleration > 0.09

    if (!movingTowardBasket || !leavingHolder || !highArc) continue
    if (events.some((event) => Math.abs(event.timestampMs - current.timestampMs) < 1400)) continue

    const possession = possessionAt(context.possessions, current.timestampMs)
    const makeConfidence = inferMakeConfidence(frames.slice(index, Math.min(frames.length, index + 9)), basket)
    events.push({
      id: eventId("shot", events.length + 1),
      type: "shot_attempt",
      timestampMs: current.timestampMs,
      confidence: clamp01(0.42 + verticalAcceleration * 1.8 + makeConfidence * 0.18),
      playerId: possession?.playerId ?? undefined,
      teamId: possession?.teamId ?? undefined,
      possessionId: possession?.id,
      clipWindow: clipAround("shot_attempt", current.timestampMs, context.durationMs, 4200, 5200, 0.82),
      metadata: {
        likelyMake: makeConfidence > 0.62,
        makeConfidence,
        outcome: makeConfidence > 0.62 ? "make" : "miss",
      },
    })
  }

  return events
}

function detectReboundsAndTurnovers(context: DetectionContext): StructuredBasketballEvent[] {
  const events: StructuredBasketballEvent[] = []

  for (let index = 1; index < context.possessions.length; index += 1) {
    const previous = context.possessions[index - 1]
    const current = context.possessions[index]
    const gap = current.startMs - previous.endMs
    const nearbyShot = nearestEventTime(context, "shot_attempt", previous.endMs, 5000)
    const confidence = clamp01((previous.confidence + current.confidence) / 2)

    if (nearbyShot !== null && gap < 3200) {
      events.push({
        id: eventId("rebound", events.length + 1),
        type: "rebound",
        timestampMs: current.startMs,
        confidence,
        playerId: current.playerId ?? undefined,
        teamId: current.teamId ?? undefined,
        possessionId: current.id,
        clipWindow: clipAround("rebound", current.startMs, context.durationMs, 3400, 4200, 0.68),
      })
    } else if (previous.teamId && current.teamId && previous.teamId !== current.teamId && gap < 2200) {
      events.push({
        id: eventId("turnover", events.length + 1),
        type: "turnover",
        timestampMs: current.startMs,
        confidence,
        playerId: previous.playerId ?? undefined,
        teamId: previous.teamId,
        possessionId: previous.id,
        clipWindow: clipAround("turnover", current.startMs, context.durationMs, 5200, 4600, 0.78),
        metadata: {
          recoveryPlayerId: current.playerId,
          recoveryTeamId: current.teamId,
        },
      })
    }
  }

  return events
}

function detectTelemetryEvents(context: DetectionContext): StructuredBasketballEvent[] {
  const events: StructuredBasketballEvent[] = []
  let lastPressureMs = -Infinity
  let lastCollapseMs = -Infinity
  let lastTransitionMs = -Infinity

  for (let index = 1; index < context.telemetry.length; index += 1) {
    const previous = context.telemetry[index - 1]
    const frame = context.telemetry[index]
    const pressureLift = frame.smoothedPressure - previous.smoothedPressure
    const density = frame.smoothedDensity
    const spacingDrop = previous.smoothedSpacing - frame.smoothedSpacing

    if (frame.smoothedPressure > 0.68 && pressureLift > 0.045 && frame.timestamp_ms - lastPressureMs > 2400) {
      lastPressureMs = frame.timestamp_ms
      events.push(telemetryEvent("pressure_spike", events.length + 1, frame.timestamp_ms, context.durationMs, frame.smoothedPressure))
    }

    if (frame.smoothedPressure > 0.62 && spacingDrop > 0.055 && density > 0.48 && frame.timestamp_ms - lastCollapseMs > 3600) {
      lastCollapseMs = frame.timestamp_ms
      events.push(telemetryEvent("collapse_window", events.length + 1, frame.timestamp_ms, context.durationMs, frame.smoothedPressure))
    }

    if (frame.smoothedControl > 0.62 && pressureLift > 0.025 && frame.timestamp_ms - lastTransitionMs > 5000) {
      lastTransitionMs = frame.timestamp_ms
      events.push(telemetryEvent("transition", events.length + 1, frame.timestamp_ms, context.durationMs, frame.smoothedControl))
    }
  }

  return events
}

function eventsFromPossessions(possessions: PossessionSegment[]): StructuredBasketballEvent[] {
  return possessions.flatMap((possession, index) => [
    {
      id: eventId("possession-start", index + 1),
      type: "possession_start" as const,
      timestampMs: possession.startMs,
      confidence: possession.confidence,
      playerId: possession.playerId ?? undefined,
      teamId: possession.teamId ?? undefined,
      possessionId: possession.id,
      clipWindow: clipAround("possession_start", possession.startMs, possession.endMs, 2400, 2600, 0.34),
    },
    {
      id: eventId("possession-end", index + 1),
      type: "possession_end" as const,
      timestampMs: possession.endMs,
      confidence: possession.confidence,
      playerId: possession.playerId ?? undefined,
      teamId: possession.teamId ?? undefined,
      possessionId: possession.id,
      clipWindow: clipAround("possession_end", possession.endMs, possession.endMs, 2200, 2600, 0.28),
    },
  ])
}

function clipWindowsFromTopology(telemetry: TelemetrySample[], durationMs: number): ClipWindow[] {
  return telemetry.flatMap((frame) =>
    frame.topology.knots.map((knot) => clipAround("topology_knot", knot, durationMs, 3200, 3800, clamp01(0.38 + frame.smoothedDensity * 0.42 + frame.smoothedPressure * 0.2))),
  )
}

function clipWindowsFromEvents(events: StructuredBasketballEvent[], durationMs: number) {
  const eventWindows = events
    .filter((event) => !["possession_start", "possession_end", "rebound"].includes(event.type))
    .map((event) => event.clipWindow)
  const momentumWindows: ClipWindow[] = []

  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1]
    const current = events[index]
    const meaningfulPair =
      ["shot_attempt", "turnover", "transition"].includes(previous.type) &&
      ["shot_attempt", "turnover", "transition", "pressure_spike"].includes(current.type)

    if (meaningfulPair && current.timestampMs - previous.timestampMs <= 8500) {
      momentumWindows.push(clipAround("momentum_shift", current.timestampMs, durationMs, 6200, 5200, Math.max(previous.confidence, current.confidence)))
    }
  }

  return [...eventWindows, ...momentumWindows]
}

function buildTraditionalStats(events: StructuredBasketballEvent[], possessions: PossessionSegment[]) {
  const players: Record<string, TraditionalStatsLine> = {}
  const teams: Record<string, TraditionalStatsLine> = {}

  for (const possession of possessions) {
    for (const touch of possession.touches) {
      line(players, touch).touches += 1
    }
    if (possession.playerId) line(players, possession.playerId).possessions += 1
    if (possession.teamId) line(teams, possession.teamId).possessions += 1
  }

  for (const event of events) {
    const player = event.playerId ? line(players, event.playerId) : null
    const team = event.teamId ? line(teams, event.teamId) : null
    const likelyMake = event.metadata?.likelyMake === true

    if (event.type === "shot_attempt") {
      if (player) player.shotAttempts += 1
      if (team) team.shotAttempts += 1
      if (likelyMake) {
        if (player) {
          player.shotMakes += 1
          player.points += 2
        }
        if (team) {
          team.shotMakes += 1
          team.points += 2
        }
        const assisterId = assistCandidate(event, possessions)
        if (assisterId) line(players, assisterId).assists += 1
      } else {
        if (player) player.shotMisses += 1
        if (team) team.shotMisses += 1
        const blockTeamId = blockRecoveryTeam(event, events, possessions)
        if (blockTeamId) line(teams, blockTeamId).blocks += 1
      }
    }
    if (event.type === "rebound") {
      if (player) player.rebounds += 1
      if (team) team.rebounds += 1
    }
    if (event.type === "turnover") {
      if (player) player.turnovers += 1
      if (team) team.turnovers += 1
      const recoveryPlayerId = text(event.metadata?.recoveryPlayerId)
      const recoveryTeamId = text(event.metadata?.recoveryTeamId)
      if (recoveryPlayerId) line(players, recoveryPlayerId).steals += 1
      if (recoveryTeamId) line(teams, recoveryTeamId).steals += 1
    }
  }

  finalizePercentages(players)
  finalizePercentages(teams)

  return {
    possessions: possessions.length,
    players,
    timeline: buildStatTimeline(events, possessions),
    teams,
  }
}

function buildStatTimeline(events: StructuredBasketballEvent[], possessions: PossessionSegment[]): StatTimelineEntry[] {
  const possessionEntries = possessions.map((possession) => ({
    id: `${possession.id}-stat`,
    label: possession.teamId
      ? `${possession.teamId} possession`
      : "possession",
    playerId: possession.playerId ?? undefined,
    possessionId: possession.id,
    teamId: possession.teamId ?? undefined,
    time: formatClock(possession.startMs),
    timestampMs: possession.startMs,
    type: "possession" as const,
  }))

  const eventEntries = events.flatMap<StatTimelineEntry>((event) => {
    if (event.type === "shot_attempt") {
      const make = event.metadata?.likelyMake === true
      const entries: StatTimelineEntry[] = [
        {
          id: `${event.id}-${make ? "make" : "miss"}`,
          label: make ? "made shot" : "missed shot",
          playerId: event.playerId,
          possessionId: event.possessionId,
          teamId: event.teamId,
          time: formatClock(event.timestampMs),
          timestampMs: event.timestampMs,
          type: make ? "make" : "miss",
        },
      ]
      const assisterId = make ? assistCandidate(event, possessions) : null
      if (assisterId) {
        entries.push({
          id: `${event.id}-assist`,
          label: "assist",
          playerId: assisterId,
          possessionId: event.possessionId,
          teamId: event.teamId,
          time: formatClock(event.timestampMs),
          timestampMs: event.timestampMs,
          type: "assist",
        })
      }
      return entries
    }

    if (event.type === "rebound") {
      return [{
        id: `${event.id}-stat`,
        label: "rebound",
        playerId: event.playerId,
        possessionId: event.possessionId,
        teamId: event.teamId,
        time: formatClock(event.timestampMs),
        timestampMs: event.timestampMs,
        type: "rebound",
      }]
    }

    if (event.type === "turnover") {
      const entries: StatTimelineEntry[] = [{
        id: `${event.id}-stat`,
        label: "turnover",
        playerId: event.playerId,
        possessionId: event.possessionId,
        teamId: event.teamId,
        time: formatClock(event.timestampMs),
        timestampMs: event.timestampMs,
        type: "turnover",
      }]
      const recoveryPlayerId = text(event.metadata?.recoveryPlayerId)
      const recoveryTeamId = text(event.metadata?.recoveryTeamId)
      if (recoveryPlayerId) {
        entries.push({
          id: `${event.id}-steal`,
          label: "steal",
          playerId: recoveryPlayerId,
          possessionId: event.possessionId,
          teamId: recoveryTeamId ?? undefined,
          time: formatClock(event.timestampMs),
          timestampMs: event.timestampMs,
          type: "steal",
        })
      }
      return entries
    }

    return []
  })

  return chronologicalStats([...possessionEntries, ...eventEntries])
}

function estimateHolder(frame: BasketballTrackingFrame, previous: HolderEstimate): HolderEstimate {
  if (!frame.ball) {
    return previous.playerId
      ? { ...previous, confidence: previous.confidence * 0.72, state: "occluded" }
      : { confidence: 0, playerId: null, state: "occluded", teamId: null }
  }

  let best: { distance: number; player: TrackedPlayer } | null = null
  for (const player of frame.players ?? []) {
    const gap = distance(frame.ball, player)
    if (!best || gap < best.distance) best = { distance: gap, player }
  }

  if (!best) return { confidence: Number(frame.ball.confidence ?? 0.3), playerId: null, state: "loose", teamId: null }
  const confidence = clamp01((1 - best.distance / 0.16) * Number(best.player.confidence ?? 1) * Number(frame.ball.confidence ?? 1))
  if (confidence < 0.28) return { confidence, playerId: null, state: "loose", teamId: null }

  return {
    confidence,
    playerId: best.player.id,
    state: "controlled",
    teamId: best.player.teamId ?? null,
  }
}

function createWorkingPossession(index: number, timestampMs: number, holder: HolderEstimate): WorkingPossession {
  return {
    confidenceTotal: holder.confidence,
    endMs: timestampMs,
    frames: 1,
    id: `possession-${index}`,
    playerId: holder.playerId,
    startMs: timestampMs,
    state: holder.state,
    teamId: holder.teamId,
    touches: new Set(holder.playerId ? [holder.playerId] : []),
  }
}

function extendPossession(possession: WorkingPossession, timestampMs: number, holder: HolderEstimate) {
  const previousEndMs = possession.endMs
  possession.endMs = timestampMs
  possession.frames += 1
  possession.confidenceTotal += holder.confidence
  if (holder.playerId) possession.touches.add(holder.playerId)
  if (holder.state === "controlled") {
    possession.playerId = holder.playerId
    possession.teamId = holder.teamId
    possession.state = "controlled"
  } else if (holder.state === "loose" && timestampMs - previousEndMs > 1200) {
    possession.state = "loose"
  }
}

function shouldStartNewPossession(possession: WorkingPossession, holder: HolderEstimate, timestampMs: number) {
  if (holder.state === "occluded") return false
  if (holder.state === "loose") return timestampMs - possession.startMs > 1600 && timestampMs - possession.endMs > 900
  if (!holder.teamId || !possession.teamId) return false
  return holder.teamId !== possession.teamId && timestampMs - possession.startMs > 900
}

function closePossession(possession: WorkingPossession, endMs: number): PossessionSegment {
  return {
    id: possession.id,
    startMs: possession.startMs,
    endMs,
    state: possession.state,
    playerId: possession.playerId,
    teamId: possession.teamId,
    confidence: clamp01(possession.confidenceTotal / Math.max(1, possession.frames)),
    touches: [...possession.touches],
  }
}

function holderDistance(frame: BasketballTrackingFrame) {
  if (!frame.ball || !frame.players?.length) return Number.POSITIVE_INFINITY
  return Math.min(...frame.players.map((player) => distance(frame.ball!, player)))
}

function inferMakeConfidence(frames: BasketballTrackingFrame[], basket: CourtPoint) {
  const nearest = frames.reduce((best, frame) => {
    if (!frame.ball) return best
    return Math.min(best, distance(frame.ball, basket))
  }, Number.POSITIVE_INFINITY)

  return clamp01(1 - nearest / 0.085)
}

function nearestEventTime(context: DetectionContext, type: StructuredBasketballEventType, timestampMs: number, windowMs: number) {
  if (type !== "shot_attempt") return null
  const shot = detectShots(context)
    .map((event) => event.timestampMs)
    .sort((first, second) => Math.abs(first - timestampMs) - Math.abs(second - timestampMs))[0]
  return shot !== undefined && Math.abs(shot - timestampMs) <= windowMs ? shot : null
}

function possessionAt(possessions: PossessionSegment[], timestampMs: number) {
  return possessions.find((possession) => timestampMs >= possession.startMs && timestampMs <= possession.endMs) ?? null
}

function telemetryEvent(type: Extract<StructuredBasketballEventType, "pressure_spike" | "transition" | "collapse_window">, index: number, timestampMs: number, durationMs: number, confidence: number): StructuredBasketballEvent {
  return {
    id: eventId(type, index),
    type,
    timestampMs,
    confidence: clamp01(confidence),
    clipWindow: clipAround(type, timestampMs, durationMs, type === "transition" ? 4200 : 3600, type === "collapse_window" ? 5200 : 3800, confidence),
  }
}

function clipAround(reason: ClipWindow["reason"], anchorMs: number, durationMs: number, beforeMs: number, afterMs: number, weight: number): ClipWindow {
  const maxEnd = durationMs > 0 ? durationMs : anchorMs + afterMs
  return {
    reason,
    startMs: Math.max(0, anchorMs - beforeMs),
    endMs: Math.max(anchorMs, Math.min(maxEnd, anchorMs + afterMs)),
    anchorMs,
    weight: clamp01(weight),
  }
}

function mergeClipWindows(windows: ClipWindow[]) {
  const sorted = [...windows].sort((first, second) => first.startMs - second.startMs || second.weight - first.weight)
  const merged: ClipWindow[] = []

  for (const windowValue of sorted) {
    const previous = merged.at(-1)
    if (!previous || windowValue.startMs > previous.endMs + 700) {
      merged.push({ ...windowValue })
      continue
    }

    previous.endMs = Math.max(previous.endMs, windowValue.endMs)
    previous.anchorMs = previous.weight >= windowValue.weight ? previous.anchorMs : windowValue.anchorMs
    previous.reason = previous.weight >= windowValue.weight ? previous.reason : windowValue.reason
    previous.weight = Math.max(previous.weight, windowValue.weight)
  }

  return merged
}

function chronologicalEvents(events: StructuredBasketballEvent[]) {
  return [...events].sort((first, second) => first.timestampMs - second.timestampMs || first.type.localeCompare(second.type))
}

function line(target: Record<string, TraditionalStatsLine>, id: string) {
  target[id] ??= {
    assists: 0,
    blocks: 0,
    fieldGoalPercentage: 0,
    points: 0,
    possessions: 0,
    rebounds: 0,
    shotAttempts: 0,
    shotMakes: 0,
    shotMisses: 0,
    steals: 0,
    touches: 0,
    turnovers: 0,
  }
  return target[id]
}

function finalizePercentages(lines: Record<string, TraditionalStatsLine>) {
  for (const item of Object.values(lines)) {
    item.fieldGoalPercentage = item.shotAttempts
      ? Number((item.shotMakes / item.shotAttempts).toFixed(3))
      : 0
  }
}

function assistCandidate(event: StructuredBasketballEvent, possessions: PossessionSegment[]) {
  if (!event.playerId || !event.possessionId) return null
  const possession = possessions.find((item) => item.id === event.possessionId)
  if (!possession) return null
  const touches = possession.touches.filter((touch) => touch !== event.playerId)
  return touches.at(-1) ?? null
}

function blockRecoveryTeam(event: StructuredBasketballEvent, events: StructuredBasketballEvent[], possessions: PossessionSegment[]) {
  if (!event.teamId) return null
  const recovery = events.find((candidate) => {
    if (candidate.timestampMs <= event.timestampMs || candidate.timestampMs - event.timestampMs > 2200) return false
    return candidate.type === "rebound" || candidate.type === "turnover"
  })
  const possession = possessionAt(possessions, recovery?.timestampMs ?? -1)
  return possession?.teamId && possession.teamId !== event.teamId ? possession.teamId : null
}

function eventId(prefix: string, index: number) {
  return `${prefix}-${index}`
}

function chronologicalStats(events: StatTimelineEntry[]) {
  return [...events].sort((first, second) => first.timestampMs - second.timestampMs || first.type.localeCompare(second.type))
}

function formatClock(timestampMs: number) {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function distance(a: CourtPoint, b: CourtPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y, Number(a.z ?? 0) - Number(b.z ?? 0))
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null
}
