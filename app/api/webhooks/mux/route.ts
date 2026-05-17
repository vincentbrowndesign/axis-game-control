import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type MuxEvent = {
  type?: string
  data?: {
    id?: string
    asset_id?: string
    upload_id?: string
    status?: string
    playback_ids?: {
      id?: string
      policy?: string
    }[]
    passthrough?: string
  }
}

function statusForEvent(type: string, rawStatus?: string) {
  if (type === "video.asset.ready") return "ready"
  if (type === "video.asset.errored") return "error"
  if (rawStatus === "ready") return "ready"
  if (rawStatus === "errored") return "error"
  if (type === "video.upload.asset_created") return "processing"

  return "processing"
}

function playbackIdFromEvent(event: MuxEvent) {
  return event.data?.playback_ids?.find((playback) => playback.id)?.id || null
}

function safeMuxFilters({
  assetId,
  uploadId,
}: {
  assetId: string
  uploadId: string
}) {
  return [
    assetId ? `mux_asset_id.eq.${assetId}` : "",
    assetId ? `asset_id.eq.${assetId}` : "",
    uploadId ? `upload_id.eq.${uploadId}` : "",
  ].filter(Boolean)
}

export async function POST(req: Request) {
  let event: MuxEvent

  try {
    event = JSON.parse(await req.text()) as MuxEvent
  } catch {
    return NextResponse.json(
      {
        error: "Invalid webhook payload",
      },
      {
        status: 400,
      }
    )
  }

  const eventType = event.type || ""
  const assetId = event.data?.id || event.data?.asset_id || ""
  const uploadId = event.data?.upload_id || ""
  const playbackId = playbackIdFromEvent(event)
  const status = statusForEvent(eventType, event.data?.status)
  const filters = safeMuxFilters({ assetId, uploadId })

  if (!eventType.startsWith("video.") || filters.length === 0) {
    return NextResponse.json({
      ok: true,
      ignored: true,
    })
  }

  const existing = await supabaseAdmin
    .from("axis_sessions")
    .select("id,metadata")
    .or(filters.join(","))
    .returns<
      {
        id: string
        metadata: Record<string, unknown> | null
      }[]
    >()

  if (existing.error) {
    console.error("MUX WEBHOOK LOOKUP ERROR", existing.error)

    return NextResponse.json(
      {
        error: "Mux webhook lookup failed",
      },
      {
        status: 500,
      }
    )
  }

  const sessions = existing.data || []

  await Promise.all(
    sessions.map((session) => {
      const metadata =
        session.metadata && typeof session.metadata === "object"
          ? session.metadata
          : {}

      return supabaseAdmin
        .from("axis_sessions")
        .update({
          status,
          ...(assetId
            ? {
                asset_id: assetId,
                mux_asset_id: assetId,
              }
            : {}),
          ...(playbackId
            ? {
                playback_id: playbackId,
                mux_playback_id: playbackId,
                video_url: `https://stream.mux.com/${playbackId}.m3u8`,
              }
            : {}),
          metadata: {
            ...metadata,
            mux: {
              eventType,
              assetId,
              playbackId,
              status,
              receivedAt: new Date().toISOString(),
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id)
    })
  )

  return NextResponse.json({
    ok: true,
    status,
    matched: sessions.length,
  })
}
