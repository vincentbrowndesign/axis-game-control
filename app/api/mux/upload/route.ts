// app/api/mux/upload/route.ts

import { NextResponse } from "next/server"
import Mux from "@mux/mux-node"

export const runtime = "nodejs"

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

export async function POST() {
  try {
    const upload = await mux.video.uploads.create({
      cors_origin: "*",

      new_asset_settings: {
        playback_policy: ["public"],
      },
    })

    return NextResponse.json({
      success: true,
      uploadId: upload.id,
      uploadUrl: upload.url,
      assetId: upload.asset_id ?? null,
    })
  } catch (error) {
    console.error("MUX CREATE UPLOAD ERROR:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create upload",
      },
      {
        status: 500,
      }
    )
  }
}