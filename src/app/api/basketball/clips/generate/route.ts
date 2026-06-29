import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { type BasketballReviewedEvent } from "@/lib/basketball";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    reviewedEvent?: BasketballReviewedEvent;
    sourceVideoPath?: string;
    outputClipPath?: string;
  } | null;

  if (!body?.userId || !body.reviewedEvent) {
    return NextResponse.json({ error: "REVIEWED_EVENT_REQUIRED" }, { status: 400 });
  }

  const event = body.reviewedEvent;
  if (!["approved", "corrected"].includes(event.reviewStatus)) {
    return NextResponse.json({ error: "REVIEWED_EVENT_NOT_READY" }, { status: 400 });
  }

  const startTime = Math.max(0, (event.startTimeSeconds || 0) - 2);
  const endTime = Math.max(startTime + 1, (event.endTimeSeconds || event.startTimeSeconds || 0) + 3);
  let status: "created" | "error" = "created";
  let outputPath = body.outputClipPath;
  let workerResult: Record<string, unknown> | null = null;

  if (body.sourceVideoPath && body.outputClipPath) {
    try {
      const { stdout } = await execFileAsync("python", [
        "python/basketball/generate_clip.py",
        "--source-video-path",
        body.sourceVideoPath,
        "--event-start-time-seconds",
        String(event.startTimeSeconds || 0),
        "--event-end-time-seconds",
        String(event.endTimeSeconds || event.startTimeSeconds || 0),
        "--output-clip-path",
        body.outputClipPath,
      ]);
      workerResult = JSON.parse(stdout) as Record<string, unknown>;
      status = workerResult.status === "created" ? "created" : "error";
      outputPath =
        typeof workerResult.output_path === "string" ? workerResult.output_path : body.outputClipPath;
    } catch (error) {
      status = "error";
      workerResult = {
        error: error instanceof Error ? error.message : "CLIP_WORKER_FAILED",
      };
    }
  }

  const supabase = createServiceSupabaseClient();

  if (supabase) {
    const { data } = await supabase
      .from("basketball_clips")
      .insert({
        user_id: body.userId,
        session_id: event.sessionId,
        recording_id: event.recordingId || null,
        event_id: event.id,
        title: event.eventType,
        start_time_seconds: startTime,
        end_time_seconds: endTime,
        storage_path: outputPath || null,
        status,
      })
      .select("id,user_id,session_id,recording_id,event_id,title,start_time_seconds,end_time_seconds,storage_path,status")
      .single();

    if (data) {
      return NextResponse.json({
        clip: {
          id: data.id,
          userId: data.user_id,
          sessionId: data.session_id,
          recordingId: data.recording_id || undefined,
          eventId: data.event_id || undefined,
          title: data.title,
          startTimeSeconds: data.start_time_seconds || undefined,
          endTimeSeconds: data.end_time_seconds || undefined,
          storagePath: data.storage_path || undefined,
          status: data.status,
          persisted: true,
        },
        workerResult,
      });
    }
  }

  return NextResponse.json({
    clip: {
      id: crypto.randomUUID(),
      userId: body.userId,
      sessionId: event.sessionId,
      recordingId: event.recordingId,
      eventId: event.id,
      title: event.eventType,
      startTimeSeconds: startTime,
      endTimeSeconds: endTime,
      storagePath: outputPath,
      status,
      persisted: false,
    },
    workerResult,
  });
}
