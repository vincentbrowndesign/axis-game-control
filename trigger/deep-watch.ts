import { logger, task } from "@trigger.dev/sdk/v3";

import {
  analyzeWithTwelveLabs,
  buildTwelveLabsWatchResponse,
  pollTaskUntilReady,
  type WatchResponse,
} from "../src/lib/axis/deep-watch-provider";

export type DeepWatchPayload = {
  clipName: string;
  query: string;
  tlTaskId: string;
};

export const deepWatchClip = task({
  id: "deep-watch-clip",
  maxDuration: 300,
  run: async (payload: DeepWatchPayload): Promise<WatchResponse> => {
    const apiKey = process.env.TWELVELABS_API_KEY;
    if (!apiKey) throw new Error("TWELVELABS_API_KEY not configured");

    const { clipName, query, tlTaskId } = payload;

    logger.info("deep-watch: polling TwelveLabs task", { tlTaskId });
    const videoId = await pollTaskUntilReady(apiKey, tlTaskId);
    logger.info("deep-watch: video ready, starting analysis", { videoId });

    const analysis = await analyzeWithTwelveLabs(apiKey, videoId, query, clipName);
    const result = buildTwelveLabsWatchResponse(query, clipName, analysis);

    logger.info("deep-watch: complete", {
      candidateCount: result.candidateMoments.length,
      provider: result.provider,
    });

    return result;
  },
});
