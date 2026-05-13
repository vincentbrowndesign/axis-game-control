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
      uploadId: upload.id,
      uploadUrl: upload.url,
    })
  } catch (error) {
    console.error("UPLOAD_CREATE_FAILED", error)

    return NextResponse.json(
      { error: "UPLOAD_CREATE_FAILED" },
      { status: 500 }
    )
  }
}