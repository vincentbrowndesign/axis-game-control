import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  return NextResponse.json({
    route: "working",
  })
}

export async function POST() {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        {
          error: "Missing Supabase environment variables",
        },
        {
          status: 500,
        }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data, error } = await supabase
      .from("axis_sessions")
      .insert({
        title: "Axis Session",
        playback_id: "demo",
      })
      .select()
      .single()

    console.log("SUPABASE DATA:", data)
    console.log("SUPABASE ERROR:", error)

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          details: error,
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      success: true,
      id: data.id,
    })

  } catch (e) {
    console.error("SERVER ERROR:", e)

    return NextResponse.json(
      {
        error: "server crash",
      },
      {
        status: 500,
      }
    )
  }
}