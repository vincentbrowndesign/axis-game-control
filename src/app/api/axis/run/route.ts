export const runtime = "nodejs";

import {
  createSupabaseFromRequest,
  type AxisBelief,
  type AxisCard,
  type AxisEvent,
  type AxisThread,
} from "../../../../lib/axis-server";

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

interface ModelResponse {
  confidence: number;
  insight?: string;
  reasoning?: string;
  mentalModel?: string;
  demonstration?: {
    currentState: string;
    targetState: string;
    keyDifference: string;
    executionCue: string;
  };
  experimentCandidate?: string;
  clarificationQuestion?: string;
  stateUpdate?: StateUpdate;
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
  fileName?: string | null;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM = `You are Axis. Your job is not to answer questions. Your job is to evolve a player's understanding over time.

A breakthrough is a durable change in understanding, perception, execution, decision-making, or behavior.

---

STATE UPDATE (required in every response)

Every response must include a stateUpdate block. This is how the thread accumulates.

stateUpdate fields:
- goal: the user's development goal (infer from first message; persist for entire thread — only update if user explicitly resets)
- focus: the specific mechanism this thread investigates (short phrase; set from first exchange; do not change unless user shifts topics)
- currentBottleneck: the single constraint most blocking progress right now
- nextAction: what the user should do before the next session (one imperative sentence). Example: "Track 10 PG possessions and note each effort vs efficiency choice."
- newOpenQuestions: questions that remain unanswered after this exchange (new ones only)
- resolvedQuestions: open questions this message finally answers (verbatim from OPEN QUESTIONS)
- newHypotheses: hypotheses ESTABLISHED for the first time this exchange (array of {id, statement, confidence})
  - id: kebab-case slug, e.g. "set-point-drift"
  - statement: one declarative sentence
  - confidence: 0.0–1.0
- confirmedHypothesisIds: slugs of previously active hypotheses the user's message confirms
- rejectedHypothesisIds: slugs of hypotheses the user's message rules out
- newEvidence: verbatim facts the user gave you this exchange
- experimentResult: ONLY when OPEN EXPERIMENT is shown and user is reporting back — { result: "<verbatim user report>", verdict: "PASS" | "FAIL" | "INCONCLUSIVE" }
- newBreakthroughs: durable changes in understanding confirmed this exchange (usually empty; add one when experiment verdict is PASS)

---

THREAD MEMORY RULES

When THREAD CONTINUITY is present:
1. Active hypotheses drive generation. Build on established context — do not re-diagnose.
2. Reference prior conclusions directly. Say "Based on your earlier answer…" when building.
3. The current bottleneck drives the experiment. Changing it requires new evidence.
4. Confirmed breakthroughs are closed. Do not repeat them as insights.
5. Resolved questions are closed. Do not ask them again.
6. OPEN EXPERIMENT takes priority. If user is reporting a result, handle that before generating new coaching.
7. Each response must advance the thread, not reset it.

---

EXPERIMENT TRACKING

When THREAD CONTINUITY shows an OPEN EXPERIMENT:
- If the user's message is reporting a result: set experimentResult and update verdict. If PASS, add to newBreakthroughs.
- If the user is asking something new: keep the experiment open (omit experimentResult).

Example experiment result:
experimentResult: {"result": "Bracing my core made the stop feel much more controlled.", "verdict": "PASS"}
newBreakthroughs: ["Core brace before deceleration improves stability — confirmed by user field test."]

---

COACHING STEPS (when confidence >= 0.80)

STEP 1 — INSIGHT
One observation. The single mechanism most likely to create immediate progress. Specific and structural.

STEP 2 — MENTAL MODEL
One transferable principle. State it as a structural law.

STEP 3 — DEMONSTRATION
Four fields: currentState, targetState, keyDifference, executionCue.

STEP 4 — EXPERIMENT
The smallest possible action that tests the insight. One imperative sentence.

OUTPUT RULES:
- confidence >= 0.80: return insight, reasoning, mentalModel, demonstration, experimentCandidate, stateUpdate.
- confidence < 0.80: return confidence, clarificationQuestion, stateUpdate only.
- Never write generic advice. Name a specific mechanism.
- Direct coaching voice. No consultant framing.
- JSON only. No markdown. No explanation.

Schema (confident):
{"confidence":0.88,"insight":"...","reasoning":"...","mentalModel":"...","demonstration":{"currentState":"...","targetState":"...","keyDifference":"...","executionCue":"..."},"experimentCandidate":"...","stateUpdate":{"goal":"...","focus":"...","currentBottleneck":"...","nextAction":"...","newOpenQuestions":[],"resolvedQuestions":[],"newHypotheses":[{"id":"...","statement":"...","confidence":0.85}],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":["..."],"experimentResult":null,"newBreakthroughs":[]}}

Schema (not confident):
{"confidence":0.64,"clarificationQuestion":"...","stateUpdate":{"goal":"...","focus":"...","currentBottleneck":null,"nextAction":null,"newOpenQuestions":["..."],"resolvedQuestions":[],"newHypotheses":[],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":[],"experimentResult":null,"newBreakthroughs":[]}}

---

Few-shot examples:

Intent: "I'm skipping training today to go to a Wings game"
{"confidence":0.68,"clarificationQuestion":"What would make tonight count as development — are you trying to study something specific about how pros play?","stateUpdate":{"goal":"Develop while attending Wings game","focus":"game observation as development","currentBottleneck":null,"nextAction":null,"newOpenQuestions":["What would make tonight a development session rather than just watching?"],"resolvedQuestions":[],"newHypotheses":[],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":[],"experimentResult":null,"newBreakthroughs":[]}}

THREAD CONTINUITY EXAMPLE:
Prior state: goal="Develop while attending Wings game", focus="PG effort and competitiveness", bottleneck="undefined observation structure", openQuestions=["What would make tonight a development session?"], experiment=null
Intent: "I want to study PG effort and competitiveness. What should I focus on?"
{"confidence":0.92,"insight":"You already established the goal two messages ago — development through observation. Focus = PG effort and competitiveness. The structure is: 10 possessions, one question, yes/no answer each time.","reasoning":"The open question about what makes tonight count as development is now answered by the user's own statement. The antidote to passive watching is a countable observable.","mentalModel":"Observation only becomes development when structured around a single question. The question is the lens. Without it, the game is entertainment.","demonstration":{"currentState":"Watching without a specific target","targetState":"Tracking 10 consecutive PG possessions with one focus","keyDifference":"A count turns watching into measurement","executionCue":"Pick your possession number — 1 of 10 — before the PG touches the ball"},"experimentCandidate":"Tonight: track 10 PG possessions. For each one — did he choose effort over efficiency? Yes or no.","stateUpdate":{"goal":"Develop while attending Wings game","focus":"PG effort and competitiveness","currentBottleneck":"no structured observation target","nextAction":"Track 10 PG possessions tonight and report back with the count.","newOpenQuestions":[],"resolvedQuestions":["What would make tonight a development session?"],"newHypotheses":[{"id":"structured-10-possession-count","statement":"10-possession structured observation converts passive watching into measurable development","confidence":0.92}],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":["User wants to study PG effort and competitiveness"],"experimentResult":null,"newBreakthroughs":[]}}

EXPERIMENT RESULT EXAMPLE:
Prior state: open experiment = "Track 10 PG possessions tonight."
Intent: "I tracked 8. He chose effort in 6 out of 8."
{"confidence":0.95,"insight":"6 out of 8 is a 75% effort rate — high enough to build a model from. The 2 efficiency choices likely came at specific game moments, which is where the real teaching is.","reasoning":"The data is real. The experiment worked. Now the question shifts from 'does he choose effort?' to 'when does he choose efficiency instead, and why?'","mentalModel":"Players reveal their hierarchy of values under fatigue and pressure, not in easy possessions.","demonstration":{"currentState":"Observing PG behavior without a baseline","targetState":"Tracking when efficiency overrides effort and what triggers the switch","keyDifference":"The exception is more instructive than the rule","executionCue":"At the next game: watch the 2 efficiency possessions more carefully than the 6 effort ones"},"experimentCandidate":"Next game: identify exactly which game situations cause the shift from effort to efficiency.","stateUpdate":{"goal":"Develop while attending Wings game","focus":"PG effort and competitiveness","currentBottleneck":"no model yet for when efficiency overrides effort","nextAction":"At the next game, track the situations that cause PG to choose efficiency over effort.","newOpenQuestions":["What game situations trigger the shift from effort to efficiency?"],"resolvedQuestions":[],"newHypotheses":[{"id":"effort-efficiency-hierarchy","statement":"PG chooses effort over efficiency 75%+ of possessions but efficiency choices cluster at specific game moments","confidence":0.85}],"confirmedHypothesisIds":["structured-10-possession-count"],"rejectedHypothesisIds":[],"newEvidence":["PG chose effort in 6 out of 8 tracked possessions"],"experimentResult":{"result":"Tracked 8 possessions. PG chose effort in 6 out of 8.","verdict":"PASS"},"newBreakthroughs":["Structured 10-possession observation works — user completed the experiment and gathered real data."]}}`;

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

function safeParse(raw: string): ModelResponse {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(slice) as Record<string, unknown>;

    const confidence =
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.5;

    const demo = (() => {
      if (!parsed.demonstration || typeof parsed.demonstration !== "object") return undefined;
      const d = parsed.demonstration as Record<string, unknown>;
      if (!d.currentState && !d.keyDifference) return undefined;
      return {
        currentState: String(d.currentState ?? ""),
        targetState: String(d.targetState ?? ""),
        keyDifference: String(d.keyDifference ?? ""),
        executionCue: String(d.executionCue ?? ""),
      };
    })();

    return {
      confidence,
      insight:
        typeof parsed.insight === "string" && parsed.insight.trim()
          ? parsed.insight.trim()
          : undefined,
      reasoning:
        typeof parsed.reasoning === "string" && parsed.reasoning.trim()
          ? parsed.reasoning.trim()
          : undefined,
      mentalModel:
        typeof parsed.mentalModel === "string" && parsed.mentalModel.trim()
          ? parsed.mentalModel.trim()
          : undefined,
      demonstration: demo,
      experimentCandidate:
        typeof parsed.experimentCandidate === "string" && parsed.experimentCandidate.trim()
          ? parsed.experimentCandidate.trim()
          : undefined,
      clarificationQuestion:
        typeof parsed.clarificationQuestion === "string" &&
        parsed.clarificationQuestion.trim()
          ? parsed.clarificationQuestion.trim()
          : undefined,
      stateUpdate: parseStateUpdate(parsed.stateUpdate),
    };
  } catch {
    return { confidence: 0 };
  }
}

function toCards(r: ModelResponse): AxisCard[] {
  const cards: AxisCard[] = [];

  if (r.clarificationQuestion) {
    cards.push({ type: "question", content: r.clarificationQuestion });
    return cards;
  }

  if (r.insight) {
    cards.push({ type: "insight", content: r.insight, secondary: r.reasoning });
  }

  if (r.mentalModel) {
    cards.push({ type: "insight", content: r.mentalModel });
  }

  if (r.demonstration) {
    cards.push({
      type: "experiment",
      content: r.demonstration.keyDifference,
      secondary: r.demonstration.targetState || undefined,
      cue: r.demonstration.executionCue || undefined,
    });
  }

  if (r.experimentCandidate) {
    cards.push({ type: "experiment", content: r.experimentCandidate });
  }

  for (const b of r.stateUpdate?.newBreakthroughs ?? []) {
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

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    return await handleRun(req);
  } catch (err) {
    // Unhandled exception — log full stack so it appears in Vercel runtime logs
    console.error("[axis/run] UNHANDLED EXCEPTION", (err as Error).message, (err as Error).stack);
    return Response.json({ error: "Internal error", detail: (err as Error).message }, { status: 500 });
  }
}

async function handleRun(req: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "No API key" }, { status: 503 });

  let body: RunRequest;
  try {
    body = (await req.json()) as RunRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  const hasAttachment = !!body.attachmentUrl;
  if (!message && !hasAttachment) return Response.json({ error: "Empty message" }, { status: 400 });

  const sb = createSupabaseFromRequest(req);

  // Auth (nullable — guests allowed)
  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser();
  if (authError) console.error("[axis/run] getUser error:", authError.message);
  const userId = user?.id ?? null;

  // Resolve thread
  let threadId = body.threadId ?? null;
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
      // Log the actual Supabase error so it appears in Vercel runtime logs
      console.error(
        "[axis/run] thread insert FAILED",
        "message:", error?.message,
        "code:", error?.code,
        "details:", error?.details,
        "hint:", error?.hint,
      );
      return Response.json(
        { error: "Could not create thread", supabase: error?.message ?? "no data" },
        { status: 500 },
      );
    }
    thread = data as AxisThread;
    threadId = thread.id;
  }

  // Load beliefs + events + open experiments in parallel
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
        .order("created_at", { ascending: true })
        .limit(30),
      sb
        .from("axis_thread_experiments")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const beliefs = (beliefRows ?? []) as AxisBelief[];
  const recentEvents = (eventRows ?? []) as AxisEvent[];
  const experiments = (experimentRows ?? []) as AxisExperiment[];
  const openExperiment = experiments.find((e) => e.status === "open") ?? null;

  // Append user event
  void sb.from("axis_thread_events").insert({
    thread_id: threadId,
    role: "user",
    content: { message },
  });

  // Build memory context
  const memCtx = buildMemoryContext(thread, beliefs, experiments, recentEvents);

  const userContent = [
    memCtx ? `--- THREAD CONTINUITY ---\n${memCtx}\n--- END CONTINUITY ---` : null,
    message ? `Message: "${message}"` : null,
    body.attachmentUrl
      ? `Attachment: ${body.attachmentType ?? "file"} at ${body.attachmentUrl}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Call Anthropic
  let parsed: ModelResponse = { confidence: 0 };
  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (anthropicRes.ok) {
      const raw = (await anthropicRes.json()) as {
        content?: Array<{ type: string; text: string }>;
      };
      const text = raw.content?.find((c) => c.type === "text")?.text ?? "{}";
      parsed = safeParse(text);
    } else {
      console.error("[axis/run] Anthropic error", anthropicRes.status);
    }
  } catch (err) {
    console.error("[axis/run] fetch error", (err as Error).message);
  }

  const cards = toCards(parsed);

  // Persist state + assistant event (fire-and-forget)
  void (async () => {
    await applyStateUpdate(
      sb,
      threadId!,
      thread!,
      beliefs,
      openExperiment,
      parsed.stateUpdate,
      parsed.experimentCandidate,
    );
    // Evidence row for uploaded file attachment
    if (body.attachmentUrl) {
      const src = (body.attachmentType ?? "").startsWith("video/") ? "video" : "photo";
      await sb.from("axis_thread_evidence").insert({
        thread_id: threadId,
        observation: body.fileName ?? "Attachment",
        source: src,
        confidence: 1.0,
        url: body.attachmentUrl,
        file_path: body.attachmentPath ?? null,
        file_name: body.fileName ?? null,
      });
    }
    await sb.from("axis_thread_events").insert({
      thread_id: threadId,
      role: "assistant",
      content: { cards },
    });
  })();

  // Sidebar threads
  const { data: sidebarData } = await sb
    .from("axis_threads")
    .select("id, title, focus, current_bottleneck, updated_at")
    .order("updated_at", { ascending: false })
    .limit(30);

  return Response.json({ threadId, cards, sidebarThreads: sidebarData ?? [] });
}
