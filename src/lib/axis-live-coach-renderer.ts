import type { AxisUnderstanding } from "./axis-server";

export interface LiveCoachIntervention {
  belief: string;
  sayThis: string;
  watchFor: string;
  nextRepRule: string;
  readTimeSeconds: number;
}

export type AxisCoachingIntervention = LiveCoachIntervention;

const DEFAULT_INTERVENTION: LiveCoachIntervention = {
  belief: "The next rep needs one focus.",
  sayThis: "One thing. Again.",
  watchFor: "Watch the change.",
  nextRepRule: "Repeat with that focus.",
  readTimeSeconds: 4,
};

export function renderCoachingIntervention(
  understanding: AxisUnderstanding | null | undefined,
): AxisCoachingIntervention {
  return renderLiveCoachIntervention(understanding);
}

export function renderLiveCoachIntervention(
  understanding: AxisUnderstanding | null | undefined,
): LiveCoachIntervention {
  if (!understanding) return DEFAULT_INTERVENTION;

  const belief = compactSentence(understanding.belief || DEFAULT_INTERVENTION.belief, 7);
  const sayThis = compactSentence(
    understanding.coachingCue || cueFromUnderstanding(understanding),
    4,
  );
  const watchFor = compactSentence(watchForFromUnderstanding(understanding), 4);
  const nextRepRule = compactSentence(
    understanding.experiment || DEFAULT_INTERVENTION.nextRepRule,
    5,
  );

  return {
    belief,
    sayThis,
    watchFor,
    nextRepRule,
    readTimeSeconds: estimateReadTimeSeconds([belief, sayThis, watchFor, nextRepRule]),
  };
}

function cueFromUnderstanding(understanding: AxisUnderstanding): string {
  if (understanding.focus) return `Keep ${understanding.focus}.`;
  if (understanding.concept) return `Find ${understanding.concept}.`;
  return DEFAULT_INTERVENTION.sayThis;
}

function watchForFromUnderstanding(understanding: AxisUnderstanding): string {
  const motion = understanding.currentPattern?.motion?.[0];
  if (motion) return `Watch for ${humanize(motion)}.`;

  const relationship = understanding.currentPattern?.relationships?.[0];
  if (relationship) return `Watch whether ${relationship}.`;

  const targetMotion = understanding.targetPattern?.motion?.[0];
  if (targetMotion) return `Watch for ${humanize(targetMotion)}.`;

  return DEFAULT_INTERVENTION.watchFor;
}

function compactSentence(value: string, maxWords: number): string {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length <= maxWords) return ensurePunctuation(words.join(" "));
  return ensurePunctuation(words.slice(0, maxWords).join(" "));
}

function ensurePunctuation(value: string): string {
  if (!value) return value;
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").trim();
}

function estimateReadTimeSeconds(lines: string[]): number {
  const words = lines.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 5));
}
