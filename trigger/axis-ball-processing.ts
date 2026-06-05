import { task } from "@trigger.dev/sdk/v3";
import { runAxisBallProcessing } from "../src/lib/axis-ball-processing";
import { updateAxisBallJob } from "../src/lib/axis-ball-jobs";

type AxisBallProcessingPayload = {
  jobId: string;
  muxPlaybackId?: string;
  muxUploadId?: string;
  videoUrl: string;
};

export const axisBallProcessing = task({
  id: "axis-ball-processing",
  maxDuration: 600,
  run: async (payload: AxisBallProcessingPayload) => {
    console.log("AXIS_BALL_PROCESSING_START", {
      jobId: payload.jobId,
      muxPlaybackId: payload.muxPlaybackId,
      muxUploadId: payload.muxUploadId,
      videoUrl: payload.videoUrl,
    });

    try {
      await updateAxisBallJob(payload.jobId, {
        error: null,
        processing_stage: "extracting_frames",
        status: "processing",
      });

      const result = await runAxisBallProcessing(payload.videoUrl, async (stage) => {
        await updateAxisBallJob(payload.jobId, {
          processing_stage: stage,
          status: "processing",
        });
      });
      await updateAxisBallJob(payload.jobId, {
        ball_track: result.ballTrack,
        ball_track_count: result.ballTrack.length,
        detection_count: result.detectionCount,
        error: null,
        frame_count: result.frameCount,
        processing_stage: "complete",
        status: "ready",
      });

      console.log("AXIS_BALL_PROCESSING_COMPLETE", {
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
      await updateAxisBallJob(payload.jobId, {
        error: reason,
        processing_stage: "failed",
        status: "failed",
      });
      console.error("AXIS_BALL_PROCESSING_FAILED", {
        jobId: payload.jobId,
        reason,
      });
      throw error;
    }
  },
});
