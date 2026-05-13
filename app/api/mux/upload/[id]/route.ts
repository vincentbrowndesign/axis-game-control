import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";

export const runtime = "nodejs";

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;

    const upload =
      await mux.video.uploads.retrieve(id);

    if (!upload.asset_id) {
      return NextResponse.json({
        ready: false,
      });
    }

    const asset =
      await mux.video.assets.retrieve(
        upload.asset_id
      );

    const playbackId =
      asset.playback_ids?.[0]?.id || null;

    return NextResponse.json({
      ready: asset.status === "ready",
      assetId: asset.id,
      playbackId,
      status: asset.status,
    });
  } catch (error: any) {
    console.error("MUX POLL ERROR");
    console.error(error);

    return NextResponse.json(
      {
        ready: false,
        error:
          error?.message ||
          "Polling failed",
      },
      { status: 500 }
    );
  }
}