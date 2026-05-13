import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      sessionId,
      playbackId,
      assetId,
    } = body

    const { data, error } = await supabase
      .from("axis_sessions")
      .update({
        playback_id: playbackId,
        asset_id: assetId,
      })
      .eq("id", sessionId)
      .select()
      .single()

    if (error) {
      console.error(error)
      return NextResponse.json(error, { status: 500 })
    }

    return NextResponse.json(data)

  } catch (err) {
    console.error(err)

    return NextResponse.json(
      { error: "failed to save replay" },
      { status: 500 }
    )
  }
}