import { task } from "@trigger.dev/sdk/v3";
import { runAxisBallProcessing } from "../src/lib/axis-ball-processing";
import { updateAxisVideoJob } from "../src/lib/axis-video-jobs";

type AxisVideoProcessingPayload = {
  jobId: string;
  muxPlaybackId?: string;
  muxUploadId?: string;
  videoUrl: string;
};

export const axisVideoProcessing = task({
  id: "axis-video-processing",
  maxDuration: 600,
  run: async (payload: AxisVideoProcessingPayload) => {
    console.log("AXIS_VIDEO_PROCESSING_START", {
      jobId: payload.jobId,
      muxPlaybackId: payload.muxPlaybackId,
      muxUploadId: payload.muxUploadId,
      videoUrl: payload.videoUrl,
    });

    try {
      await updateAxisVideoJob(payload.jobId, {
        error: null,
        processing_stage: "extracting_frames",
        progress: 15,
        status: "processing",
      });

      const result = await runAxisBallProcessing(payload.videoUrl, async (stage) => {
        await updateAxisVideoJob(payload.jobId, {
          processing_stage: stage,
          progress: progressFromStage(stage),
          status: "processing",
        });
      });

      await updateAxisVideoJob(payload.jobId, {
        ball_track: result.ballTrack,
        ball_track_count: result.ballTrack.length,
        detection_count: result.detectionCount,
        error: null,
        frame_count: result.frameCount,
        processing_stage: "complete",
        progress: 100,
        status: "ready",
      });

      console.log("AXIS_VIDEO_PROCESSING_COMPLETE", {
        ballTrackCount: result.ballTrack.length,
        detectionCount: result.detectionCount,
        frameCount: result.frameCount,
        jobId: payload.jobId,
      });

      return {
        ballTrackCount: result.ballTrack.length,
        detectionCount: result.detectionCount,
        frameCount: result.frameCount,
        jobId: payload.jobId,
        status: "ready",
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await updateAxisVideoJob(payload.jobId, {
        error: reason,
        processing_stage: "failed",
        progress: 0,
        status: "failed",
      });
      console.error("AXIS_VIDEO_PROCESSING_FAILED", {
        jobId: payload.jobId,
        reason,
      });
      throw error;
    }
  },
});

function progressFromStage(stage: string) {
  if (stage === "extracting_frames") return 25;
  if (stage === "detecting_basketball") return 55;
  if (stage === "building_track") return 75;
  if (stage === "rendering_replay") return 90;
  if (stage === "complete") return 100;
  return 15;
}
