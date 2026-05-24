import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import {
  AXIS_PROCESSING_JOB_TYPES,
  deriveProcessingFromJobs,
  ensureJobManifest,
  markManifestJob,
  readJobManifest,
  runProcessingJob,
  summarizeJobs,
  type AxisProcessingJobType,
} from "@/lib/axis-processing/jobs"
import { applySessionArchiveManifest } from "@/lib/axis-processing/archive"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type JobsBody = {
  action?: "enqueue" | "run"
  jobType?: AxisProcessingJobType
  sessionId?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function isJobType(value: unknown): value is AxisProcessingJobType {
  return (
    typeof value === "string" &&
    AXIS_PROCESSING_JOB_TYPES.includes(value as AxisProcessingJobType)
  )
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, traceId, error: "AUTH REQUIRED" },
        { status: 401 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as JobsBody
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
    const action = body.action === "enqueue" ? "enqueue" : "run"

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, traceId, error: "SESSION REQUIRED" },
        { status: 400 }
      )
    }

    const sessionResult = await supabase
      .from("axis_sessions")
      .select("id, user_id, title, file_path, duration_seconds, metadata")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle<{
        duration_seconds: number | null
        file_path: string | null
        id: string
        metadata: Record<string, unknown> | null
        title: string | null
        user_id: string
      }>()

    if (sessionResult.error || !sessionResult.data) {
      return NextResponse.json(
        { ok: false, traceId, error: "SESSION NOT FOUND" },
        { status: 404 }
      )
    }

    let metadata = asRecord(sessionResult.data.metadata)
    let manifest = ensureJobManifest(readJobManifest(metadata.processingJobs))
    metadata.processingJobs = manifest
    metadata.processing = deriveProcessingFromJobs(manifest, traceId)

    if (action === "enqueue") {
      await persistSession({
        metadata,
        session: sessionResult.data,
        sessionId,
        status: "queued",
        userId: user.id,
      })

      return NextResponse.json({
        ok: true,
        jobs: manifest.jobs,
        summary: summarizeJobs(manifest),
        traceId,
      })
    }

    const requestedJob = isJobType(body.jobType) ? body.jobType : null
    const runnableJobs = requestedJob
      ? manifest.jobs.filter((job) => job.type === requestedJob)
      : manifest.jobs.filter((job) => job.status === "queued" || job.status === "waiting")
    const completed: AxisProcessingJobType[] = []

    for (const job of runnableJobs) {
      manifest = readJobManifest(metadata.processingJobs)

      if (job.status === "complete") continue

      metadata.processingJobs = markManifestJob(
        manifest,
        job.type,
        "running",
        `Running ${job.type}.`
      )
      metadata.processing = deriveProcessingFromJobs(
        readJobManifest(metadata.processingJobs),
        traceId
      )
      await persistSession({
        metadata,
        session: sessionResult.data,
        sessionId,
        status: "processing",
        userId: user.id,
      })

      try {
        metadata = await runProcessingJob({
          jobType: job.type,
          metadata,
          session: sessionResult.data,
          traceId,
        })
        completed.push(job.type)
        await persistSession({
          metadata,
          session: sessionResult.data,
          sessionId,
          status: String(asRecord(metadata.processing).state || "processing").toLowerCase(),
          userId: user.id,
        })
      } catch (error) {
        const failedManifest = markManifestJob(
          readJobManifest(metadata.processingJobs),
          job.type,
          "failed",
          `Failed ${job.type}.`,
          error instanceof Error ? error.message : "Job failed."
        )
        metadata.processingJobs = failedManifest
        metadata.processing = deriveProcessingFromJobs(failedManifest, traceId)
        await persistSession({
          metadata,
          session: sessionResult.data,
          sessionId,
          status: "failed",
          userId: user.id,
        })

        return NextResponse.json(
          {
            ok: false,
            completed,
            error: error instanceof Error ? error.message : "JOB FAILED",
            failedJob: job.type,
            jobs: failedManifest.jobs,
            summary: summarizeJobs(failedManifest),
            traceId,
          },
          { status: 500 }
        )
      }
    }

    manifest = readJobManifest(metadata.processingJobs)
    metadata.processing = deriveProcessingFromJobs(manifest, traceId)
    await persistSession({
      metadata,
      session: sessionResult.data,
      sessionId,
      status: String(asRecord(metadata.processing).state || "processing").toLowerCase(),
      userId: user.id,
    })

    revalidatePath("/games")
    revalidatePath("/replay-native")

    return NextResponse.json({
      ok: true,
      completed,
      jobs: manifest.jobs,
      processing: metadata.processing,
      summary: summarizeJobs(manifest),
      traceId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        traceId,
        error: error instanceof Error ? error.message : "JOB ORCHESTRATION FAILED",
      },
      { status: 500 }
    )
  }
}

async function persistSession({
  metadata,
  session,
  sessionId,
  status,
  userId,
}: {
  metadata: Record<string, unknown>
  session: {
    duration_seconds: number | null
    file_path: string | null
    id: string
    title: string | null
  }
  sessionId: string
  status: string
  userId: string
}) {
  const archivedMetadata = applySessionArchiveManifest({
    durationSeconds: session.duration_seconds,
    filePath: session.file_path,
    id: session.id,
    metadata,
    status,
    title: session.title,
    updatedAt: new Date().toISOString(),
  })

  const updated = await supabaseAdmin
    .from("axis_sessions")
    .update({
      metadata: archivedMetadata,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)

  if (updated.error) throw new Error(updated.error.message)
}
