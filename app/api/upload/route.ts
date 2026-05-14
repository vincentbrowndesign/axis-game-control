import { NextRequest } from "next/server"

export const runtime = "nodejs"

const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID!
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET!

export async function POST(req: NextRequest) {
  try {
    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
      return Response.json(
        {
          error: "Missing Mux credentials",
        },
        {
          status: 500,
        }
      )
    }

    const formData = await req.formData()

    const file = formData.get("file") as File | null

    if (!file) {
      return Response.json(
        {
          error: "No file uploaded",
        },
        {
          status: 400,
        }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const uploadResponse = await fetch(
      "https://api.mux.com/video/v1/assets",
      {
        method: "POST",

        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`
            ).toString("base64"),

          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          input: [
            {
              generated_subtitles: [],
            },
          ],

          playback_policy: ["public"],

          mp4_support: "standard",

          video_quality: "basic",
        }),
      }
    )

    const assetData = await uploadResponse.json()

    if (!uploadResponse.ok) {
      console.error(assetData)

      return Response.json(
        {
          error: "Failed creating Mux asset",
          details: assetData,
        },
        {
          status: 500,
        }
      )
    }

    const uploadUrl =
      assetData?.data?.upload_url

    if (!uploadUrl) {
      return Response.json(
        {
          error: "No upload URL returned",
        },
        {
          status: 500,
        }
      )
    }

    const directUpload = await fetch(uploadUrl, {
      method: "PUT",
      body: buffer,
      headers: {
        "Content-Type": file.type || "video/mp4",
      },
    })

    if (!directUpload.ok) {
      return Response.json(
        {
          error: "Direct upload failed",
        },
        {
          status: 500,
        }
      )
    }

    const assetId = assetData?.data?.id

    let playbackId = ""

    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) =>
        setTimeout(resolve, 3000)
      )

      const statusResponse = await fetch(
        `https://api.mux.com/video/v1/assets/${assetId}`,
        {
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(
                `${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`
              ).toString("base64"),
          },
        }
      )

      const statusData =
        await statusResponse.json()

      playbackId =
        statusData?.data?.playback_ids?.[0]?.id

      if (playbackId) {
        break
      }
    }

    if (!playbackId) {
      return Response.json(
        {
          error:
            "Playback ID not ready yet",
        },
        {
          status: 500,
        }
      )
    }

    const playbackUrl = `https://stream.mux.com/${playbackId}.m3u8`

    return Response.json({
      success: true,
      playbackId,
      url: playbackUrl,
    })
  } catch (error) {
    console.error(error)

    return Response.json(
      {
        error: "Upload route crashed",
      },
      {
        status: 500,
      }
    )
  }
}