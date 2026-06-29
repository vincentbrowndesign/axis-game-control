import { NextResponse } from "next/server";
import { type BasketballAIEventCandidate } from "@/lib/basketball";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

type ReviewAction = "approve" | "reject" | "correct";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: candidateId } = await params;
  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    action?: ReviewAction;
    correctedEventType?: string;
    candidate?: BasketballAIEventCandidate;
  } | null;

  if (!candidateId || !body?.userId || !body.action) {
    return NextResponse.json({ error: "AI_EVENT_REVIEW_INVALID" }, { status: 400 });
  }

  if (!["approve", "reject", "correct"].includes(body.action)) {
    return NextResponse.json({ error: "AI_EVENT_REVIEW_ACTION_INVALID" }, { status: 400 });
  }

  if (body.action === "correct" && !body.correctedEventType?.trim()) {
    return NextResponse.json({ error: "AI_EVENT_CORRECTION_REQUIRED" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  if (supabase) {
    const { data: candidate } = await supabase
      .from("basketball_ai_event_candidates")
      .select(
        "id,user_id,session_id,recording_id,event_type,start_time_seconds,end_time_seconds,confidence,overlay_context,detections,metadata",
      )
      .eq("id", candidateId)
      .eq("user_id", body.userId)
      .single();

    if (body.action === "reject") {
      await supabase
        .from("basketball_ai_event_candidates")
        .update({ review_status: "rejected" })
        .eq("id", candidateId)
        .eq("user_id", body.userId);

      return NextResponse.json({
        status: "rejected",
        candidateId,
        persisted: Boolean(candidate),
      });
    }

    if (candidate) {
      const reviewStatus = body.action === "correct" ? "corrected" : "approved";
      const eventType =
        body.action === "correct" ? body.correctedEventType?.trim() : candidate.event_type;

      const { data: reviewed } = await supabase
        .from("basketball_reviewed_events")
        .insert({
          user_id: body.userId,
          candidate_id: candidateId,
          session_id: candidate.session_id,
          recording_id: candidate.recording_id,
          event_type: eventType,
          start_time_seconds: candidate.start_time_seconds,
          end_time_seconds: candidate.end_time_seconds,
          confidence: candidate.confidence,
          review_status: reviewStatus,
          metadata: {
            candidate_metadata: candidate.metadata || {},
            overlay_context: candidate.overlay_context || {},
            evidence: candidate.detections || {},
          },
        })
        .select(
          "id,user_id,candidate_id,session_id,recording_id,event_type,start_time_seconds,end_time_seconds,confidence,review_status,metadata",
        )
        .single();

      await supabase
        .from("basketball_ai_event_candidates")
        .update({ review_status: reviewStatus })
        .eq("id", candidateId)
        .eq("user_id", body.userId);

      if (reviewed) {
        return NextResponse.json({
          reviewedEvent: {
            id: reviewed.id,
            userId: reviewed.user_id,
            candidateId: reviewed.candidate_id || undefined,
            sessionId: reviewed.session_id,
            recordingId: reviewed.recording_id || undefined,
            eventType: reviewed.event_type,
            startTimeSeconds: reviewed.start_time_seconds || undefined,
            endTimeSeconds: reviewed.end_time_seconds || undefined,
            confidence: reviewed.confidence || undefined,
            reviewStatus: reviewed.review_status,
            metadata: reviewed.metadata || {},
            persisted: true,
          },
        });
      }
    }
  }

  if (body.action === "reject") {
    return NextResponse.json({
      status: "rejected",
      candidateId,
      persisted: false,
    });
  }

  const candidate = body.candidate;
  if (!candidate) {
    return NextResponse.json({ error: "AI_EVENT_CANDIDATE_REQUIRED" }, { status: 400 });
  }

  return NextResponse.json({
    reviewedEvent: {
      id: crypto.randomUUID(),
      userId: body.userId,
      candidateId,
      sessionId: candidate.sessionId,
      recordingId: candidate.recordingId,
      eventType:
        body.action === "correct" ? body.correctedEventType?.trim() : candidate.eventType,
      startTimeSeconds: candidate.startTimeSeconds,
      endTimeSeconds: candidate.endTimeSeconds,
      confidence: candidate.confidence,
      reviewStatus: body.action === "correct" ? "corrected" : "approved",
      metadata: {
        candidate_metadata: candidate.metadata,
        overlay_context: candidate.overlayContext,
        evidence: candidate.evidence,
      },
      persisted: false,
    },
  });
}
