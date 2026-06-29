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
    return NextResponse.json({ error: "OVERLAY_LOOKUP_INVALID" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ overlays: [] });
  }

  const { data, error } = await supabase
    .from("basketball_overlay_configs")
    .select("id,user_id,session_id,overlay_type,opacity,transform,calibration,settings")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ overlays: [] });
  }

  return NextResponse.json({
    overlays: data.map((overlay) => ({
      id: overlay.id,
      userId: overlay.user_id,
      sessionId: overlay.session_id,
      overlayType: overlay.overlay_type,
      opacity: overlay.opacity,
      visible: Boolean(overlay.transform?.visible ?? true),
      transform: overlay.transform,
      calibration: overlay.calibration,
      settings: overlay.settings,
      persisted: true,
    })),
  });
}
