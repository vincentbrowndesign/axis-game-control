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
  duration_seconds: number | null
  file_path: string | null
  id: string
  metadata: Record<string, unknown> | null
  title: string | null
  user_id: string
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
  sessionId,
  traceId,
  userId,
}: {
  sessionId: string
  traceId?: string
  userId: string
}) {
  await enqueueProcessingJobs({
    jobTypes: ["replay_generation"],
    sessionId,
    userId,
  })

  await updateTriggerGameUploadStatus({
    detail: "Game queued.",
    jobStatus: "queued",
    sessionId,
    sessionStatus: "queued",
    traceId,
    userId,
  })
}

export async function updateTriggerGameUploadStatus({
  detail,
  jobStatus,
  result = {},
  sessionId,
  sessionStatus,
  traceId,
  userId,
}: {
  detail: string
  jobStatus: AxisProcessingJobStatus
  result?: Record<string, unknown>
  sessionId: string
  sessionStatus: string
  traceId?: string
  userId: string
}) {
  const session = await loadTriggerSession({ sessionId, userId })
  if (!session) throw new Error("Axis session not found.")

  const now = new Date().toISOString()
  const existingRows = await listProcessingJobRows({ sessionId, userId })
  const replayJob = existingRows.find((job) => job.type === "replay_generation")

  if (!replayJob) {
    await enqueueProcessingJobs({
      jobTypes: ["replay_generation"],
      sessionId,
      userId,
    })
  }

  const currentJob = replayJob || (await listProcessingJobRows({ sessionId, userId }))
    .find((job) => job.type === "replay_generation")

  if (!currentJob) throw new Error("Axis processing job not found.")

  const updatedJob = await supabaseAdmin
    .from("axis_processing_jobs")
    .update({
      attempts:
        jobStatus === "processing"
          ? currentJob.attempts + 1
          : currentJob.attempts,
      completed_at: jobStatus === "complete" ? now : currentJob.completed_at,
      detail,
      error: null,
      progress: jobStatus === "complete" ? 100 : jobStatus === "processing" ? 50 : 0,
      result: jobStatus === "complete" ? result : currentJob.result,
      started_at: jobStatus === "processing" ? now : currentJob.started_at,
      status: jobStatus,
      updated_at: now,
    })
    .eq("id", currentJob.id)

  if (updatedJob.error) throw new Error(updatedJob.error.message)

  const rows = await listProcessingJobRows({ sessionId, userId })
  const manifest = manifestFromRows(rows)
  const metadata = {
    ...asRecord(session.metadata),
    processing: deriveProcessingFromJobs(manifest, traceId),
    processingJobs: manifest,
    trigger: {
      ...(asRecord(asRecord(session.metadata).trigger)),
      processGameUpload: {
        detail,
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

  const updatedSession = await supabaseAdmin
    .from("axis_sessions")
    .update({
      metadata: archivedMetadata,
      status: sessionStatus,
      updated_at: now,
    })
    .eq("id", session.id)
    .eq("user_id", session.user_id)

  if (updatedSession.error) throw new Error(updatedSession.error.message)

  return {
    jobs: manifest.jobs,
    processing: metadata.processing,
    sessionStatus,
  }
}

async function loadTriggerSession({
  sessionId,
  userId,
}: {
  sessionId: string
  userId: string
}) {
  const result = await supabaseAdmin
    .from("axis_sessions")
    .select("id, user_id, title, file_path, duration_seconds, metadata")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle<TriggerSession>()

  if (result.error) throw new Error(result.error.message)

  return result.data
}
