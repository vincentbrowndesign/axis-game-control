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

export type AbstractReplayFrame = {
  at: number
  entities: AbstractReplayEntity[]
  source: "camera" | "surface"
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
  return {
    at,
    entities: state.tracks
      .slice()
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)
      .map((track) => ({ ...track })),
    source,
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

function inferSymbolFromCourtPosition(detection: NormalizedDetection): AbstractReplaySymbol {
  return detection.y < 0.5 ? "O" : "X"
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}
