// Axis Watch Compiler — translates open queries into structured watch plans.
// Consumed by the watch route (server-side) to shape provider routing and prompts.

export type WatchPrimitive = "how" | "result" | "what" | "when" | "where" | "who";

export type BasketballWatch =
  | "action"       // what — key events, decision points, teaching moments
  | "movement_v0"  // how — group transitions, pace shifts (v0: no individual ID)
  | "player_lock"  // who — visible individual (no jersey, no identity claims)
  | "report"       // meta — broad clip sweep across all categories
  | "shot_v0"      // result — shot attempts (v0: no rim/ball certainty claims)
  | "spacing";     // where — court geometry, floor balance, gaps

export type ProviderRoute = "openai" | "twelvelabs" | "twelvelabs+roboflow";

export type WatchConfidenceRule = {
  autoAcceptAbove: number;
  needsReviewBelow: number;
  watch: BasketballWatch;
};

export type CompiledWatchPlan = {
  compiledIntent: string;
  confidenceRules: WatchConfidenceRule[];
  expectedOutputGroups: string[];
  prompt: string;
  providerRoute: ProviderRoute;
  watches: BasketballWatch[];
};

const SPACING_KEYS = ["spacing", "spread", "floor", "wide", "close", "distance", "zone", "gap", "crowd", "open", "weak side", "strong side"];
const ACTION_KEYS = ["teach", "teaching", "moment", "breakdown", "example", "find", "look", "what happened", "delta", "set", "play", "offense", "defense"];
const SHOT_V0_KEYS = ["shot", "attempt", "score", "basket", "make", "miss", "finish", "layup", "drive", "post", "three", "pull up"];
const MOVEMENT_V0_KEYS = ["transition", "fast break", "sprint", "run", "movement", "pace", "speed", "tempo", "cut", "backdoor"];
const PLAYER_LOCK_KEYS = ["who", "player", "person", "number", "jersey", "him", "her", "they", "individual", "guard", "forward", "center"];
const REPORT_KEYS = ["review", "summary", "overview", "everything", "whole", "all", "general", "watch this", "here", "this clip", "happened"];

const CONFIDENCE_RULES: Record<BasketballWatch, WatchConfidenceRule> = {
  action:      { autoAcceptAbove: 0.70, needsReviewBelow: 0.55, watch: "action" },
  movement_v0: { autoAcceptAbove: 0.65, needsReviewBelow: 0.50, watch: "movement_v0" },
  player_lock: { autoAcceptAbove: 0.80, needsReviewBelow: 0.65, watch: "player_lock" },
  report:      { autoAcceptAbove: 0.65, needsReviewBelow: 0.50, watch: "report" },
  shot_v0:     { autoAcceptAbove: 0.68, needsReviewBelow: 0.50, watch: "shot_v0" },
  spacing:     { autoAcceptAbove: 0.72, needsReviewBelow: 0.55, watch: "spacing" },
};

export function compileWatchPlan(
  query: string,
  clipMetadata?: { durationSeconds?: number; name?: string },
  routineContext?: string,
): CompiledWatchPlan {
  const normalized = query.toLowerCase();
  const clipName = clipMetadata?.name ?? "Axis clip";

  const watches = selectWatches(normalized);
  const prompt = buildWatchPrompt(watches, query, clipName, routineContext);
  const compiledIntent = buildIntent(watches);
  const expectedOutputGroups = watches.map(watchToGroupLabel);
  const confidenceRules = watches.map((w) => CONFIDENCE_RULES[w]);

  // Roboflow precision routing — selected for player_lock and shot_v0 watches
  // when ROBOFLOW_API_KEY is configured. Evidence fetch reserved for future release.
  const wantsObjectPrecision = watches.includes("player_lock") || watches.includes("shot_v0");
  const providerRoute: ProviderRoute =
    wantsObjectPrecision && typeof process !== "undefined" && !!process.env?.ROBOFLOW_API_KEY
      ? "twelvelabs+roboflow"
      : "twelvelabs";

  return { compiledIntent, confidenceRules, expectedOutputGroups, prompt, providerRoute, watches };
}

function selectWatches(normalized: string): BasketballWatch[] {
  const watches = new Set<BasketballWatch>();

  if (SPACING_KEYS.some((k) => normalized.includes(k))) watches.add("spacing");
  if (ACTION_KEYS.some((k) => normalized.includes(k))) watches.add("action");
  if (SHOT_V0_KEYS.some((k) => normalized.includes(k))) watches.add("shot_v0");
  if (MOVEMENT_V0_KEYS.some((k) => normalized.includes(k))) watches.add("movement_v0");
  if (PLAYER_LOCK_KEYS.some((k) => normalized.includes(k))) watches.add("player_lock");
  if (REPORT_KEYS.some((k) => normalized.includes(k))) watches.add("report");

  // Generic query that doesn't trigger specific watches — default to action + spacing
  if (watches.size === 0) {
    watches.add("action");
    watches.add("spacing");
  }

  // Cap at 4 to keep the prompt focused
  return [...watches].slice(0, 4);
}

function buildWatchPrompt(
  watches: BasketballWatch[],
  query: string,
  clipName: string,
  routineContext?: string,
): string {
  const focusLines = watches.map(watchToInstruction).join("\n");
  const context = routineContext ? `\nCoach context: ${routineContext}` : "";

  return `You are reviewing basketball footage for a coach. Clip: ${clipName}. Coach query: ${query}.${context}

Focus on these areas:
${focusLines}

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

Rules: no identity claims, no score claims, no shot-result or rim claims. Max 8 chapters.`;
}

function watchToInstruction(watch: BasketballWatch): string {
  switch (watch) {
    case "spacing":     return "- Spacing: note when players cluster or leave open gaps. Flag floor imbalance.";
    case "action":      return "- Teaching moments: find decision points, breakdowns, and clean sequences.";
    case "shot_v0":     return "- Shot attempts: note visible attempts only. Do not claim makes, misses, or rim outcomes.";
    case "movement_v0": return "- Movement: track group transition patterns and pace changes.";
    case "player_lock": return "- Individual: note visible individual actions. No name, jersey, or identity claims.";
    case "report":      return "- Full review: broad sweep — spacing, transitions, group shape, key events.";
  }
}

export function watchToGroupLabel(watch: BasketballWatch): string {
  switch (watch) {
    case "spacing":     return "Spacing";
    case "action":      return "Teaching moments";
    case "shot_v0":     return "Shot attempts";
    case "movement_v0": return "Transition";
    case "player_lock": return "Individual";
    case "report":      return "Full review";
  }
}

function buildIntent(watches: BasketballWatch[]): string {
  if (watches.length === 0) return "Axis reviewed the clip.";
  const parts = watches.map(watchToIntentPhrase);
  if (parts.length === 1) return `Axis watched for ${parts[0]}.`;
  if (parts.length === 2) return `Axis watched for ${parts[0]} and ${parts[1]}.`;
  const last = parts.pop()!;
  return `Axis watched for ${parts.join(", ")}, and ${last}.`;
}

function watchToIntentPhrase(watch: BasketballWatch): string {
  switch (watch) {
    case "spacing":     return "spacing and floor balance";
    case "action":      return "teaching moments";
    case "shot_v0":     return "shot attempts";
    case "movement_v0": return "transition patterns";
    case "player_lock": return "individual player actions";
    case "report":      return "a full clip review";
  }
}
