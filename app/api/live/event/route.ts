import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { defaultReplayWindow } from "@/lib/temporalEventGraph"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CreateEventBody = {
  id?: string
  sessionId?: string
  type?: string
  sessionTime?: number
  payload?: Record<string, unknown>
}

const allowedEvents = new Set([
  "MARK",
  "SNAPSHOT",
  "TIMEOUT",
  "SYSTEM_RECONNECT",
  "SESSION_STARTED",
  "STREAM_CONNECTED",
  "CHUNK_RECORDED",
  "ARCHIVE_STARTED",
  "ARCHIVE_COMPLETE",
  "ARCHIVE_FAILED",
])

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as CreateEventBody
    const sessionId = body.sessionId || ""
    const type = body.type || ""

    if (!isUuid(sessionId) || !allowedEvents.has(type)) {
      return NextResponse.json(
        {
          ok: false,
          error: "EVENT_INVALID",
        },
        {
          status: 400,
        }
      )
    }

    const eventId = body.id && isUuid(body.id) ? body.id : crypto.randomUUID()
    const sessionTime = Number.isFinite(body.sessionTime) ? Number(body.sessionTime) : 0
    const payload: Record<string, unknown> = {
      replay_window: defaultReplayWindow(),
      ...(body.payload || {}),
    }

    const inserted = await supabaseAdmin
      .from("events")
      .insert({
        id: eventId,
        session_id: sessionId,
        type,
        session_time: sessionTime,
        payload,
      })
      .select("*")
      .single()

    if (inserted.error) {
      return NextResponse.json(
        {
          ok: false,
          error: inserted.error.message,
        },
        {
          status: 500,
        }
      )
    }

    if (type === "SNAPSHOT" && typeof payload.image_url === "string") {
      await supabaseAdmin.from("snapshots").insert({
        id: eventId,
        session_id: sessionId,
        session_time: sessionTime,
        image_url: payload.image_url,
      })
    }

    return NextResponse.json({
      ok: true,
      event: inserted.data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "EVENT_CREATE_FAILED",
      },
      {
        status: 500,
      }
    )
  }
}
