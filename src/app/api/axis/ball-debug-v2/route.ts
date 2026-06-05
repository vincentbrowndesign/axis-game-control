import { tasks } from "@trigger.dev/sdk/v3";
import { createAxisBallJob, updateAxisBallJob } from "../../../../lib/axis-ball-jobs";
import { getMuxPlaybackUrl } from "../../../../lib/axis-ball-processing";

export const runtime = "nodejs";

type CreateBallJobBody = {
  muxPlaybackId?: unknown;
  muxUploadId?: unknown;
  videoUrl?: unknown;
};

export async function POST(request: Request) {
  console.log("BALL_DEBUG_JOB_CREATE_START");
  const body = (await request.json().catch(() => null)) as CreateBallJobBody | null;
  if (!body) return Response.json({ error: "JSON body is required." }, { status: 400 });

  const muxPlaybackId = getString(body.muxPlaybackId);
  const muxUploadId = getString(body.muxUploadId);
  const videoUrl = getString(body.videoUrl) || getMuxPlaybackUrl(muxPlaybackId);
  if (!videoUrl) return Response.json({ error: "videoUrl or muxPlaybackId is required." }, { status: 400 });

  const jobId = `axis-ball-${crypto.randomUUID()}`;
  const storagePath = muxPlaybackId ? `mux:${muxPlaybackId}` : videoUrl;

  const created = await createAxisBallJob({
    ball_track: [],
    ball_track_count: 0,
    detection_count: 0,
    error: null,
    frame_count: 0,
    job_id: jobId,
    mux_playback_id: muxPlaybackId || null,
    mux_upload_id: muxUploadId || null,
    processing_stage: "uploading",
    status: "processing",
    storage_path: storagePath,
    storage_provider: "mux",
    trigger_run_id: null,
    video_url: videoUrl,
  });

  if (!created.stored) {
    console.error("BALL_DEBUG_JOB_CREATE_FAILED", {
      jobId,
      reason: created.reason,
    });
    return Response.json({ error: created.reason }, { status: 502 });
  }

  try {
    const handle = await tasks.trigger("axis-ball-processing", {
      jobId,
      muxPlaybackId: muxPlaybackId || undefined,
      muxUploadId: muxUploadId || undefined,
      videoUrl,
    });
    await updateAxisBallJob(jobId, { trigger_run_id: handle.id });

    console.log("BALL_DEBUG_JOB_CREATED", {
      jobId,
      muxPlaybackId,
      muxUploadId,
      status: "processing",
      triggerRunId: handle.id,
    });

    return Response.json({
      jobId,
      status: "processing",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await updateAxisBallJob(jobId, {
      error: reason,
      processing_stage: "failed",
      status: "failed",
    });
    console.error("BALL_DEBUG_JOB_TRIGGER_FAILED", {
      jobId,
      reason,
    });
    return Response.json({ error: reason, jobId, status: "failed" }, { status: 502 });
  }
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
