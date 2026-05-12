import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export async function GET(req: NextRequest) {
  try {
    const uploadId = req.nextUrl.searchParams.get("uploadId");

    if (!uploadId) {
      return NextResponse.json({ error: "Missing uploadId" }, { status: 400 });
    }

    const upload = await mux.video.uploads.retrieve(uploadId);

    const assetId = upload.asset_id;

    if (!assetId) {
      return NextResponse.json({
        status: upload.status,
        uploadId,
        assetId: null,
        playbackId: null,
      });
    }

    const asset = await mux.video.assets.retrieve(assetId);

    const playbackId = asset.playback_ids?.[0]?.id ?? null;

    return NextResponse.json({
      status: asset.status,
      uploadId,
      assetId,
      playbackId,
    });
  } catch (error) {
    console.error("MUX STATUS ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch upload status" },
      { status: 500 }
    );
  }
}