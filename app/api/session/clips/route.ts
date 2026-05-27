import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { exportSessionClips } from "@/lib/replay/exportClips"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ClipsBody = {
  maxClips?: number
  sessionId?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
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

    const body = (await request.json().catch(() => ({}))) as ClipsBody
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
    const maxClips = Math.max(1, Math.min(10, Number(body.maxClips || 6)))

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, traceId, error: "SESSION REQUIRED" },
        { status: 400 }
      )
    }

    const session = await supabase
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

    if (session.error || !session.data) {
      return NextResponse.json(
        { ok: false, traceId, error: "SESSION NOT FOUND" },
        { status: 404 }
      )
    }

    const result = await exportSessionClips({
      maxClips,
      session: session.data,
    })
    const metadata = asRecord(session.data.metadata)

    const updated = await supabaseAdmin
      .from("axis_sessions")
      .update({
        metadata: {
          ...metadata,
          clips: {
            count: result.clips.length,
            errors: result.errors,
            generatedAt: new Date().toISOString(),
            plannedCount: result.plan.length,
            status: result.clips.length > 0 ? "ready" : "empty",
            traceId,
            values: result.clips,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id)

    if (updated.error) {
      return NextResponse.json(
        { ok: false, traceId, error: updated.error.message },
        { status: 500 }
      )
    }

    revalidatePath("/")

    return NextResponse.json({
      clips: result.clips,
      errors: result.errors,
      ok: true,
      plannedCount: result.plan.length,
      traceId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        traceId,
        error: error instanceof Error ? error.message : "CLIP EXPORT FAILED",
      },
      { status: 500 }
    )
  }
}
