import { type AxisContext, type ContextMatch, type ContextSummary, toSummary } from "./context-model";

// ---------------------------------------------------------------------------
// Context Store
//
// Persistence: localStorage, key "axis_dev_contexts".
// Same pattern as axis_learning_tokens in the shell.
// No migrations. No schema versioning. Simple first.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "axis_dev_contexts";
const REUSE_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function load(): AxisContext[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as AxisContext[];
  } catch {
    return [];
  }
}

function save(contexts: AxisContext[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contexts));
  } catch {}
}

// ---------------------------------------------------------------------------
// Title helpers
// ---------------------------------------------------------------------------

function titleFromIntent(intent: string): string {
  return intent
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Strip emoji and leading/trailing whitespace for comparison
function normalize(text: string): string {
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .toLowerCase()
    .trim();
}

// Word overlap similarity — ignores stop words shorter than 3 chars
function similarity(a: string, b: string): number {
  const words = (s: string) =>
    new Set(normalize(s).split(/\s+/).filter((w) => w.length > 2));
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  const overlap = [...wa].filter((w) => wb.has(w)).length;
  return overlap / Math.max(wa.size, wb.size);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function createContext(input: { title?: string; intent?: string; capability?: string }): AxisContext {
  const now = new Date().toISOString();
  const title = input.title ?? (input.intent ? titleFromIntent(input.intent) : "Untitled");
  const ctx: AxisContext = {
    id: `ctx-${Date.now().toString(36)}`,
    title,
    capability: input.capability,
    lastIntent: input.intent,
    createdAt: now,
    updatedAt: now,
  };
  const existing = load();
  save([...existing, ctx]);
  return ctx;
}

export function getContext(id: string): AxisContext | null {
  return load().find((c) => c.id === id) ?? null;
}

export function updateContext(id: string, patch: Partial<AxisContext>): AxisContext | null {
  const contexts = load();
  const idx = contexts.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated: AxisContext = {
    ...contexts[idx],
    ...patch,
    id,                             // id is immutable
    updatedAt: new Date().toISOString(),
  };
  contexts[idx] = updated;
  save(contexts);
  return updated;
}

export function listContexts(): AxisContext[] {
  return load().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listSummaries(): ContextSummary[] {
  return listContexts().map(toSummary);
}

export function deleteContext(id: string): void {
  save(load().filter((c) => c.id !== id));
}

// ---------------------------------------------------------------------------
// Reuse — find a matching context for a new intent
//
// Strategy: word-overlap similarity between intent and context title.
// Returns the best match above REUSE_THRESHOLD, or null.
// ---------------------------------------------------------------------------

export function findMatchingContext(intent: string): ContextMatch | null {
  const contexts = load();
  if (contexts.length === 0) return null;

  let best: ContextMatch | null = null;

  for (const ctx of contexts) {
    const score = Math.max(
      similarity(intent, ctx.title),
      ctx.lastIntent ? similarity(intent, ctx.lastIntent) : 0,
    );
    if (score >= REUSE_THRESHOLD && (!best || score > best.confidence)) {
      best = { context: ctx, confidence: score };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Development state updates — called as the loop progresses
// ---------------------------------------------------------------------------

export function recordIntent(id: string, intent: string): AxisContext | null {
  return updateContext(id, { lastIntent: intent });
}

export function recordExperiment(id: string, experiment: string): AxisContext | null {
  return updateContext(id, { lastExperiment: experiment });
}

export function recordObservation(id: string, observation: string): AxisContext | null {
  return updateContext(id, { lastObservation: observation });
}

export function recordOutcome(id: string, outcome: string): AxisContext | null {
  return updateContext(id, { lastOutcome: outcome });
}
