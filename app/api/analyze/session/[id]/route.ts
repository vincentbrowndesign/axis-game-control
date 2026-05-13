import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

type Context = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_req: Request, context: Context) {
  try {
    const { id } = await context.params

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: session, error } = await supabase
      .from("axis_sessions")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.error("SESSION_FETCH_FAILED", error)

      return NextResponse.json(
        { error: "SESSION_FETCH_FAILED" },
        { status: 500 }
      )
    }

    const { data: events } = await supabase
      .from("axis_events")
      .select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: true })

    return NextResponse.json({
      session,
      events: events ?? [],
    })
  } catch (error) {
    console.error("SESSION_ROUTE_FAILED", error)

    return NextResponse.json(
      { error: "SESSION_ROUTE_FAILED" },
      { status: 500 }
    )
  }
}