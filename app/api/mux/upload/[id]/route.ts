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

export async function GET(
  req: Request,
  context: {
    params: Promise<{
      id: string
    }>
  }
) {
  try {
    const params = await context.params

    const uploadId = params.id

    const upload =
      await mux.video.uploads.retrieve(uploadId)

    const assetId =
      typeof upload.asset_id === "string"
        ? upload.asset_id
        : null

    if (!assetId) {
      return NextResponse.json({
        status: "waiting_for_asset",
      })
    }

    const asset =
      await mux.video.assets.retrieve(assetId)

    const playbackId =
      asset.playback_ids?.[0]?.id || null

    await supabase
      .from("axis_sessions")
      .update({
        asset_id: assetId,
        playback_id: playbackId,
      })
      .eq("upload_id", uploadId)

    return NextResponse.json({
      status: "ready",
      assetId,
      playbackId,
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