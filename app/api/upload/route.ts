import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        {
          error: "No file uploaded",
        },
        {
          status: 400,
        }
      )
    }

    const arrayBuffer = await file.arrayBuffer()

    console.log("UPLOAD SIZE:", arrayBuffer.byteLength)

    const playbackId =
      "playback_" + Math.random().toString(36).slice(2)

    return NextResponse.json({
      success: true,
      playbackId,
      fileName: file.name,
      size: arrayBuffer.byteLength,
    })
  } catch (error) {
    console.error("UPLOAD ERROR:", error)

    return NextResponse.json(
      {
        error: "Upload failed",
      },
      {
        status: 500,
      }
    )
  }
}