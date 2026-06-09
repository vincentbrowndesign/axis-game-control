import { task } from "@trigger.dev/sdk/v3";
import { promises as fs } from "node:fs";
import { runAxisBallProcessing, type AxisReplayFocusSelection } from "../src/lib/axis-ball-processing";
import { storeAxisEvents } from "../src/lib/axis-events";
import type { AxisVideoJobRecord } from "../src/lib/axis-video-jobs";
import { getAxisVideoJob, updateAxisVideoJob } from "../src/lib/axis-video-jobs";
import { uploadCloudflareStreamVideoFile, waitForCloudflareMp4Download, waitForCloudflareStreamReady } from "../src/lib/cloudflare-stream";
import { assertAxisSupabaseServerEnv, verifyAxisSupabaseServiceRoleConnectivity } from "../src/lib/axis-supabase-server";

type AxisVideoProcessingPayload = {
  cloudflareUid: string;
  focusSelection?: AxisReplayFocusSelection;
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
    let processingWorkDir: string | undefined;
    logAxisVideoProcessingMemory("PROCESSING_START", { jobId: payload.jobId });
    console.log("AXIS_VIDEO_PROCESSING_START", {
      cloudflareUid: payload.cloudflareUid,
      jobId: payload.jobId,
    });

    try {
      console.log("PROCESSING_START", { jobId: payload.jobId });
      assertAxisSupabaseServerEnv("axis-video-processing:startup");
      await verifyAxisSupabaseServiceRoleConnectivity("axis-video-processing:startup");
      logAxisVideoProcessingMemory("PROCESSING_START_AFTER_LOG", { jobId: payload.jobId });
      console.log("PROCESSING_STEP_1", {
        request: "supabase.axis_video_jobs.update",
        stage: "mark_stream_processing",
      });
      await persistAxisVideoJobUpdate("PROCESSING_MARK_STREAM_PROCESSING", payload.jobId, {
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
      await persistAxisVideoJobUpdate("PROCESSING_MARK_VIDEO_READY", payload.jobId, {
        progress: 25,
        status: "ready_for_axis_processing",
        video_ready_at: videoReadyAt,
        video_url: streamVideo.playback?.hls ?? `https://customer-${payload.cloudflareUid}.cloudflarestream.com/${payload.cloudflareUid}/manifest/video.m3u8`,
      });
      logAxisVideoProcessingMemory("AFTER_CLOUDFLARE_VIDEO_READY", { jobId: payload.jobId });

      console.log("DOWNLOAD_VIDEO_START", {
        cloudflareUid: payload.cloudflareUid,
        hasFocusSelection: Boolean(payload.focusSelection),
        jobId: payload.jobId,
      });
      console.log("PROCESSING_STEP_3", {
        request: "cloudflare.stream.downloads.create_and_read",
        uid: payload.cloudflareUid,
      });
      const mp4Url = await waitForCloudflareMp4Download(payload.cloudflareUid);
      console.log("CLOUDFLARE_MP4_DOWNLOAD_RESULT", {
        cloudflareUid: payload.cloudflareUid,
        downloadedLocalPath: null,
        inputMode: "remote_url_handoff",
        jobId: payload.jobId,
        mp4Url,
      });
      const mp4ReadyAt = new Date().toISOString();
      await persistAxisVideoJobUpdate("PROCESSING_MARK_AXIS_PROCESSING", payload.jobId, {
        mp4_ready_at: mp4ReadyAt,
        progress: 35,
        status: "axis_processing",
      });
      logAxisVideoProcessingMemory("AFTER_CLOUDFLARE_DOWNLOAD", { jobId: payload.jobId });
      console.log("DOWNLOAD_VIDEO_COMPLETE", {
        cloudflareUid: payload.cloudflareUid,
        jobId: payload.jobId,
      });

      logAxisVideoProcessingMemory("BEFORE_FRAME_EXTRACTION", { jobId: payload.jobId });
      console.log("AXIS_BALL_PROCESSING_INPUT", {
        ballProcessingInputPath: mp4Url,
        localDownloadStage: "runAxisBallProcessing",
        willDownloadBeforeExtraction: isRemoteUrl(mp4Url),
        jobId: payload.jobId,
      });
      console.log("FRAME_EXTRACTION_START", { jobId: payload.jobId });
      const result = await runAxisBallProcessing(
        mp4Url,
        async (stage) => {
          await persistAxisVideoJobUpdate("PROCESSING_STAGE_UPDATE", payload.jobId, {
            processing_stage: stage,
            progress: progressFromStage(stage),
            status: "axis_processing",
          });
        },
        { exportReplay: true, focusSelection: payload.focusSelection, keepWorkDir: true, sourceJobId: payload.jobId },
      );
      processingWorkDir = result.workDir;
      logAxisVideoProcessingMemory("BEFORE_REPLAY_GENERATION", { jobId: payload.jobId });
      console.log("FRAME_EXTRACTION_COMPLETE", { frameCount: result.frameCount, jobId: payload.jobId });
      console.log("ROBOFLOW_COMPLETE", { detectionCount: result.detectionCount, jobId: payload.jobId });
      console.log("BALL_TRACK_CREATED", { ballTrackCount: result.ballTrack.length, jobId: payload.jobId });

      const job = await getAxisVideoJob(payload.jobId);
      if (job.error) throw new Error(`Axis video job read failed before final update: ${job.error}`);
      const eventStorage = await storeAxisEvents(result.events, {
        organizationId: job.record?.organization_id,
        sessionId: job.record?.session_id,
        sourceJobId: payload.jobId,
        userId: job.record?.user_id,
        videoId: job.record?.video_id || payload.cloudflareUid,
      });
      if (!eventStorage.stored) {
        throw new Error(`Axis event persistence failed: ${eventStorage.code}: ${eventStorage.reason}`);
      }
      console.log("AXIS_EVENTS_STORED", {
        eventCount: eventStorage.eventCount,
        jobId: payload.jobId,
      });
      let replayCloudflareUid: string | null = null;
      let replayMp4Url: string | null = null;
      if (!result.replayExport?.path) throw new Error("Replay export MP4 was not created.");
      console.log("REPLAY_EXPORT_UPLOAD_START", {
        exportPath: result.replayExport.path,
        jobId: payload.jobId,
        sizeBytes: result.replayExport.sizeBytes,
      });
      const replayUpload = await uploadCloudflareStreamVideoFile({
        filePath: result.replayExport.path,
        filename: `${payload.jobId}-axis-replay.mp4`,
      });
      if (replayUpload.error || !replayUpload.uid) throw new Error(`Replay upload failed: ${replayUpload.error}`);
      replayCloudflareUid = replayUpload.uid;
      console.log("CLOUDFLARE_REPLAY_STREAM_READY_WAIT_START", {
        jobId: payload.jobId,
        replayCloudflareUid,
      });
      await waitForCloudflareStreamReady(replayUpload.uid);
      console.log("CLOUDFLARE_REPLAY_STREAM_READY_WAIT_COMPLETE", {
        jobId: payload.jobId,
        replayCloudflareUid,
      });
      console.log("CLOUDFLARE_REPLAY_MP4_DOWNLOAD_WAIT_START", {
        jobId: payload.jobId,
        replayCloudflareUid,
      });
      replayMp4Url = await waitForCloudflareMp4Download(replayUpload.uid);
      console.log("CLOUDFLARE_REPLAY_MP4_DOWNLOAD_READY", {
        jobId: payload.jobId,
        replayCloudflareUid,
        replayMp4Url,
      });
      console.log("REPLAY_EXPORT_UPLOAD_COMPLETE", {
        jobId: payload.jobId,
        replayCloudflareUid,
        replayMp4Url,
      });

      const finalUpdate = await persistAxisVideoJobUpdate("PROCESSING_FINAL_REPLAY_READY", payload.jobId, {
        ball_track: result.ballTrack,
        ball_track_count: result.ballTrack.length,
        detection_count: result.detectionCount,
        error: null,
        focus_player_track_id: result.focusPlayerTrackId ?? null,
        frame_count: result.frameCount,
        player_track: result.playerTrack,
        player_track_count: result.playerTrack.length,
        processing_stage: "complete",
        progress: 100,
        status: "replay_ready",
        video_url: replayMp4Url,
      });
      if (result.workDir) await fs.rm(result.workDir, { force: true, recursive: true }).catch(() => null);
      processingWorkDir = undefined;

      console.log("JOB_READY", {
        ballTrackCount: result.ballTrack.length,
        cloudflareUid: payload.cloudflareUid,
        focusPlayerTrackId: result.focusPlayerTrackId ?? null,
        persistedStatus: finalUpdate.record.status,
        jobId: payload.jobId,
      });
      console.log("PLAYER_TRACKS_PERSISTED", {
        jobId: payload.jobId,
        playerTrackCount: finalUpdate.record.player_track_count,
      });

      return {
        ballTrackCount: result.ballTrack.length,
        cloudflareUid: payload.cloudflareUid,
        detectionCount: result.detectionCount,
        frameCount: result.frameCount,
        focusPlayerTrackId: result.focusPlayerTrackId ?? null,
        jobId: payload.jobId,
        replayCloudflareUid,
        status: "replay_ready",
      };
    } catch (error) {
      if (processingWorkDir) {
        await fs.rm(processingWorkDir, { force: true, recursive: true }).catch(() => null);
        processingWorkDir = undefined;
      }
      const reason = error instanceof Error ? error.message : String(error);
      try {
        await persistAxisVideoJobUpdate("PROCESSING_MARK_FAILED", payload.jobId, {
          error: reason,
          processing_stage: "failed",
          progress: 0,
          status: "failed",
        });
      } catch (persistenceError) {
        console.error("AXIS_VIDEO_PROCESSING_FAILED_STATUS_WRITE_FAILED", {
          cloudflareUid: payload.cloudflareUid,
          jobId: payload.jobId,
          reason: persistenceError instanceof Error ? persistenceError.message : String(persistenceError),
        });
      }
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

async function persistAxisVideoJobUpdate(stage: string, jobId: string, patch: Partial<AxisVideoJobRecord>) {
  const result = await updateAxisVideoJob(jobId, patch);
  if (!result.stored) {
    console.error("AXIS_VIDEO_JOB_UPDATE_FAILED", {
      code: result.code,
      details: result.details ?? null,
      hint: result.hint ?? null,
      jobId,
      message: result.message ?? result.reason,
      payload: patch,
      reason: result.reason,
      stage,
      table: "axis_video_jobs",
      where: { job_id: jobId },
    });
    throw new Error(`${stage}: ${result.code}: ${result.reason}`);
  }

  console.log("AXIS_VIDEO_JOB_UPDATE_STORED", {
    ballTrackCount: result.record.ball_track_count,
    jobId,
    processingStage: result.record.processing_stage,
    progress: result.record.progress,
    stage,
    status: result.record.status,
  });
  return result;
}

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function logAxisVideoProcessingMemory(stage: string, details: Record<string, unknown> = {}) {
  const memory = process.memoryUsage();
  console.log("AXIS_VIDEO_PROCESSING_MEMORY", {
    ...details,
    external: memory.external,
    heap_total: memory.heapTotal,
    heap_used: memory.heapUsed,
    rss: memory.rss,
    stage,
  });
}
