import { NextResponse } from "next/server";
import { mux } from "@/lib/mux";

export async function POST() {
  try {
    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
      },
    });

    return NextResponse.json({
      uploadUrl: upload.url,
      uploadId: upload.id,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to create upload" },
      { status: 500 }
    );
  }
}