import { NextRequest } from "next/server"

export const runtime = "nodejs"

const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID!
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET!

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const file = formData.get("file") as File | null

    if (!file) {
      return Response.json(
        { error: "No file uploaded" },
        { status: 400 }
      )
    }

    const auth = Buffer.from(
      `${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`
    ).toString("base64")

    /*
      STEP 1
      CREATE DIRECT UPLOAD
    */

    const createUpload = await fetch(
      "https://api.mux.com/video/v1/uploads",
      {
        method: "POST",

        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          cors_origin: "*",

          new_asset_settings: {
            playback_policy: ["public"],
            mp4_support: "standard",
          },
        }),
      }
    )

    const uploadData = await createUpload.json()

    if (!createUpload.ok) {
      console.error(uploadData)

      return Response.json(
        {
          error: "Failed creating upload",
          details: uploadData,
        },
        {
          status: 500,
        }
      )
    }

    const uploadUrl =
      uploadData?.data?.url

    const uploadId =
      uploadData?.data?.id

    if (!uploadUrl || !uploadId) {
      return Response.json(
        {
          error: "Missing upload URL",
        },
        {
          status: 500,
        }
      )
    }

    /*
      STEP 2
      SEND VIDEO TO MUX
    */

    const arrayBuffer =
      await file.arrayBuffer()

    const uploadVideo = await fetch(
      uploadUrl,
      {
        method: "PUT",
        headers: {
          "Content-Type":
            file.type || "video/mp4",
        },
        body: arrayBuffer,
      }
    )

    if (!uploadVideo.ok) {
      return Response.json(
        {
          error: "Video upload failed",
        },
        {
          status: 500,
        }
      )
    }

    /*
      STEP 3
      WAIT FOR ASSET
    */

    let playbackId = ""

    for (let i = 0; i < 25; i++) {
      await new Promise((r) =>
        setTimeout(r, 3000)
      )

      const uploadStatus = await fetch(
        `https://api.mux.com/video/v1/uploads/${uploadId}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      )

      const statusData =
        await uploadStatus.json()

      const assetId =
        statusData?.data?.asset_id

      if (!assetId) {
        continue
      }

      const assetResponse = await fetch(
        `https://api.mux.com/video/v1/assets/${assetId}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      )

      const assetData =
        await assetResponse.json()

      playbackId =
        assetData?.data?.playback_ids?.[0]?.id

      if (playbackId) {
        break
      }
    }

    if (!playbackId) {
      return Response.json(
        {
          error:
            "Playback ID not ready",
        },
        {
          status: 500,
        }
      )
    }

    return Response.json({
      success: true,

      playbackId,

      url: `https://stream.mux.com/${playbackId}.m3u8`,
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