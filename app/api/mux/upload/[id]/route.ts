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

    const upload = await mux.video.uploads.retrieve(id)

    return NextResponse.json({
      assetId: upload.asset_id || null,
      status: upload.status,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "failed retrieving upload" },
      { status: 500 }
    )
  }
}