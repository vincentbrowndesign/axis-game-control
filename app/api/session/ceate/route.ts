import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST() {
  try {
    console.log("API START")

    console.log(
      "URL EXISTS:",
      !!process.env.NEXT_PUBLIC_SUPABASE_URL
    )

    console.log(
      "SERVICE ROLE EXISTS:",
      !!process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log("SUPABASE CONNECTED")

    const { data, error } = await supabase
      .from("axis_sessions")
      .insert({
        title: "Axis Session",
      })
      .select()
      .single()

    console.log("INSERT RESPONSE:", data)
    console.log("INSERT ERROR:", error)

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
      id: data.id,
    })

  } catch (err) {
    console.error("SERVER CRASH:", err)

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