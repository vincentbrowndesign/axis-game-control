import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!sessionId || !userId) {
    return NextResponse.json({ error: "AI_EVENT_LOOKUP_INVALID" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ candidates: [] });
  }

  const { data, error } = await supabase
    .from("basketball_ai_event_candidates")
    .select(
      "id,user_id,session_id,recording_id,overlay_config_id,event_type,start_time_seconds,end_time_seconds,confidence,reason,overlay_context,detections,metadata,review_status",
    )
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ candidates: [] });
  }

  return NextResponse.json({
    suggestedMoments: data.map((candidate) => ({
      id: candidate.id,
      userId: candidate.user_id,
      sessionId: candidate.session_id,
      recordingId: candidate.recording_id || undefined,
      overlayConfigId: candidate.overlay_config_id || undefined,
      eventType: candidate.event_type,
      startTimeSeconds: candidate.start_time_seconds || undefined,
      endTimeSeconds: candidate.end_time_seconds || undefined,
      confidence: candidate.confidence || undefined,
      reason: candidate.reason || undefined,
      overlayContext: candidate.overlay_context || {},
      evidence: candidate.detections || {},
      metadata: candidate.metadata || {},
      reviewStatus: candidate.review_status,
    })),
  });
}
