import { tasks } from "@trigger.dev/sdk/v3";
import { createAxisVideoJob, updateAxisVideoJob } from "../../../../lib/axis-video-jobs";
import { getMuxPlaybackUrl } from "../../../../lib/axis-ball-processing";

export const runtime = "nodejs";

type CreateVideoJobBody = {
  assetId?: unknown;
  muxPlaybackId?: unknown;
  muxUploadId?: unknown;
  videoUrl?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateVideoJobBody | null;
  if (!body) return Response.json({ error: "JSON body is required." }, { status: 400 });

  const muxPlaybackId = getString(body.muxPlaybackId);
  const muxUploadId = getString(body.muxUploadId);
  const assetId = getString(body.assetId) || muxUploadId || muxPlaybackId;
  const videoUrl = getString(body.videoUrl) || getMuxPlaybackUrl(muxPlaybackId);
  if (!assetId) return Response.json({ error: "assetId or muxUploadId is required." }, { status: 400 });
  if (!videoUrl) return Response.json({ error: "videoUrl or muxPlaybackId is required." }, { status: 400 });

  const jobId = `axis-video-${crypto.randomUUID()}`;
  const storagePath = muxPlaybackId ? `mux:${muxPlaybackId}` : `mux-upload:${assetId}`;

  const created = await createAxisVideoJob({
    asset_id: assetId,
    ball_track: [],
    ball_track_count: 0,
    detection_count: 0,
    error: null,
    frame_count: 0,
    job_id: jobId,
    mux_playback_id: muxPlaybackId || null,
    mux_upload_id: muxUploadId || null,
    processing_stage: "queued",
    progress: 0,
    status: "queued",
    storage_path: storagePath,
    storage_provider: "mux",
    trigger_run_id: null,
    video_url: videoUrl,
  });

  if (!created.stored) return Response.json({ error: created.reason }, { status: 502 });

  try {
    const handle = await tasks.trigger("axis-video-processing", {
      jobId,
      muxPlaybackId: muxPlaybackId || undefined,
      muxUploadId: muxUploadId || undefined,
      videoUrl,
    });
    await updateAxisVideoJob(jobId, {
      progress: 5,
      status: "processing",
      trigger_run_id: handle.id,
    });

    return Response.json({
      assetId,
      jobId,
      status: "processing",
      triggerRunId: handle.id,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await updateAxisVideoJob(jobId, {
      error: reason,
      processing_stage: "failed",
      progress: 0,
      status: "failed",
    });
    return Response.json({ error: reason, jobId, status: "failed" }, { status: 502 });
  }
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
