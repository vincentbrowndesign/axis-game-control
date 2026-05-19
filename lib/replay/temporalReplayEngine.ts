export type TemporalReplayEventType =
  | "score"
  | "marker"
  | "snapshot"
  | "period"
  | "session_start"
  | "session_end"
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
  | "clock"
  | "inference"
  | "pressure_spike"
  | "momentum_swing"
  | "recovery"
  | "collapse"
  | "volatility"

export type TemporalReplayEvent = {
  id: string
  type: TemporalReplayEventType
  createdAt: string
  sessionTime: number
  gameClock: string
  period: number
  metadata: Record<string, unknown>
}

export type TemporalReplayCluster = {
  id: string
  start: number
  end: number
  eventIds: string[]
  weight: number
}

export type TemporalReplayJump = {
  id: string
  eventId: string
  sessionTime: number
  label: string
  type: TemporalReplayEventType
}

export type TemporalReplayDensityRegion = {
  id: string
  start: number
  end: number
  weight: number
  eventIds: string[]
}

export type TemporalReplayEngine = {
  chronological: TemporalReplayEvent[]
  clusters: TemporalReplayCluster[]
  jumps: TemporalReplayJump[]
  densityRegions: TemporalReplayDensityRegion[]
  zoom: {
    duration: number
    minWindow: number
    maxWindow: number
  }
}

function eventWeight(event: TemporalReplayEvent) {
  if (event.type === "score") {
    const points = Number(event.metadata.points || 1)
    return Math.max(1, Math.min(3, points))
  }

  if (event.type === "snapshot") return 3
  if (event.type === "inference") return 3
  if (event.type === "marker") return 1
  if (event.type === "reconnect") return 1.5
  if (event.type === "system_state") return 1
  return 0.75
}

function jumpLabel(event: TemporalReplayEvent) {
  if (event.type === "score") {
    return `${event.metadata.team || "TEAM"} +${event.metadata.points || 0}`
  }

  if (event.type === "clock") return `CLOCK ${event.metadata.action || ""}`.trim()
  return String(event.metadata.label || event.type).toUpperCase()
}

export function buildTemporalReplayEngine({
  events,
  duration,
}: {
  events: TemporalReplayEvent[]
  duration: number
}): TemporalReplayEngine {
  const chronological = [...events].sort((a, b) => a.sessionTime - b.sessionTime)
  const densityWindow = Math.max(8, Math.min(24, duration / 8 || 8))
  const clusterWindow = 12
  const clusters: TemporalReplayCluster[] = []
  let activeCluster: TemporalReplayEvent[] = []

  for (const event of chronological) {
    const previous = activeCluster.at(-1)

    if (!previous || event.sessionTime - previous.sessionTime <= clusterWindow) {
      activeCluster.push(event)
    } else {
      if (activeCluster.length > 1) {
        clusters.push({
          id: `cluster-${clusters.length + 1}`,
          start: activeCluster[0].sessionTime,
          end: activeCluster.at(-1)?.sessionTime || activeCluster[0].sessionTime,
          eventIds: activeCluster.map((item) => item.id),
          weight: activeCluster.reduce((total, item) => total + eventWeight(item), 0),
        })
      }
      activeCluster = [event]
    }
  }

  if (activeCluster.length > 1) {
    clusters.push({
      id: `cluster-${clusters.length + 1}`,
      start: activeCluster[0].sessionTime,
      end: activeCluster.at(-1)?.sessionTime || activeCluster[0].sessionTime,
      eventIds: activeCluster.map((item) => item.id),
      weight: activeCluster.reduce((total, item) => total + eventWeight(item), 0),
    })
  }

  const densityRegions: TemporalReplayDensityRegion[] = []
  const regionCount = Math.max(1, Math.ceil(Math.max(duration, densityWindow) / densityWindow))

  for (let index = 0; index < regionCount; index += 1) {
    const start = index * densityWindow
    const end = start + densityWindow
    const regionEvents = chronological.filter(
      (event) => event.sessionTime >= start && event.sessionTime < end
    )
    const weight = regionEvents.reduce((total, event) => total + eventWeight(event), 0)

    if (!weight) continue

    densityRegions.push({
      id: `density-${index + 1}`,
      start,
      end,
      weight,
      eventIds: regionEvents.map((event) => event.id),
    })
  }

  return {
    chronological,
    clusters,
    jumps: chronological.map((event) => ({
      id: `jump-${event.id}`,
      eventId: event.id,
      sessionTime: event.sessionTime,
      label: jumpLabel(event),
      type: event.type,
    })),
    densityRegions,
    zoom: {
      duration,
      minWindow: Math.min(15, Math.max(5, duration / 12 || 5)),
      maxWindow: Math.max(60, duration),
    },
  }
}
