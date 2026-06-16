export const runtime = "nodejs";

import {
  createSupabaseFromRequest,
  type AxisBelief,
  type AxisCard,
  type AxisEvent,
  type AxisObservation,
  type AxisPattern,
  type AxisThread,
  type AxisUnderstanding,
} from "../../../../lib/axis-server";
import {
  hasObservationSignal,
  observeEvidence,
  observeTextReport,
  updateUnderstandingFromObservation,
} from "../../../../lib/axis-observation-engine";
import {
  AXIS_MOVEMENT_PRIMITIVE_JSON_TEXT,
  filterAxisMovementPrimitives,
} from "../../../../lib/axis-movement-language";
import { runAxisOperatingSystem } from "../../../../lib/axis-operating-system";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StateUpdate {
  goal?: string;
  focus?: string;
  currentBottleneck?: string;
  nextAction?: string;
  newOpenQuestions?: string[];
  resolvedQuestions?: string[];
  newHypotheses?: Array<{ id: string; statement: string; confidence: number }>;
  confirmedHypothesisIds?: string[];
  rejectedHypothesisIds?: string[];
  newEvidence?: string[];
  experimentResult?: { result: string; verdict: "PASS" | "FAIL" | "INCONCLUSIVE" };
  newBreakthroughs?: string[];
}


interface AxisExperiment {
  id: string;
  thread_id: string;
  hypothesis: string;
  status: "open" | "completed" | "failed" | "inconclusive";
  result: string | null;
  verdict: "PASS" | "FAIL" | "INCONCLUSIVE" | null;
  created_at: string;
}

interface RunRequest {
  message: string;
  threadId?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentPath?: string | null;
  evidenceId?: string | null;
  fileName?: string | null;
}

interface ThreadState {
  threadId: string;
  thread: AxisThread;
  beliefs: AxisBelief[];
  recentEvents: AxisEvent[];
  experiments: AxisExperiment[];
  openExperiment: AxisExperiment | null;
}

interface BuildUnderstandingInput {
  apiKey: string;
  priorUnderstanding: AxisUnderstanding;
  threadId: string;
  userContent: string;
}

interface BuildUnderstandingResult {
  understanding: AxisUnderstanding;
  stateUpdate?: StateUpdate;
}

interface AxisRunResponse {
  understanding: AxisUnderstanding;
  cards: AxisCard[];
  comparison: ReturnType<typeof runAxisOperatingSystem>["comparison"] | null;
  operatingSystem: ReturnType<typeof runAxisOperatingSystem> | null;
}

// ---------------------------------------------------------------------------
// System prompt — single Understanding object drives all cards
// ---------------------------------------------------------------------------

const SYSTEM_UNDERSTANDING = `You are Axis. Your job is not to answer questions. Your job is not to route to a capability. Your job is to produce one AxisUnderstanding object that is the source of truth for coaching, demonstration, experiment, and evidence.

Explanation and demonstration must come from the same object. Do not generate explanation separately from demonstration. Same belief. Same primitives. Same target.

---

FIELDS

- concept: the mechanism being worked on (short noun phrase, e.g. "ball path", "plant foot timing", "pre-catch scan")
- focus: what this thread specifically investigates (one phrase, set from first message)
- belief: one declarative sentence about what Axis currently believes is happening. A belief, not a question. Not advice. Direct. Example: "Hudson's ball path is drifting away from the target line."
- confidence: 0.0–1.0. Below 0.60 — return belief as a hypothesis, set evidenceRequest to ask the single question that would raise confidence.
- primitives: 2–5 values from [${AXIS_MOVEMENT_PRIMITIVE_JSON_TEXT}]
- currentPattern: { label, objects, relationships, motion }
  - label: short phrase (e.g. "drifting path", "wait after catch")
  - objects: 2–5 nouns (e.g. ["ball","target_line","foot","defender"])
  - relationships: 1–3 statements of how objects relate now
  - motion: 1–3 motion keywords (e.g. ["curve_out","late_correct","pause"])
- targetPattern: same structure — what the corrected pattern looks like
- coachingCue: one phrase, 8 words max, deliverable in one breath. No explanation. Just the cue.
- experiment: one imperative sentence. The smallest action that tests the belief.
- evidenceRequest: one sentence. The specific upload or observation that would confirm or deny the belief.
- stateUpdate: required every response — thread accumulation schema (see below)

stateUpdate fields:
- goal: the user's development goal (infer from first message; persist — only reset if user explicitly changes it)
- focus: same as Understanding.focus
- currentBottleneck: the single constraint most blocking progress
- nextAction: what the user should do before the next session (one imperative sentence)
- newOpenQuestions: new unanswered questions this exchange raises
- resolvedQuestions: open questions this message answers (verbatim match)
- newHypotheses: [{id: kebab-slug, statement: one sentence, confidence: 0.0–1.0}]
- confirmedHypothesisIds: slugs confirmed by this message
- rejectedHypothesisIds: slugs ruled out by this message
- newEvidence: verbatim facts the user gave you
- experimentResult: only when user reports back on OPEN EXPERIMENT — {result: "...", verdict: "PASS"|"FAIL"|"INCONCLUSIVE"}
- newBreakthroughs: durable changes confirmed this exchange (usually empty; add one when experiment verdict is PASS)

THREAD MEMORY RULES

When THREAD CONTINUITY is present:
1. Build on established context — do not re-diagnose what is already known.
2. Confirmed breakthroughs are closed. Do not repeat them.
3. Resolved questions are closed. Do not ask them again.
4. OPEN EXPERIMENT takes priority — if user is reporting a result, handle that first.
5. Each response must advance the thread, not reset it.

---

JSON only. No markdown. No explanation.

Schema:
{"concept":"...","focus":"...","belief":"...","confidence":0.82,"primitives":["ball_path","direction"],"currentPattern":{"label":"...","objects":["ball","target_line"],"relationships":["ball moves away from target line"],"motion":["curve_out","late_correct"]},"targetPattern":{"label":"...","objects":["ball","target_line"],"relationships":["ball stays near target line"],"motion":["straight","repeat"]},"coachingCue":"...","experiment":"...","evidenceRequest":"...","stateUpdate":{"goal":"...","focus":"...","currentBottleneck":"...","nextAction":"...","newOpenQuestions":[],"resolvedQuestions":[],"newHypotheses":[{"id":"...","statement":"...","confidence":0.85}],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":["..."],"experimentResult":null,"newBreakthroughs":[]}}

---

Few-shot examples:

Input: "Hudson said ball path."
{"concept":"ball path","focus":"repeatable ball path","belief":"Hudson's ball path is drifting instead of staying connected to his target line.","confidence":0.74,"primitives":["ball_path","direction","distance"],"currentPattern":{"label":"drifting path","objects":["ball","target_line"],"relationships":["ball moves away from target line"],"motion":["curve_out","late_correct"]},"targetPattern":{"label":"clean path","objects":["ball","target_line"],"relationships":["ball stays near target line"],"motion":["straight","repeat"]},"coachingCue":"Keep the ball inside your frame.","experiment":"10 reps. Track whether the ball stays inside the foot line.","evidenceRequest":"Show me one rep from the front.","stateUpdate":{"goal":"improve Hudson's shooting","focus":"repeatable ball path","currentBottleneck":"ball path drifts away from target line","nextAction":"Run 10 reps tracking ball path inside foot line.","newOpenQuestions":[],"resolvedQuestions":[],"newHypotheses":[{"id":"ball-path-drift","statement":"Hudson's ball path drifts away from the target line instead of staying connected.","confidence":0.74}],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":["Hudson reported ball path issue"],"experimentResult":null,"newBreakthroughs":[]}}

Input: "Hailey takes too long deciding."
{"concept":"decision timing","focus":"pre-catch scan and decision","belief":"Hailey is recognizing the advantage late — she scans after the catch instead of before.","confidence":0.79,"primitives":["timing","advantage","orientation","position"],"currentPattern":{"label":"wait after catch","objects":["Hailey","ball","defender","open_teammate"],"relationships":["Hailey receives ball before scanning","defender reads hesitation"],"motion":["catch","pause","scan","decide"]},"targetPattern":{"label":"scan before catch","objects":["Hailey","ball","defender","open_teammate"],"relationships":["Hailey scans before ball arrives","decision made at catch"],"motion":["scan","catch_and_go"]},"coachingCue":"Know where you're going before it arrives.","experiment":"On every catch: scan, decide, act in one second.","evidenceRequest":"Upload one possession where she catches and pauses.","stateUpdate":{"goal":"improve Hailey's decision speed","focus":"pre-catch scan and decision","currentBottleneck":"scanning after catch instead of before","nextAction":"Practice pre-catch scan on every possession.","newOpenQuestions":[],"resolvedQuestions":[],"newHypotheses":[{"id":"late-scan-timing","statement":"Hailey scans after the catch instead of before, causing decision delay.","confidence":0.79}],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":["Hailey takes too long deciding"],"experimentResult":null,"newBreakthroughs":[]}}`;

// ---------------------------------------------------------------------------
// Memory context builder
// ---------------------------------------------------------------------------

function buildMemoryContext(
  thread: AxisThread,
  beliefs: AxisBelief[],
  experiments: AxisExperiment[],
  recentEvents: AxisEvent[],
): string | null {
  const lines: string[] = [];

  if (thread.goal) lines.push(`GOAL: ${thread.goal}`);
  if (thread.focus) lines.push(`THREAD FOCUS: ${thread.focus}`);
  if (thread.current_bottleneck) lines.push(`CURRENT BOTTLENECK: ${thread.current_bottleneck}`);
  if (thread.next_action) lines.push(`NEXT ACTION (carry forward): ${thread.next_action}`);

  const openExp = experiments.find((e) => e.status === "open");
  if (openExp) {
    lines.push(`OPEN EXPERIMENT: "${openExp.hypothesis}"`);
  }

  const active = beliefs.filter((b) => b.status === "active");
  if (active.length > 0) {
    lines.push(
      `ACTIVE HYPOTHESES:\n${active
        .map((b) => `- [${b.belief_id ?? "?"}] ${b.statement} (confidence: ${b.confidence})`)
        .join("\n")}`,
    );
  }

  const confirmed = beliefs.filter((b) => b.status === "confirmed");
  if (confirmed.length > 0) {
    lines.push(
      `CONFIRMED HYPOTHESES:\n${confirmed
        .map((b) => `- [${b.belief_id ?? "?"}] ${b.statement}`)
        .join("\n")}`,
    );
  }

  const completedExp = experiments.filter((e) => e.status !== "open" && e.result);
  if (completedExp.length > 0) {
    lines.push(
      `EXPERIMENT RESULTS:\n${completedExp
        .map((e) => `- [${e.verdict ?? e.status.toUpperCase()}] ${e.hypothesis}: ${e.result}`)
        .join("\n")}`,
    );
  }

  if ((thread.open_questions ?? []).length > 0) {
    lines.push(
      `OPEN QUESTIONS:\n${thread.open_questions.map((q) => `- ${q}`).join("\n")}`,
    );
  }

  if (recentEvents.length > 0) {
    const historyLines: string[] = [];
    for (const evt of recentEvents.slice(-16)) {
      if (evt.role === "user") {
        const msg = (evt.content as { message?: string }).message;
        if (msg) historyLines.push(`User: "${msg}"`);
      } else {
        const cards = (evt.content as { cards?: AxisCard[] }).cards ?? [];
        const first = cards[0];
        if (first) historyLines.push(`Axis: [${first.type.toUpperCase()}] ${first.content}`);
      }
    }
    if (historyLines.length > 0) {
      lines.push(`CONVERSATION HISTORY:\n${historyLines.join("\n")}`);
    }
  }

  return lines.length > 0 ? lines.join("\n\n") : null;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseStateUpdate(val: unknown): StateUpdate | undefined {
  if (!val || typeof val !== "object") return undefined;
  const u = val as Record<string, unknown>;

  const strArr = (key: string): string[] =>
    Array.isArray(u[key])
      ? (u[key] as unknown[]).filter((v): v is string => typeof v === "string")
      : [];

  const newHypotheses = Array.isArray(u.newHypotheses)
    ? (u.newHypotheses as unknown[]).flatMap((h) => {
        if (!h || typeof h !== "object") return [];
        const hyp = h as Record<string, unknown>;
        if (typeof hyp.id !== "string" || typeof hyp.statement !== "string") return [];
        return [
          {
            id: hyp.id.trim(),
            statement: hyp.statement.trim(),
            confidence:
              typeof hyp.confidence === "number"
                ? Math.min(1, Math.max(0, hyp.confidence))
                : 0.7,
          },
        ];
      })
    : [];

  const experimentResult = (() => {
    if (!u.experimentResult || typeof u.experimentResult !== "object") return undefined;
    const r = u.experimentResult as Record<string, unknown>;
    if (typeof r.result !== "string" || !r.result.trim()) return undefined;
    const verdict: "PASS" | "FAIL" | "INCONCLUSIVE" =
      r.verdict === "PASS" || r.verdict === "FAIL" || r.verdict === "INCONCLUSIVE"
        ? r.verdict
        : "INCONCLUSIVE";
    return { result: r.result.trim(), verdict };
  })();

  return {
    goal: typeof u.goal === "string" && u.goal.trim() ? u.goal.trim() : undefined,
    focus: typeof u.focus === "string" && u.focus.trim() ? u.focus.trim() : undefined,
    currentBottleneck:
      typeof u.currentBottleneck === "string" && u.currentBottleneck.trim()
        ? u.currentBottleneck.trim()
        : undefined,
    nextAction:
      typeof u.nextAction === "string" && u.nextAction.trim()
        ? u.nextAction.trim()
        : undefined,
    newOpenQuestions: strArr("newOpenQuestions").length > 0 ? strArr("newOpenQuestions") : undefined,
    resolvedQuestions: strArr("resolvedQuestions").length > 0 ? strArr("resolvedQuestions") : undefined,
    newHypotheses: newHypotheses.length > 0 ? newHypotheses : undefined,
    confirmedHypothesisIds:
      strArr("confirmedHypothesisIds").length > 0 ? strArr("confirmedHypothesisIds") : undefined,
    rejectedHypothesisIds:
      strArr("rejectedHypothesisIds").length > 0 ? strArr("rejectedHypothesisIds") : undefined,
    newEvidence: strArr("newEvidence").length > 0 ? strArr("newEvidence") : undefined,
    experimentResult,
    newBreakthroughs: strArr("newBreakthroughs").length > 0 ? strArr("newBreakthroughs") : undefined,
  };
}

const EMPTY_PATTERN: AxisPattern = { label: "", objects: [], relationships: [], motion: [] };
function stringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? (v as unknown[]).flatMap((x) => {
        if (typeof x !== "string") return [];
        const trimmed = x.trim();
        return trimmed ? [trimmed] : [];
      })
    : [];
}

function hasPatternSignal(pattern: AxisPattern): boolean {
  return Boolean(
    pattern.label ||
      pattern.objects.length ||
      pattern.relationships.length ||
      pattern.motion.length,
  );
}

function mergePattern(base: AxisPattern, candidate: AxisPattern): AxisPattern {
  return {
    label: candidate.label || base.label,
    objects: candidate.objects.length ? candidate.objects : base.objects,
    relationships: candidate.relationships.length ? candidate.relationships : base.relationships,
    motion: candidate.motion.length ? candidate.motion : base.motion,
  };
}

function emptyUnderstanding(): AxisUnderstanding {
  return {
    id: crypto.randomUUID(),
    threadId: "",
    concept: "",
    focus: "",
    belief: "",
    confidence: 0,
    primitives: [],
    currentPattern: EMPTY_PATTERN,
    targetPattern: EMPTY_PATTERN,
    coachingCue: "",
    experiment: "",
    evidenceRequest: "",
  };
}

function normalizeUnderstanding(
  candidate: AxisUnderstanding,
  prior: AxisUnderstanding,
  threadId: string,
): AxisUnderstanding {
  const primitives = filterAxisMovementPrimitives(candidate.primitives);
  const priorPrimitives = filterAxisMovementPrimitives(prior.primitives);

  return {
    id: prior.id || candidate.id || crypto.randomUUID(),
    threadId,
    concept: candidate.concept || prior.concept,
    focus: candidate.focus || prior.focus,
    belief: candidate.belief || prior.belief,
    confidence: candidate.belief
      ? candidate.confidence
      : prior.belief
        ? prior.confidence
        : candidate.confidence,
    primitives: primitives.length ? primitives : priorPrimitives,
    currentPattern: hasPatternSignal(candidate.currentPattern)
      ? mergePattern(prior.currentPattern, candidate.currentPattern)
      : prior.currentPattern,
    targetPattern: hasPatternSignal(candidate.targetPattern)
      ? mergePattern(prior.targetPattern, candidate.targetPattern)
      : prior.targetPattern,
    coachingCue: candidate.coachingCue || prior.coachingCue,
    experiment: candidate.experiment || prior.experiment,
    evidenceRequest: candidate.evidenceRequest || prior.evidenceRequest,
  };
}

function stateUpdateFromUnderstanding(
  stateUpdate: StateUpdate | undefined,
  understanding: AxisUnderstanding,
): StateUpdate {
  const focus = stateUpdate?.focus ?? (understanding.focus || undefined);
  const currentBottleneck =
    stateUpdate?.currentBottleneck ?? (understanding.belief || undefined);
  const nextAction = stateUpdate?.nextAction ?? (understanding.experiment || undefined);

  return {
    ...stateUpdate,
    focus,
    currentBottleneck,
    nextAction,
    newHypotheses:
      stateUpdate?.newHypotheses ??
      (!stateUpdate && understanding.belief
        ? [
            {
              id: understanding.concept
                ? understanding.concept.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
                : "current-understanding",
              statement: understanding.belief,
              confidence: understanding.confidence,
            },
          ]
        : undefined),
  };
}

function parseUnderstanding(
  raw: string,
): { understanding: AxisUnderstanding; stateUpdate?: StateUpdate } {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const p = JSON.parse(slice) as Record<string, unknown>;

    const parsePattern = (v: unknown): AxisPattern => {
      const d = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
      return {
        label: typeof d.label === "string" ? d.label.trim() : "",
        objects: stringArray(d.objects),
        relationships: stringArray(d.relationships),
        motion: stringArray(d.motion),
      };
    };

    const understanding: AxisUnderstanding = {
      id: crypto.randomUUID(),
      threadId: "",
      concept: typeof p.concept === "string" ? p.concept.trim() : "",
      focus: typeof p.focus === "string" ? p.focus.trim() : "",
      belief: typeof p.belief === "string" ? p.belief.trim() : "",
      confidence:
        typeof p.confidence === "number" ? Math.min(1, Math.max(0, p.confidence)) : 0.5,
      primitives: filterAxisMovementPrimitives(stringArray(p.primitives)),
      currentPattern: parsePattern(p.currentPattern),
      targetPattern: parsePattern(p.targetPattern),
      coachingCue: typeof p.coachingCue === "string" ? p.coachingCue.trim() : "",
      experiment: typeof p.experiment === "string" ? p.experiment.trim() : "",
      evidenceRequest: typeof p.evidenceRequest === "string" ? p.evidenceRequest.trim() : "",
    };

    return { understanding, stateUpdate: parseStateUpdate(p.stateUpdate) };
  } catch {
    return { understanding: emptyUnderstanding() };
  }
}

function understandingToCards(u: AxisUnderstanding, stateUpdate: StateUpdate | undefined): AxisCard[] {
  const cards: AxisCard[] = [];

  if (u.belief) {
    cards.push({
      type: "belief",
      content: u.belief,
      data: { confidence: u.confidence },
    });
  }

  if (u.currentPattern.label || u.targetPattern.label || u.primitives.length > 0) {
    cards.push({
      type: "see_it",
      content: u.currentPattern.label || u.concept,
      secondary: u.targetPattern.label || undefined,
      data: {
        currentPattern: u.currentPattern,
        targetPattern: u.targetPattern,
        primitives: u.primitives,
      },
    });
  }

  if (u.experiment) {
    cards.push({
      type: "try_this",
      content: u.experiment,
      cue: u.coachingCue || undefined,
    });
  }

  if (u.evidenceRequest) {
    cards.push({
      type: "show_me",
      content: u.evidenceRequest,
    });
  }

  for (const b of stateUpdate?.newBreakthroughs ?? []) {
    cards.push({ type: "breakthrough", content: b });
  }

  if (cards.length === 0) {
    cards.push({ type: "question", content: "Tell me more about what you're working on." });
  }

  return cards;
}

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

type SupabaseClient = ReturnType<typeof createSupabaseFromRequest>;

async function applyStateUpdate(
  sb: SupabaseClient,
  threadId: string,
  thread: AxisThread,
  beliefs: AxisBelief[],
  openExperiment: AxisExperiment | null,
  update: StateUpdate | undefined,
  experimentCandidate: string | undefined,
): Promise<void> {
  const now = new Date().toISOString();

  // --- Thread scalar fields ---
  const threadPatch: Record<string, unknown> = { updated_at: now };
  if (update?.goal && !thread.goal) threadPatch.goal = update.goal;
  if (update?.focus) threadPatch.focus = update.focus;
  if (update?.currentBottleneck) threadPatch.current_bottleneck = update.currentBottleneck;
  if (update?.nextAction) threadPatch.next_action = update.nextAction;

  // Auto-title from focus or goal if thread has no title
  if (!thread.title && (update?.focus ?? update?.goal)) {
    const src = update?.focus ?? update?.goal ?? "";
    threadPatch.title = src.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // --- Open questions ---
  const existing = thread.open_questions ?? [];
  const resolved = new Set(update?.resolvedQuestions ?? []);
  const fresh = (update?.newOpenQuestions ?? []).filter((q) => !existing.includes(q));
  const updated = [...existing.filter((q) => !resolved.has(q)), ...fresh];
  if (updated.length !== existing.length || fresh.length > 0) {
    threadPatch.open_questions = updated;
  }

  await sb.from("axis_threads").update(threadPatch).eq("id", threadId);

  // --- New beliefs ---
  if (update?.newHypotheses?.length) {
    await sb.from("axis_thread_beliefs").insert(
      update.newHypotheses.map((h) => ({
        thread_id: threadId,
        belief_id: h.id,
        statement: h.statement,
        status: "active",
        confidence: h.confidence,
      })),
    );
  }

  // --- Belief status changes ---
  for (const slug of update?.confirmedHypothesisIds ?? []) {
    const match = beliefs.find((b) => b.belief_id === slug);
    if (match) {
      await sb.from("axis_thread_beliefs").update({ status: "confirmed" }).eq("id", match.id);
    }
  }
  for (const slug of update?.rejectedHypothesisIds ?? []) {
    const match = beliefs.find((b) => b.belief_id === slug);
    if (match) {
      await sb.from("axis_thread_beliefs").update({ status: "rejected" }).eq("id", match.id);
    }
  }

  // --- Evidence ---
  if (update?.newEvidence?.length) {
    await sb.from("axis_thread_evidence").insert(
      update.newEvidence.map((obs) => ({
        thread_id: threadId,
        observation: obs,
        source: "user_report",
        confidence: 0.8,
      })),
    );
  }

  // --- Experiment: close open + record result ---
  if (update?.experimentResult && openExperiment) {
    const statusMap: Record<"PASS" | "FAIL" | "INCONCLUSIVE", string> = {
      PASS: "completed",
      FAIL: "failed",
      INCONCLUSIVE: "inconclusive",
    };
    await sb
      .from("axis_thread_experiments")
      .update({
        status: statusMap[update.experimentResult.verdict],
        result: update.experimentResult.result,
        verdict: update.experimentResult.verdict,
      })
      .eq("id", openExperiment.id);
  }

  // --- Experiment: create new experiment from candidate ---
  if (experimentCandidate && !update?.experimentResult) {
    // Only create a new experiment if we're not closing the current one
    await sb.from("axis_thread_experiments").insert({
      thread_id: threadId,
      hypothesis: experimentCandidate,
      status: "open",
    });
  }

  // --- Breakthroughs ---
  if (update?.newBreakthroughs?.length) {
    await sb.from("axis_thread_breakthroughs").insert(
      update.newBreakthroughs.map((d) => ({ thread_id: threadId, description: d })),
    );
  }
}

async function persistCanonicalUnderstanding(
  sb: SupabaseClient,
  threadId: string,
  understanding: AxisUnderstanding,
): Promise<void> {
  const { error } = await sb
    .from("axis_threads")
    .update({
      current_understanding: understanding,
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);

  if (error) throw new Error(`Could not persist canonical understanding: ${error.message}`);
}

async function writeAxisEvent(
  sb: SupabaseClient,
  threadId: string,
  role: AxisEvent["role"],
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await sb.from("axis_thread_events").insert({
    thread_id: threadId,
    role,
    content: payload,
  });

  if (error) throw new Error(`Could not write Axis event: ${error.message}`);
}

async function loadThreadState(
  sb: SupabaseClient,
  requestedThreadId: string | null | undefined,
  userId: string | null,
): Promise<ThreadState> {
  let threadId = requestedThreadId ?? null;
  let thread: AxisThread | null = null;

  if (threadId) {
    const { data, error } = await sb.from("axis_threads").select("*").eq("id", threadId).single();
    if (error) console.error("[axis/run] thread lookup error:", error.message, "code:", error.code);
    thread = (data as AxisThread) ?? null;
  }

  if (!thread) {
    const { data, error } = await sb
      .from("axis_threads")
      .insert({ user_id: userId })
      .select("*")
      .single();
    if (error || !data) {
      console.error(
        "[axis/run] thread insert FAILED",
        "message:", error?.message,
        "code:", error?.code,
        "details:", error?.details,
        "hint:", error?.hint,
      );
      throw new Error(error?.message ?? "Could not create thread");
    }
    thread = data as AxisThread;
    threadId = thread.id;
  }

  const [{ data: beliefRows }, { data: eventRows }, { data: experimentRows }] =
    await Promise.all([
      sb
        .from("axis_thread_beliefs")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true }),
      sb
        .from("axis_thread_events")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(30),
      sb
        .from("axis_thread_experiments")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const recentEvents = ((eventRows ?? []) as AxisEvent[]).reverse();
  const experiments = (experimentRows ?? []) as AxisExperiment[];

  return {
    threadId: threadId!,
    thread,
    beliefs: (beliefRows ?? []) as AxisBelief[],
    recentEvents,
    experiments,
    openExperiment: experiments.find((e) => e.status === "open") ?? null,
  };
}

async function buildUnderstanding(input: BuildUnderstandingInput): Promise<BuildUnderstandingResult> {
  let understanding: AxisUnderstanding = emptyUnderstanding();
  let stateUpdate: StateUpdate | undefined;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: SYSTEM_UNDERSTANDING,
        messages: [{ role: "user", content: input.userContent }],
      }),
    });

    if (anthropicRes.ok) {
      const raw = (await anthropicRes.json()) as {
        content?: Array<{ type: string; text: string }>;
      };
      const text = raw.content?.find((c) => c.type === "text")?.text ?? "{}";
      const result = parseUnderstanding(text);
      understanding = result.understanding;
      stateUpdate = result.stateUpdate;
    } else {
      console.error("[axis/run] Anthropic error", anthropicRes.status);
    }
  } catch (err) {
    console.error("[axis/run] fetch error", (err as Error).message);
  }

  return {
    understanding: normalizeUnderstanding(
      understanding,
      input.priorUnderstanding,
      input.threadId,
    ),
    stateUpdate,
  };
}

function buildAxisResponse(
  understanding: AxisUnderstanding,
  observation: AxisObservation | null,
  comparison: ReturnType<typeof runAxisOperatingSystem>["comparison"] | null,
  operatingSystem: ReturnType<typeof runAxisOperatingSystem> | null,
): AxisRunResponse {
  return {
    understanding,
    cards: understandingToCards(understanding, undefined),
    comparison,
    operatingSystem,
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    return await handleRunCanonical(req);
  } catch (err) {
    // Unhandled exception — log full stack so it appears in Vercel runtime logs
    console.error("[axis/run] UNHANDLED EXCEPTION", (err as Error).message, (err as Error).stack);
    return Response.json({ error: "Internal error", detail: (err as Error).message }, { status: 500 });
  }
}

async function handleRunCanonical(req: Request): Promise<Response> {
  let body: RunRequest;
  try {
    body = (await req.json()) as RunRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  const hasAttachment = !!body.attachmentUrl;
  const isAttachmentOnly = hasAttachment && !message;
  if (!message && !hasAttachment) return Response.json({ error: "Empty message" }, { status: 400 });

  const sb = createSupabaseFromRequest(req);
  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser();
  if (authError) console.error("[axis/run] getUser error:", authError.message);

  let state: ThreadState;
  try {
    state = await loadThreadState(sb, body.threadId, user?.id ?? null);
  } catch (error) {
    return Response.json(
      { error: "Could not create thread", supabase: (error as Error).message },
      { status: 500 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !isAttachmentOnly) return Response.json({ error: "No API key" }, { status: 503 });

  const priorUnderstanding = state.thread.current_understanding ?? emptyUnderstanding();
  await writeAxisEvent(sb, state.threadId, "user", { message, fileName: body.fileName ?? null });

  let observation: AxisObservation | null = null;
  let comparison: ReturnType<typeof runAxisOperatingSystem>["comparison"] | null = null;
  let understanding = priorUnderstanding;
  let stateUpdate: StateUpdate | undefined;
  // True when the turn is handled entirely by the observation path.
  let isObservationTurn = hasAttachment;

  if (hasAttachment) {
    observation = await observeEvidence({
      apiKey,
      evidenceUrl: body.attachmentUrl!,
      evidenceType: body.attachmentType ?? "",
      message: message ?? "",
      prior: priorUnderstanding,
    });
    understanding = updateUnderstandingFromObservation(priorUnderstanding, observation).understanding;
  }

  if (!isAttachmentOnly) {
    // For text-only input, try to extract a structured observation first.
    // If the message contains observable physical facts, update understanding
    // from observation and skip buildUnderstanding (no coaching generated).
    if (!hasAttachment && message && apiKey) {
      const textObs = await observeTextReport({ apiKey, message, prior: priorUnderstanding });
      if (hasObservationSignal(textObs)) {
        observation = textObs;
        understanding = updateUnderstandingFromObservation(priorUnderstanding, textObs).understanding;
        isObservationTurn = true;
      }
    }

    if (!isObservationTurn) {
      const memCtx = buildMemoryContext(
        state.thread,
        state.beliefs,
        state.experiments,
        state.recentEvents,
      );
      const userContent = [
        memCtx ? `--- THREAD CONTINUITY ---\n${memCtx}\n--- END CONTINUITY ---` : null,
        message ? `Message: "${message}"` : null,
        body.attachmentUrl
          ? `Attachment: ${body.attachmentType ?? "file"} at ${body.attachmentUrl}`
          : null,
        observation
          ? `--- OBSERVATION ---\nSummary: ${observation.summary || "none"}\nRelevant signals: ${observation.relevantSignals.join(", ") || "none"}\nIgnored noise: ${observation.ignoredNoise.join(", ") || "none"}\n--- END OBSERVATION ---`
          : null,
        hasAttachment
          ? `--- CANONICAL BELIEF STATE ---\nConcept: ${understanding.concept || "unset"}\nBelief: ${understanding.belief || "unset"}\nConfidence: ${understanding.confidence}\n--- END CANONICAL BELIEF STATE ---`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      const built = await buildUnderstanding({
        apiKey: apiKey!,
        priorUnderstanding: understanding,
        threadId: state.threadId,
        userContent,
      });
      understanding = built.understanding;
      stateUpdate = stateUpdateFromUnderstanding(built.stateUpdate, understanding);
    }
  }

  const operatingSystem = isObservationTurn
    ? null
    : runAxisOperatingSystem({
        understanding,
        observation,
        learnFromSources: false,
      });
  understanding = normalizeUnderstanding(
    operatingSystem?.understanding ?? understanding,
    priorUnderstanding,
    state.threadId,
  );
  comparison = isObservationTurn ? null : (operatingSystem?.comparison ?? null);

  await persistCanonicalUnderstanding(sb, state.threadId, understanding);

  if (!isObservationTurn) {
    await applyStateUpdate(
      sb,
      state.threadId,
      state.thread,
      state.beliefs,
      state.openExperiment,
      stateUpdate,
      understanding.experiment || undefined,
    );
  }

  if (body.attachmentUrl && !body.evidenceId) {
    const src = (body.attachmentType ?? "").startsWith("video/") ? "video" : "photo";
    await sb.from("axis_thread_evidence").insert({
      thread_id: state.threadId,
      observation: body.fileName ?? "Attachment",
      source: src,
      confidence: 1.0,
      url: body.attachmentUrl,
      file_path: body.attachmentPath ?? null,
      file_name: body.fileName ?? null,
    });
  }

  const response = buildAxisResponse(understanding, observation, comparison, operatingSystem);
  response.cards = isObservationTurn
    ? [
        {
          type: "evidence_received",
          content: observation?.summary || body.fileName || "Observation recorded.",
          secondary: isAttachmentOnly
            ? (body.fileName ?? undefined)
            : undefined,
        },
      ]
    : understandingToCards(understanding, stateUpdate);

  await writeAxisEvent(sb, state.threadId, "assistant", {
    cards: response.cards,
    understanding: response.understanding,
    observation,
    comparison: response.comparison,
    operatingSystem: response.operatingSystem,
    evidenceId: body.evidenceId ?? null,
  });

  const { data: sidebarData } = await sb
    .from("axis_threads")
    .select("id, title, focus, current_bottleneck, updated_at")
    .order("updated_at", { ascending: false })
    .limit(30);

  return Response.json({
    threadId: state.threadId,
    understanding: response.understanding,
    cards: response.cards,
    comparison: response.comparison,
    operatingSystem: response.operatingSystem,
    sidebarThreads: sidebarData ?? [],
  });
}
