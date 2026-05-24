import { NextResponse } from "next/server"
import { drainProcessingJobsForSession } from "@/lib/axis-processing/worker"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type WorkerBody = {
  maxJobs?: number
  sessionId?: string
  userId?: string
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()

  try {
    const body = (await request.json().catch(() => ({}))) as WorkerBody
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
    let userId = typeof body.userId === "string" ? body.userId : ""

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, traceId, error: "SESSION REQUIRED" },
        { status: 400 }
      )
    }

    if (!isInternalWorkerRequest(request)) {
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

      userId = user.id
    }

    if (!userId) {
      return NextResponse.json(
        { ok: false, traceId, error: "USER REQUIRED" },
        { status: 400 }
      )
    }

    const result = await drainProcessingJobsForSession({
      maxJobs: Math.max(1, Math.min(7, Number(body.maxJobs || 7))),
      sessionId,
      userId,
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
        error: error instanceof Error ? error.message : "WORKER FAILED",
      },
      { status: 500 }
    )
  }
}

function isInternalWorkerRequest(request: Request) {
  const secret = process.env.AXIS_WORKER_SECRET
  const header = request.headers.get("x-axis-worker-secret")

  if (secret) return header === secret

  return request.headers.get("x-axis-worker") === "internal"
}
