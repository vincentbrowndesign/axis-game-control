import { NextResponse } from "next/server";
import Mux from "@mux/mux-node";
import { createClient } from "@supabase/supabase-js";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _req: Request,
  context: Context
) {
  try {
    const { id } = await context.params;

    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID!,
      tokenSecret: process.env.MUX_TOKEN_SECRET!,
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // GET DIRECT UPLOAD
    const upload = await mux.video.uploads.retrieve(id);

    if (!upload.asset_id) {
      return NextResponse.json({
        status: "processing",
        stage: "waiting_for_asset",
      });
    }

    // GET ASSET
    const asset = await mux.video.assets.retrieve(
      upload.asset_id
    );

    console.log("MUX ASSET STATUS", asset.status);
    console.log(
      "MUX PLAYBACK IDS",
      asset.playback_ids
    );

    // WAIT UNTIL ASSET READY
    if (
      asset.status !== "ready" ||
      !asset.playback_ids ||
      asset.playback_ids.length === 0
    ) {
      return NextResponse.json({
        status: "processing",
        stage: "mux_processing",
        assetStatus: asset.status,
      });
    }

    const playbackId =
      asset.playback_ids[0].id;

    // CHECK EXISTING SESSION
    const { data: existing } = await supabase
      .from("axis_sessions")
      .select("*")
      .eq("upload_id", id)
      .maybeSingle();

    // RETURN EXISTING
    if (existing) {
      return NextResponse.json({
        status: "ready",
        sessionId: existing.id,
        playbackId,
      });
    }

    // CREATE SESSION
    const { data: session, error } =
      await supabase
        .from("axis_sessions")
        .insert({
          title: "Axis Session",
          upload_id: id,
          asset_id: asset.id,
          playback_id: playbackId,
          video_url: `https://stream.mux.com/${playbackId}.m3u8`,
        })
        .select()
        .single();

    if (error) {
      console.error(
        "SESSION_CREATE_FAILED",
        error
      );

      return NextResponse.json(
        {
          status: "error",
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ready",
      sessionId: session.id,
      playbackId,
    });
  } catch (error) {
    console.error("MUX_POLL_FAILED", error);

    return NextResponse.json(
      {
        status: "error",
      },
      { status: 500 }
    );
  }
}