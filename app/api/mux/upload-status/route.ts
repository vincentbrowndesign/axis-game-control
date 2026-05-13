// app/api/mux/upload-status/route.ts

import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest
) {
  const id =
    req.nextUrl.searchParams.get(
      "id"
    )

  const tokenId =
    process.env.MUX_TOKEN_ID!

  const tokenSecret =
    process.env.MUX_TOKEN_SECRET!

  const response = await fetch(
    `https://api.mux.com/video/v1/uploads/${id}`,
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${tokenId}:${tokenSecret}`
          ).toString("base64"),
      },
    }
  )

  const data =
    await response.json()

  const assetId =
    data?.data?.asset_id

  if (!assetId) {
    return NextResponse.json({})
  }

  const assetRes = await fetch(
    `https://api.mux.com/video/v1/assets/${assetId}`,
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${tokenId}:${tokenSecret}`
          ).toString("base64"),
      },
    }
  )

  const assetData =
    await assetRes.json()

  return NextResponse.json({
    playbackId:
      assetData?.data?.playback_ids?.[0]
        ?.id || null,
  })
}