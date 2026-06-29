import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    recordingId?: string;
    sessionId?: string;
    overlayConfigId?: string;
    localBlobUrl?: string;
    durationSeconds?: number;
    width?: number;
    height?: number;
    fps?: number;
    metadata?: Record<string, unknown>;
  } | null;

  if (!body?.userId || !body.recordingId || !body.sessionId || !body.overlayConfigId) {
    return NextResponse.json({ error: "RECORDING_COMPLETE_INVALID" }, { status: 400 });
  }

  const metadata = {
    source: "browser-media-recorder",
    ...(body.metadata || {}),
  };
  const supabase = createServiceSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("basketball_recordings")
      .update({
        local_blob_url: body.localBlobUrl || null,
        duration_seconds: body.durationSeconds || null,
        width: body.width || null,
        height: body.height || null,
        fps: body.fps || null,
        status: "complete",
        metadata,
      })
      .eq("id", body.recordingId)
      .eq("user_id", body.userId)
      .select(
        "id,user_id,session_id,overlay_config_id,local_blob_url,duration_seconds,width,height,fps,status,metadata",
      )
      .single();

    if (!error && data) {
      return NextResponse.json({
        recording: {
          id: data.id,
          userId: data.user_id,
          sessionId: data.session_id,
          overlayConfigId: data.overlay_config_id,
          localBlobUrl: data.local_blob_url || undefined,
          durationSeconds: data.duration_seconds || undefined,
          width: data.width || undefined,
          height: data.height || undefined,
          fps: data.fps || undefined,
          status: data.status,
          metadata: data.metadata,
          persisted: true,
        },
      });
    }
  }

  return NextResponse.json({
    recording: {
      id: body.recordingId,
      userId: body.userId,
      sessionId: body.sessionId,
      overlayConfigId: body.overlayConfigId,
      localBlobUrl: body.localBlobUrl,
      durationSeconds: body.durationSeconds,
      width: body.width,
      height: body.height,
      fps: body.fps,
      status: "complete",
      metadata,
      persisted: false,
    },
  });
}
