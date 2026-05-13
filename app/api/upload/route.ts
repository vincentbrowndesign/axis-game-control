import { NextResponse } from "next/server"
import Mux from "@mux/mux-node"
import { createClient } from "@supabase/supabase-js"

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
      },
    })

    const sessionId = crypto.randomUUID()

    await supabase
      .from("axis_sessions")
      .insert({
        id: sessionId,
        title: body.title || "Axis Session",
        upload_id: upload.id,
        asset_id: null,
        playback_id: null,
      })

    return NextResponse.json({
      uploadUrl: upload.url,
      uploadId: upload.id,
      sessionId,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: "FAILED_CREATING_UPLOAD",
      },
      {
        status: 500,
      }
    )
  }
}