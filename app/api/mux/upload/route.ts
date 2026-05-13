// app/api/mux/upload/route.ts

import { NextResponse } from "next/server"

export async function POST() {
  try {
    const tokenId =
      process.env.MUX_TOKEN_ID

    const tokenSecret =
      process.env.MUX_TOKEN_SECRET

    if (!tokenId || !tokenSecret) {
      return NextResponse.json(
        {
          error:
            "Missing Mux credentials",
        },
        { status: 500 }
      )
    }

    const response = await fetch(
      "https://api.mux.com/video/v1/uploads",
      {
        method: "POST",

        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${tokenId}:${tokenSecret}`
            ).toString("base64"),

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          new_asset_settings: {
            playback_policy: [
              "public",
            ],
          },

          cors_origin: "*",
        }),
      }
    )

    const data =
      await response.json()

    return NextResponse.json(data)
  } catch (error: any) {
    console.error(error)

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Mux upload failed",
      },
      { status: 500 }
    )
  }
}