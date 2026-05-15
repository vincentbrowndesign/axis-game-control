import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Authentication required",
        },
        {
          status: 401,
        }
      )
    }

    let body: { playbackId?: unknown } = {}

    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const inserted = await supabaseAdmin
      .from("axis_sessions")
      .insert({
        user_id: user.id,
        playback_id:
          typeof body.playbackId === "string"
            ? body.playbackId
            : null,
        title: "Axis Session",
        source: "upload",
        mission: "None",
        player_name: "Unassigned",
        environment: "practice",
        status: "created",
        tags: [],
        metadata: {},
      })
      .select("id, playback_id")
      .single()

    if (inserted.error) {
      return NextResponse.json(
        {
          error: inserted.error.message,
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      success: true,
      id: inserted.data.id,
      playbackId: inserted.data.playback_id,
    })
  } catch (error) {
    console.error("SESSION ERROR:", error)

    return NextResponse.json(
      {
        error: "Session creation failed",
      },
      {
        status: 500,
      }
    )
  }
}
