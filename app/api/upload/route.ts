import { NextResponse } from "next/server"
import Mux from "@mux/mux-node"

export async function POST() {
  try {
    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID!,
      tokenSecret: process.env.MUX_TOKEN_SECRET!,
    })

    const upload = await mux.video.uploads.create({
      cors_origin: "*",

      new_asset_settings: {
        playback_policy: ["public"],
      },
    })

    return NextResponse.json({
      id: upload.id,
      url: upload.url,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: "Failed to create upload",
      },
      {
        status: 500,
      }
    )
  }
}