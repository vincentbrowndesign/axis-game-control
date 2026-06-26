// AxisWatchCompiler translates open-ended user asks into internal basketball watches.
// It keeps prompt sharpening inside Axis instead of asking the user for a better prompt.

export type WatchPrimitive = "how" | "result" | "what" | "when" | "where" | "who";

export type BasketballWatch =
  | "action"
  | "movement_v0"
  | "people"
  | "player_lock"
  | "report"
  | "shot_v0"
  | "spacing";

export type ProviderRoute = "openai" | "twelvelabs" | "twelvelabs+cv" | "twelvelabs+openai";

export type WatchConfidenceRule = {
  autoAcceptAbove: number;
  needsReviewBelow: number;
  watch: BasketballWatch;
};

export type AxisWatchCompilerCvContext = {
  avgPeopleCount?: number;
  ballDetected?: boolean;
  classCounts?: Record<string, number>;
  failReason?: string;
  framesWithDetections?: number;
  framesWithPeople?: number;
  maxPeopleCount?: number;
  provider?: string;
  reason?: string;
  status?: string;
  totalDetections?: number;
  totalFrames?: number;
  usableFrameCount?: number;
};

export type AxisWatchCompilerInput = {
  clipMetadata?: { durationSeconds?: number; name?: string };
  cvContext?: AxisWatchCompilerCvContext;
  knownPlayerLabels?: string[];
  routineContext?: string;
  userQuery: string;
};

export type AxisVisibilityContext = {
  ball: "not_visible" | "unknown" | "visible";
  cameraMotion: "likely_motion" | "stable_or_unknown";
  frameQuality: "limited" | "usable" | "unknown";
  people: "not_visible" | "unknown" | "visible";
  rimOrObject: "not_visible" | "unknown" | "visible";
};

export type EvidenceGoal = {
  description: string;
  mustAvoid: string[];
  watch: BasketballWatch;
};

export type RepairPlan = {
  enabled: boolean;
  steps: Array<"general_play_analysis" | "focused_event_pass" | "cv_only_summary" | "provider_second_pass">;
};

export type CompiledWatchPlan = {
  compiledIntent: string;
  confidenceRules: WatchConfidenceRule[];
  evidenceGoals: EvidenceGoal[];
  expectedOutputGroups: string[];
  prompt: string;
  providerRoute: ProviderRoute;
  repairPlan: RepairPlan;
  selectedWatches: BasketballWatch[];
  visibility: AxisVisibilityContext;
  watches: BasketballWatch[];
};

const SPACING_KEYS = ["spacing", "spread", "floor", "wide", "close", "distance", "zone", "gap", "crowd", "open", "weak side", "strong side"];
const ACTION_KEYS = ["allow", "allowed", "points", "teach", "teaching", "moment", "breakdown", "example", "find", "look", "what happened", "delta", "set", "play", "offense", "defense"];
const SHOT_V0_KEYS = ["release", "shot", "attempt", "score", "basket", "make", "miss", "finish", "layup", "drive", "post", "three", "pull up"];
const MOVEMENT_V0_KEYS = ["transition", "fast break", "sprint", "run", "movement", "pace", "speed", "tempo", "cut", "backdoor"];
const PLAYER_LOCK_KEYS = ["who", "player", "person", "number", "jersey", "him", "her", "they", "individual", "guard", "forward", "center"];
const REPORT_KEYS = ["caption", "captions", "report", "review", "summary", "overview", "everything", "whole", "all", "general", "watch this", "here", "this clip", "happened"];

const CONFIDENCE_RULES: Record<BasketballWatch, WatchConfidenceRule> = {
  action: { autoAcceptAbove: 0.70, needsReviewBelow: 0.55, watch: "action" },
  movement_v0: { autoAcceptAbove: 0.65, needsReviewBelow: 0.50, watch: "movement_v0" },
  people: { autoAcceptAbove: 0.70, needsReviewBelow: 0.55, watch: "people" },
  player_lock: { autoAcceptAbove: 0.80, needsReviewBelow: 0.65, watch: "player_lock" },
  report: { autoAcceptAbove: 0.65, needsReviewBelow: 0.50, watch: "report" },
  shot_v0: { autoAcceptAbove: 0.68, needsReviewBelow: 0.50, watch: "shot_v0" },
  spacing: { autoAcceptAbove: 0.72, needsReviewBelow: 0.55, watch: "spacing" },
};

export class AxisWatchCompiler {
  compile(input: AxisWatchCompilerInput): CompiledWatchPlan {
    const query = input.userQuery.trim() || "What happened?";
    const normalized = query.toLowerCase();
    const clipName = input.clipMetadata?.name ?? "Axis clip";
    const visibility = inferVisibility(input.cvContext);
    const selectedWatches = selectWatches(normalized, visibility);
    const evidenceGoals = selectedWatches.map((watch) => buildEvidenceGoal(watch, visibility));
    const expectedOutputGroups = selectedWatches.map(watchToGroupLabel);
    const confidenceRules = selectedWatches.map((watch) => CONFIDENCE_RULES[watch]);
    const compiledIntent = buildIntent(selectedWatches, query);
    const providerRoute = selectProviderRoute(selectedWatches, visibility);
    const repairPlan: RepairPlan = {
      enabled: true,
      steps: ["general_play_analysis", "focused_event_pass", "cv_only_summary", "provider_second_pass"],
    };
    const prompt = buildWatchPrompt({
      clipName,
      evidenceGoals,
      knownPlayerLabels: input.knownPlayerLabels ?? [],
      query,
      routineContext: input.routineContext,
      selectedWatches,
      visibility,
    });

    return {
      compiledIntent,
      confidenceRules,
      evidenceGoals,
      expectedOutputGroups,
      prompt,
      providerRoute,
      repairPlan,
      selectedWatches,
      visibility,
      watches: selectedWatches,
    };
  }
}

export function compileWatchPlan(
  query: string,
  clipMetadata?: { durationSeconds?: number; name?: string },
  routineContext?: string,
  cvContext?: AxisWatchCompilerCvContext,
  knownPlayerLabels?: string[],
): CompiledWatchPlan {
  return new AxisWatchCompiler().compile({
    clipMetadata,
    cvContext,
    knownPlayerLabels,
    routineContext,
    userQuery: query,
  });
}

export function inferVisibility(cv?: AxisWatchCompilerCvContext): AxisVisibilityContext {
  if (!cv) {
    return {
      ball: "unknown",
      cameraMotion: "stable_or_unknown",
      frameQuality: "unknown",
      people: "unknown",
      rimOrObject: "unknown",
    };
  }

  const usableFrames = cv.usableFrameCount ?? cv.totalFrames ?? 0;
  const totalFrames = cv.totalFrames ?? usableFrames;
  const framesWithPeople = cv.framesWithPeople ?? 0;
  const classCounts = cv.classCounts ?? {};
  const objectCount = Object.entries(classCounts).some(([label, count]) => {
    const normalized = label.toLowerCase();
    return count > 0 && !normalized.includes("person") && !normalized.includes("sports ball");
  });

  return {
    ball: cv.ballDetected || (classCounts["sports ball"] ?? 0) > 0 ? "visible" : usableFrames > 0 ? "not_visible" : "unknown",
    cameraMotion: totalFrames >= 24 && (cv.framesWithDetections ?? 0) > 0 ? "stable_or_unknown" : "likely_motion",
    frameQuality: usableFrames >= 12 ? "usable" : usableFrames > 0 || cv.reason ? "limited" : "unknown",
    people: (cv.maxPeopleCount ?? 0) > 0 || framesWithPeople > 0 ? "visible" : usableFrames >= 12 ? "not_visible" : "unknown",
    rimOrObject: objectCount ? "visible" : "unknown",
  };
}

function selectWatches(normalized: string, visibility: AxisVisibilityContext): BasketballWatch[] {
  const watches = new Set<BasketballWatch>();

  if (SPACING_KEYS.some((key) => normalized.includes(key))) watches.add("spacing");
  if (ACTION_KEYS.some((key) => normalized.includes(key))) watches.add("action");
  if (SHOT_V0_KEYS.some((key) => normalized.includes(key))) watches.add("shot_v0");
  if (MOVEMENT_V0_KEYS.some((key) => normalized.includes(key))) watches.add("movement_v0");
  if (PLAYER_LOCK_KEYS.some((key) => normalized.includes(key))) watches.add("people");
  if (REPORT_KEYS.some((key) => normalized.includes(key))) watches.add("report");

  if (visibility.people === "visible") watches.add("people");
  if (visibility.ball === "visible" && (normalized.includes("shot") || normalized.includes("release"))) watches.add("shot_v0");

  if (watches.size === 0 || normalized.length < 18) {
    watches.add("report");
    watches.add("action");
    watches.add("spacing");
  }

  if (normalized.includes("what happened") || normalized === "what happened?") {
    watches.add("movement_v0");
  }

  return [...watches].slice(0, 5);
}

function selectProviderRoute(watches: BasketballWatch[], visibility: AxisVisibilityContext): ProviderRoute {
  if (visibility.frameQuality === "limited") return "twelvelabs+cv";
  if (watches.includes("shot_v0") || watches.includes("people")) return "twelvelabs+cv";
  if (process.env.OPENAI_API_KEY) return "twelvelabs+openai";
  return "twelvelabs";
}

function buildWatchPrompt({
  clipName,
  evidenceGoals,
  knownPlayerLabels,
  query,
  routineContext,
  selectedWatches,
  visibility,
}: {
  clipName: string;
  evidenceGoals: EvidenceGoal[];
  knownPlayerLabels: string[];
  query: string;
  routineContext?: string;
  selectedWatches: BasketballWatch[];
  visibility: AxisVisibilityContext;
}): string {
  const context = routineContext ? `\nCoach context: ${routineContext}` : "";
  const labels = knownPlayerLabels.length ? `\nKnown visible labels to preserve if the user supplied them: ${knownPlayerLabels.join(", ")}` : "";
  const focusLines = selectedWatches.map(watchToInstruction).join("\n");
  const goalLines = evidenceGoals.map((goal) => `- ${goal.description}`).join("\n");

  return `You are Axis, a basketball evidence engine. The user may ask openly; do not ask them to sharpen the prompt. Internally compile the request into cautious basketball evidence.

Clip: ${clipName}
User ask: ${query}${context}${labels}

CV visibility context:
- People: ${visibility.people}
- Ball: ${visibility.ball}
- Rim/object: ${visibility.rimOrObject}
- Frame quality: ${visibility.frameQuality}
- Camera motion: ${visibility.cameraMotion}

Selected watches:
${focusLines}

Evidence goals:
${goalLines}

Return ONLY valid JSON, no markdown:
{
  "clipSummary": "one sentence about what is visible overall",
  "peopleSummary": "one sentence about visible people or group shape; say unclear if unclear",
  "chapters": [
    {"start": 0.0, "end": 5.0, "title": "short coach-facing title", "summary": "what a coach should review here, tied to visible evidence only"}
  ],
  "limitations": ["one short limitation about what could not be assessed"],
  "suggestedQueries": ["one useful follow-up query"]
}

Rules:
- Do not ask for a sharper question.
- No identity claims unless the user supplied a label.
- No fake stats, score claims, shot-result certainty, rim certainty, or ball certainty.
- For shot/release requests, describe visible body mechanics or visible attempt cues only.
- If evidence is thin, return broad reviewable moments and limitations instead of empty output.
- Max 8 chapters.`;
}

function buildEvidenceGoal(watch: BasketballWatch, visibility: AxisVisibilityContext): EvidenceGoal {
  const mustAvoid = ["identity claims", "fake stats", "shot-result certainty", "rim certainty", "unsupported ball certainty"];
  switch (watch) {
    case "people":
      return { description: `Find visible people and group shape; people visibility is ${visibility.people}.`, mustAvoid, watch };
    case "spacing":
      return { description: "Find spacing, gaps, clustering, and floor balance that a coach can review.", mustAvoid, watch };
    case "shot_v0":
      return { description: `Find visible release or attempt cues; ball visibility is ${visibility.ball}.`, mustAvoid, watch };
    case "movement_v0":
      return { description: `Find pace changes, transitions, and movement paths; camera motion is ${visibility.cameraMotion}.`, mustAvoid, watch };
    case "action":
      return { description: "Find what allowed the play to develop: timing, advantage, defensive reaction, or breakdown.", mustAvoid, watch };
    case "player_lock":
      return { description: "Find visible individual actions without naming or identifying the player.", mustAvoid, watch };
    case "report":
      return { description: `Build a cautious report or caption from visible evidence; frame quality is ${visibility.frameQuality}.`, mustAvoid, watch };
  }
}

function watchToInstruction(watch: BasketballWatch): string {
  switch (watch) {
    case "people":
      return "- People: describe visible players/group shape without identity claims.";
    case "spacing":
      return "- Spacing: note clustering, open gaps, weak-side balance, and floor compression.";
    case "action":
      return "- Action: identify visible events, decisions, advantage creation, and breakdowns.";
    case "shot_v0":
      return "- Shot/release: describe visible release mechanics or attempt cues only; no make/miss.";
    case "movement_v0":
      return "- Movement: track group transitions, pace shifts, cuts, and resets.";
    case "player_lock":
      return "- Individual: note visible individual actions only; no name, jersey, or identity claims.";
    case "report":
      return "- Report: broad sweep for caption/report-ready evidence and coach review points.";
  }
}

export function watchToGroupLabel(watch: BasketballWatch): string {
  switch (watch) {
    case "people":
      return "People";
    case "spacing":
      return "Spacing";
    case "action":
      return "Teaching moments";
    case "shot_v0":
      return "Shot/release";
    case "movement_v0":
      return "Movement";
    case "player_lock":
      return "Individual";
    case "report":
      return "Report";
  }
}

function buildIntent(watches: BasketballWatch[], query: string): string {
  const phrases = watches.map(watchToIntentPhrase);
  const prefix = query.toLowerCase().includes("caption") ? "Axis is building a caption from" : "Axis is watching";
  if (phrases.length === 0) return `${prefix} the clip.`;
  if (phrases.length === 1) return `${prefix} for ${phrases[0]}.`;
  const last = phrases[phrases.length - 1];
  return `${prefix} for ${phrases.slice(0, -1).join(", ")}, and ${last}.`;
}

function watchToIntentPhrase(watch: BasketballWatch): string {
  switch (watch) {
    case "people":
      return "visible people and group shape";
    case "spacing":
      return "spacing and floor balance";
    case "action":
      return "what allowed the play to happen";
    case "shot_v0":
      return "shot release cues";
    case "movement_v0":
      return "movement and pace changes";
    case "player_lock":
      return "individual visible actions";
    case "report":
      return "a useful basketball report";
  }
}
