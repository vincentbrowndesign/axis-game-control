import { NextResponse } from "next/server"
import { enqueueProcessingJobs, listProcessingJobRows } from "@/lib/axis-processing/queue"
import { drainProcessingJobsForSession } from "@/lib/axis-processing/worker"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type JobsBody = {
  action?: "enqueue" | "run"
  maxJobs?: number
  sessionId?: string
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { ok: false, traceId, error: "AUTH REQUIRED" },
        { status: 401 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as JobsBody
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, traceId, error: "SESSION REQUIRED" },
        { status: 400 }
      )
    }

    const ownsSession = await supabase
      .from("axis_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>()

    if (ownsSession.error || !ownsSession.data) {
      return NextResponse.json(
        { ok: false, traceId, error: "SESSION NOT FOUND" },
        { status: 404 }
      )
    }

    if (body.action === "enqueue") {
      await enqueueProcessingJobs({
        sessionId,
        userId: user.id,
      })

      const jobs = await listProcessingJobRows({
        sessionId,
        userId: user.id,
      })

      return NextResponse.json({
        jobs,
        ok: true,
        traceId,
      })
    }

    const result = await drainProcessingJobsForSession({
      maxJobs: Math.max(1, Math.min(7, Number(body.maxJobs || 7))),
      sessionId,
      userId: user.id,
    })

    return NextResponse.json({
      ...result,
      traceId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        traceId,
        error: error instanceof Error ? error.message : "JOB REQUEST FAILED",
      },
      { status: 500 }
    )
  }
}
