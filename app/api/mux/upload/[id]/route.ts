import { NextResponse } from "next/server"
import Mux from "@mux/mux-node"
import { createClient } from "@supabase/supabase-js"

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    const playbackId =
      asset.playback_ids?.[0]?.id || null

    if (!playbackId) {
      return NextResponse.json({
        status: "processing",
        muxStatus: asset.status,
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
        playbackId,
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
          status: "database_error",
          error: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: "ready",
      sessionId: session.id,
      playbackId,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        status: "server_error",
      },
      { status: 500 }
    )
  }
}