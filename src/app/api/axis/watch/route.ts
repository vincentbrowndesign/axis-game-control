import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";
import OpenAI from "openai";

import {
  CANDIDATE_LABELS,
  LOW_CONFIDENCE_THRESHOLD,
  createSuggestedNextQueries,
  createTwelveLabsIndex,
  normalizeStringArray,
  uploadVideoToIndex,
  type CandidateLabel,
  type CandidateMoment,
  type WatchResponse,
} from "../../../../lib/axis/deep-watch-provider";
import type { DeepWatchPayload } from "../../../../../trigger/deep-watch";

export const runtime = "nodejs";
export const maxDuration = 300;

// ─── Route-local types ────────────────────────────────────────────────────────

type WatchFrame = {
  imageDataUrl?: string;
  timestampSeconds: number;
};

type WatchRequest = {
  clipMetadata?: { durationSeconds?: unknown; name?: unknown };
  clipName?: unknown;
  frames?: WatchFrame[];
  query?: string;
};

type ProviderPayload = {
  candidateMoments?: unknown;
  clipSummary?: unknown;
  limitations?: unknown;
  peopleSummary?: unknown;
  suggestedNextQueries?: unknown;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_REQUEST_FRAMES = 60;
const MAX_PROVIDER_FRAMES = 18;
const PROVIDER_BATCH_SIZE = 6;

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return handleDeepWatch(request);
  }

  return handleFastWatch(request);
}

// ─── Fast Watch (OpenAI sampled frames) ───────────────────────────────────────

async function handleFastWatch(request: Request) {
  let body: WatchRequest;

  try {
    body = (await request.json()) as WatchRequest;
  } catch {
    return NextResponse.json({ error: "Invalid watch request." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const frames = Array.isArray(body.frames)
    ? body.frames.slice(0, MAX_REQUEST_FRAMES).filter((frame) => isWatchFrame(frame))
    : [];

  if (!query || frames.length === 0) {
    return NextResponse.json({ error: "Add a clip and query before watching." }, { status: 400 });
  }

  const clipName = getClipName(body);
  const fallback = createFallbackWatchResponse(query, frames, clipName, "fallback");

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(fallback);
  }

  try {
    const providerResponse = await watchFramesWithOpenAI(query, frames, clipName);
    return NextResponse.json(providerResponse);
  } catch {
    return NextResponse.json(fallback);
  }
}

async function watchFramesWithOpenAI(query: string, frames: WatchFrame[], clipName: string): Promise<WatchResponse> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const selectedFrames = selectProviderFrames(frames, MAX_PROVIDER_FRAMES);
  const batches = chunk(selectedFrames, PROVIDER_BATCH_SIZE);
  const batchResults: ProviderPayload[] = [];

  for (const batch of batches) {
    const completion = await openai.chat.completions.create({
      max_tokens: 900,
      messages: [
        {
          content:
            "You are Axis, a basketball footage review assistant. Watch sampled frames and return only cautious, reviewable moments. Do not identify people. Do not claim makes, misses, rim, ball, shot stats, scores, or exact tactics unless visible. Low confidence or unclear evidence must set needsReview true.",
          role: "system",
        },
        {
          content: [
            { text: buildVisionPrompt(query, clipName, frames.length, batch), type: "text" },
            ...batch.map((frame) => ({
              image_url: { detail: "low" as const, url: frame.imageDataUrl || "" },
              type: "image_url" as const,
            })),
          ],
          role: "user",
        },
      ],
      model: "gpt-4o-mini",
      temperature: 0.1,
    });

    batchResults.push(parseProviderPayload(completion.choices[0]?.message?.content ?? "{}"));
  }

  return normalizeOpenAIWatchResponse(query, frames, clipName, batchResults);
}

function buildVisionPrompt(query: string, clipName: string, totalFrameCount: number, batch: WatchFrame[]) {
  const timestamps = batch.map((frame, index) => `${index + 1}: ${frame.timestampSeconds.toFixed(2)}s`).join("\n");

  return `Clip: ${clipName}
Coach query: ${query}
Total sampled frames available: ${totalFrameCount}
This batch timestamps:
${timestamps}

Return valid JSON only:
{
  "clipSummary": "one plain sentence about what is visible in this batch",
  "peopleSummary": "one plain sentence about visible people or group shape; say unclear if unclear",
  "candidateMoments": [
    {
      "title": "short coach-facing title",
      "note": "what to review at this timestamp, tied only to visible evidence",
      "timestampSeconds": 0,
      "confidence": 0.0,
      "needsReview": true,
      "labels": ["person_visible" | "group_action" | "player_action" | "spacing_issue" | "speed_change" | "teaching_moment" | "breakdown" | "clean_sequence" | "unclear"]
    }
  ],
  "limitations": ["short limitation"],
  "suggestedNextQueries": ["next useful query"]
}

Rules:
- Use only these labels: person_visible, group_action, player_action, spacing_issue, speed_change, teaching_moment, breakdown, clean_sequence, unclear.
- Max 3 candidateMoments for this batch.
- Prefer timestamps from the supplied batch list.
- If confidence is below ${LOW_CONFIDENCE_THRESHOLD}, needsReview must be true.
- If the clip is unclear, return an unclear candidate instead of inventing detail.`;
}

function normalizeOpenAIWatchResponse(
  query: string,
  frames: WatchFrame[],
  clipName: string,
  payloads: ProviderPayload[],
): WatchResponse {
  const duration = getClipDuration(frames);
  const moments = payloads
    .flatMap((payload) => normalizeCandidateMoments(payload.candidateMoments, duration))
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
    .slice(0, 8)
    .map((moment, index) => ({ ...moment, id: `candidate-${index + 1}` }));

  if (moments.length === 0) {
    return createFallbackWatchResponse(query, frames, clipName, "fallback");
  }

  const limitations = uniqueStrings(payloads.flatMap((payload) => normalizeStringArray(payload.limitations))).slice(0, 5);
  const suggestedNextQueries = uniqueStrings(
    payloads.flatMap((payload) => normalizeStringArray(payload.suggestedNextQueries)),
  ).slice(0, 4);

  return {
    candidates: moments.map(({ id, note, timestampSeconds, title }) => ({ id, note, timestampSeconds, title })),
    candidateMoments: moments,
    clipSummary: firstString(payloads.map((payload) => payload.clipSummary)) || `Axis reviewed sampled frames from ${clipName}.`,
    frameCount: frames.length,
    limitations:
      limitations.length > 0
        ? limitations
        : ["Axis reviewed sampled frames only, so each candidate should be confirmed by a coach."],
    needsReviewCount: moments.filter((moment) => moment.needsReview).length,
    peopleSummary:
      firstString(payloads.map((payload) => payload.peopleSummary)) ||
      "Visible people or spacing may need coach review.",
    provider: "fast_watch",
    suggestedNextQueries: suggestedNextQueries.length > 0 ? suggestedNextQueries : createSuggestedNextQueries(query),
  };
}

// ─── Deep Watch (TwelveLabs via Trigger.dev) ──────────────────────────────────

async function handleDeepWatch(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid deep watch request." }, { status: 400 });
  }

  const rawQuery = formData.get("query");
  const rawClipName = formData.get("clipName");
  const videoEntry = formData.get("video");

  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  const clipName =
    typeof rawClipName === "string" && rawClipName.trim() ? rawClipName.trim().slice(0, 120) : "Axis clip";

  if (!query || !videoEntry || !(videoEntry instanceof Blob)) {
    return NextResponse.json({ error: "Add a clip and query before watching." }, { status: 400 });
  }

  const apiKey = process.env.TWELVELABS_API_KEY;

  if (!apiKey) {
    // Return a synchronous fallback so the UI can show something immediately.
    const fallback = createFallbackWatchResponse(query, [], clipName, "fallback");
    return NextResponse.json({
      ...fallback,
      limitations: ["TwelveLabs key is not configured. Results are placeholder candidates."],
    });
  }

  try {
    // Upload happens in the route so we can pass a JSON-serializable task ID.
    // Polling and analysis run async in the Trigger.dev task.
    const indexId = await createTwelveLabsIndex(apiKey, `axis-${Date.now()}`);
    const tlTaskId = await uploadVideoToIndex(apiKey, indexId, videoEntry, clipName);

    const handle = await tasks.trigger<typeof import("../../../../../trigger/deep-watch").deepWatchClip>(
      "deep-watch-clip",
      { clipName, indexId, query, tlTaskId } satisfies DeepWatchPayload,
    );

    console.log("[deep-watch] triggered", { clipName, jobId: handle.id, tlTaskId });

    return NextResponse.json({ jobId: handle.id, status: "watching" });
  } catch (err) {
    console.error("[deep-watch] failed to start", err instanceof Error ? err.message : String(err));
    const fallback = createFallbackWatchResponse(query, [], clipName, "fallback");
    return NextResponse.json(fallback);
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function parseProviderPayload(raw: string): ProviderPayload {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const json = start >= 0 && end >= start ? raw.slice(start, end + 1) : raw;
    return JSON.parse(json) as ProviderPayload;
  } catch {
    return {};
  }
}

function normalizeCandidateMoments(candidateMoments: unknown, duration: number): CandidateMoment[] {
  if (!Array.isArray(candidateMoments)) return [];

  return candidateMoments
    .map((candidate, index) => {
      const source = candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : {};
      const confidence = clampNumber(source.confidence, 0, 1, 0.45);
      const labels = normalizeLabels(source.labels);
      const timestampSeconds = clampNumber(source.timestampSeconds, 0, duration, Math.min(duration, index));
      const needsReview =
        Boolean(source.needsReview) || confidence < LOW_CONFIDENCE_THRESHOLD || labels.includes("unclear");

      return {
        confidence,
        id: `candidate-${index + 1}`,
        labels,
        needsReview,
        note: getNonEmptyString(source.note, "Review this visible moment before using it in a report."),
        timestampSeconds: Number(timestampSeconds.toFixed(1)),
        title: getNonEmptyString(source.title, "Candidate moment"),
      };
    })
    .filter((candidate) => candidate.title.length > 0 && candidate.note.length > 0);
}

function createFallbackWatchResponse(
  query: string,
  frames: WatchFrame[],
  clipName: string,
  provider: WatchResponse["provider"],
): WatchResponse {
  const candidateMoments = createFallbackCandidateMoments(query, frames);

  return {
    candidates: candidateMoments.map(({ id, note, timestampSeconds, title }) => ({ id, note, timestampSeconds, title })),
    candidateMoments,
    clipSummary: `Axis prepared review candidates for ${clipName} from the query.`,
    frameCount: frames.length,
    limitations: ["Vision provider was unavailable. These are coarse review prompts based on the query and clip timing."],
    needsReviewCount: candidateMoments.length,
    peopleSummary: "People and actions need coach review before being used as session truth.",
    provider,
    suggestedNextQueries: createSuggestedNextQueries(query),
  };
}

function createFallbackCandidateMoments(query: string, frames: WatchFrame[]): CandidateMoment[] {
  const normalized = query.toLowerCase();
  const duration = getClipDuration(frames);
  const timestamps = pickCandidateTimes(duration, frames);

  if (normalized.includes("spacing") || normalized.includes("delta") || normalized.includes("offense")) {
    return timestamps.map((timestampSeconds, index) => ({
      confidence: 0.35,
      id: `candidate-${index + 1}`,
      labels: index === 0
        ? (["spacing_issue", "teaching_moment"] as CandidateLabel[])
        : (["group_action", "unclear"] as CandidateLabel[]),
      needsReview: true,
      note:
        index === 0
          ? "Check spacing before the action starts. Confirm whether players are crowding the same area."
          : index === 1
            ? "Review the timing of the second option. Confirm whether the advantage appears late."
            : "Check the reset after the action. This may be a useful correction point if the clip supports it.",
      timestampSeconds,
      title: index === 0 ? "Spacing setup" : index === 1 ? "Timing read" : "Reset moment",
    }));
  }

  if (normalized.includes("transition")) {
    return timestamps.map((timestampSeconds, index) => ({
      confidence: 0.35,
      id: `candidate-${index + 1}`,
      labels: ["group_action", "speed_change", "unclear"] as CandidateLabel[],
      needsReview: true,
      note: "Review lane spacing and early decisions before the defense gets set.",
      timestampSeconds,
      title: index === 0 ? "Early lane spacing" : "Transition decision",
    }));
  }

  return timestamps.map((timestampSeconds, index) => ({
    confidence: 0.35,
    id: `candidate-${index + 1}`,
    labels: ["teaching_moment", "unclear"] as CandidateLabel[],
    needsReview: true,
    note: "Review this stretch as a possible coachable moment.",
    timestampSeconds,
    title: index === 0 ? "Candidate moment" : `Candidate moment ${index + 1}`,
  }));
}

function pickCandidateTimes(duration: number, frames: WatchFrame[]) {
  if (frames.length > 0 && frames.length <= 3) return frames.map((frame) => Number(frame.timestampSeconds.toFixed(1)));
  const safeDuration = Math.max(duration, 4);
  return [safeDuration * 0.25, safeDuration * 0.5, safeDuration * 0.75].map((time) => Number(time.toFixed(1)));
}

function selectProviderFrames(frames: WatchFrame[], maxFrames: number) {
  const validFrames = frames.filter(
    (frame) => typeof frame.imageDataUrl === "string" && frame.imageDataUrl.startsWith("data:image/"),
  );
  if (validFrames.length <= maxFrames) return validFrames;

  return Array.from({ length: maxFrames }, (_, index) => {
    const frameIndex = Math.round((index * (validFrames.length - 1)) / (maxFrames - 1));
    return validFrames[frameIndex];
  });
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isWatchFrame(frame: unknown): frame is WatchFrame {
  if (!frame || typeof frame !== "object") return false;
  const candidate = frame as Record<string, unknown>;
  return typeof candidate.timestampSeconds === "number" && Number.isFinite(candidate.timestampSeconds);
}

function getClipName(body: WatchRequest) {
  if (typeof body.clipName === "string" && body.clipName.trim()) return body.clipName.trim().slice(0, 120);
  if (body.clipMetadata && typeof body.clipMetadata.name === "string" && body.clipMetadata.name.trim()) {
    return body.clipMetadata.name.trim().slice(0, 120);
  }
  return "Axis clip";
}

function getClipDuration(frames: WatchFrame[]) {
  return Math.max(1, frames[frames.length - 1]?.timestampSeconds ?? frames.length);
}

function normalizeLabels(labels: unknown): CandidateLabel[] {
  if (!Array.isArray(labels)) return ["unclear"];
  const normalized = labels.filter((label): label is CandidateLabel => CANDIDATE_LABELS.has(label as CandidateLabel));
  return normalized.length > 0 ? Array.from(new Set(normalized)).slice(0, 4) : ["unclear"];
}

function firstString(values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
}

function getNonEmptyString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 280) : fallback;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
}
