import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
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
      session: data,
      redirect: `/session/${data.id}`,
    })
  } catch (err) {
    console.error(err)

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