import type { SegmentedMemory, Segment } from "@/lib/segments/types"
import type { ExtractedReplaySignals } from "@/lib/signals/types"
import type { ReplaySessionView } from "@/types/memory"
import type { ReplayMarker, ReplayMarkerType } from "./types"

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(1, value))
}

function marker({
  id,
  label,
  startTime,
  endTime,
  confidence,
  type,
}: {
  id: string
  label: string
  startTime: number
  endTime: number
  confidence: number
  type: ReplayMarkerType
}): ReplayMarker {
  return {
    id,
    label,
    startTime: Math.max(0, startTime),
    endTime: Math.max(startTime, endTime),
    confidence: clamp01(confidence),
    type,
  }
}

function longestSegment(
  segments: Segment[],
  types: Segment["type"][]
) {
  return segments
    .filter((segment) => types.includes(segment.type))
    .sort(
      (a, b) =>
        b.endTime - b.startTime - (a.endTime - a.startTime)
    )[0]
}

function segmentCount(
  segments: Segment[],
  type: Segment["type"]
) {
  return segments.filter((segment) => segment.type === type).length
}

function firstAndLast(
  segments: Segment[],
  type: Segment["type"]
) {
  const matching = segments.filter((segment) => segment.type === type)
  const first = matching[0]
  const last = matching[matching.length - 1]

  if (!first || !last) return null

  return {
    first,
    last,
    count: matching.length,
  }
}

function handleMarkers(
  segmentedMemory: SegmentedMemory
): ReplayMarker[] {
  const markers: ReplayMarker[] = []
  const dribbles = firstAndLast(
    segmentedMemory.segments,
    "dribble_cycle"
  )
  const strongestWindow = longestSegment(segmentedMemory.segments, [
    "activity_window",
  ])
  const firstPause = segmentedMemory.segments.find(
    (segment) => segment.type === "pause"
  )
  const cadence = segmentedMemory.cadenceEstimate

  if (
    dribbles &&
    dribbles.count >= 3 &&
    segmentedMemory.confidence >= 0.5
  ) {
    markers.push(
      marker({
        id: "handle-repetition",
        label: `${dribbles.count} HANDLE CYCLES`,
        startTime: dribbles.first.startTime,
        endTime: dribbles.last.endTime,
        confidence: segmentedMemory.confidence,
        type: "repetition",
      })
    )
  }

  if (
    cadence.consistency != null &&
    cadence.consistency >= 0.52 &&
    dribbles
  ) {
    markers.push(
      marker({
        id: "handle-cadence",
        label:
          cadence.state === "stable"
            ? "CADENCE STABILIZED"
            : "REPEATED CADENCE",
        startTime: dribbles.first.startTime,
        endTime: dribbles.last.endTime,
        confidence: 0.5 + cadence.consistency * 0.4,
        type: "cadence",
      })
    )
  }

  if (strongestWindow) {
    markers.push(
      marker({
        id: "handle-rhythm-window",
        label: "STRONGEST RHYTHM WINDOW",
        startTime: strongestWindow.startTime,
        endTime: strongestWindow.endTime,
        confidence: strongestWindow.confidence,
        type: "rhythm",
      })
    )
  }

  if (firstPause) {
    markers.push(
      marker({
        id: "handle-reset",
        label: "RESET MOMENT",
        startTime: firstPause.startTime,
        endTime: firstPause.endTime,
        confidence: firstPause.confidence,
        type: "reset",
      })
    )
  }

  return markers
}

function genericSegmentMarkers(
  segmentedMemory: SegmentedMemory
): ReplayMarker[] {
  const markers: ReplayMarker[] = []
  const strongestWindow = longestSegment(segmentedMemory.segments, [
    "activity_window",
    "movement_burst",
    "repeated_motion",
  ])
  const burstCount = segmentCount(
    segmentedMemory.segments,
    "movement_burst"
  )
  const repeatedMotion = firstAndLast(
    segmentedMemory.segments,
    "repeated_motion"
  )

  if (strongestWindow) {
    markers.push(
      marker({
        id: "movement-continuity",
        label:
          strongestWindow.type === "movement_burst"
            ? "MOVEMENT BURST"
            : "MOVEMENT CONTINUITY",
        startTime: strongestWindow.startTime,
        endTime: strongestWindow.endTime,
        confidence: strongestWindow.confidence,
        type:
          strongestWindow.type === "movement_burst"
            ? "burst"
            : "continuity",
      })
    )
  }

  if (burstCount >= 2) {
    const firstBurst = segmentedMemory.segments.find(
      (segment) => segment.type === "movement_burst"
    )
    const lastBurst = [...segmentedMemory.segments]
      .reverse()
      .find((segment) => segment.type === "movement_burst")

    if (firstBurst && lastBurst) {
      markers.push(
        marker({
          id: "movement-bursts",
          label: `${burstCount} MOVEMENT BURSTS`,
          startTime: firstBurst.startTime,
          endTime: lastBurst.endTime,
          confidence: 0.58,
          type: "burst",
        })
      )
    }
  }

  if (repeatedMotion && repeatedMotion.count >= 2) {
    markers.push(
      marker({
        id: "repeated-motion",
        label: "REPEATED MOTION",
        startTime: repeatedMotion.first.startTime,
        endTime: repeatedMotion.last.endTime,
        confidence: 0.56,
        type: "repetition",
      })
    )
  }

  return markers
}

function signalMarkers({
  session,
  signals,
}: {
  session: ReplaySessionView
  signals: ExtractedReplaySignals | null
}) {
  if (!signals) return []

  const markers: ReplayMarker[] = []

  if (
    signals.frameSampleCount >= 2 &&
    signals.activityState === "active"
  ) {
    markers.push(
      marker({
        id: "activity-recorded",
        label: "MOVEMENT STORED",
        startTime: 0,
        endTime: Math.max(1, Math.min(session.duration || 3, 3)),
        confidence: 0.5,
        type: "continuity",
      })
    )
  }

  if (
    signals.cameraMovement != null &&
    signals.cameraMovement <= 0.18 &&
    signals.frameSampleCount >= 3
  ) {
    markers.push(
      marker({
        id: "camera-stabilized",
        label: "FRAME STABILIZED",
        startTime: 0,
        endTime: Math.max(1, Math.min(session.duration || 4, 4)),
        confidence: 0.54,
        type: "stabilization",
      })
    )
  }

  for (const [index, segment] of signals.timeline.entries()) {
    if (
      segment.label === "BRIGHTNESS SHIFT" ||
      segment.label === "AUDIO ENERGY"
    ) {
      markers.push(
        marker({
          id: `signal-${index}`,
          label:
            segment.label === "AUDIO ENERGY"
              ? "AUDIO MOMENT"
              : "LIGHT SHIFT",
          startTime: segment.start,
          endTime: segment.end,
          confidence: 0.5,
          type:
            segment.label === "AUDIO ENERGY"
              ? "rhythm"
              : "stabilization",
        })
      )
    }
  }

  return markers
}

export function generateReplayMarkers({
  session,
  signals,
  segmentedMemory,
}: {
  session: ReplaySessionView
  signals: ExtractedReplaySignals | null
  segmentedMemory: SegmentedMemory | null
}): ReplayMarker[] {
  const markers = [
    ...(segmentedMemory?.missionId.includes("HANDLE")
      ? handleMarkers(segmentedMemory)
      : segmentedMemory
        ? genericSegmentMarkers(segmentedMemory)
        : []),
    ...signalMarkers({ session, signals }),
  ]

  return markers
    .filter((item) => item.confidence >= 0.45)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence
      }

      return a.startTime - b.startTime
    })
    .slice(0, 5)
}
