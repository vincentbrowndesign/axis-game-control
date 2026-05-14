import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      )
    }

    // convert file to buffer
    const arrayBuffer = await file.arrayBuffer()

    // fake upload simulation for now
    // replace later with mux direct upload

    const playbackId =
      "demo_" + Math.random().toString(36).slice(2)

    return NextResponse.json({
      success: true,
      playbackId,
      size: arrayBuffer.byteLength,
      fileName: file.name,
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