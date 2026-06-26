// Shared TwelveLabs types and provider functions.
// Consumed by trigger/deep-watch.ts (polling + analysis) and
// src/app/api/axis/watch/route.ts (index creation + video upload).

export type CandidateLabel =
  | "person_visible"
  | "group_action"
  | "player_action"
  | "spacing_issue"
  | "speed_change"
  | "teaching_moment"
  | "breakdown"
  | "clean_sequence"
  | "unclear";

export type CandidateMoment = {
  confidence: number;
  id: string;
  labels: CandidateLabel[];
  needsReview: boolean;
  note: string;
  timestampSeconds: number;
  title: string;
};

export type WatchResponse = {
  candidates: Array<{ id: string; note: string; timestampSeconds: number; title: string }>;
  candidateMoments: CandidateMoment[];
  clipSummary: string;
  frameCount: number;
  limitations: string[];
  needsReviewCount: number;
  peopleSummary: string;
  provider?: "fast_watch" | "deep_watch" | "fallback";
  suggestedNextQueries: string[];
};

type TwelveLabsTaskStatus = "pending" | "indexing" | "ready" | "failed" | "error";

type TwelveLabsTask = {
  _id: string;
  status: TwelveLabsTaskStatus;
  video_id?: string;
};

type TwelveLabsChapter = {
  start: number;
  end: number;
  title: string;
  summary: string;
};

type TwelveLabsAnalyzeResponse = {
  chapters?: TwelveLabsChapter[];
  clipSummary?: string;
  limitations?: string[];
  peopleSummary?: string;
  suggestedQueries?: string[];
};

export const CANDIDATE_LABELS = new Set<CandidateLabel>([
  "person_visible",
  "group_action",
  "player_action",
  "spacing_issue",
  "speed_change",
  "teaching_moment",
  "breakdown",
  "clean_sequence",
  "unclear",
]);

export const LOW_CONFIDENCE_THRESHOLD = 0.65;

const TWELVELABS_BASE = "https://api.twelvelabs.io/v1.3";
const TL_POLL_INTERVAL_MS = 8_000;
const TL_MAX_POLLS = 30;

// ─── TwelveLabs API calls ─────────────────────────────────────────────────────

export async function createTwelveLabsIndex(apiKey: string, name: string): Promise<string> {
  const response = await fetch(`${TWELVELABS_BASE}/indexes`, {
    body: JSON.stringify({
      index_name: name.slice(0, 60),
      models: [{ model_name: "pegasus1.2", model_options: ["visual", "audio"] }],
    }),
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    method: "POST",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TwelveLabs index creation failed: ${response.status} ${text.slice(0, 80)}`);
  }

  const data = (await response.json()) as { _id: string };
  return data._id;
}

export async function uploadVideoToIndex(
  apiKey: string,
  indexId: string,
  videoBlob: Blob,
  clipName: string,
): Promise<string> {
  const fileName = /\.(mp4|webm|mov|avi|mkv)$/i.test(clipName) ? clipName : `${clipName}.mp4`;
  const form = new FormData();
  form.append("video_file", videoBlob, fileName);
  form.append("index_id", indexId);
  form.append("language", "en");

  const response = await fetch(`${TWELVELABS_BASE}/tasks`, {
    body: form,
    headers: { "x-api-key": apiKey },
    method: "POST",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TwelveLabs upload failed: ${response.status} ${text.slice(0, 120)}`);
  }

  const data = (await response.json()) as { _id: string };
  return data._id;
}

export async function pollTaskUntilReady(apiKey: string, taskId: string): Promise<string> {
  for (let attempt = 0; attempt < TL_MAX_POLLS; attempt++) {
    await sleep(TL_POLL_INTERVAL_MS);

    let taskResponse: Response;
    try {
      taskResponse = await fetch(`${TWELVELABS_BASE}/tasks/${taskId}`, {
        headers: { "x-api-key": apiKey },
      });
    } catch {
      continue;
    }

    if (!taskResponse.ok) continue;

    const task = (await taskResponse.json()) as TwelveLabsTask;

    if (task.status === "ready" && task.video_id) return task.video_id;
    if (task.status === "failed" || task.status === "error") {
      throw new Error(`TwelveLabs task failed: ${task.status}`);
    }
  }

  throw new Error("TwelveLabs task timed out.");
}

export async function analyzeWithTwelveLabs(
  apiKey: string,
  videoId: string,
  query: string,
  clipName: string,
): Promise<TwelveLabsAnalyzeResponse> {
  const prompt = `You are reviewing basketball footage for a coach. Clip: ${clipName}. Coach query: ${query}.

Return ONLY valid JSON — no markdown fences, no prose before or after:
{
  "clipSummary": "one sentence about what is visible overall",
  "peopleSummary": "one sentence about group shape or visible people; say unclear if unclear",
  "chapters": [
    {"start": 0.0, "end": 5.0, "title": "short coach-facing title", "summary": "what a coach should review here, tied to visible evidence only"}
  ],
  "limitations": ["one short limitation about what could not be assessed"],
  "suggestedQueries": ["one follow-up query for the coach"]
}

Rules: no identity claims, no score claims, no shot-result or rim claims.`;

  const response = await fetch(`${TWELVELABS_BASE}/analyze`, {
    body: JSON.stringify({ video_id: videoId, prompt }),
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    method: "POST",
  });

  if (!response.ok || !response.body) return {};

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n").filter(Boolean)) {
      try {
        const event = JSON.parse(line) as { event_type: string; text?: string };
        if (event.event_type === "text_generation" && event.text) fullText += event.text;
      } catch {
        // partial line between SSE chunks
      }
    }
  }

  return parseTwelveLabsAnalyzeResponse(fullText);
}

function parseTwelveLabsAnalyzeResponse(raw: string): TwelveLabsAnalyzeResponse {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const json = start >= 0 && end >= start ? raw.slice(start, end + 1) : raw;
    return JSON.parse(json) as TwelveLabsAnalyzeResponse;
  } catch {
    return {};
  }
}

// ─── Normalization ────────────────────────────────────────────────────────────

export function buildTwelveLabsWatchResponse(
  query: string,
  clipName: string,
  analysis: TwelveLabsAnalyzeResponse,
): WatchResponse {
  const rawChapters = Array.isArray(analysis.chapters) ? analysis.chapters : [];
  const moments = rawChapters
    .map((chapter, index) => normalizeTwelveLabsChapter(chapter, index, query))
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
    .slice(0, 10)
    .map((moment, index) => ({ ...moment, id: `candidate-${index + 1}` }));

  if (moments.length === 0) {
    return {
      candidates: [],
      candidateMoments: [],
      clipSummary: `TwelveLabs reviewed ${clipName} but no moments were identified.`,
      frameCount: 0,
      limitations: ["The analysis did not produce structured moments. Try a more specific query."],
      needsReviewCount: 0,
      peopleSummary: "Could not assess visible people or spacing.",
      provider: "fallback",
      suggestedNextQueries: createSuggestedNextQueries(query),
    };
  }

  const clipSummary =
    typeof analysis.clipSummary === "string" && analysis.clipSummary.trim()
      ? ensurePeriod(analysis.clipSummary.trim())
      : `TwelveLabs reviewed the full clip from ${clipName}.`;

  const peopleSummary =
    typeof analysis.peopleSummary === "string" && analysis.peopleSummary.trim()
      ? ensurePeriod(analysis.peopleSummary.trim())
      : "Visible people and group shape need coach review.";

  const limitations = normalizeStringArray(analysis.limitations).slice(0, 4);
  const suggestedNextQueries = normalizeStringArray(analysis.suggestedQueries).slice(0, 4);

  return {
    candidates: moments.map(({ id, note, timestampSeconds, title }) => ({ id, note, timestampSeconds, title })),
    candidateMoments: moments,
    clipSummary,
    frameCount: 0,
    limitations:
      limitations.length > 0
        ? limitations
        : ["TwelveLabs analyzed the full uploaded clip. Each moment should be confirmed by a coach."],
    needsReviewCount: moments.filter((m) => m.needsReview).length,
    peopleSummary,
    provider: "deep_watch",
    suggestedNextQueries: suggestedNextQueries.length > 0 ? suggestedNextQueries : createSuggestedNextQueries(query),
  };
}

function normalizeTwelveLabsChapter(chapter: TwelveLabsChapter, index: number, query: string): CandidateMoment {
  const combinedText = `${chapter.title} ${chapter.summary}`.toLowerCase();
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const queryMatches = queryWords.filter((word) => combinedText.includes(word)).length;
  const relevanceRatio = queryWords.length > 0 ? queryMatches / queryWords.length : 0;

  const confidence = relevanceRatio >= 0.5 ? 0.74 : relevanceRatio > 0 ? 0.58 : 0.44;
  const needsReview = confidence < LOW_CONFIDENCE_THRESHOLD;

  return {
    confidence,
    id: `candidate-${index + 1}`,
    labels: deriveLabelsFromText(combinedText),
    needsReview,
    note: (chapter.summary || "Review this segment for coaching cues.").slice(0, 280),
    timestampSeconds: Number(chapter.start.toFixed(1)),
    title: (chapter.title || `Segment ${index + 1}`).slice(0, 80),
  };
}

function deriveLabelsFromText(text: string): CandidateLabel[] {
  const labels: CandidateLabel[] = [];
  if (text.includes("spacing") || text.includes("spread") || text.includes("floor")) labels.push("spacing_issue");
  if (text.includes("breakdown") || text.includes("mistake") || text.includes("turnover")) labels.push("breakdown");
  if (text.includes("fast") || text.includes("transition") || text.includes("sprint")) labels.push("speed_change");
  if (text.includes("player") || text.includes("dribble") || text.includes("drive")) labels.push("player_action");
  if (text.includes("group") || text.includes("team") || text.includes("offense") || text.includes("defense"))
    labels.push("group_action");
  if (text.includes("teach") || text.includes("example") || text.includes("moment") || text.includes("key"))
    labels.push("teaching_moment");
  if (labels.length === 0) labels.push("unclear");
  return Array.from(new Set(labels)).slice(0, 4) as CandidateLabel[];
}

// ─── Shared utilities ─────────────────────────────────────────────────────────

export function createSuggestedNextQueries(query: string): string[] {
  const normalized = query.toLowerCase();
  if (normalized.includes("spacing")) {
    return [
      "Watch the same clip for weak-side spacing.",
      "Find the cleanest teaching moment.",
      "Check where the action breaks down.",
    ];
  }
  return [
    "Find the clearest teaching moment.",
    "Watch for group spacing.",
    "Find any unclear sequences that need review.",
  ];
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function ensurePeriod(text: string): string {
  return text.endsWith(".") || text.endsWith("!") || text.endsWith("?") ? text : `${text}.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
