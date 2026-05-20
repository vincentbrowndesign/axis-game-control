import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json(
      {
        ok: false,
        error: "SESSION_ACCESS_REQUIRED",
      },
      {
        status: 401,
      }
    )
  }

  const session = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .eq("operator_id", user.id)
    .maybeSingle()

  if (session.error) {
    return NextResponse.json(
      {
        ok: false,
        error: session.error.message,
      },
      {
        status: 500,
      }
    )
  }

  if (!session.data) {
    return NextResponse.json(
      {
        ok: false,
        error: "SESSION_NOT_FOUND",
      },
      {
        status: 404,
      }
    )
  }

  const events = await supabase
    .from("events")
    .select("*")
    .eq("session_id", id)
    .order("session_time", {
      ascending: true,
    })
    .order("sequence_order", {
      ascending: true,
    })
    .order("created_at", {
      ascending: true,
    })

  const snapshots = await supabase
    .from("snapshots")
    .select("*")
    .eq("session_id", id)
    .order("session_time", {
      ascending: true,
    })

  const trainingMemories = await supabase
    .from("training_memories")
    .select("*")
    .eq("session_id", id)
    .order("replay_time", {
      ascending: true,
    })

  return NextResponse.json({
    ok: true,
    session: session.data,
    events: events.data || [],
    snapshots: snapshots.data || [],
    trainingMemories: trainingMemories.data || [],
  })
}
