import { logger, task } from "@trigger.dev/sdk/v3";

import {
  WATCH_FAILURE_MESSAGES,
  analyzeWithTwelveLabs,
  buildTwelveLabsWatchResponse,
  deleteTwelveLabsIndex,
  pollTaskUntilReady,
  type WatchFailureReason,
  type WatchResponse,
} from "../src/lib/axis/deep-watch-provider";

export type DeepWatchPayload = {
  clipName: string;
  indexId: string;
  query: string;
  tlTaskId: string;
};

export const deepWatchClip = task({
  id: "deep-watch-clip",
  maxDuration: 300,
  run: async (payload: DeepWatchPayload): Promise<WatchResponse> => {
    const apiKey = process.env.TWELVELABS_API_KEY;
    if (!apiKey) throw new Error("TWELVELABS_API_KEY not configured");

    const { clipName, indexId, query, tlTaskId } = payload;

    try {
      // Phase 1: poll until TwelveLabs finishes indexing the video
      logger.info("deep-watch: polling task", { tlTaskId });
      let videoId: string;
      try {
        videoId = await pollTaskUntilReady(apiKey, tlTaskId);
      } catch (err) {
        const reason: WatchFailureReason =
          err instanceof Error && err.message.includes("timed out") ? "task_timeout" : "task_failed";
        logger.warn("deep-watch: polling failed", { reason });
        return buildFailedWatchResponse(reason);
      }

      // Phase 2: analyze with TwelveLabs Pegasus
      logger.info("deep-watch: analyzing", { videoId });
      let analysis;
      try {
        analysis = await analyzeWithTwelveLabs(apiKey, videoId, query, clipName);
      } catch {
        logger.warn("deep-watch: analyze failed");
        return buildFailedWatchResponse("analyze_failed");
      }

      // Phase 3: normalize to WatchResponse
      const result = buildTwelveLabsWatchResponse(query, clipName, analysis);
      if (result.provider === "fallback") {
        logger.warn("deep-watch: parse produced no moments");
        return buildFailedWatchResponse("parse_failed");
      }

      logger.info("deep-watch: complete", {
        candidateCount: result.candidateMoments.length,
        provider: result.provider,
      });

      return result;
    } finally {
      // Best-effort cleanup — always runs whether phase succeeded or failed
      await deleteTwelveLabsIndex(apiKey, indexId);
      logger.info("deep-watch: index cleaned up", { indexId });
    }
  },
});

function buildFailedWatchResponse(reason: WatchFailureReason): WatchResponse {
  return {
    candidates: [],
    candidateMoments: [],
    clipSummary: WATCH_FAILURE_MESSAGES[reason],
    failureReason: reason,
    frameCount: 0,
    limitations: [],
    needsReviewCount: 0,
    peopleSummary: "",
    provider: "failed",
    suggestedNextQueries: [],
  };
}
