import { NextResponse } from "next/server"
import Mux from "@mux/mux-node"
import { supabaseAdmin } from "@/lib/supabase/admin"

type Context = {
  params: Promise<{
    id: string
  }>
}

export async function GET(
  _req: Request,
  context: Context
) {
  const traceId = crypto.randomUUID()

  try {
    const { id } = await context.params
    console.log("AXIS MUX UPLOAD PIPELINE", {
      traceId,
      stage: "mux-upload-poll-start",
      uploadId: id,
    })

    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID!,
      tokenSecret: process.env.MUX_TOKEN_SECRET!,
    })

    const upload = await mux.video.uploads.retrieve(id)
    console.log("AXIS MUX UPLOAD PIPELINE", {
      traceId,
      stage: "mux-upload-result",
      uploadId: id,
      assetId: upload.asset_id || null,
      status: upload.status || "unknown",
    })

    if (!upload.asset_id) {
      await supabaseAdmin
        .from("axis_sessions")
        .update({
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("upload_id", id)

      return NextResponse.json({
        status: "processing",
        traceId,
      })
    }

    const asset = await mux.video.assets.retrieve(
      upload.asset_id
    )
    console.log("AXIS MUX UPLOAD PIPELINE", {
      traceId,
      stage: "mux-asset-result",
      uploadId: id,
      assetId: asset.id,
      status: asset.status,
      playbackIds: asset.playback_ids?.length || 0,
    })

    if (asset.status !== "ready") {
      await supabaseAdmin
        .from("axis_sessions")
        .update({
          status: asset.status === "errored" ? "error" : "processing",
          asset_id: asset.id,
          mux_asset_id: asset.id,
          updated_at: new Date().toISOString(),
        })
        .eq("upload_id", id)

      return NextResponse.json({
        status: asset.status === "errored" ? "error" : "processing",
        traceId,
      })
    }

    const playbackId =
      asset.playback_ids?.[0]?.id

    if (!playbackId) {
      return NextResponse.json({
        status: "processing",
        traceId,
      })
    }

    const existing = await supabaseAdmin
      .from("axis_sessions")
      .select("*")
      .eq("upload_id", id)
      .maybeSingle()

    if (existing.error) {
      console.error("AXIS MUX UPLOAD PIPELINE FAILURE", {
        traceId,
        stage: "session-lookup",
        error: existing.error.message,
      })

      return NextResponse.json({
        status: "database_error",
        error: existing.error.message,
        traceId,
      })
    }

    if (existing.data) {
      await supabaseAdmin
        .from("axis_sessions")
        .update({
          status: "ready",
          asset_id: asset.id,
          mux_asset_id: asset.id,
          playback_id: playbackId,
          mux_playback_id: playbackId,
          video_url: `https://stream.mux.com/${playbackId}.m3u8`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id)

      return NextResponse.json({
        status: "ready",
        sessionId: existing.data.id,
        traceId,
      })
    }

    const inserted = await supabaseAdmin
      .from("axis_sessions")
      .insert({
        title: "Axis Session",
        upload_id: id,
        asset_id: asset.id,
        mux_asset_id: asset.id,
        playback_id: playbackId,
        mux_playback_id: playbackId,
        video_url: `https://stream.mux.com/${playbackId}.m3u8`,
        status: "ready",
      })
      .select()
      .single()

    if (inserted.error) {
      console.error("AXIS MUX UPLOAD PIPELINE FAILURE", {
        traceId,
        stage: "session-create",
        error: inserted.error.message,
      })

      return NextResponse.json({
        status: "database_error",
        error: inserted.error.message,
        traceId,
      })
    }

    return NextResponse.json({
      status: "ready",
      sessionId: inserted.data.id,
      traceId,
    })
  } catch (error) {
    console.error("AXIS MUX UPLOAD PIPELINE FAILURE", {
      traceId,
      stage: "unhandled",
      error: error instanceof Error ? error.message : "Mux upload polling failed",
    })

    return NextResponse.json({
      status: "server_error",
      error: "Mux upload polling failed",
      traceId,
    })
  }
}
