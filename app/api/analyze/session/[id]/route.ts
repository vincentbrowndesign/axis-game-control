// app/api/session/[id]/route.ts

import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string
    }>
  }
) {
  try {
    const { id } = await context.params

    const { data: session, error } =
      await supabase
        .from("axis_sessions")
        .select("*")
        .eq("id", id)
        .single()

    if (error) {
      console.error(error)

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      )
    }

    const { data: events } =
      await supabase
        .from("axis_events")
        .select("*")
        .eq("session_id", id)
        .order("timestamp", {
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
        error: "Session route failed",
      },
      {
        status: 500,
      }
    )
  }
}