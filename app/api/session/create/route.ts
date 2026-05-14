import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    let body: any = {}

    try {
      body = await req.json()
    } catch {
      body = {}
    }

    // create mock session
    const sessionId =
      "session_" + Math.random().toString(36).slice(2)

    return NextResponse.json({
      success: true,
      id: sessionId,
      playbackId: body.playbackId || null,
    })
  } catch (error) {
    console.error("SESSION ERROR:", error)

    return NextResponse.json(
      {
        error: "Session creation failed",
      },
      {
        status: 500,
      }
    )
  }
}