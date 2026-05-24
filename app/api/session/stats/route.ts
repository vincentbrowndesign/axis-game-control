import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

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

    const body = (await request.json().catch(() => ({}))) as {
      sessionId?: unknown
    }
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, traceId, error: "SESSION REQUIRED" },
        { status: 400 }
      )
    }

    const session = await supabase
      .from("axis_sessions")
      .select("id, metadata")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string; metadata: Record<string, unknown> | null }>()

    if (session.error || !session.data) {
      return NextResponse.json(
        { ok: false, traceId, error: "SESSION NOT FOUND" },
        { status: 404 }
      )
    }

    const metadata = asRecord(session.data.metadata)
    const stats = asRecord(metadata.stats)
    const timeline = asRecord(metadata.timeline)
    const statsPath =
      typeof stats.path === "string"
        ? stats.path
        : typeof timeline.path === "string"
          ? timeline.path
          : ""

    if (!statsPath) {
      return NextResponse.json(
        { ok: false, traceId, error: "STATS NOT READY" },
        { status: 404 }
      )
    }

    const downloaded = await supabaseAdmin.storage
      .from("axis-replays")
      .download(statsPath)

    if (downloaded.error || !downloaded.data) {
      return NextResponse.json(
        {
          ok: false,
          traceId,
          error: downloaded.error?.message || "STATS LOAD FAILED",
        },
        { status: 500 }
      )
    }

    const payload = JSON.parse(await downloaded.data.text()) as {
      events?: unknown[]
      possessions?: unknown[]
      stats?: unknown
    }

    return NextResponse.json({
      ok: true,
      stats: payload.stats ?? null,
      summary: {
        eventCount: Array.isArray(payload.events) ? payload.events.length : 0,
        possessionCount: Array.isArray(payload.possessions)
          ? payload.possessions.length
          : 0,
      },
      traceId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        traceId,
        error: error instanceof Error ? error.message : "STATS LOAD FAILED",
      },
      { status: 500 }
    )
  }
}
