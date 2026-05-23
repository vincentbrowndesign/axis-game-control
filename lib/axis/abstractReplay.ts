export type AbstractReplaySymbol = "O" | "X"

export type NormalizedDetection = {
  confidence: number
  height: number
  sourceId?: string
  teamHint?: AbstractReplaySymbol
  width: number
  x: number
  y: number
}

export type AbstractReplayEntity = {
  confidence: number
  id: string
  lastSeenAt: number
  misses: number
  symbol: AbstractReplaySymbol
  vx: number
  vy: number
  x: number
  y: number
}

export type AbstractReplayRelationship = {
  distance: number
  fromId: string
  kind: "pressure" | "recovery" | "spacing"
  pressure: number
  toId: string
}

export type AbstractReplaySpacing = {
  averageSpeed: number
  compression: number
  defenseWidth: number
  offenseWidth: number
}

export type AbstractReplayFrame = {
  at: number
  entities: AbstractReplayEntity[]
  relationships: AbstractReplayRelationship[]
  source: "camera" | "surface"
  spacing: AbstractReplaySpacing
}

export type AbstractReplayState = {
  nextId: number
  tracks: AbstractReplayEntity[]
}

const maxTrackDistance = 0.14
const maxMisses = 8

export function createAbstractReplayState(): AbstractReplayState {
  return {
    nextId: 1,
    tracks: [],
  }
}

export function updateAbstractReplayFromDetections(state: AbstractReplayState, detections: NormalizedDetection[], at: number) {
  const usableDetections = detections
    .filter((detection) => detection.confidence >= 0.22)
    .map((detection) => ({
      ...detection,
      x: clamp01(detection.x),
      y: clamp01(detection.y),
    }))

  const claimedTracks = new Set<string>()
  const claimedDetections = new Set<number>()

  usableDetections.forEach((detection, detectionIndex) => {
    const track = nearestTrack(state.tracks, detection, claimedTracks)
    if (!track || distance(track, detection) > maxTrackDistance) return

    claimedTracks.add(track.id)
    claimedDetections.add(detectionIndex)
    updateTrack(track, detection, at)
  })

  usableDetections.forEach((detection, detectionIndex) => {
    if (claimedDetections.has(detectionIndex)) return

    state.tracks.push({
      confidence: detection.confidence,
      id: detection.sourceId || `entity-${state.nextId++}`,
      lastSeenAt: at,
      misses: 0,
      symbol: detection.teamHint || inferSymbolFromCourtPosition(detection),
      vx: 0,
      vy: 0,
      x: detection.x,
      y: detection.y,
    })
  })

  state.tracks = state.tracks
    .map((track) => {
      if (claimedTracks.has(track.id) || usableDetections.some((detection) => detection.sourceId === track.id)) {
        return track
      }

      return {
        ...track,
        confidence: track.confidence * 0.92,
        misses: track.misses + 1,
      }
    })
    .filter((track) => track.misses <= maxMisses && track.confidence >= 0.08)

  return buildAbstractReplayFrame(state, at, "camera")
}

export function buildAbstractReplayFrame(state: AbstractReplayState, at: number, source: AbstractReplayFrame["source"]): AbstractReplayFrame {
  const entities = state.tracks
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .map((track) => ({ ...track }))

  return {
    at,
    entities,
    relationships: buildRelationships(entities),
    source,
    spacing: buildSpacing(entities),
  }
}

function buildRelationships(entities: AbstractReplayEntity[]) {
  const relationships: AbstractReplayRelationship[] = []
  const offense = entities.filter((entity) => entity.symbol === "O")
  const defense = entities.filter((entity) => entity.symbol === "X")

  for (const offensiveEntity of offense) {
    const nearestDefender = nearestEntity(offensiveEntity, defense)
    if (!nearestDefender) continue

    const gap = distance(offensiveEntity, nearestDefender)
    const pressure = clamp01((0.24 - gap) / 0.24)
    if (pressure > 0.04) {
      relationships.push({
        distance: gap,
        fromId: nearestDefender.id,
        kind: "pressure",
        pressure,
        toId: offensiveEntity.id,
      })
    }
  }

  for (const defender of defense) {
    const nearestOffense = nearestEntity(defender, offense)
    if (!nearestOffense) continue

    const recoveryPressure = clamp01(vectorMagnitude(nearestOffense) / 0.018) * clamp01((0.34 - distance(defender, nearestOffense)) / 0.34)
    if (recoveryPressure > 0.05) {
      relationships.push({
        distance: distance(defender, nearestOffense),
        fromId: defender.id,
        kind: "recovery",
        pressure: recoveryPressure,
        toId: nearestOffense.id,
      })
    }
  }

  offense.forEach((entity, index) => {
    for (let nextIndex = index + 1; nextIndex < offense.length; nextIndex += 1) {
      const teammate = offense[nextIndex]
      const gap = distance(entity, teammate)
      const compression = clamp01((0.18 - gap) / 0.18)
      if (compression > 0.03) {
        relationships.push({
          distance: gap,
          fromId: entity.id,
          kind: "spacing",
          pressure: compression,
          toId: teammate.id,
        })
      }
    }
  })

  return relationships.sort((a, b) => b.pressure - a.pressure).slice(0, 18)
}

function buildSpacing(entities: AbstractReplayEntity[]): AbstractReplaySpacing {
  const offense = entities.filter((entity) => entity.symbol === "O")
  const defense = entities.filter((entity) => entity.symbol === "X")
  const offenseWidth = horizontalWidth(offense)
  const defenseWidth = horizontalWidth(defense)
  const averageSpeed = entities.length === 0 ? 0 : entities.reduce((sum, entity) => sum + vectorMagnitude(entity), 0) / entities.length

  return {
    averageSpeed,
    compression: clamp01((0.44 - offenseWidth) / 0.44),
    defenseWidth,
    offenseWidth,
  }
}

function updateTrack(track: AbstractReplayEntity, detection: NormalizedDetection, at: number) {
  const previousX = track.x
  const previousY = track.y
  const blend = 0.38 + detection.confidence * 0.24

  track.x = track.x * (1 - blend) + detection.x * blend
  track.y = track.y * (1 - blend) + detection.y * blend
  track.vx = track.x - previousX
  track.vy = track.y - previousY
  track.confidence = Math.max(track.confidence * 0.88, detection.confidence)
  track.lastSeenAt = at
  track.misses = 0
  track.symbol = detection.teamHint || track.symbol
}

function nearestTrack(tracks: AbstractReplayEntity[], detection: NormalizedDetection, claimedTracks: Set<string>) {
  let nearest: AbstractReplayEntity | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const track of tracks) {
    if (claimedTracks.has(track.id)) continue
    const gap = distance(track, detection)
    if (gap < nearestDistance) {
      nearest = track
      nearestDistance = gap
    }
  }

  return nearest
}

function nearestEntity(origin: AbstractReplayEntity, entities: AbstractReplayEntity[]) {
  let nearest: AbstractReplayEntity | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const entity of entities) {
    if (entity.id === origin.id) continue
    const gap = distance(origin, entity)
    if (gap < nearestDistance) {
      nearest = entity
      nearestDistance = gap
    }
  }

  return nearest
}

function inferSymbolFromCourtPosition(detection: NormalizedDetection): AbstractReplaySymbol {
  return detection.y < 0.5 ? "O" : "X"
}

function horizontalWidth(entities: AbstractReplayEntity[]) {
  if (entities.length < 2) return 0
  const xs = entities.map((entity) => entity.x)
  return Math.max(...xs) - Math.min(...xs)
}

function vectorMagnitude(entity: Pick<AbstractReplayEntity, "vx" | "vy">) {
  return Math.hypot(entity.vx, entity.vy)
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}
