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
  newHypotheses?: Array<{ id: string; statement: string; confidence: number }>;
  confirmedHypothesisIds?: string[];
  rejectedHypothesisIds?: string[];
  newEvidence?: string[];
  newBreakthroughs?: string[];
  resolvedQuestions?: string[];
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

interface RunRequest {
  message: string;
  threadId?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM = `You are Axis. Your job is not to answer questions. Your job is to evolve a player's understanding over time.

A breakthrough is a durable change in understanding, perception, execution, decision-making, or behavior.

---

STATE UPDATE (required in every response)

Every response must include a stateUpdate block. This is how the thread learns.

stateUpdate fields:
- goal: the user's development goal (infer from the first message; persist for the entire thread — only update if user explicitly resets). Example: "Develop through live game observation"
- focus: what specific mechanism this thread is investigating (short phrase, set from first exchange, do not change unless user shifts topics). Example: "PG effort and competitiveness"
- currentBottleneck: the single constraint most blocking progress right now (update as evidence narrows the problem)
- newHypotheses: hypotheses this exchange ESTABLISHES for the first time (array of {id, statement, confidence})
  - id: kebab-case slug, e.g. "set-point-drift"
  - statement: one declarative sentence
  - confidence: 0.0–1.0
- confirmedHypothesisIds: slugs of previously open hypotheses the user's message confirms
- rejectedHypothesisIds: slugs of hypotheses the user's message rules out
- newEvidence: verbatim facts the user gave you
- newBreakthroughs: breakthroughs confirmed this exchange (usually empty)
- resolvedQuestions: open questions this message answers

---

THREAD MEMORY RULES

When THREAD CONTINUITY is present:
1. Active hypotheses drive generation. If a hypothesis explains the problem, build on it.
2. Reference prior conclusions directly. Say "Based on your earlier answer..." when building.
3. The current bottleneck drives the experiment. Changing it requires new evidence.
4. Confirmed breakthroughs are closed. Do not repeat them.
5. Resolved questions are closed. Do not ask them again.
6. Each response must advance the thread, not reset it.

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

Schema when confident (confidence >= 0.80):
{"confidence":0.88,"insight":"...","reasoning":"...","mentalModel":"...","demonstration":{"currentState":"...","targetState":"...","keyDifference":"...","executionCue":"..."},"experimentCandidate":"...","stateUpdate":{"goal":"...","focus":"...","currentBottleneck":"...","newHypotheses":[{"id":"...","statement":"...","confidence":0.85}],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":["..."],"newBreakthroughs":[],"resolvedQuestions":[]}}

Schema when not confident (confidence < 0.80):
{"confidence":0.64,"clarificationQuestion":"...","stateUpdate":{"goal":"...","focus":"...","currentBottleneck":null,"newHypotheses":[],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":[],"newBreakthroughs":[],"resolvedQuestions":[]}}

---

Examples:

Intent: "I'm skipping training today to go to a Wings game"
{"confidence":0.68,"clarificationQuestion":"What would make tonight a development session instead of just watching — are you trying to study something specific about how pros play?","stateUpdate":{"goal":"Develop while attending Wings game","focus":"game observation as development","currentBottleneck":null,"newHypotheses":[],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":[],"newBreakthroughs":[],"resolvedQuestions":[]}}

THREAD CONTINUITY EXAMPLE:
Prior state: goal="Develop while attending Wings game", focus="PG effort and competitiveness", hypotheses=[{id:"passive-observation-problem", statement:"Watching without a question produces no development", status:"active", confidence:0.8}], openQuestions=["What would make tonight a development session?"]
Intent: "I want to study PG effort and competitiveness. What should I focus on?"
{"confidence":0.92,"insight":"You already answered your own question two messages ago — the goal is to develop through observation. Focus = PG effort and competitiveness. Track 10 possessions and note every moment a PG chooses effort over efficiency.","reasoning":"The hypothesis is that passive observation without a question produces nothing. The antidote is a specific observable: 10 possessions, one focus, written or mental count. That creates active observation.","mentalModel":"Observation only becomes development when it is structured around a question. The question is the lens. Without it, the game is entertainment.","demonstration":{"currentState":"Watching without a specific target","targetState":"Tracking 10 consecutive possessions with a single focus","keyDifference":"A count turns watching into measurement","executionCue":"Pick a possession number — 1 of 10 — before the PG touches the ball"},"experimentCandidate":"Track 10 PG possessions tonight. Each one: did he choose effort over efficiency? Yes or no.","stateUpdate":{"goal":"Develop while attending Wings game","focus":"PG effort and competitiveness","currentBottleneck":"undefined observation structure","newHypotheses":[{"id":"10-possession-observation","statement":"Structured 10-possession tracking converts passive watching into measurable development","confidence":0.92}],"confirmedHypothesisIds":["passive-observation-problem"],"rejectedHypothesisIds":[],"newEvidence":["User wants to study PG effort and competitiveness"],"newBreakthroughs":[],"resolvedQuestions":["What would make tonight a development session?"]}}`;

// ---------------------------------------------------------------------------
// Memory context builder
// ---------------------------------------------------------------------------

function buildMemoryContext(
  thread: AxisThread,
  beliefs: AxisBelief[],
  recentEvents: AxisEvent[],
): string | null {
  const lines: string[] = [];

  if (thread.goal) lines.push(`GOAL: ${thread.goal}`);
  if (thread.focus) lines.push(`THREAD FOCUS: ${thread.focus}`);
  if (thread.current_bottleneck) lines.push(`CURRENT BOTTLENECK: ${thread.current_bottleneck}`);

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
      `CONFIRMED HYPOTHESES:\n${confirmed.map((b) => `- [${b.belief_id ?? "?"}] ${b.statement}`).join("\n")}`,
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

  return {
    goal:
      typeof u.goal === "string" && u.goal.trim() ? u.goal.trim() : undefined,
    focus:
      typeof u.focus === "string" && u.focus.trim() ? u.focus.trim() : undefined,
    currentBottleneck:
      typeof u.currentBottleneck === "string" && u.currentBottleneck.trim()
        ? u.currentBottleneck.trim()
        : undefined,
    newHypotheses: newHypotheses.length > 0 ? newHypotheses : undefined,
    confirmedHypothesisIds:
      strArr("confirmedHypothesisIds").length > 0
        ? strArr("confirmedHypothesisIds")
        : undefined,
    rejectedHypothesisIds:
      strArr("rejectedHypothesisIds").length > 0
        ? strArr("rejectedHypothesisIds")
        : undefined,
    newEvidence: strArr("newEvidence").length > 0 ? strArr("newEvidence") : undefined,
    newBreakthroughs:
      strArr("newBreakthroughs").length > 0 ? strArr("newBreakthroughs") : undefined,
    resolvedQuestions:
      strArr("resolvedQuestions").length > 0 ? strArr("resolvedQuestions") : undefined,
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
  existingBeliefs: AxisBelief[],
  thread: AxisThread,
  update: StateUpdate | undefined,
): Promise<void> {
  const now = new Date().toISOString();

  // Thread-level fields
  const threadPatch: Record<string, string | null> = { updated_at: now };
  if (update?.goal && !thread.goal) threadPatch.goal = update.goal;
  if (update?.focus) threadPatch.focus = update.focus;
  if (update?.currentBottleneck) threadPatch.current_bottleneck = update.currentBottleneck;

  // Auto-title from focus if thread has no title
  if (!thread.title && (update?.focus ?? update?.goal)) {
    const src = update.focus ?? update.goal ?? "";
    threadPatch.title = src.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  await sb.from("axis_threads").update(threadPatch).eq("id", threadId);

  // New beliefs
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

  // Confirmed
  for (const slug of update?.confirmedHypothesisIds ?? []) {
    const match = existingBeliefs.find((b) => b.belief_id === slug);
    if (match) {
      await sb
        .from("axis_thread_beliefs")
        .update({ status: "confirmed" })
        .eq("id", match.id);
    }
  }

  // Rejected
  for (const slug of update?.rejectedHypothesisIds ?? []) {
    const match = existingBeliefs.find((b) => b.belief_id === slug);
    if (match) {
      await sb
        .from("axis_thread_beliefs")
        .update({ status: "rejected" })
        .eq("id", match.id);
    }
  }

  // Evidence
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

  // Breakthroughs
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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "No API key" }, { status: 503 });

  let body: RunRequest;
  try {
    body = (await req.json()) as RunRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) return Response.json({ error: "Empty message" }, { status: 400 });

  const sb = createSupabaseFromRequest(req);

  // Auth (nullable — guests allowed)
  const {
    data: { user },
  } = await sb.auth.getUser();
  const userId = user?.id ?? null;

  // Resolve thread
  let threadId = body.threadId ?? null;
  let thread: AxisThread | null = null;

  if (threadId) {
    const { data } = await sb
      .from("axis_threads")
      .select("*")
      .eq("id", threadId)
      .single();
    thread = (data as AxisThread) ?? null;
  }

  if (!thread) {
    const { data, error } = await sb
      .from("axis_threads")
      .insert({ user_id: userId })
      .select("*")
      .single();
    if (error || !data) {
      return Response.json({ error: "Could not create thread" }, { status: 500 });
    }
    thread = data as AxisThread;
    threadId = thread.id;
  }

  // Load beliefs + recent events in parallel
  const [{ data: beliefRows }, { data: eventRows }] = await Promise.all([
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
  ]);

  const beliefs = (beliefRows ?? []) as AxisBelief[];
  const recentEvents = (eventRows ?? []) as AxisEvent[];

  // Append user event
  void sb.from("axis_thread_events").insert({
    thread_id: threadId,
    role: "user",
    content: { message },
  });

  // Build memory context
  const memCtx = buildMemoryContext(thread, beliefs, recentEvents);

  const userContent = [
    memCtx ? `--- THREAD CONTINUITY ---\n${memCtx}\n--- END CONTINUITY ---` : null,
    `Message: "${message}"`,
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
        max_tokens: 1400,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (anthropicRes.ok) {
      const raw = await anthropicRes.json() as { content?: Array<{ type: string; text: string }> };
      const text = raw.content?.find((c) => c.type === "text")?.text ?? "{}";
      parsed = safeParse(text);
    } else {
      console.error("[axis/run] Anthropic error", anthropicRes.status);
    }
  } catch (err) {
    console.error("[axis/run] fetch error", (err as Error).message);
  }

  const cards = toCards(parsed);

  // Persist state update + assistant event (fire-and-forget)
  void (async () => {
    await applyStateUpdate(sb, threadId!, beliefs, thread!, parsed.stateUpdate);
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

  return Response.json({
    threadId,
    cards,
    sidebarThreads: sidebarData ?? [],
  });
}
