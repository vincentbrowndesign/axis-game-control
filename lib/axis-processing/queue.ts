import {
  AXIS_PROCESSING_JOB_TYPES,
  type AxisProcessingJob,
  type AxisProcessingJobStatus,
  type AxisProcessingJobType,
} from "@/lib/axis-processing/jobs"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type AxisProcessingJobRow = {
  attempts: number
  completed_at: string | null
  created_at: string
  detail: string | null
  error: string | null
  failed_at: string | null
  id: string
  payload: Record<string, unknown>
  progress: number
  queued_at: string
  result: Record<string, unknown>
  session_id: string
  started_at: string | null
  status: AxisProcessingJobStatus
  type: AxisProcessingJobType
  updated_at: string
  user_id: string
}

export function jobRowToManifestJob(row: AxisProcessingJobRow): AxisProcessingJob {
  return {
    attempts: row.attempts,
    completedAt: row.completed_at || undefined,
    detail: row.detail || undefined,
    error: row.error || undefined,
    id: row.id,
    progress: row.progress,
    queuedAt: row.queued_at,
    startedAt: row.started_at || undefined,
    status: row.status,
    type: row.type,
    updatedAt: row.updated_at,
  }
}

export async function enqueueProcessingJobs({
  jobTypes = AXIS_PROCESSING_JOB_TYPES,
  sessionId,
  userId,
}: {
  jobTypes?: readonly AxisProcessingJobType[]
  sessionId: string
  userId: string
}) {
  const now = new Date().toISOString()
  const rows = jobTypes.map((type) => ({
    payload: {},
    progress: 0,
    queued_at: now,
    session_id: sessionId,
    status: "queued",
    type,
    updated_at: now,
    user_id: userId,
  }))

  const result = await supabaseAdmin
    .from("axis_processing_jobs")
    .upsert(rows, {
      ignoreDuplicates: true,
      onConflict: "session_id,type",
    })
    .select("*")
    .returns<AxisProcessingJobRow[]>()

  if (result.error) throw new Error(result.error.message)

  return result.data || []
}

export async function listProcessingJobRows({
  sessionId,
  userId,
}: {
  sessionId: string
  userId: string
}) {
  const result = await supabaseAdmin
    .from("axis_processing_jobs")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("queued_at", { ascending: true })
    .returns<AxisProcessingJobRow[]>()

  if (result.error) throw new Error(result.error.message)

  return result.data || []
}

export async function claimNextProcessingJob({
  sessionId,
  userId,
}: {
  sessionId: string
  userId: string
}) {
  const next = await supabaseAdmin
    .from("axis_processing_jobs")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .in("status", ["queued", "waiting"])
    .order("queued_at", { ascending: true })
    .limit(1)
    .maybeSingle<AxisProcessingJobRow>()

  if (next.error || !next.data) {
    if (next.error) throw new Error(next.error.message)
    return null
  }

  const now = new Date().toISOString()
  const claimed = await supabaseAdmin
    .from("axis_processing_jobs")
    .update({
      attempts: next.data.attempts + 1,
      detail: `Processing ${next.data.type}.`,
      progress: 50,
      started_at: now,
      status: "processing",
      updated_at: now,
    })
    .eq("id", next.data.id)
    .in("status", ["queued", "waiting"])
    .select("*")
    .maybeSingle<AxisProcessingJobRow>()

  if (claimed.error) throw new Error(claimed.error.message)

  return claimed.data
}

export async function completeProcessingJob({
  detail,
  jobId,
  result = {},
}: {
  detail?: string
  jobId: string
  result?: Record<string, unknown>
}) {
  const now = new Date().toISOString()
  const updated = await supabaseAdmin
    .from("axis_processing_jobs")
    .update({
      completed_at: now,
      detail,
      error: null,
      progress: 100,
      result,
      status: "complete",
      updated_at: now,
    })
    .eq("id", jobId)
    .select("*")
    .single<AxisProcessingJobRow>()

  if (updated.error) throw new Error(updated.error.message)

  return updated.data
}

export async function failProcessingJob({
  error,
  jobId,
}: {
  error: string
  jobId: string
}) {
  const now = new Date().toISOString()
  const updated = await supabaseAdmin
    .from("axis_processing_jobs")
    .update({
      error,
      failed_at: now,
      progress: 100,
      status: "failed",
      updated_at: now,
    })
    .eq("id", jobId)
    .select("*")
    .single<AxisProcessingJobRow>()

  if (updated.error) throw new Error(updated.error.message)

  return updated.data
}
