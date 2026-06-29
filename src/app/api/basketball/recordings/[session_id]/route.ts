import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ session_id: string }> },
) {
  const { session_id: sessionId } = await params;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!sessionId || !userId) {
    return NextResponse.json({ error: "RECORDING_LOOKUP_INVALID" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ recordings: [] });
  }

  const { data, error } = await supabase
    .from("basketball_recordings")
    .select(
      "id,user_id,session_id,overlay_config_id,local_blob_url,duration_seconds,width,height,fps,status,metadata",
    )
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ recordings: [] });
  }

  return NextResponse.json({
    recordings: data.map((recording) => ({
      id: recording.id,
      userId: recording.user_id,
      sessionId: recording.session_id,
      overlayConfigId: recording.overlay_config_id,
      localBlobUrl: recording.local_blob_url || undefined,
      durationSeconds: recording.duration_seconds || undefined,
      width: recording.width || undefined,
      height: recording.height || undefined,
      fps: recording.fps || undefined,
      status: recording.status,
      metadata: recording.metadata,
      persisted: true,
    })),
  });
}
