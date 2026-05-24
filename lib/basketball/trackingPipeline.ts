import {
  buildStructuredBasketballEvents,
  type BasketballTrackingFrame,
  type CourtPoint,
  type TrackedPlayer,
} from "@/lib/basketball/structuredEvents"
import {
  smoothTelemetry,
  type AxisTelemetryFrame,
  type TelemetrySample,
} from "@/lib/axis-replay/telemetry"

export type PlayableArea =
  | {
      type: "rect"
      x: number
      y: number
      width: number
      height: number
    }
  | {
      points: CourtPoint[]
      type: "polygon"
    }

export type RawRfDetection = {
  bbox?: [number, number, number, number] | {
    height?: number
    width?: number
    x?: number
    y?: number
  }
  box?: [number, number, number, number] | {
    height?: number
    width?: number
    x?: number
    y?: number
  }
  class?: string
  class_name?: string
  classId?: string | number
  className?: string
  confidence?: number
  height?: number
  id?: string | number
  label?: string
  score?: number
  teamId?: string
  track_id?: string | number
  width?: number
  x?: number
  y?: number
}

export type RawRfDetectionFrame = {
  detections?: RawRfDetection[]
  frame_id?: string | number
  frameId?: string | number
  height?: number
  image?: {
    height?: number
    width?: number
  }
  predictions?: RawRfDetection[]
  timestamp_ms?: number
  timestampMs?: number
  width?: number
}

type DetectionKind = "ball" | "basket" | "player" | "unknown"

type NormalizedObjectDetection = {
  center: CourtPoint
  confidence: number
  height: number
  kind: DetectionKind
  label: string
  sourceId: string | null
  teamId: string | null
  width: number
}

type PlayerTrack = {
  confidence: number
  hits: number
  id: string
  lastSeenMs: number
  lostFrames: number
  teamId: string | null
  vx: number
  vy: number
  x: number
  y: number
}

type BallTrack = {
  confidence: number
  lastSeenMs: number
  lostFrames: number
  vx: number
  vy: number
  x: number
  y: number
}

export type TrackingPipelineOutput = {
  quality: {
    averageDetections: number
    averagePlayers: number
    ballFrames: number
    playableAreaFiltered: number
    rawDetections: number
    trackedFrames: number
  }
  telemetry: TelemetrySample[]
  telemetryNdjson: string
  timeline: ReturnType<typeof buildStructuredBasketballEvents>
  tracking: BasketballTrackingFrame[]
}

const DEFAULT_PLAYABLE_AREA: PlayableArea = {
  height: 0.88,
  type: "rect",
  width: 0.94,
  x: 0.03,
  y: 0.06,
}

const HIGH_PLAYER_CONFIDENCE = 0.34
const LOW_PLAYER_CONFIDENCE = 0.14
const MAX_PLAYER_LOST_FRAMES = 12
const MAX_BALL_LOST_FRAMES = 6

export function buildReplayTrackingPipeline({
  frames,
  playableArea = DEFAULT_PLAYABLE_AREA,
}: {
  frames: RawRfDetectionFrame[]
  playableArea?: PlayableArea
}): TrackingPipelineOutput {
  const sortedFrames = [...frames].sort(
    (first, second) => timestampMs(first, 0) - timestampMs(second, 0)
  )
  const tracks: PlayerTrack[] = []
  let ballTrack: BallTrack | null = null
  let nextTrackId = 1
  let rawDetections = 0
  let playableAreaFiltered = 0
  const tracking: BasketballTrackingFrame[] = []

  sortedFrames.forEach((frame, index) => {
    const at = timestampMs(frame, index)
    const normalized = normalizeFrameDetections(frame)
    rawDetections += normalized.length

    const playable = normalized.filter((detection) => {
      if (detection.kind === "basket") return true
      const inside = pointInPlayableArea(detection.center, playableArea)
      if (!inside) playableAreaFiltered += 1
      return inside
    })
    const players = playable.filter((detection) => detection.kind === "player")
    const ball = strongest(playable.filter((detection) => detection.kind === "ball"))
    const basket = strongest(playable.filter((detection) => detection.kind === "basket"))

    const activeTracks = updatePlayerTracks({
      at,
      detections: players,
      nextId: () => `player-${nextTrackId++}`,
      tracks,
    })

    ballTrack = updateBallTrack(ballTrack, ball, at)

    tracking.push({
      basket: basket?.center,
      ball: ballPoint(ballTrack),
      players: activeTracks.map((track) => trackedPlayer(track)),
      timestampMs: at,
    })
  })

  const telemetry = buildTelemetryFromTracking(tracking)
  const timeline = buildStructuredBasketballEvents({
    telemetry,
    tracking,
  })

  return {
    quality: {
      averageDetections: sortedFrames.length
        ? rawDetections / sortedFrames.length
        : 0,
      averagePlayers: tracking.length
        ? tracking.reduce((sum, frame) => sum + (frame.players?.length ?? 0), 0) /
          tracking.length
        : 0,
      ballFrames: tracking.filter((frame) => Boolean(frame.ball)).length,
      playableAreaFiltered,
      rawDetections,
      trackedFrames: tracking.length,
    },
    telemetry,
    telemetryNdjson: serializeTelemetryNdjson(telemetry),
    timeline,
    tracking,
  }
}

export function serializeTelemetryNdjson(telemetry: TelemetrySample[]) {
  return telemetry.map((frame) => JSON.stringify(frame)).join("\n")
}

function normalizeFrameDetections(frame: RawRfDetectionFrame) {
  const source = frame.detections ?? frame.predictions ?? []
  const width = positive(frame.width ?? frame.image?.width, 1)
  const height = positive(frame.height ?? frame.image?.height, 1)

  return source
    .map((detection) => normalizeDetection(detection, width, height))
    .filter((detection): detection is NormalizedObjectDetection => Boolean(detection))
    .sort((first, second) => second.confidence - first.confidence)
}

function normalizeDetection(
  detection: RawRfDetection,
  imageWidth: number,
  imageHeight: number
): NormalizedObjectDetection | null {
  const box = detection.bbox ?? detection.box ?? detection
  const rect = Array.isArray(box)
    ? { height: box[3], width: box[2], x: box[0], y: box[1] }
    : {
        height: box.height,
        width: box.width,
        x: box.x,
        y: box.y,
      }
  const width = positive(rect.width, 0)
  const height = positive(rect.height, 0)
  const x = number(rect.x, Number.NaN)
  const y = number(rect.y, Number.NaN)

  if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0) {
    return null
  }

  const normalizedWidth = normalizeLength(width, imageWidth)
  const normalizedHeight = normalizeLength(height, imageHeight)
  const center = normalizePoint(
    looksNormalized(x, y, width, height)
      ? { x: x + width / 2, y: y + height / 2 }
      : {
          x: (x + width / 2) / imageWidth,
          y: (y + height / 2) / imageHeight,
        }
  )
  const label = String(
    detection.className ??
      detection.class_name ??
      detection.class ??
      detection.label ??
      detection.classId ??
      "unknown"
  ).toLowerCase()
  const confidence = clamp01(number(detection.confidence ?? detection.score, 0))

  return {
    center,
    confidence,
    height: normalizedHeight,
    kind: detectionKind(label),
    label,
    sourceId:
      detection.track_id != null || detection.id != null
        ? String(detection.track_id ?? detection.id)
        : null,
    teamId:
      typeof detection.teamId === "string" && detection.teamId.trim()
        ? detection.teamId.trim()
        : null,
    width: normalizedWidth,
  }
}

function updatePlayerTracks({
  at,
  detections,
  nextId,
  tracks,
}: {
  at: number
  detections: NormalizedObjectDetection[]
  nextId: () => string
  tracks: PlayerTrack[]
}) {
  const highConfidence = detections.filter(
    (detection) => detection.confidence >= HIGH_PLAYER_CONFIDENCE
  )
  const lowConfidence = detections.filter(
    (detection) =>
      detection.confidence >= LOW_PLAYER_CONFIDENCE &&
      detection.confidence < HIGH_PLAYER_CONFIDENCE
  )
  const matchedTracks = new Set<string>()
  const matchedDetections = new Set<NormalizedObjectDetection>()

  matchTracks(tracks, highConfidence, matchedTracks, matchedDetections, at)
  matchTracks(tracks, lowConfidence, matchedTracks, matchedDetections, at)

  for (const detection of highConfidence) {
    if (matchedDetections.has(detection)) continue
    tracks.push({
      confidence: detection.confidence,
      hits: 1,
      id: detection.sourceId ?? nextId(),
      lastSeenMs: at,
      lostFrames: 0,
      teamId: detection.teamId,
      vx: 0,
      vy: 0,
      x: detection.center.x,
      y: detection.center.y,
    })
  }

  for (const track of tracks) {
    if (matchedTracks.has(track.id)) continue
    track.lostFrames += 1
    track.confidence *= 0.9
    track.x = clamp01(track.x + track.vx)
    track.y = clamp01(track.y + track.vy)
  }

  for (let index = tracks.length - 1; index >= 0; index -= 1) {
    const track = tracks[index]
    if (
      track.lostFrames > MAX_PLAYER_LOST_FRAMES ||
      track.confidence < 0.08
    ) {
      tracks.splice(index, 1)
    }
  }

  assignMissingTeams(tracks)

  return tracks
    .filter((track) => track.hits >= 2 || track.lostFrames <= 1)
    .sort((first, second) => second.confidence - first.confidence)
    .slice(0, 10)
}

function matchTracks(
  tracks: PlayerTrack[],
  detections: NormalizedObjectDetection[],
  matchedTracks: Set<string>,
  matchedDetections: Set<NormalizedObjectDetection>,
  at: number
) {
  const candidates = tracks
    .flatMap((track) =>
      detections.map((detection) => ({
        detection,
        score: associationScore(track, detection),
        track,
      }))
    )
    .filter((candidate) => candidate.score > 0.18)
    .sort((first, second) => second.score - first.score)

  for (const candidate of candidates) {
    if (
      matchedTracks.has(candidate.track.id) ||
      matchedDetections.has(candidate.detection)
    ) {
      continue
    }

    updateTrack(candidate.track, candidate.detection, at)
    matchedTracks.add(candidate.track.id)
    matchedDetections.add(candidate.detection)
  }
}

function updateTrack(
  track: PlayerTrack,
  detection: NormalizedObjectDetection,
  at: number
) {
  const blend = detection.confidence >= HIGH_PLAYER_CONFIDENCE ? 0.58 : 0.32
  const previousX = track.x
  const previousY = track.y
  const nextX = track.x * (1 - blend) + detection.center.x * blend
  const nextY = track.y * (1 - blend) + detection.center.y * blend

  track.x = clamp01(nextX)
  track.y = clamp01(nextY)
  track.vx = clamp(nextX - previousX, -0.08, 0.08)
  track.vy = clamp(nextY - previousY, -0.08, 0.08)
  track.confidence = clamp01(Math.max(track.confidence * 0.92, detection.confidence))
  track.hits += 1
  track.lastSeenMs = at
  track.lostFrames = 0
  track.teamId = detection.teamId || track.teamId
}

function updateBallTrack(
  previous: BallTrack | null,
  detection: NormalizedObjectDetection | null,
  at: number
): BallTrack | null {
  if (!detection || detection.confidence < 0.18) {
    if (!previous) return null
    const lostFrames = previous.lostFrames + 1
    if (lostFrames > MAX_BALL_LOST_FRAMES) return null
    return {
      ...previous,
      confidence: previous.confidence * 0.78,
      lostFrames,
      x: clamp01(previous.x + previous.vx),
      y: clamp01(previous.y + previous.vy),
    }
  }

  if (!previous) {
    return {
      confidence: detection.confidence,
      lastSeenMs: at,
      lostFrames: 0,
      vx: 0,
      vy: 0,
      x: detection.center.x,
      y: detection.center.y,
    }
  }

  const blend = detection.confidence > 0.5 ? 0.72 : 0.48
  const nextX = previous.x * (1 - blend) + detection.center.x * blend
  const nextY = previous.y * (1 - blend) + detection.center.y * blend

  return {
    confidence: clamp01(Math.max(previous.confidence * 0.82, detection.confidence)),
    lastSeenMs: at,
    lostFrames: 0,
    vx: clamp(nextX - previous.x, -0.12, 0.12),
    vy: clamp(nextY - previous.y, -0.12, 0.12),
    x: clamp01(nextX),
    y: clamp01(nextY),
  }
}

function buildTelemetryFromTracking(frames: BasketballTrackingFrame[]) {
  const raw: AxisTelemetryFrame[] = []
  let previousPressure = 0
  let previousControl = 0.5
  let previousSpacing = 0.6
  let previousDensity = 0

  frames.forEach((frame, index) => {
    const players = frame.players ?? []
    const pressure = pressureForFrame(players)
    const spacing = spacingForFrame(players)
    const speed = averageSpeed(frame, frames[Math.max(0, index - 1)])
    const ballConfidence = frame.ball?.confidence ?? 0
    const control = clamp01(ballConfidence * 0.54 + speed * 4.8 + 0.18)
    const density = clamp01(
      pressure * 0.5 +
        (1 - spacing) * 0.34 +
        Math.min(1, players.length / 10) * 0.16
    )
    const pressureLift = pressure - previousPressure
    const spacingDrop = previousSpacing - spacing
    const controlLift = control - previousControl
    const densityLift = density - previousDensity
    const isKnot =
      pressure > 0.62 ||
      (pressureLift > 0.08 && spacingDrop > 0.04) ||
      (density > 0.58 && controlLift > 0.035) ||
      densityLift > 0.1
    const windows = isKnot
      ? [
          {
            end_ms: frame.timestampMs + 3200 + density * 1200,
            start_ms: Math.max(0, frame.timestampMs - 2400 - pressure * 900),
            weight: clamp01(pressure * 0.48 + density * 0.34 + control * 0.18),
          },
        ]
      : []

    raw.push({
      control,
      frame_id: `tracking-${index}`,
      pressure,
      spacing,
      timestamp_ms: frame.timestampMs,
      topology: {
        knots: isKnot ? [frame.timestampMs] : [],
        temporal_density: density,
        windows,
      },
    })

    previousPressure = pressure
    previousControl = control
    previousSpacing = spacing
    previousDensity = density
  })

  return smoothTelemetry(raw, 0.16)
}

function pressureForFrame(players: TrackedPlayer[]) {
  let total = 0
  let pairs = 0
  const home = players.filter((player) => player.teamId === "home")
  const away = players.filter((player) => player.teamId === "away")

  for (const offensive of home.length && away.length ? home : players) {
    const defenders =
      home.length && away.length
        ? away
        : players.filter((player) => player.id !== offensive.id)
    const nearest = nearestDistance(offensive, defenders)
    if (!Number.isFinite(nearest)) continue
    total += clamp01((0.22 - nearest) / 0.22)
    pairs += 1
  }

  return pairs ? total / pairs : 0
}

function spacingForFrame(players: TrackedPlayer[]) {
  if (players.length < 2) return 0.6
  const teams = groupPlayersByTeam(players)
  const spreads = Object.values(teams)
    .filter((team) => team.length >= 2)
    .map((team) => teamSpread(team))
  const spread = spreads.length
    ? spreads.reduce((sum, value) => sum + value, 0) / spreads.length
    : teamSpread(players)

  return clamp01(spread / 0.58)
}

function averageSpeed(
  frame: BasketballTrackingFrame,
  previous: BasketballTrackingFrame
) {
  const previousById = new Map((previous.players ?? []).map((player) => [player.id, player]))
  const speeds = (frame.players ?? [])
    .map((player) => {
      const before = previousById.get(player.id)
      return before ? distance(player, before) : 0
    })
    .filter((speed) => speed > 0)

  return speeds.length
    ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
    : 0
}

function trackedPlayer(track: PlayerTrack): TrackedPlayer {
  return {
    confidence: clamp01(track.confidence),
    id: track.id,
    teamId: track.teamId ?? undefined,
    x: track.x,
    y: track.y,
  }
}

function ballPoint(track: BallTrack | null) {
  if (!track) return undefined
  return {
    confidence: clamp01(track.confidence),
    x: track.x,
    y: track.y,
  }
}

function assignMissingTeams(tracks: PlayerTrack[]) {
  for (const track of tracks) {
    if (track.teamId) continue
    track.teamId = track.y < 0.5 ? "home" : "away"
  }
}

function associationScore(track: PlayerTrack, detection: NormalizedObjectDetection) {
  const predicted = {
    x: clamp01(track.x + track.vx),
    y: clamp01(track.y + track.vy),
  }
  const gap = distance(predicted, detection.center)
  const distanceScore = clamp01((0.22 - gap) / 0.22)
  const sourceBoost = detection.sourceId === track.id ? 0.4 : 0

  return distanceScore * 0.78 + detection.confidence * 0.22 + sourceBoost
}

function pointInPlayableArea(point: CourtPoint, area: PlayableArea) {
  if (area.type === "rect") {
    return (
      point.x >= area.x &&
      point.x <= area.x + area.width &&
      point.y >= area.y &&
      point.y <= area.y + area.height
    )
  }

  let inside = false
  for (let index = 0, last = area.points.length - 1; index < area.points.length; last = index++) {
    const current = area.points[index]
    const previous = area.points[last]
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          Math.max(0.000001, previous.y - current.y) +
          current.x

    if (intersects) inside = !inside
  }

  return inside
}

function strongest<T extends { confidence: number }>(items: T[]) {
  return items.sort((first, second) => second.confidence - first.confidence)[0] ?? null
}

function detectionKind(label: string): DetectionKind {
  if (/\b(ball|basketball)\b/.test(label)) return "ball"
  if (/\b(hoop|rim|basket|backboard)\b/.test(label)) return "basket"
  if (/\b(person|player|athlete|human)\b/.test(label)) return "player"
  return "unknown"
}

function normalizePoint(point: CourtPoint): CourtPoint {
  return {
    x: clamp01(point.x),
    y: clamp01(point.y),
    z: point.z,
  }
}

function normalizeLength(value: number, imageDimension: number) {
  return clamp01(value <= 1 ? value : value / Math.max(1, imageDimension))
}

function looksNormalized(x: number, y: number, width: number, height: number) {
  return x <= 1 && y <= 1 && width <= 1 && height <= 1
}

function timestampMs(frame: RawRfDetectionFrame, index: number) {
  return Math.max(0, number(frame.timestampMs ?? frame.timestamp_ms, index * 240))
}

function groupPlayersByTeam(players: TrackedPlayer[]) {
  return players.reduce<Record<string, TrackedPlayer[]>>((groups, player) => {
    const team = player.teamId || "unknown"
    groups[team] ??= []
    groups[team].push(player)
    return groups
  }, {})
}

function teamSpread(players: TrackedPlayer[]) {
  if (players.length < 2) return 0
  let total = 0
  let pairs = 0

  for (let index = 0; index < players.length; index += 1) {
    for (let next = index + 1; next < players.length; next += 1) {
      total += distance(players[index], players[next])
      pairs += 1
    }
  }

  return pairs ? total / pairs : 0
}

function nearestDistance(origin: CourtPoint, targets: CourtPoint[]) {
  return targets.reduce(
    (nearest, target) => Math.min(nearest, distance(origin, target)),
    Number.POSITIVE_INFINITY
  )
}

function distance(a: CourtPoint, b: CourtPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y, Number(a.z ?? 0) - Number(b.z ?? 0))
}

function number(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function positive(value: unknown, fallback: number) {
  return Math.max(0, number(value, fallback))
}

function clamp01(value: number) {
  return clamp(value, 0, 1)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
