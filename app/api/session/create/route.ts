import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  return NextResponse.json({
    route: "working",
  })
}

export async function POST() {
  try {
    const { data, error } = await supabase
      .from("axis_sessions")
      .insert({
        title: "Axis Session",
        playback_id: "demo",
        video_url: null,
        file_name: null,
      })
      .select()
      .single()

    if (error) {
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
      session: data,
      redirect: `/session/${data.id}`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      }
    )
  }
}