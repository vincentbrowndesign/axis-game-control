import { logger, task } from "@trigger.dev/sdk/v3";
import OpenAI from "openai";

import {
  WATCH_FAILURE_MESSAGES,
  analyzeWithTwelveLabs,
  buildCvEvidenceWatchResponse,
  buildTwelveLabsWatchResponse,
  deleteTwelveLabsIndex,
  pollTaskUntilReady,
  type CvEvidenceSummary,
  type WatchFailureReason,
  type WatchResponse,
} from "../src/lib/axis/deep-watch-provider";
import type { EvidenceGoal, ProviderRoute, RepairPlan } from "../src/lib/axis/watch-compiler";

export type DeepWatchPayload = {
  clipName: string;
  compiledIntent?: string;
  compiledPrompt?: string;
  compiledWatches?: string[];
  cvContext?: CvEvidenceSummary;
  evidenceGoals?: EvidenceGoal[];
  indexId: string;
  providerRoute?: ProviderRoute;
  query: string;
  repairPlan?: RepairPlan;
  tlTaskId: string;
};

export const deepWatchClip = task({
  id: "deep-watch-clip",
  maxDuration: 300,
  run: async (payload: DeepWatchPayload): Promise<WatchResponse> => {
    const apiKey = process.env.TWELVELABS_API_KEY;
    if (!apiKey) throw new Error("TWELVELABS_API_KEY not configured");

    const {
      clipName,
      compiledIntent,
      compiledPrompt,
      compiledWatches,
      cvContext,
      indexId,
      providerRoute,
      query,
      repairPlan,
      tlTaskId,
    } = payload;

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
        return buildFailedWatchResponse(reason, compiledIntent, query, clipName, cvContext, compiledWatches);
      }

      // Phase 2: analyze with compiled prompt if available, fallback to generic
      logger.info("deep-watch: analyzing", { videoId, watches: compiledWatches });
      let analysis;
      try {
        analysis = await analyzeWithTwelveLabs(apiKey, videoId, query, clipName, compiledPrompt);
      } catch {
        logger.warn("deep-watch: analyze failed");
        return buildFailedWatchResponse("analyze_failed", compiledIntent, query, clipName, cvContext, compiledWatches);
      }

      // Phase 3: normalize — pass compiled context for intent + grouping
      const result = buildTwelveLabsWatchResponse(query, clipName, analysis, compiledIntent, compiledWatches);
      if (result.provider === "fallback") {
        logger.warn("deep-watch: parse produced no moments; repairing", { providerRoute, repairPlan });
        return repairDeepWatch({
          apiKey,
          clipName,
          compiledIntent,
          compiledWatches,
          cvContext,
          query,
          videoId,
        });
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

async function repairDeepWatch({
  apiKey,
  clipName,
  compiledIntent,
  compiledWatches,
  cvContext,
  query,
  videoId,
}: {
  apiKey: string;
  clipName: string;
  compiledIntent?: string;
  compiledWatches?: string[];
  cvContext?: CvEvidenceSummary;
  query: string;
  videoId: string;
}): Promise<WatchResponse> {
  const repairPrompts = [
    buildGeneralRepairPrompt(query, clipName, cvContext),
    buildFocusedEventRepairPrompt(query, clipName, cvContext),
  ];

  for (const prompt of repairPrompts) {
    try {
      const analysis = await analyzeWithTwelveLabs(apiKey, videoId, query, clipName, prompt);
      const repaired = buildTwelveLabsWatchResponse(query, clipName, analysis, compiledIntent, compiledWatches);
      if (repaired.candidateMoments.length > 0) {
        logger.info("deep-watch: repair produced moments", { candidateCount: repaired.candidateMoments.length });
        return { ...repaired, provider: "deep_watch:repaired" };
      }
    } catch (err) {
      logger.warn("deep-watch: repair pass failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }

  const cvOnly = buildCvEvidenceWatchResponse({ clipName, compiledIntent, cvContext, expectedOutputGroups: compiledWatches, query });
  const secondPass = await runOptionalSecondPassCheck(query, clipName, compiledIntent, compiledWatches, cvContext);
  return secondPass ?? cvOnly;
}

function buildFailedWatchResponse(
  reason: WatchFailureReason,
  compiledIntent: string | undefined,
  query: string,
  clipName: string,
  cvContext?: CvEvidenceSummary,
  expectedOutputGroups?: string[],
): WatchResponse {
  if (reason === "analyze_failed" || reason === "parse_failed") {
    return buildCvEvidenceWatchResponse({ clipName, compiledIntent, cvContext, expectedOutputGroups, query });
  }

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

function buildGeneralRepairPrompt(query: string, clipName: string, cvContext?: CvEvidenceSummary) {
  return `You are Axis, a basketball evidence engine. The first watch did not return useful moments, so widen the request automatically.

Clip: ${clipName}
User ask: ${query}
CV context: ${summarizeCvContext(cvContext)}

Find broad basketball play evidence: visible people, spacing, action, movement, and report-ready moments.
Return valid JSON only with clipSummary, peopleSummary, chapters, limitations, suggestedQueries.
Do not ask for a sharper question. No identity claims, fake stats, score claims, shot-result certainty, rim certainty, or unsupported ball certainty.`;
}

function buildFocusedEventRepairPrompt(query: string, clipName: string, cvContext?: CvEvidenceSummary) {
  return `You are Axis, a basketball evidence engine. Run a focused event pass after a broad pass found no structured moments.

Clip: ${clipName}
User ask: ${query}
CV context: ${summarizeCvContext(cvContext)}

Look for three reviewable segments: setup, action, and reset. If shot release is relevant, describe visible body/release cues only.
Return valid JSON only with clipSummary, peopleSummary, chapters, limitations, suggestedQueries.
Do not ask the user to re-prompt. Keep every claim tied to visible evidence.`;
}

function summarizeCvContext(cvContext?: CvEvidenceSummary) {
  if (!cvContext) return "not available";
  return [
    `people max ${cvContext.maxPeopleCount ?? 0}`,
    `frames with people ${cvContext.framesWithPeople ?? 0}/${cvContext.totalFrames ?? 0}`,
    `usable frames ${cvContext.usableFrameCount ?? cvContext.totalFrames ?? 0}`,
    `ball detected ${cvContext.ballDetected ? "yes" : "no"}`,
    `reason ${cvContext.reason ?? cvContext.failReason ?? "none"}`,
  ].join("; ");
}

async function runOptionalSecondPassCheck(
  query: string,
  clipName: string,
  compiledIntent?: string,
  compiledWatches?: string[],
  cvContext?: CvEvidenceSummary,
): Promise<WatchResponse | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      max_tokens: 700,
      messages: [
        {
          content:
            "You are Axis repairing a basketball evidence report. Use only the supplied CV summary and user ask. Return JSON only. Do not invent video details.",
          role: "system",
        },
        {
          content: `Clip: ${clipName}
User ask: ${query}
CV context: ${summarizeCvContext(cvContext)}

Return JSON:
{
  "clipSummary": "one cautious sentence",
  "peopleSummary": "one cautious sentence",
  "chapters": [
    {"start": 0, "end": 5, "title": "short title", "summary": "reviewable evidence summary"}
  ],
  "limitations": ["short limitation"],
  "suggestedQueries": ["next useful query"]
}

Rules: no sharper-question request, no identity claims, no fake stats, no score claims, no shot result, no rim certainty, no unsupported ball certainty.`,
          role: "user",
        },
      ],
      model: "gpt-4o-mini",
      temperature: 0.1,
    });
    const analysis = parseSecondPassAnalysis(completion.choices[0]?.message?.content ?? "");
    const result = buildTwelveLabsWatchResponse(query, clipName, analysis, compiledIntent, compiledWatches);
    return result.candidateMoments.length > 0 ? { ...result, provider: "deep_watch:repaired" } : null;
  } catch (err) {
    logger.warn("deep-watch: optional second-pass failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

function parseSecondPassAnalysis(raw: string) {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const json = start >= 0 && end >= start ? raw.slice(start, end + 1) : raw;
    return JSON.parse(json) as {
      chapters?: Array<{ end: number; start: number; summary: string; title: string }>;
      clipSummary?: string;
      limitations?: string[];
      peopleSummary?: string;
      suggestedQueries?: string[];
    };
  } catch {
    return {};
  }
}
