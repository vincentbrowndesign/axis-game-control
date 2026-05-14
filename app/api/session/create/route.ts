import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
      console.error(error)

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      session: data,
      redirect: `/session/${data.id}`,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        success: false,
        error: "Unexpected server error",
      },
      { status: 500 }
    )
  }
}