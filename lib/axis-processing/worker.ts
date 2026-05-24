import { applySessionArchiveManifest } from "@/lib/axis-processing/archive"
import {
  deriveProcessingFromJobs,
  runProcessingJob,
  type AxisProcessingJobManifest,
} from "@/lib/axis-processing/jobs"
import {
  claimNextProcessingJob,
  completeProcessingJob,
  failProcessingJob,
  jobRowToManifestJob,
  listProcessingJobRows,
  type AxisProcessingJobRow,
} from "@/lib/axis-processing/queue"
import { supabaseAdmin } from "@/lib/supabase/admin"

type WorkerSession = {
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

export async function drainProcessingJobsForSession({
  maxJobs = 7,
  sessionId,
  userId,
}: {
  maxJobs?: number
  sessionId: string
  userId: string
}) {
  const traceId = crypto.randomUUID()
  const completed: string[] = []

  for (let index = 0; index < maxJobs; index += 1) {
    const job = await claimNextProcessingJob({ sessionId, userId })
    if (!job) break

    const session = await loadSession({ sessionId, userId })
    if (!session) {
      await failProcessingJob({
        error: "Session missing.",
        jobId: job.id,
      })
      break
    }

    let metadata: Record<string, unknown> = await syncSessionFromJobRows({
      session,
      status: "processing",
      traceId,
    })

    try {
      metadata = await runProcessingJob({
        jobType: job.type,
        metadata,
        session,
        traceId,
      })

      await completeProcessingJob({
        detail: `${job.type} complete.`,
        jobId: job.id,
        result: {
          completedAt: new Date().toISOString(),
          traceId,
        },
      })

      completed.push(job.type)

      await syncSessionFromJobRows({
        metadata,
        session,
        status: "processing",
        traceId,
      })
    } catch (error) {
      await failProcessingJob({
        error: error instanceof Error ? error.message : "Job failed.",
        jobId: job.id,
      })

      await syncSessionFromJobRows({
        metadata,
        session,
        status: "failed",
        traceId,
      })

      return {
        completed,
        failedJob: job.type,
        ok: false,
        traceId,
      }
    }
  }

  const finalRows = await listProcessingJobRows({ sessionId, userId })
  const allComplete =
    finalRows.length > 0 && finalRows.every((job) => job.status === "complete")

  const finalSession = await loadSession({ sessionId, userId })
  if (finalSession) {
    await syncSessionFromJobRows({
      session: finalSession,
      status: allComplete ? "complete" : "processing",
      traceId,
    })
  }

  return {
    completed,
    ok: true,
    remaining: finalRows.filter((job) => job.status === "queued" || job.status === "waiting").length,
    traceId,
  }
}

async function loadSession({
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
    .maybeSingle<WorkerSession>()

  if (result.error) throw new Error(result.error.message)

  return result.data
}

async function syncSessionFromJobRows({
  metadata,
  session,
  status,
  traceId,
}: {
  metadata?: Record<string, unknown>
  session: WorkerSession
  status: string
  traceId: string
}): Promise<Record<string, unknown>> {
  const rows = await listProcessingJobRows({
    sessionId: session.id,
    userId: session.user_id,
  })
  const manifest = manifestFromRows(rows)
  const nextMetadata = {
    ...asRecord(session.metadata),
    ...(metadata || {}),
    processing: deriveProcessingFromJobs(manifest, traceId),
    processingJobs: manifest,
  }
  const sessionStatus = nextMetadata.processing.state === "COMPLETE"
    ? "complete"
    : nextMetadata.processing.state === "FAILED"
      ? "failed"
      : status
  const archivedMetadata = applySessionArchiveManifest({
    durationSeconds: session.duration_seconds,
    filePath: session.file_path,
    id: session.id,
    metadata: nextMetadata,
    status: sessionStatus,
    title: session.title,
    updatedAt: new Date().toISOString(),
  })

  const updated = await supabaseAdmin
    .from("axis_sessions")
    .update({
      metadata: archivedMetadata,
      status: sessionStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("user_id", session.user_id)

  if (updated.error) throw new Error(updated.error.message)

  return archivedMetadata as Record<string, unknown>
}
