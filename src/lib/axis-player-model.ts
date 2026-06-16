import type {
  AxisBelief,
  AxisEvent,
  AxisThread,
  AxisUnderstanding,
} from "./axis-server";

export interface AxisPlayerEvidenceLink {
  id: string;
  threadId: string;
  observation: string;
  source: string;
  confidence: number;
  createdAt: string;
}

export interface AxisPlayerExperimentLink {
  id: string;
  threadId: string;
  hypothesis: string;
  status: string;
  result?: string | null;
  verdict?: string | null;
  createdAt: string;
}

export interface AxisPlayerBreakthroughLink {
  id: string;
  threadId: string;
  description: string;
  createdAt: string;
}

export interface AxisPlayerThreadLink {
  id: string;
  title: string;
  focus: string | null;
  currentBottleneck: string | null;
  nextAction: string | null;
  openQuestions: string[];
  updatedAt: string;
  understanding?: AxisUnderstanding;
  evidence: AxisPlayerEvidenceLink[];
  beliefs: AxisBelief[];
  experiments: AxisPlayerExperimentLink[];
  breakthroughs: AxisPlayerBreakthroughLink[];
}

export interface AxisDevelopmentPattern {
  label: string;
  threadIds: string[];
  threadTitles: string[];
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  latestBelief: string;
  latestConfidence: number;
  status: "improved" | "not_improved" | "still_showing_up";
}

export interface AxisDevelopmentMemory {
  recurringPatterns: AxisDevelopmentPattern[];
  topRecurringIssues: AxisDevelopmentPattern[];
  keepsShowingUp: string[];
  improved: string[];
  notImproved: string[];
}

export interface AxisPlayerModelInput {
  playerId: string;
  playerName: string;
  threads: AxisThread[];
  events: AxisEvent[];
  beliefs: AxisBelief[];
  evidence: AxisPlayerEvidenceLink[];
  experiments: AxisPlayerExperimentLink[];
  breakthroughs: AxisPlayerBreakthroughLink[];
}

export interface AxisPlayerModel {
  player: {
    id: string;
    name: string;
  };
  threads: AxisPlayerThreadLink[];
  currentStrengths: string[];
  currentBottlenecks: string[];
  recentImprovements: string[];
  openQuestions: string[];
  evidence: AxisPlayerEvidenceLink[];
  developmentMemory: AxisDevelopmentMemory;
  whatMattersMostRightNow: string;
}

export function buildAxisPlayerModel(input: AxisPlayerModelInput): AxisPlayerModel {
  const understandingRecords = understandingRecordsFromEvents(input.events, input.threads);
  const understandingsByThread = latestUnderstandingByThread(input.events);
  const linkedThreads = input.threads
    .map((thread) => linkThread(thread, input, understandingsByThread.get(thread.id)))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const developmentMemory = buildDevelopmentMemory(understandingRecords);

  const currentStrengths = unique([
    ...input.beliefs
      .filter((belief) => belief.status === "confirmed")
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((belief) => belief.statement),
    ...input.breakthroughs
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((breakthrough) => breakthrough.description),
  ]).slice(0, 5);

  const currentBottlenecks = unique([
    ...linkedThreads.flatMap((thread) => thread.currentBottleneck ? [thread.currentBottleneck] : []),
    ...input.beliefs
      .filter((belief) => belief.status === "active")
      .sort((a, b) => b.confidence - a.confidence)
      .map((belief) => belief.statement),
  ]).slice(0, 5);

  const recentImprovements = unique([
    ...input.breakthroughs
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((breakthrough) => breakthrough.description),
    ...input.experiments
      .filter((experiment) => experiment.status !== "open" && experiment.result)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((experiment) => experiment.result ?? ""),
  ]).slice(0, 5);

  const openQuestions = unique([
    ...linkedThreads.flatMap((thread) => thread.openQuestions),
    ...linkedThreads.flatMap((thread) =>
      thread.understanding?.evidenceRequest ? [thread.understanding.evidenceRequest] : [],
    ),
  ]).slice(0, 5);

  return {
    player: {
      id: input.playerId,
      name: input.playerName,
    },
    threads: linkedThreads,
    currentStrengths,
    currentBottlenecks,
    recentImprovements,
    openQuestions,
    evidence: input.evidence.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    developmentMemory,
    whatMattersMostRightNow: chooseWhatMattersMost(linkedThreads, currentBottlenecks, openQuestions),
  };
}

function linkThread(
  thread: AxisThread,
  input: AxisPlayerModelInput,
  understanding?: AxisUnderstanding,
): AxisPlayerThreadLink {
  return {
    id: thread.id,
    title: thread.title || thread.focus || "Untitled thread",
    focus: thread.focus,
    currentBottleneck: thread.current_bottleneck,
    nextAction: thread.next_action,
    openQuestions: thread.open_questions ?? [],
    updatedAt: thread.updated_at,
    understanding,
    evidence: input.evidence.filter((item) => item.threadId === thread.id),
    beliefs: input.beliefs.filter((item) => item.thread_id === thread.id),
    experiments: input.experiments.filter((item) => item.threadId === thread.id),
    breakthroughs: input.breakthroughs.filter((item) => item.threadId === thread.id),
  };
}

function latestUnderstandingByThread(events: AxisEvent[]): Map<string, AxisUnderstanding> {
  const map = new Map<string, AxisUnderstanding>();
  const sorted = [...events].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  for (const event of sorted) {
    if (event.role !== "assistant") continue;
    const understanding = (event.content as { understanding?: AxisUnderstanding }).understanding;
    if (!understanding) continue;
    map.set(event.thread_id, understanding);
  }

  return map;
}

function understandingRecordsFromEvents(
  events: AxisEvent[],
  threads: AxisThread[],
): Array<{
  threadId: string;
  threadTitle: string;
  createdAt: string;
  understanding: AxisUnderstanding;
}> {
  const titleByThread = new Map(
    threads.map((thread) => [thread.id, thread.title || thread.focus || "Untitled thread"]),
  );

  return [...events]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .flatMap((event) => {
      if (event.role !== "assistant") return [];
      const understanding = (event.content as { understanding?: AxisUnderstanding }).understanding;
      if (!understanding) return [];
      return [
        {
          threadId: event.thread_id,
          threadTitle: titleByThread.get(event.thread_id) ?? "Untitled thread",
          createdAt: event.created_at,
          understanding,
        },
      ];
    });
}

function buildDevelopmentMemory(
  records: ReturnType<typeof understandingRecordsFromEvents>,
): AxisDevelopmentMemory {
  const groups = new Map<string, ReturnType<typeof understandingRecordsFromEvents>>();

  for (const record of records) {
    const key = memoryKey(record.understanding);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  const recurringPatterns = [...groups.entries()]
    .flatMap(([label, group]) => {
      const threadIds = unique(group.map((record) => record.threadId));
      if (group.length < 2 && threadIds.length < 2) return [];
      const sorted = [...group].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      const first = sorted[0];
      const latest = sorted[sorted.length - 1];
      const confidenceChange =
        latest.understanding.confidence - first.understanding.confidence;
      const status: AxisDevelopmentPattern["status"] =
        confidenceChange >= 0.15
          ? "improved"
          : threadIds.length > 1
            ? "still_showing_up"
            : "not_improved";

      return [
        {
          label,
          threadIds,
          threadTitles: unique(group.map((record) => record.threadTitle)),
          occurrences: group.length,
          firstSeen: first.createdAt,
          lastSeen: latest.createdAt,
          latestBelief: latest.understanding.belief,
          latestConfidence: latest.understanding.confidence,
          status,
        },
      ];
    })
    .sort((a, b) => {
      const threadSpread = b.threadIds.length - a.threadIds.length;
      if (threadSpread !== 0) return threadSpread;
      const occurrenceSpread = b.occurrences - a.occurrences;
      if (occurrenceSpread !== 0) return occurrenceSpread;
      return Date.parse(b.lastSeen) - Date.parse(a.lastSeen);
    });

  return {
    recurringPatterns,
    topRecurringIssues: recurringPatterns
      .filter((pattern) => pattern.status !== "improved")
      .slice(0, 3),
    keepsShowingUp: recurringPatterns
      .filter((pattern) => pattern.status === "still_showing_up")
      .map((pattern) => pattern.label)
      .slice(0, 5),
    improved: recurringPatterns
      .filter((pattern) => pattern.status === "improved")
      .map((pattern) => pattern.label)
      .slice(0, 5),
    notImproved: recurringPatterns
      .filter((pattern) => pattern.status === "not_improved")
      .map((pattern) => pattern.label)
      .slice(0, 5),
  };
}

function memoryKey(understanding: AxisUnderstanding): string {
  return (
    understanding.concept ||
    understanding.focus ||
    understanding.currentPattern.label ||
    understanding.targetPattern.label ||
    understanding.primitives[0] ||
    ""
  )
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chooseWhatMattersMost(
  threads: AxisPlayerThreadLink[],
  currentBottlenecks: string[],
  openQuestions: string[],
): string {
  const activeThread = threads.find((thread) => thread.nextAction || thread.currentBottleneck) ?? threads[0];
  if (activeThread?.nextAction) return activeThread.nextAction;
  if (currentBottlenecks[0]) return currentBottlenecks[0];
  if (openQuestions[0]) return openQuestions[0];
  return "Create one clear thread with evidence from the next session.";
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const clean = value.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }

  return result;
}
