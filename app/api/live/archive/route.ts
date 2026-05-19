import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ArchiveSessionBody = {
  sessionId?: string
  endedAt?: string
  durationSeconds?: number
  playbackUrl?: string
  storagePath?: string
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ArchiveSessionBody
    const sessionId = body.sessionId || ""

    if (
      !isUuid(sessionId) ||
      !body.playbackUrl ||
      !body.storagePath ||
      !Number.isFinite(body.durationSeconds)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "ARCHIVE_INVALID",
        },
        {
          status: 400,
        }
      )
    }

    const updated = await supabaseAdmin
      .from("sessions")
      .update({
        status: "ARCHIVED",
        ended_at: body.endedAt || new Date().toISOString(),
        duration_seconds: Number(body.durationSeconds),
        playback_url: body.playbackUrl,
        storage_path: body.storagePath,
      })
      .eq("id", sessionId)
      .select("*")
      .single()

    if (updated.error) {
      return NextResponse.json(
        {
          ok: false,
          error: updated.error.message,
        },
        {
          status: 500,
        }
      )
    }

    await supabaseAdmin.from("events").insert({
      id: crypto.randomUUID(),
      session_id: sessionId,
      type: "ARCHIVE_COMPLETE",
      session_time: Number(body.durationSeconds),
      payload: {
        playback_url: body.playbackUrl,
        storage_path: body.storagePath,
      },
    })

    return NextResponse.json({
      ok: true,
      session: updated.data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "ARCHIVE_UPDATE_FAILED",
      },
      {
        status: 500,
      }
    )
  }
}
