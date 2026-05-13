import { NextResponse } from "next/server"
import Mux from "@mux/mux-node"

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const asset = await mux.video.assets.retrieve(id)

    return NextResponse.json({
      status: asset.status,
      playbackId: asset.playback_ids?.[0]?.id || null,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "failed retrieving asset" },
      { status: 500 }
    )
  }
}