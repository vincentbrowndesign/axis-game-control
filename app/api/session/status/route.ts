import { NextResponse } from "next/server"
import { readProcessingSnapshot } from "@/lib/axis-processing/state"
import { readJobManifest, summarizeJobs } from "@/lib/axis-processing/jobs"
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
  const processing = readProcessingSnapshot(metadata.processing)
  const jobs = readJobManifest(metadata.processingJobs)
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
