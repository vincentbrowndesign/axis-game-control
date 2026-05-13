import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: Request,
  context: {
    params: Promise<{
      id: string
    }>
  }
) {
  try {
    const params = await context.params

    const sessionId = params.id

    const { data: session } = await supabase
      .from("axis_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()

    const { data: events } = await supabase
      .from("axis_events")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", {
        ascending: true,
      })

    return NextResponse.json({
      session,
      events: events || [],
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: "SESSION_FETCH_FAILED",
      },
      {
        status: 500,
      }
    )
  }
}