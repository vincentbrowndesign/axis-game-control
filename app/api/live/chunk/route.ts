import { NextResponse } from "next/server"
import { writeLiveBridgeChunk } from "@/lib/mux/liveBridge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const sessionId = req.headers.get("x-axis-live-session")

  if (!sessionId) {
    return NextResponse.json(
      {
        error: "LIVE_SESSION_MISSING",
      },
      {
        status: 400,
      }
    )
  }

  const chunk = Buffer.from(await req.arrayBuffer())
  const result = writeLiveBridgeChunk(sessionId, chunk)

  return NextResponse.json(result, {
    status: result.ok ? 200 : 409,
  })
}
