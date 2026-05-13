import { NextResponse } from "next/server"
import Mux from "@mux/mux-node"

import { supabase } from "@/lib/supabase"

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

type Context = {
  params: Promise<{
    id: string
  }>
}

export async function GET(
  _req: Request,
  context: Context
) {
  try {
    const { id } = await context.params

    const upload = await mux.video.uploads.retrieve(id)

    if (!upload.asset_id) {
      return NextResponse.json({
        status: "waiting_for_asset",
      })
    }

    const asset = await mux.video.assets.retrieve(
      upload.asset_id
    )

    if (asset.status !== "ready") {
      return NextResponse.json({
        status: "processing",
      })
    }

    const playbackId =
      asset.playback_ids?.[0]?.id

    if (!playbackId) {
      return NextResponse.json({
        status: "waiting_for_playback",
      })
    }

    const { data: existing } = await supabase
      .from("axis_sessions")
      .select("*")
      .eq("upload_id", id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        status: "ready",
        sessionId: existing.id,
      })
    }

    const { data: session, error } = await supabase
      .from("axis_sessions")
      .insert({
        title: "Axis Session",
        upload_id: id,
        asset_id: asset.id,
        playback_id: playbackId,
        video_url: `https://stream.mux.com/${playbackId}.m3u8`,
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
      status: "ready",
      sessionId: session.id,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: "UPLOAD_STATUS_FAILED",
      },
      {
        status: 500,
      }
    )
  }
}