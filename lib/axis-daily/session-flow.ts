export type AxisSessionSegmentStatus = "active" | "completed" | "started"

export type AxisSessionSegment = {
  id: string
  label: string
  status: AxisSessionSegmentStatus
}

export const AXIS_DEFAULT_SESSION_SEGMENTS: AxisSessionSegment[] = [
  { id: "warmup", label: "Warmup", status: "active" },
  { id: "station-1", label: "Station 1", status: "started" },
  { id: "station-2", label: "Station 2", status: "started" },
  { id: "scrimmage", label: "Scrimmage", status: "started" },
]

export function normalizeSessionSegments(value: unknown): AxisSessionSegment[] {
  if (!Array.isArray(value)) return AXIS_DEFAULT_SESSION_SEGMENTS

  const known = new Map(
    AXIS_DEFAULT_SESSION_SEGMENTS.map((segment) => [segment.id, segment])
  )
  const normalized = value
    .map((segment) => {
      if (!isSegmentRecord(segment) || !known.has(segment.id)) return null

      return {
        id: segment.id,
        label: known.get(segment.id)?.label || segment.label,
        status: normalizeSegmentStatus(segment.status),
      } satisfies AxisSessionSegment
    })
    .filter((segment): segment is AxisSessionSegment => Boolean(segment))

  if (normalized.length !== AXIS_DEFAULT_SESSION_SEGMENTS.length) {
    return AXIS_DEFAULT_SESSION_SEGMENTS
  }

  return normalized
}

export function advanceSessionSegment(
  segments: AxisSessionSegment[],
  segmentId: string
) {
  const index = segments.findIndex((segment) => segment.id === segmentId)
  if (index < 0) return segments

  return segments.map((segment, segmentIndex) => {
    if (segmentIndex < index) {
      return { ...segment, status: "completed" as const }
    }

    if (segmentIndex === index) {
      return { ...segment, status: "completed" as const }
    }

    if (segmentIndex === index + 1) {
      return { ...segment, status: "active" as const }
    }

    return {
      ...segment,
      status:
        segment.status === "completed"
          ? ("completed" as const)
          : ("started" as const),
    }
  })
}

export function completeSessionSegments(segments: AxisSessionSegment[]) {
  return segments.map((segment) => ({
    ...segment,
    status: "completed" as const,
  }))
}

function isSegmentRecord(value: unknown): value is {
  id: string
  label: string
  status: string
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "label" in value &&
    "status" in value &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.status === "string"
  )
}

function normalizeSegmentStatus(value: string): AxisSessionSegmentStatus {
  if (value === "active" || value === "completed" || value === "started") {
    return value
  }

  return "started"
}
