import { NextResponse } from "next/server"
import { stopLiveBridgeSession } from "@/lib/mux/liveBridge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const sessionId = req.headers.get("x-axis-live-session")

  if (!sessionId) {
    return NextResponse.json(
      {
        ok: false,
        error: "LIVE_SESSION_MISSING",
      },
      {
        status: 400,
      }
    )
  }

  stopLiveBridgeSession(sessionId)

  return NextResponse.json({
    ok: true,
    status: "ended",
  })
}
