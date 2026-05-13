// app/api/upload/route.ts

import { NextResponse } from "next/server"
import Mux from "@mux/mux-node"

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
      },
    })

    return NextResponse.json({
      uploadUrl: upload.url,
      uploadId: upload.id,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: "Upload creation failed",
      },
      {
        status: 500,
      }
    )
  }
}