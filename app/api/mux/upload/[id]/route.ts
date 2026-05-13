import { NextResponse } from "next/server"
import Mux from "@mux/mux-node"
import { createClient } from "@supabase/supabase-js"

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

    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID!,
      tokenSecret: process.env.MUX_TOKEN_SECRET!,
    })

    const upload = await mux.video.uploads.retrieve(id)

    if (!upload.asset_id) {
      return NextResponse.json({
        status: "processing",
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
        status: "processing",
      })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const existing = await supabase
      .from("axis_sessions")
      .select("*")
      .eq("upload_id", id)
      .maybeSingle()

    if (existing.data) {
      return NextResponse.json({
        status: "ready",
        sessionId: existing.data.id,
      })
    }

    const inserted = await supabase
      .from("axis_sessions")
      .insert({
        upload_id: id,
        asset_id: asset.id,
        playback_id: playbackId,
        title: "Axis Session",
        video_url: `https://stream.mux.com/${playbackId}.m3u8`,
      })
      .select()
      .single()

    if (inserted.error) {
      console.error(inserted.error)

      return NextResponse.json({
        status: "database_error",
        error: inserted.error.message,
      })
    }

    return NextResponse.json({
      status: "ready",
      sessionId: inserted.data.id,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json({
      status: "server_error",
    })
  }
}