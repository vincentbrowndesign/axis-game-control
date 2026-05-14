import { NextResponse } from "next/server"

export const runtime = "nodejs"

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

    return NextResponse.json({
      success: true,
      fileName: file.name,
      type: file.type,
      size: file.size,
    })
  } catch (error) {
    console.error("UPLOAD ERROR:", error)

    return NextResponse.json(
      {
        error: "Upload route crashed",
      },
      {
        status: 500,
      }
    )
  }
}