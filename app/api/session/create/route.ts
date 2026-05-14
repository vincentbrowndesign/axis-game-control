import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  return NextResponse.json({
    route: "working",
  })
}

export async function POST() {
  try {
    console.log("AXIS SESSION CREATE START")

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl) {
      return NextResponse.json(
        {
          error:
            "Missing NEXT_PUBLIC_SUPABASE_URL",
        },
        {
          status: 500,
        }
      )
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Missing SUPABASE_SERVICE_ROLE_KEY",
        },
        {
          status: 500,
        }
      )
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    )

    const { data, error } = await supabase
      .from("axis_sessions")
      .insert({
        title: "Axis Session",
        playback_id: "demo",
      })
      .select()
      .single()

    if (error) {
      console.error("SUPABASE ERROR:", error)

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

    console.log("SESSION CREATED:", data)

    return NextResponse.json({
      success: true,
      id: data.id,
    })

  } catch (err) {
    console.error("SERVER ERROR:", err)

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unknown server error",
      },
      {
        status: 500,
      }
    )
  }
}