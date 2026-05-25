import { applySessionArchiveManifest } from "@/lib/axis-processing/archive"
import {
  deriveProcessingFromJobs,
  type AxisProcessingJobManifest,
  type AxisProcessingJobStatus,
} from "@/lib/axis-processing/jobs"
import {
  enqueueProcessingJobs,
  jobRowToManifestJob,
  listProcessingJobRows,
  type AxisProcessingJobRow,
} from "@/lib/axis-processing/queue"
import { supabaseAdmin } from "@/lib/supabase/admin"

type TriggerSession = {
  clerk_user_id: string | null
  duration_seconds: number | null
  file_path: string | null
  file_name: string | null
  id: string
  metadata: Record<string, unknown> | null
  title: string | null
  user_id: string | null
  video_url: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function manifestFromRows(rows: AxisProcessingJobRow[]): AxisProcessingJobManifest {
  const now = new Date().toISOString()

  return {
    createdAt: rows[0]?.created_at || now,
    jobs: rows.map(jobRowToManifestJob),
    updatedAt: rows.reduce(
      (latest, row) =>
        new Date(row.updated_at).getTime() > new Date(latest).getTime()
          ? row.updated_at
          : latest,
      rows[0]?.updated_at || now
    ),
    version: 1,
  }
}

export async function startTriggerGameUploadProcessing({
  clerkUserId,
  sessionId,
  traceId,
  userId,
}: {
  clerkUserId?: string | null
  sessionId: string
  traceId?: string
  userId?: string | null
}) {
  await enqueueProcessingJobs({
    clerkUserId,
    jobTypes: ["replay_generation"],
    sessionId,
    userId,
  })

  await updateTriggerGameUploadStatus({
    detail: "Game queued.",
    jobStatus: "queued",
    clerkUserId,
    sessionId,
    sessionStatus: "queued",
    traceId,
    userId,
  })
}

export async function updateTriggerGameUploadStatus({
  clerkUserId,
  detail,
  jobStatus,
  result = {},
  sessionId,
  sessionStatus,
  traceId,
  userId,
}: {
  clerkUserId?: string | null
  detail: string
  jobStatus: AxisProcessingJobStatus
  result?: Record<string, unknown>
  sessionId: string
  sessionStatus: string
  traceId?: string
  userId?: string | null
}) {
  const session = await loadTriggerSession({ clerkUserId, sessionId, userId })
  if (!session) throw new Error("Axis session not found.")

  const now = new Date().toISOString()
  const existingRows = await listProcessingJobRows({ clerkUserId, sessionId, userId })
  const replayJob = existingRows.find((job) => job.type === "replay_generation")

  if (!replayJob) {
    await enqueueProcessingJobs({
      clerkUserId,
      jobTypes: ["replay_generation"],
      sessionId,
      userId,
    })
  }

  const currentJob = replayJob || (await listProcessingJobRows({ clerkUserId, sessionId, userId }))
    .find((job) => job.type === "replay_generation")

  if (!currentJob) throw new Error("Axis processing job not found.")

  const outputResult = jobStatus === "complete"
    ? await writePlaceholderOutputs({ session, traceId })
    : { metadata: {}, paths: {} }
  const updatedJob = await supabaseAdmin
    .from("axis_processing_jobs")
    .update({
      attempts:
        jobStatus === "processing"
          ? currentJob.attempts + 1
          : currentJob.attempts,
      completed_at: jobStatus === "complete" ? now : currentJob.completed_at,
      current_step: currentStep(jobStatus),
      detail,
      error: null,
      progress: jobStatus === "complete" ? 100 : jobStatus === "processing" ? 50 : 0,
      result: jobStatus === "complete"
        ? { ...result, outputs: outputResult.paths }
        : currentJob.result,
      started_at: jobStatus === "processing" ? now : currentJob.started_at,
      status: jobStatus,
      updated_at: now,
    })
    .eq("id", currentJob.id)

  if (updatedJob.error) throw new Error(updatedJob.error.message)

  const rows = await listProcessingJobRows({ clerkUserId, sessionId, userId })
  const manifest = manifestFromRows(rows)
  const metadata = {
    ...asRecord(session.metadata),
    ...outputResult.metadata,
    processing: deriveProcessingFromJobs(manifest, traceId),
    processingJobs: manifest,
    trigger: {
      ...(asRecord(asRecord(session.metadata).trigger)),
      processGameUpload: {
        detail,
        outputs: outputResult.paths,
        status: jobStatus,
        traceId,
        updatedAt: now,
      },
    },
  }
  const archivedMetadata = applySessionArchiveManifest({
    durationSeconds: session.duration_seconds,
    filePath: session.file_path,
    id: session.id,
    metadata,
    status: sessionStatus,
    title: session.title,
    updatedAt: now,
  })

  const updatedSession = supabaseAdmin
    .from("axis_sessions")
    .update({
      metadata: archivedMetadata,
      status: sessionStatus,
      updated_at: now,
    })
    .eq("id", session.id)

  const scopedSessionUpdate = session.user_id
    ? updatedSession.eq("user_id", session.user_id)
    : updatedSession.eq("clerk_user_id", session.clerk_user_id || "")
  const scopedSessionResult = await scopedSessionUpdate

  if (scopedSessionResult.error) throw new Error(scopedSessionResult.error.message)

  return {
    jobs: manifest.jobs,
    processing: metadata.processing,
    sessionStatus,
  }
}

async function loadTriggerSession({
  clerkUserId,
  sessionId,
  userId,
}: {
  clerkUserId?: string | null
  sessionId: string
  userId?: string | null
}) {
  let query = supabaseAdmin
    .from("axis_sessions")
    .select("id, user_id, clerk_user_id, title, video_url, file_name, file_path, duration_seconds, metadata")
    .eq("id", sessionId)

  query = userId
    ? query.eq("user_id", userId)
    : query.eq("clerk_user_id", clerkUserId || "")

  const result = await query
    .maybeSingle<TriggerSession>()

  if (result.error) throw new Error(result.error.message)

  return result.data
}

function currentStep(status: AxisProcessingJobStatus) {
  if (status === "queued") return "queued"
  if (status === "processing") return "processing"
  if (status === "complete") return "complete"
  if (status === "failed") return "failed"
  return "waiting"
}

async function writePlaceholderOutputs({
  session,
  traceId,
}: {
  session: TriggerSession
  traceId?: string
}) {
  const owner = session.clerk_user_id || session.user_id || "axis"
  const basePath = `${owner}/sessions/${session.id}/outputs`
  const generatedAt = new Date().toISOString()
  const paths = {
    clips: `${basePath}/clips.json`,
    stats: `${basePath}/stats.json`,
    timeline: `${basePath}/timeline.json`,
  }
  const timeline = {
    clipWindows: [],
    events: [
      {
        id: `${session.id}-upload-complete`,
        label: "Game uploaded",
        timestampMs: 0,
        type: "session_created",
      },
    ],
    generatedAt,
    sessionId: session.id,
    source: "axis-placeholder",
    traceId,
  }
  const clips = {
    clips: [],
    generatedAt,
    sessionId: session.id,
    source: "axis-placeholder",
    traceId,
  }
  const stats = {
    generatedAt,
    players: {},
    possessions: 0,
    sessionId: session.id,
    source: "axis-placeholder",
    teams: {},
    timeline: [],
    traceId,
  }

  await Promise.all([
    uploadJson(paths.timeline, timeline),
    uploadJson(paths.clips, clips),
    uploadJson(paths.stats, stats),
  ])

  return {
    metadata: {
      clips: {
        count: 0,
        generatedAt,
        path: paths.clips,
        status: "ready",
        values: [],
      },
      stats: {
        path: paths.stats,
        playerCount: 0,
        possessionCount: 0,
        teamCount: 0,
        timelineCount: 0,
        updatedAt: generatedAt,
      },
      timeline: {
        clipWindowCount: 0,
        eventCount: 1,
        path: paths.timeline,
        possessionCount: 0,
      },
    },
    paths,
  }
}

async function uploadJson(path: string, payload: unknown) {
  const uploaded = await supabaseAdmin.storage
    .from("axis-replays")
    .upload(path, JSON.stringify(payload, null, 2), {
      contentType: "application/json",
      upsert: true,
    })

  if (uploaded.error) throw new Error(uploaded.error.message)
}
