import { NextResponse } from "next/server"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { readProcessingSnapshot } from "@/lib/axis-processing/state"
import {
  deriveProcessingFromJobs,
  readJobManifest,
  summarizeJobs,
  type AxisProcessingJobManifest,
} from "@/lib/axis-processing/jobs"
import {
  jobRowToManifestJob,
  type AxisProcessingJobRow,
} from "@/lib/axis-processing/queue"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get("sessionId") || ""
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    return NextResponse.json(
      { error: "MEMORY ACCESS REQUIRED" },
      { status: 401 }
    )
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "SESSION REQUIRED" },
      { status: 400 }
    )
  }

  let sessionQuery = supabaseAdmin
    .from("axis_sessions")
    .select("id, status, metadata")
    .eq("id", sessionId)

  sessionQuery = identity.supabaseUserId
    ? sessionQuery.eq("user_id", identity.supabaseUserId)
    : sessionQuery.eq("clerk_user_id", identity.clerkUserId || "")

  const session = await sessionQuery
    .maybeSingle<{
      id: string
      metadata: Record<string, unknown> | null
      status: string | null
    }>()

  if (session.error || !session.data) {
    return NextResponse.json(
      { error: "SESSION NOT FOUND" },
      { status: 404 }
    )
  }

  const metadata = asRecord(session.data.metadata)
  let jobQuery = supabaseAdmin
    .from("axis_processing_jobs")
    .select("*")
    .eq("session_id", sessionId)

  jobQuery = identity.supabaseUserId
    ? jobQuery.eq("user_id", identity.supabaseUserId)
    : jobQuery.eq("clerk_user_id", identity.clerkUserId || "")

  const jobRows = await jobQuery
    .order("queued_at", { ascending: true })
    .returns<AxisProcessingJobRow[]>()

  if (jobRows.error) {
    return NextResponse.json(
      { error: "PROCESSING STATE UNAVAILABLE" },
      { status: 500 }
    )
  }

  const jobs = !jobRows.data?.length
    ? readJobManifest(metadata.processingJobs)
    : manifestFromRows(jobRows.data)
  const processing = jobRows.data?.length
    ? deriveProcessingFromJobs(jobs)
    : readProcessingSnapshot(metadata.processing)
  const archive = asRecord(metadata.archive)
  const outputs = asRecord(metadata.outputs)

  return NextResponse.json({
    archive,
    ok: true,
    outputs,
    jobs: jobs.jobs,
    processing,
    session: {
      id: session.data.id,
      status: session.data.status || "stored",
    },
    summary: summarizeJobs(jobs),
  })
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
