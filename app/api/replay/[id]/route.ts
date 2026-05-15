import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { buildMemoryState } from "@/lib/memoryInference"
import { normalizeReplay } from "@/lib/normalizeReplay"
import {
  type AxisReplaySession,
} from "@/types/memory"

type Context = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_req: Request, context: Context) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      {
        error: "SIGNAL INTERRUPTED",
      },
      {
        status: 401,
      }
    )
  }

  const { data } = await supabase
    .from("axis_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<AxisReplaySession>()

  if (!data) {
    return NextResponse.json(
      {
        error: "MEMORY LOAD FAILED",
      },
      {
        status: 404,
      }
    )
  }

  if (data.file_path) {
    const signed = await supabaseAdmin.storage
      .from("axis-replays")
      .createSignedUrl(data.file_path, 60 * 60 * 24 * 7)

    data.video_url = signed.data?.signedUrl || data.video_url
  }

  const { data: previousData } = await supabase
    .from("axis_sessions")
    .select("*")
    .eq("user_id", user.id)
    .neq("id", id)
    .lt("created_at", data.created_at)
    .order("created_at", { ascending: false })
    .returns<AxisReplaySession[]>()

  const session = normalizeReplay(data)
  const previousSessions = (previousData || []).map(normalizeReplay)
  const memoryState = buildMemoryState({
    session,
    previousSessions,
    player: session.player,
  })

  return NextResponse.json({
    session: {
      ...session,
      memoryCount: memoryState.memoryCount,
      lastSignal: memoryState.status,
      archiveStatus: memoryState.archiveStatus,
      context: memoryState.contextLine,
      timeline: memoryState.timelineEvents.map((event) => ({
        time: event.time,
        label: event.label,
        detail: event.body,
        tone: event.tone,
      })),
      ambientLine: memoryState.ambientLine,
      memoryState,
    },
  })
}
