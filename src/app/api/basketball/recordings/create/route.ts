import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    sessionId?: string;
    overlayConfigId?: string;
    width?: number;
    height?: number;
    fps?: number;
    metadata?: Record<string, unknown>;
  } | null;

  if (!body?.userId || !body.sessionId || !body.overlayConfigId) {
    return NextResponse.json({ error: "RECORDING_INPUT_INVALID" }, { status: 400 });
  }

  const metadata = {
    source: "browser-media-recorder",
    ...(body.metadata || {}),
  };
  const supabase = createServiceSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("basketball_recordings")
      .insert({
        user_id: body.userId,
        session_id: body.sessionId,
        overlay_config_id: body.overlayConfigId,
        width: body.width || null,
        height: body.height || null,
        fps: body.fps || null,
        status: "recording",
        metadata,
      })
      .select("id,user_id,session_id,overlay_config_id,width,height,fps,status,metadata")
      .single();

    if (!error && data) {
      return NextResponse.json({
        recording: {
          id: data.id,
          userId: data.user_id,
          sessionId: data.session_id,
          overlayConfigId: data.overlay_config_id,
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
      id: crypto.randomUUID(),
      userId: body.userId,
      sessionId: body.sessionId,
      overlayConfigId: body.overlayConfigId,
      width: body.width,
      height: body.height,
      fps: body.fps,
      status: "recording",
      metadata,
      persisted: false,
    },
  });
}
