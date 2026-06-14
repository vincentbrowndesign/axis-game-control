// ---------------------------------------------------------------------------
// Context Model
//
// A context is a development pursuit, not a chat.
// It stores the state of what someone is working on over time.
//
// Naming note: AxisContext (the session context "SOLO"|"PARTNER"|"TEAM"|"GAME")
// also exists in axis-challenges.ts. Import with an alias if both are needed
// in the same file: import type { AxisContext as SessionContext } from "./axis-challenges"
// ---------------------------------------------------------------------------

export interface AxisContext {
  id: string;
  title: string;         // "Reading Defenders", "Triple Threat", "Axis Build"
  capability?: string;   // optional domain: "basketball", "music", "build"

  // Development state — the thumbnail
  lastIntent?: string;
  lastExperiment?: string;
  lastObservation?: string;
  lastOutcome?: string;

  createdAt: string;     // ISO string
  updatedAt: string;     // ISO string
}

// ---------------------------------------------------------------------------
// ContextSummary — sidebar row
// ---------------------------------------------------------------------------

export interface ContextSummary {
  id: string;
  title: string;
  lastExperiment?: string;
  updatedAt: string;
}

export function toSummary(ctx: AxisContext): ContextSummary {
  return {
    id: ctx.id,
    title: ctx.title,
    lastExperiment: ctx.lastExperiment,
    updatedAt: ctx.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// ContextMatch — result of a reuse search
// ---------------------------------------------------------------------------

export interface ContextMatch {
  context: AxisContext;
  confidence: number;  // 0–1
}
