import { getAxisBallJob } from "../../../../../lib/axis-ball-jobs";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const jobId = id.trim();
  if (!jobId) return Response.json({ error: "job id is required" }, { status: 400 });

  const result = await getAxisBallJob(jobId);
  if (result.error) return Response.json({ error: result.error }, { status: 502 });
  if (!result.record) return Response.json({ error: "job not found" }, { status: 404 });

  return Response.json({
    ballTrack: result.record.status === "ready" ? result.record.ball_track : [],
    ballTrackCount: result.record.ball_track_count,
    detectionCount: result.record.detection_count,
    error: result.record.error,
    frameCount: result.record.frame_count,
    jobId: result.record.job_id,
    status: result.record.status,
    videoUrl: result.record.video_url,
  });
}
