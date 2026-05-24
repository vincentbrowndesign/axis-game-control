import { createProcessingSnapshot, type AxisProcessingState } from "@/lib/axis-processing/state"
import { buildOutputBundle } from "@/lib/axis-processing/outputs"
import { exportSessionClips } from "@/lib/replay/exportClips"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const AXIS_PROCESSING_JOB_TYPES = [
  "upload",
  "tracking",
  "telemetry",
  "replay_generation",
  "clip_generation",
  "stats_generation",
  "broadcast_generation",
] as const

export type AxisProcessingJobType = (typeof AXIS_PROCESSING_JOB_TYPES)[number]
export type AxisProcessingJobStatus = "queued" | "running" | "complete" | "failed" | "waiting"

export type AxisProcessingJob = {
  attempts: number
  completedAt?: string
  detail?: string
  error?: string
  id: string
  progress: number
  queuedAt: string
  startedAt?: string
  status: AxisProcessingJobStatus
  type: AxisProcessingJobType
  updatedAt: string
}

export type AxisProcessingJobManifest = {
  createdAt: string
  jobs: AxisProcessingJob[]
  updatedAt: string
  version: 1
}

export type AxisJobSession = {
  duration_seconds: number | null
  file_path: string | null
  id: string
  metadata: Record<string, unknown> | null
  title: string | null
  user_id: string
}

type JobRunnerContext = {
  metadata: Record<string, unknown>
  session: AxisJobSession
  traceId: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function jobState(type: AxisProcessingJobType): AxisProcessingState {
  if (type === "upload") return "QUEUED"
  if (type === "tracking") return "TRACKING"
  if (type === "telemetry") return "GENERATING_REPLAY"
  if (type === "replay_generation") return "GENERATING_REPLAY"
  if (type === "clip_generation") return "GENERATING_CLIPS"
  if (type === "stats_generation") return "GENERATING_STATS"
  return "GENERATING_BROADCAST"
}

function jobDetail(type: AxisProcessingJobType) {
  if (type === "upload") return "Game upload saved."
  if (type === "tracking") return "Tracking pass prepared."
  if (type === "telemetry") return "Telemetry prepared."
  if (type === "replay_generation") return "Replay memory prepared."
  if (type === "clip_generation") return "Clips prepared."
  if (type === "stats_generation") return "Stats prepared."
  return "Broadcast recap prepared."
}

export function readJobManifest(value: unknown): AxisProcessingJobManifest {
  const record = asRecord(value)
  const now = new Date().toISOString()
  const rawJobs = Array.isArray(record.jobs) ? record.jobs : []
  const jobs = rawJobs
    .filter((job): job is Record<string, unknown> => Boolean(job) && typeof job === "object")
    .filter((job) => AXIS_PROCESSING_JOB_TYPES.includes(job.type as AxisProcessingJobType))
    .map((job) => ({
      attempts: typeof job.attempts === "number" ? job.attempts : 0,
      completedAt: typeof job.completedAt === "string" ? job.completedAt : undefined,
      detail: typeof job.detail === "string" ? job.detail : undefined,
      error: typeof job.error === "string" ? job.error : undefined,
      id: typeof job.id === "string" ? job.id : crypto.randomUUID(),
      progress: typeof job.progress === "number" ? job.progress : 0,
      queuedAt: typeof job.queuedAt === "string" ? job.queuedAt : now,
      startedAt: typeof job.startedAt === "string" ? job.startedAt : undefined,
      status: isJobStatus(job.status) ? job.status : "queued",
      type: job.type as AxisProcessingJobType,
      updatedAt: typeof job.updatedAt === "string" ? job.updatedAt : now,
    }))

  return ensureJobManifest({
    createdAt: typeof record.createdAt === "string" ? record.createdAt : now,
    jobs,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now,
    version: 1,
  })
}

export function ensureJobManifest(manifest?: AxisProcessingJobManifest) {
  const now = new Date().toISOString()
  const existing = new Map((manifest?.jobs || []).map((job) => [job.type, job]))
  const jobs = AXIS_PROCESSING_JOB_TYPES.map((type) => {
    const job = existing.get(type)
    if (job) return job

    return {
      attempts: 0,
      id: crypto.randomUUID(),
      progress: 0,
      queuedAt: now,
      status: "queued" as const,
      type,
      updatedAt: now,
    }
  })

  return {
    createdAt: manifest?.createdAt || now,
    jobs,
    updatedAt: now,
    version: 1 as const,
  }
}

export function summarizeJobs(manifest: AxisProcessingJobManifest) {
  const total = manifest.jobs.length || 1
  const complete = manifest.jobs.filter((job) => job.status === "complete").length
  const failed = manifest.jobs.filter((job) => job.status === "failed").length
  const running = manifest.jobs.find((job) => job.status === "running")
  const next = manifest.jobs.find((job) => job.status === "queued" || job.status === "waiting")

  return {
    complete,
    failed,
    nextType: running?.type || next?.type || null,
    progress: Math.round((complete / total) * 100),
    total,
  }
}

export function deriveProcessingFromJobs(manifest: AxisProcessingJobManifest, traceId?: string) {
  const failed = manifest.jobs.find((job) => job.status === "failed")
  if (failed) {
    return createProcessingSnapshot({
      detail: failed.error || failed.detail,
      previous: {},
      state: "FAILED",
      traceId,
    })
  }

  if (manifest.jobs.every((job) => job.status === "complete")) {
    return createProcessingSnapshot({
      detail: "Replay, clips, stats, and recap output are ready.",
      previous: {},
      state: "COMPLETE",
      traceId,
    })
  }

  const active =
    manifest.jobs.find((job) => job.status === "running") ||
    manifest.jobs.find((job) => job.status === "queued") ||
    manifest.jobs.find((job) => job.status === "waiting")

  return createProcessingSnapshot({
    detail: active?.detail || (active ? jobDetail(active.type) : "Game queued."),
    previous: {},
    state: active ? jobState(active.type) : "QUEUED",
    traceId,
  })
}

export async function runProcessingJob({
  jobType,
  metadata,
  session,
  traceId,
}: JobRunnerContext & {
  jobType: AxisProcessingJobType
}) {
  if (jobType === "upload") return completeUploadJob({ metadata, session, traceId })
  if (jobType === "tracking") return completeTrackingJob({ metadata, session, traceId })
  if (jobType === "telemetry") return completeTelemetryJob({ metadata, session, traceId })
  if (jobType === "replay_generation") return completeReplayJob({ metadata, session, traceId })
  if (jobType === "clip_generation") return completeClipJob({ metadata, session, traceId })
  if (jobType === "stats_generation") return completeStatsJob({ metadata, session, traceId })
  return completeBroadcastJob({ metadata, session, traceId })
}

function isJobStatus(value: unknown): value is AxisProcessingJobStatus {
  return value === "queued" || value === "running" || value === "complete" || value === "failed" || value === "waiting"
}

function markJob(
  manifest: AxisProcessingJobManifest,
  type: AxisProcessingJobType,
  status: AxisProcessingJobStatus,
  detail?: string,
  error?: string
) {
  const now = new Date().toISOString()

  return {
    ...manifest,
    jobs: manifest.jobs.map((job) => {
      if (job.type !== type) return job

      return {
        ...job,
        attempts: status === "running" ? job.attempts + 1 : job.attempts,
        completedAt: status === "complete" ? now : job.completedAt,
        detail,
        error,
        progress: status === "complete" ? 100 : status === "running" ? 50 : job.progress,
        startedAt: status === "running" ? now : job.startedAt,
        status,
        updatedAt: now,
      }
    }),
    updatedAt: now,
  }
}

export function markManifestJob(
  manifest: AxisProcessingJobManifest,
  type: AxisProcessingJobType,
  status: AxisProcessingJobStatus,
  detail?: string,
  error?: string
) {
  return markJob(manifest, type, status, detail, error)
}

function setManifest(metadata: Record<string, unknown>, manifest: AxisProcessingJobManifest, traceId: string) {
  metadata.processingJobs = manifest
  metadata.processing = deriveProcessingFromJobs(manifest, traceId)
  return metadata
}

function completeUploadJob({ metadata, session, traceId }: JobRunnerContext) {
  if (!session.file_path) throw new Error("Game upload is missing.")

  const manifest = markJob(
    readJobManifest(metadata.processingJobs),
    "upload",
    "complete",
    "Game upload saved."
  )

  return setManifest(metadata, manifest, traceId)
}

function completeTrackingJob({ metadata, traceId }: JobRunnerContext) {
  const manifest = markJob(
    readJobManifest(metadata.processingJobs),
    "tracking",
    "complete",
    "Tracking pass prepared."
  )

  metadata.tracking = {
    ...(asRecord(metadata.tracking)),
    status: "ready",
    updatedAt: new Date().toISOString(),
  }

  return setManifest(metadata, manifest, traceId)
}

async function completeTelemetryJob({ metadata, session, traceId }: JobRunnerContext) {
  const telemetry = asRecord(metadata.telemetry)
  const existingPath = typeof telemetry.path === "string" ? telemetry.path : ""

  if (!existingPath) {
    const durationMs = Math.max(1000, Number(session.duration_seconds || 0) * 1000)
    const frames = buildBaselineTelemetry(durationMs)
    const path = `${session.user_id}/telemetry/${session.id}-axis-telemetry.ndjson`
    const body = frames.map((frame) => JSON.stringify(frame)).join("\n")
    const upload = await supabaseAdmin.storage
      .from("axis-replays")
      .upload(path, body, {
        cacheControl: "3600",
        contentType: "application/x-ndjson",
        upsert: true,
      })

    if (upload.error) throw new Error(upload.error.message)

    metadata.telemetry = {
      contentType: "application/x-ndjson",
      durationMs,
      fileName: "axis-telemetry.ndjson",
      frameCount: frames.length,
      path,
      sizeBytes: body.length,
      traceId,
    }
  }

  const manifest = markJob(
    readJobManifest(metadata.processingJobs),
    "telemetry",
    "complete",
    "Telemetry prepared."
  )

  return setManifest(metadata, manifest, traceId)
}

async function completeReplayJob({ metadata, session, traceId }: JobRunnerContext) {
  const timeline = asRecord(metadata.timeline)
  const existingPath = typeof timeline.path === "string" ? timeline.path : ""

  if (!existingPath) {
    const durationMs = Math.max(1000, Number(session.duration_seconds || 0) * 1000)
    const clipWindows = buildBaselineClipWindows(durationMs)
    const path = `${session.user_id}/timelines/${session.id}-axis-timeline.json`
    const payload = {
      clipWindows,
      events: [],
      possessions: [],
      quality: {
        source: "baseline",
        warnings: ["Tracking detections were not attached yet."],
      },
      stats: baselineStats(),
    }
    const body = JSON.stringify(payload, null, 2)
    const upload = await supabaseAdmin.storage
      .from("axis-replays")
      .upload(path, body, {
        cacheControl: "3600",
        contentType: "application/json",
        upsert: true,
      })

    if (upload.error) throw new Error(upload.error.message)

    metadata.timeline = {
      clipWindowCount: clipWindows.length,
      eventCount: 0,
      path,
      possessionCount: 0,
      traceId,
    }
    metadata.stats = {
      path,
      playerCount: 0,
      possessionCount: 0,
      teamCount: 0,
      timelineCount: 0,
      traceId,
      updatedAt: new Date().toISOString(),
    }
  }

  const manifest = markJob(
    readJobManifest(metadata.processingJobs),
    "replay_generation",
    "complete",
    "Replay memory prepared."
  )

  return setManifest(metadata, manifest, traceId)
}

async function completeClipJob({ metadata, session, traceId }: JobRunnerContext) {
  const result = await exportSessionClips({
    maxClips: 5,
    session: {
      ...session,
      metadata,
    },
  })

  metadata.clips = {
    count: result.clips.length,
    errors: result.errors,
    generatedAt: new Date().toISOString(),
    plannedCount: result.plan.length,
    status: result.clips.length > 0 ? "ready" : "empty",
    traceId,
    values: result.clips,
  }

  const manifest = markJob(
    readJobManifest(metadata.processingJobs),
    "clip_generation",
    "complete",
    "Clips prepared."
  )

  return setManifest(metadata, manifest, traceId)
}

function completeStatsJob({ metadata, traceId }: JobRunnerContext) {
  const stats = asRecord(metadata.stats)
  metadata.stats = {
    path: typeof stats.path === "string" ? stats.path : "",
    playerCount: typeof stats.playerCount === "number" ? stats.playerCount : 0,
    possessionCount: typeof stats.possessionCount === "number" ? stats.possessionCount : 0,
    teamCount: typeof stats.teamCount === "number" ? stats.teamCount : 0,
    timelineCount: typeof stats.timelineCount === "number" ? stats.timelineCount : 0,
    traceId,
    updatedAt: new Date().toISOString(),
  }

  const manifest = markJob(
    readJobManifest(metadata.processingJobs),
    "stats_generation",
    "complete",
    "Stats prepared."
  )

  return setManifest(metadata, manifest, traceId)
}

function completeBroadcastJob({ metadata, session, traceId }: JobRunnerContext) {
  const clips = asRecord(metadata.clips)
  const clipValues = Array.isArray(clips.values) ? clips.values : []
  const stats = asRecord(metadata.stats)
  const outputs = buildOutputBundle({
    clips: clipValues,
    metadata,
    replayHref: `/replay-native?session=${encodeURIComponent(session.id)}`,
    sessionId: session.id,
    sessionTitle: session.title || "Game",
  })

  metadata.broadcast = {
    ...outputs.broadcast,
    clipCount: typeof clips.count === "number" ? clips.count : 0,
    possessionCount: typeof stats.possessionCount === "number" ? stats.possessionCount : 0,
    sessionId: session.id,
    status: "ready",
    traceId,
  }
  metadata.highlights = outputs.highlights
  metadata.outputs = outputs

  const manifest = markJob(
    readJobManifest(metadata.processingJobs),
    "broadcast_generation",
    "complete",
    "Broadcast recap prepared."
  )

  return setManifest(metadata, manifest, traceId)
}

function buildBaselineTelemetry(durationMs: number) {
  const frameCount = Math.max(2, Math.min(120, Math.ceil(durationMs / 1000)))

  return Array.from({ length: frameCount }, (_, index) => {
    const timestamp = Math.round((durationMs * index) / Math.max(1, frameCount - 1))

    return {
      control: 0.28,
      frame_id: index,
      pressure: 0.16,
      spacing: 0.72,
      timestamp_ms: timestamp,
      topology: {
        knots: [],
        temporal_density: 0.12,
        windows: [],
      },
    }
  })
}

function buildBaselineClipWindows(durationMs: number) {
  const safeDuration = Math.max(1000, durationMs)
  const anchors = [0.25, 0.5, 0.75]

  return anchors.map((anchor, index) => {
    const center = safeDuration * anchor
    const startMs = Math.max(0, Math.round(center - 5000))
    const endMs = Math.min(safeDuration, Math.round(center + 7000))

    return {
      endMs,
      id: `baseline-window-${index + 1}`,
      label: "Game moment",
      reason: "game_memory",
      startMs,
      weight: 0.35,
    }
  })
}

function baselineStats() {
  return {
    players: {},
    possessions: 0,
    teams: {},
    timeline: [],
  }
}
