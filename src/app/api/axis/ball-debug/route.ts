import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { runAxisFrameDebugPass } from "../../../../lib/axis-frame-debug";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let videoPath = "";

  try {
    const form = await request.formData();
    const video = form.get("video");

    if (!(video instanceof Blob)) {
      return Response.json({ error: "video is required" }, { status: 400 });
    }

    const suffix = getVideoSuffix(video);
    videoPath = path.join(os.tmpdir(), `axis-ball-debug-${Date.now()}${suffix}`);
    await fs.writeFile(videoPath, Buffer.from(await video.arrayBuffer()));

    const result = await runAxisFrameDebugPass({
      createDebugMp4: false,
      frameIntervalSeconds: 0.1,
      videoUrl: videoPath,
    });

    return Response.json({
      AVERAGE_CONFIDENCE: result.track_quality.AVERAGE_CONFIDENCE,
      BASKETBALL_DETECTIONS: result.BALL_DETECTIONS,
      BALL_CONFIDENCE: result.ball_track[0]?.confidence ?? null,
      BALL_TRACK_COUNT: result.BALL_TRACK_COUNT,
      DETECTION_COVERAGE_PERCENT: result.track_quality.DETECTION_COVERAGE_PERCENT,
      FIRST_MISSING_FRAME: result.track_quality.FIRST_MISSING_FRAME,
      FRAMES_EXTRACTED: result.TOTAL_FRAMES,
      FRAMES_WITH_BALL: result.track_quality.FRAMES_WITH_BALL,
      LARGEST_TRACKING_GAP: result.track_quality.LARGEST_TRACKING_GAP,
      LAST_MISSING_FRAME: result.track_quality.LAST_MISSING_FRAME,
      TRACK_GAPS: result.track_quality.TRACK_GAPS,
      ball_track: result.ball_track,
      exact_failing_step: result.exact_failing_step,
      first_ball_frame: result.FIRST_BALL_FRAME,
      last_ball_frame: result.LAST_BALL_FRAME,
      player_tracks: result.player_tracks,
      PLAYER_TRACK_COUNT: result.player_tracks.length,
      raw_class_names: result.raw_class_names,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("BALL_DEBUG_FAILED", { reason });
    return Response.json(
      {
        AVERAGE_CONFIDENCE: null,
        BASKETBALL_DETECTIONS: 0,
        BALL_CONFIDENCE: null,
        BALL_TRACK_COUNT: 0,
        DETECTION_COVERAGE_PERCENT: 0,
        FIRST_MISSING_FRAME: null,
        FRAMES_EXTRACTED: 0,
        FRAMES_WITH_BALL: 0,
        LARGEST_TRACKING_GAP: 0,
        LAST_MISSING_FRAME: null,
        TRACK_GAPS: [],
        ball_track: [],
        error: reason,
        exact_failing_step: "BALL_DEBUG_FAILED",
        player_tracks: [],
        PLAYER_TRACK_COUNT: 0,
      },
      { status: 500 },
    );
  } finally {
    if (videoPath) {
      await fs.unlink(videoPath).catch(() => null);
    }
  }
}

function getVideoSuffix(video: Blob) {
  if (video instanceof File && path.extname(video.name)) return path.extname(video.name);
  if (video.type.includes("quicktime")) return ".mov";
  if (video.type.includes("webm")) return ".webm";
  return ".mp4";
}
