import { NextResponse } from "next/server"
import Mux from "@mux/mux-node"
import { createLiveBridgeSession } from "@/lib/mux/liveBridge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function muxClient() {
  const tokenId = process.env.MUX_TOKEN_ID
  const tokenSecret = process.env.MUX_TOKEN_SECRET

  if (!tokenId || !tokenSecret) return null

  return new Mux({
    tokenId,
    tokenSecret,
  })
}

export async function POST() {
  try {
    const mux = muxClient()

    if (!mux) {
      return NextResponse.json(
        {
          error: "MUX_ENV_MISSING",
        },
        {
          status: 500,
        }
      )
    }

    const configuredLiveStreamId = process.env.MUX_LIVE_STREAM_ID || ""
    const liveStream = configuredLiveStreamId
      ? await mux.video.liveStreams.retrieve(configuredLiveStreamId)
      : await mux.video.liveStreams.create({
          playback_policies: ["public"],
          new_asset_settings: {
            playback_policies: ["public"],
          },
          latency_mode: "reduced",
          reconnect_window: 60,
        })
    let playbackId = liveStream.playback_ids?.[0]?.id || ""

    if (!playbackId) {
      const playback = await mux.video.liveStreams.createPlaybackId(liveStream.id, {
        policy: "public",
      })
      playbackId = playback.id
    }

    if (!liveStream.stream_key || !playbackId) {
      return NextResponse.json(
        {
          error: "MUX_STREAM_UNAVAILABLE",
        },
        {
          status: 500,
        }
      )
    }

    const bridge = createLiveBridgeSession(liveStream.stream_key)

    return NextResponse.json({
      sessionId: bridge.id,
      playbackId,
      status: bridge.status,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "LIVE_START_FAILED",
      },
      {
        status: 500,
      }
    )
  }
}
