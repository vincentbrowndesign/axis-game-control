import type { WitnessEvent } from "./axis-core";

// ---------------------------------------------------------------------------
// Coach Witness V1
//
// The coach is the highest-trust witness. Synchronous. No API. confidence: 1.
//
// Two input paths:
//   coachTapEvent  — one of four named taps, maps to a predefined claim
//   coachNoteEvent — free-form note, passed through as claim summary
//
// The coach observes. Experiment Registry resolves final verdict.
// ---------------------------------------------------------------------------

export type CoachTap = "Got it" | "Missed it" | "Hesitated" | "Improved";

export const COACH_TAPS: CoachTap[] = ["Got it", "Missed it", "Hesitated", "Improved"];

// ---------------------------------------------------------------------------
// Tap definitions
// ---------------------------------------------------------------------------

interface TapDef {
  verdict: "satisfied" | "violated" | "partial";
  summary: string;
  magnitude: number;
}

const TAP_MAP: Record<CoachTap, TapDef> = {
  "Got it":    { verdict: "satisfied", summary: "Coach confirmed: constraint satisfied.",          magnitude: 1.0 },
  "Missed it": { verdict: "violated",  summary: "Coach observed: constraint was not met.",          magnitude: 1.0 },
  "Hesitated": { verdict: "violated",  summary: "Coach saw hesitation before the first move.",      magnitude: 0.8 },
  "Improved":  { verdict: "partial",   summary: "Coach noted visible improvement on this attempt.", magnitude: 0.9 },
};

// ---------------------------------------------------------------------------
// Event builders
// ---------------------------------------------------------------------------

export function coachTapEvent(
  intent_id: string,
  experiment_id: string,
  tap: CoachTap,
): WitnessEvent {
  const def = TAP_MAP[tap];
  const now = new Date().toISOString();
  return {
    intent_id,
    experiment_id,
    modality: "coach",
    window: { start: now, end: now },
    claim: {
      verdict: def.verdict,
      summary: def.summary,
      magnitude: def.magnitude,
    },
    confidence: 1,
  };
}

export function coachNoteEvent(
  intent_id: string,
  experiment_id: string,
  note: string,
): WitnessEvent {
  const now = new Date().toISOString();
  return {
    intent_id,
    experiment_id,
    modality: "coach",
    window: { start: now, end: now },
    claim: {
      summary: note.trim(),
    },
    confidence: 1,
  };
}
