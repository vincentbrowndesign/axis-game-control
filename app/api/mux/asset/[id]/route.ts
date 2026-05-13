// app/api/mux/asset/[id]/route.ts

import { NextResponse } from "next/server"
import Mux from "@mux/mux-node"

export const runtime = "nodejs"

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret:
    process.env.MUX_TOKEN_SECRET!,
})

export async function GET(
  req: Request,
  context: {
    params: Promise<{
      id: string
    }>
  }
) {
  try {
    const { id } =
      await context.params

    const asset =
      await mux.video.assets.retrieve(
        id
      )

    return NextResponse.json({
      success: true,

      assetId: asset.id,

      status: asset.status,

      playbackId:
        asset.playback_ids?.[0]
          ?.id ?? null,
    })
  } catch (error) {
    console.error(
      "MUX ASSET ERROR:",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to retrieve asset",
      },
      {
        status: 500,
      }
    )
  }
}