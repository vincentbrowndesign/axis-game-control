import { assertAxisJobOwner, getAxisRequestUser } from "../../../../../lib/axis-request-auth";
import { getAxisVideoJob } from "../../../../../lib/axis-video-jobs";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason }, { status: 401 });

  const { id } = await context.params;
  const jobId = id.trim();
  if (!jobId) return Response.json({ error: "job id is required" }, { status: 400 });

  const result = await getAxisVideoJob(jobId);
  if (result.error) return Response.json({ code: result.code, error: result.error }, { status: 502 });
  if (!result.record) return Response.json({ error: "job not found" }, { status: 404 });
  const ownership = assertAxisJobOwner({ recordUserId: result.record.user_id, requestUserId: auth.userId });
  if (ownership) return Response.json({ code: ownership.code, error: ownership.reason }, { status: 403 });

  return Response.json({
    assetId: result.record.asset_id,
    ballTrack: result.record.status === "replay_ready" ? result.record.ball_track : [],
    ballTrackCount: result.record.ball_track_count,
    cloudflareUid: result.record.cloudflare_uid,
    detectionCount: result.record.detection_count,
    error: result.record.error,
    frameCount: result.record.frame_count,
    jobId: result.record.job_id,
    playerTrack: result.record.status === "replay_ready" ? result.record.player_track : [],
    playerTrackCount: result.record.player_track_count,
    processingStage: result.record.processing_stage,
    progress: result.record.progress,
    replayMp4Url: result.record.replay_mp4_url,
    replayVideoUrl: result.record.replay_video_url,
    status: result.record.status,
    videoUrl: result.record.video_url,
  });
}
