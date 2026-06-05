import { task } from "@trigger.dev/sdk/v3";
import { runAxisBallProcessing } from "../src/lib/axis-ball-processing";
import { getAxisVideoJob, updateAxisVideoJob } from "../src/lib/axis-video-jobs";
import { waitForCloudflareMp4Download, waitForCloudflareStreamReady } from "../src/lib/cloudflare-stream";

type AxisVideoProcessingPayload = {
  cloudflareUid: string;
  jobId: string;
};

export const axisVideoProcessing = task({
  id: "axis-video-processing",
  maxDuration: 900,
  queue: {
    name: "axis-video-processing",
    concurrencyLimit: 1,
  },
  run: async (payload: AxisVideoProcessingPayload) => {
    console.log("AXIS_VIDEO_PROCESSING_START", {
      cloudflareUid: payload.cloudflareUid,
      jobId: payload.jobId,
    });

    try {
      console.log("PROCESSING_START", { jobId: payload.jobId });
      console.log("PROCESSING_STEP_1", {
        request: "supabase.axis_video_jobs.update",
        stage: "mark_stream_processing",
      });
      await updateAxisVideoJob(payload.jobId, {
        error: null,
        progress: 10,
        status: "stream_processing",
      });

      console.log("PROCESSING_STEP_2", {
        request: "cloudflare.stream.video.read",
        uid: payload.cloudflareUid,
      });
      const streamVideo = await waitForCloudflareStreamReady(payload.cloudflareUid);
      const videoReadyAt = new Date().toISOString();
      await updateAxisVideoJob(payload.jobId, {
        progress: 25,
        status: "ready_for_axis_processing",
        video_ready_at: videoReadyAt,
        video_url: streamVideo.playback?.hls ?? `https://customer-${payload.cloudflareUid}.cloudflarestream.com/${payload.cloudflareUid}/manifest/video.m3u8`,
      });

      console.log("DOWNLOAD_VIDEO_START", {
        cloudflareUid: payload.cloudflareUid,
        jobId: payload.jobId,
      });
      console.log("PROCESSING_STEP_3", {
        request: "cloudflare.stream.downloads.create_and_read",
        uid: payload.cloudflareUid,
      });
      const mp4Url = await waitForCloudflareMp4Download(payload.cloudflareUid);
      const mp4ReadyAt = new Date().toISOString();
      await updateAxisVideoJob(payload.jobId, {
        mp4_ready_at: mp4ReadyAt,
        progress: 35,
        status: "axis_processing",
      });
      console.log("DOWNLOAD_VIDEO_COMPLETE", {
        cloudflareUid: payload.cloudflareUid,
        jobId: payload.jobId,
      });

      console.log("FRAME_EXTRACTION_START", { jobId: payload.jobId });
      const result = await runAxisBallProcessing(mp4Url, async (stage) => {
        await updateAxisVideoJob(payload.jobId, {
          processing_stage: stage,
          progress: progressFromStage(stage),
          status: "axis_processing",
        });
      });
      console.log("FRAME_EXTRACTION_COMPLETE", { frameCount: result.frameCount, jobId: payload.jobId });
      console.log("ROBOFLOW_COMPLETE", { detectionCount: result.detectionCount, jobId: payload.jobId });
      console.log("BALL_TRACK_CREATED", { ballTrackCount: result.ballTrack.length, jobId: payload.jobId });

      const job = await getAxisVideoJob(payload.jobId);
      await updateAxisVideoJob(payload.jobId, {
        ball_track: result.ballTrack,
        ball_track_count: result.ballTrack.length,
        detection_count: result.detectionCount,
        error: null,
        frame_count: result.frameCount,
        processing_stage: "complete",
        progress: 100,
        status: "replay_ready",
        video_url: job.record?.video_url || streamVideo.playback?.hls || "",
      });

      console.log("JOB_READY", {
        ballTrackCount: result.ballTrack.length,
        cloudflareUid: payload.cloudflareUid,
        jobId: payload.jobId,
      });

      return {
        ballTrackCount: result.ballTrack.length,
        cloudflareUid: payload.cloudflareUid,
        detectionCount: result.detectionCount,
        frameCount: result.frameCount,
        jobId: payload.jobId,
        status: "replay_ready",
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
        cloudflareUid: payload.cloudflareUid,
        jobId: payload.jobId,
        reason,
      });
      throw error;
    }
  },
});

function progressFromStage(stage: string) {
  if (stage === "extracting_frames") return 45;
  if (stage === "detecting_basketball") return 65;
  if (stage === "building_track") return 85;
  if (stage === "rendering_replay") return 95;
  if (stage === "complete") return 100;
  return 40;
}
