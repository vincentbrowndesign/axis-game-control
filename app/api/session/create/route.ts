import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  return NextResponse.json({
    route: "working",
  })
}

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const mockPlaybackIds = [
      "DS00Spx1CV902MC00YwTYhQxK01CZhFmcWWR8SeA00g4w",
      "VzDVn5qqP01rVcpW7dKzYBynh3s02T00h01",
      "q6NOGo02XfByt00FQWz00Qx00Yk5W1jYpA"
    ]

    const randomPlaybackId =
      mockPlaybackIds[
        Math.floor(
          Math.random() * mockPlaybackIds.length
        )
      ]

    const { data, error } = await supabase
      .from("axis_sessions")
      .insert({
        title: "Axis Session",
        playback_id: randomPlaybackId,
      })
      .select()
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

    return NextResponse.json({
      success: true,
      id: data.id,
    })

  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: "Failed to create session",
      },
      {
        status: 500,
      }
    )
  }
}