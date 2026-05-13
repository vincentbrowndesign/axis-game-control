import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

console.log("UPLOAD ROUTE LIVE")

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      sessionId,
      playbackId,
     assetId,
    } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: "missing sessionId" },
        { status: 400 }
      )
    }

    const updatePayload: {
      playback_id?: string
      asset_id?: string
    } = {}

    if (playbackId) {
      updatePayload.playback_id = playbackId
    }

    if (assetId) {
      updatePayload.asset_id = assetId
    }

    const { data, error } = await supabase
      .from("axis_sessions")
      .update(updatePayload)
      .eq("id", sessionId)
      .select()
      .single()

    if (error) {
      console.error("SUPABASE SAVE ERROR:", error)

      return NextResponse.json(
        error,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })

  } catch (err) {
    console.error("UPLOAD SAVE ROUTE ERROR:", err)

    return NextResponse.json(
      {
        error: "failed to save replay",
      },
      {
        status: 500,
      }
    )
  }
}