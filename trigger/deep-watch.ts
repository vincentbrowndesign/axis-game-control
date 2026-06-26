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
  compiledIntent?: string;
  compiledPrompt?: string;
  compiledWatches?: string[];
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

    const { clipName, compiledIntent, compiledPrompt, compiledWatches, indexId, query, tlTaskId } = payload;

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
        return buildFailedWatchResponse(reason, compiledIntent);
      }

      // Phase 2: analyze with compiled prompt if available, fallback to generic
      logger.info("deep-watch: analyzing", { videoId, watches: compiledWatches });
      let analysis;
      try {
        analysis = await analyzeWithTwelveLabs(apiKey, videoId, query, clipName, compiledPrompt);
      } catch {
        logger.warn("deep-watch: analyze failed");
        return buildFailedWatchResponse("analyze_failed", compiledIntent);
      }

      // Phase 3: normalize — pass compiled context for intent + grouping
      const result = buildTwelveLabsWatchResponse(query, clipName, analysis, compiledIntent, compiledWatches);
      if (result.provider === "fallback") {
        logger.warn("deep-watch: parse produced no moments");
        return buildFailedWatchResponse("parse_failed", compiledIntent);
      }

      logger.info("deep-watch: complete", {
        candidateCount: result.candidateMoments.length,
        groupCount: result.watchGroups?.length ?? 0,
        provider: result.provider,
        watches: compiledWatches,
      });

      return result;
    } finally {
      await deleteTwelveLabsIndex(apiKey, indexId);
      logger.info("deep-watch: index cleaned up", { indexId });
    }
  },
});

function buildFailedWatchResponse(reason: WatchFailureReason, compiledIntent?: string): WatchResponse {
  return {
    candidates: [],
    candidateMoments: [],
    clipSummary: WATCH_FAILURE_MESSAGES[reason],
    compiledIntent,
    failureReason: reason,
    frameCount: 0,
    limitations: [],
    needsReviewCount: 0,
    peopleSummary: "",
    provider: "failed",
    suggestedNextQueries: [],
  };
}
