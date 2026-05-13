// app/api/mux/upload/[id]/route.ts

import { NextResponse } from "next/server"
import Mux from "@mux/mux-node"

export const runtime = "nodejs"

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
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
    const { id } = await context.params

    const upload =
      await mux.video.uploads.retrieve(id)

    return NextResponse.json({
      success: true,

      uploadId: upload.id,

      assetId: upload.asset_id ?? null,

      status: upload.status,
    })
  } catch (error) {
    console.error("MUX UPLOAD STATUS ERROR:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve upload",
      },
      {
        status: 500,
      }
    )
  }
}