import { NextResponse } from "next/server";
import Mux from "@mux/mux-node";

export const runtime = "nodejs";

const tokenId = process.env.MUX_TOKEN_ID;
const tokenSecret = process.env.MUX_TOKEN_SECRET;

if (!tokenId || !tokenSecret) {
  console.error("Missing Mux environment variables");
}

const mux = new Mux({
  tokenId: tokenId!,
  tokenSecret: tokenSecret!,
});

export async function POST() {
  try {
    if (!tokenId || !tokenSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MUX_TOKEN_ID or MUX_TOKEN_SECRET missing",
        },
        { status: 500 }
      );
    }

    const upload = await mux.video.uploads.create({
      cors_origin: "*",

      new_asset_settings: {
        playback_policy: ["public"],
      },
    });

    return NextResponse.json({
      success: true,
      uploadId: upload.id,
      uploadUrl: upload.url,
    });
  } catch (error: any) {
    console.error("MUX UPLOAD CREATE ERROR");
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Failed to create upload",
      },
      { status: 500 }
    );
  }
}