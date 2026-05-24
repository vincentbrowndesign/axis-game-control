import { NextResponse } from "next/server"
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
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get("sessionId") || ""
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
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

  const session = await supabase
    .from("axis_sessions")
    .select("id, status, metadata")
    .eq("id", sessionId)
    .eq("user_id", user.id)
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
  const jobRows = await supabase
    .from("axis_processing_jobs")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
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
