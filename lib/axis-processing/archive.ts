import { readJobManifest, summarizeJobs } from "@/lib/axis-processing/jobs"
import { readProcessingSnapshot } from "@/lib/axis-processing/state"

export type AxisSessionArchiveManifest = {
  assets: {
    broadcast: Record<string, unknown>
    clips: {
      count: number
      paths: string[]
      status: string
    }
    replayTopology: Record<string, unknown>
    stats: Record<string, unknown>
    telemetry: Record<string, unknown>
    video: Record<string, unknown>
  }
  createdAt: string
  id: string
  kind: "game"
  processing: ReturnType<typeof readProcessingSnapshot>
  processingJobs: ReturnType<typeof summarizeJobs>
  resumable: boolean
  searchableText: string
  status: string
  title: string
  updatedAt: string
  version: 1
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function pathList(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => item.path)
    .filter((path): path is string => typeof path === "string" && path.length > 0)
}

export function buildSessionArchiveManifest({
  createdAt,
  durationSeconds,
  fileName,
  filePath,
  id,
  metadata,
  status,
  title,
  updatedAt,
}: {
  createdAt?: string | number | null
  durationSeconds?: number | null
  fileName?: string | null
  filePath?: string | null
  id: string
  metadata: Record<string, unknown>
  status?: string | null
  title?: string | null
  updatedAt?: string | null
}): AxisSessionArchiveManifest {
  const now = new Date().toISOString()
  const existingArchive = asRecord(metadata.archive)
  const video = asRecord(existingArchive.video)
  const telemetry = asRecord(metadata.telemetry)
  const timeline = asRecord(metadata.timeline)
  const stats = asRecord(metadata.stats)
  const clips = asRecord(metadata.clips)
  const broadcast = asRecord(metadata.broadcast)
  const outputs = asRecord(metadata.outputs)
  const processing = readProcessingSnapshot(metadata.processing)
  const jobs = readJobManifest(metadata.processingJobs)
  const jobSummary = summarizeJobs(jobs)
  const resolvedTitle = text(title, text(fileName, "Game media"))
  const created =
    typeof createdAt === "string"
      ? createdAt
      : typeof createdAt === "number"
        ? new Date(createdAt).toISOString()
        : text(existingArchive.createdAt, now)

  return {
    assets: {
      broadcast: {
        ...broadcast,
        outputs,
        status: text(broadcast.status, "queued"),
      },
      clips: {
        count:
          typeof clips.count === "number"
            ? clips.count
            : pathList(clips.values).length,
        paths: pathList(clips.values),
        status: text(clips.status, "queued"),
      },
      replayTopology: {
        clipWindowCount: number(timeline.clipWindowCount),
        eventCount: number(timeline.eventCount),
        path: text(timeline.path),
        possessionCount: number(timeline.possessionCount),
        status: text(timeline.path) ? "ready" : "queued",
      },
      stats: {
        ...stats,
        status: text(stats.path) ? "ready" : "queued",
      },
      telemetry: {
        durationMs: number(telemetry.durationMs),
        frameCount: number(telemetry.frameCount),
        path: text(telemetry.path),
        status: text(telemetry.path) ? "ready" : "queued",
      },
      video: {
        ...video,
        bucket: text(video.bucket, "axis-replays"),
        contentType: text(video.contentType, "video/mp4"),
        durationSeconds: number(durationSeconds),
        fileName: text(fileName, text(video.fileName, resolvedTitle)),
        path: text(filePath, text(video.path)),
        sizeBytes: number(video.sizeBytes),
        status: text(filePath, text(video.path)) ? "ready" : "queued",
      },
    },
    createdAt: created,
    id,
    kind: "game",
    processing,
    processingJobs: jobSummary,
    resumable: processing.state !== "COMPLETE" && processing.state !== "FAILED",
    searchableText: [
      resolvedTitle,
      text(fileName),
      processing.label,
      text(broadcast.title),
      text(asRecord(outputs.replay).href),
    ].filter(Boolean).join(" ").toLowerCase(),
    status: text(status, processing.state.toLowerCase()),
    title: resolvedTitle,
    updatedAt: updatedAt || now,
    version: 1,
  }
}

export function applySessionArchiveManifest({
  createdAt,
  durationSeconds,
  fileName,
  filePath,
  id,
  metadata,
  status,
  title,
  updatedAt,
}: {
  createdAt?: string | number | null
  durationSeconds?: number | null
  fileName?: string | null
  filePath?: string | null
  id: string
  metadata: Record<string, unknown>
  status?: string | null
  title?: string | null
  updatedAt?: string | null
}) {
  const archive = buildSessionArchiveManifest({
    createdAt,
    durationSeconds,
    fileName,
    filePath,
    id,
    metadata,
    status,
    title,
    updatedAt,
  })

  return {
    ...metadata,
    archive,
    archiveSearch: archive.searchableText,
  }
}
