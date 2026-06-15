import { getSupabaseBrowserClient } from "./supabase-browser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThreadHypothesis {
  id: string;
  statement: string;
  status: "active" | "confirmed" | "rejected";
  confidence: number;
  evidence: string[];
  createdAt: string;
}

export interface ThreadExperiment {
  id: string;
  hypothesis: string;
  status: "open" | "completed" | "failed" | "inconclusive";
  result?: string;
  verdict?: "PASS" | "FAIL" | "INCONCLUSIVE";
  createdAt: string;
}

export interface ThreadEvidenceItem {
  id: string;
  observation: string;
  source: "user_report" | "photo" | "video" | "voice" | "cv" | "research";
  claim?: string;
  confidence: number;
  createdAt: string;
}

export interface ThreadMemory {
  focus: string | null;
  currentBottleneck: string | null;
  hypotheses: ThreadHypothesis[];
  experiments: ThreadExperiment[];
  evidence: ThreadEvidenceItem[];
  breakthroughs: string[];
  openQuestions: string[];
}

export const EMPTY_THREAD_MEMORY: ThreadMemory = {
  focus: null,
  currentBottleneck: null,
  hypotheses: [],
  experiments: [],
  evidence: [],
  breakthroughs: [],
  openQuestions: [],
};

export interface DevThread {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  entry_count?: number;
}

export interface DevEntry {
  id: string;
  thread_id: string;
  intent: string;
  insight: string | null;
  reasoning: string | null;
  mental_model: string | null;
  demonstration: {
    currentState: string;
    targetState: string;
    keyDifference: string;
    executionCue: string;
  } | null;
  experiment: string | null;
  confidence: number | null;
  position: number;
  created_at: string;
}

export interface Breakthrough {
  id: string;
  thread_id: string | null;
  entry_id: string | null;
  description: string;
  domain: string | null;
  created_at: string;
}

export interface DevEvidence {
  id: string;
  thread_id: string | null;
  entry_id: string | null;
  observation: string;
  claim: string | null;
  question: string | null;
  development_opportunity: string | null;
  confidence: number;
  source: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export async function createDevThread(title: string): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("axis_dev_threads")
    .insert({ title })
    .select("id")
    .single();
  if (error) { console.error("[axis-dev] createThread", error.message); return null; }
  return data.id as string;
}

export async function listDevThreads(): Promise<DevThread[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("axis_dev_threads")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) { console.error("[axis-dev] listThreads", error.message); return []; }
  return (data ?? []) as DevThread[];
}

export async function touchDevThread(threadId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  await supabase
    .from("axis_dev_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);
}

export async function loadThreadMemory(threadId: string): Promise<ThreadMemory> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ...EMPTY_THREAD_MEMORY };
  const { data, error } = await supabase
    .from("axis_dev_threads")
    .select("memory")
    .eq("id", threadId)
    .single();
  if (error || !data?.memory) return { ...EMPTY_THREAD_MEMORY };
  const m = data.memory as Partial<ThreadMemory>;
  return {
    focus: m.focus ?? null,
    currentBottleneck: m.currentBottleneck ?? null,
    hypotheses: m.hypotheses ?? [],
    experiments: m.experiments ?? [],
    evidence: m.evidence ?? [],
    breakthroughs: m.breakthroughs ?? [],
    openQuestions: m.openQuestions ?? [],
  };
}

export async function saveThreadMemory(threadId: string, memory: ThreadMemory): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("axis_dev_threads")
    .update({ memory, updated_at: new Date().toISOString() })
    .eq("id", threadId);
  if (error) console.error("[axis-dev] saveThreadMemory", error.message);
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export interface SaveEntryInput {
  threadId: string;
  intent: string;
  insight?: string;
  reasoning?: string;
  mentalModel?: string;
  demonstration?: {
    currentState: string;
    targetState: string;
    keyDifference: string;
    executionCue: string;
  };
  experiment?: string;
  confidence?: number;
  position: number;
}

export async function saveDevEntry(input: SaveEntryInput): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("axis_dev_entries")
    .insert({
      thread_id: input.threadId,
      intent: input.intent,
      insight: input.insight ?? null,
      reasoning: input.reasoning ?? null,
      mental_model: input.mentalModel ?? null,
      demonstration: input.demonstration ?? null,
      experiment: input.experiment ?? null,
      confidence: input.confidence ?? null,
      position: input.position,
    })
    .select("id")
    .single();
  if (error) { console.error("[axis-dev] saveEntry", error.message); return null; }
  return data.id as string;
}

export async function loadDevEntries(threadId: string): Promise<DevEntry[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("axis_dev_entries")
    .select("*")
    .eq("thread_id", threadId)
    .order("position", { ascending: true });
  if (error) { console.error("[axis-dev] loadEntries", error.message); return []; }
  return (data ?? []) as DevEntry[];
}

// ---------------------------------------------------------------------------
// Breakthroughs
// ---------------------------------------------------------------------------

export async function saveBreakthrough(
  description: string,
  threadId?: string,
  entryId?: string,
  domain?: string,
): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("axis_breakthroughs")
    .insert({
      description,
      thread_id: threadId ?? null,
      entry_id: entryId ?? null,
      domain: domain ?? null,
    })
    .select("id")
    .single();
  if (error) { console.error("[axis-dev] saveBreakthrough", error.message); return null; }
  return data.id as string;
}

export async function listBreakthroughs(): Promise<Breakthrough[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("axis_breakthroughs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) { console.error("[axis-dev] listBreakthroughs", error.message); return []; }
  return (data ?? []) as Breakthrough[];
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export interface SaveEvidenceInput {
  threadId?: string;
  entryId?: string;
  observation: string;
  claim?: string;
  question?: string;
  developmentOpportunity?: string;
  confidence?: number;
  source?: string;
}

export async function saveDevEvidence(input: SaveEvidenceInput): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("axis_dev_evidence")
    .insert({
      thread_id: input.threadId ?? null,
      entry_id: input.entryId ?? null,
      observation: input.observation,
      claim: input.claim ?? null,
      question: input.question ?? null,
      development_opportunity: input.developmentOpportunity ?? null,
      confidence: input.confidence ?? 0.5,
      source: input.source ?? "user_report",
    })
    .select("id")
    .single();
  if (error) { console.error("[axis-dev] saveEvidence", error.message); return null; }
  return data.id as string;
}

export async function listDevEvidence(limit = 50): Promise<DevEvidence[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("axis_dev_evidence")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.error("[axis-dev] listEvidence", error.message); return []; }
  return (data ?? []) as DevEvidence[];
}
