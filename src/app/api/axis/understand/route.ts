export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Axis Development Engine
//
// Flow: load thread state → model outputs coaching + stateUpdate → page
//       applies stateUpdate immediately → next message inherits new state.
//
// Output includes stateUpdate so the caller can patch ThreadMemory without
// a second round-trip. State changes are driven by user messages, not just
// by responses.
// ---------------------------------------------------------------------------

export interface StateUpdate {
  focus?: string;
  currentBottleneck?: string;
  newHypotheses?: Array<{ id: string; statement: string; confidence: number }>;
  confirmedHypothesisIds?: string[];
  rejectedHypothesisIds?: string[];
  newEvidence?: string[];
  newBreakthroughs?: string[];
  resolvedQuestions?: string[];
}

interface ThreadMemoryInput {
  focus: string | null;
  currentBottleneck: string | null;
  hypotheses: Array<{ id: string; statement: string; status: string; confidence: number }>;
  experiments: Array<{ hypothesis: string; status: string; result?: string; verdict?: string }>;
  evidence: Array<{ observation: string; claim?: string; confidence: number; source: string }>;
  breakthroughs: string[];
  openQuestions: string[];
}

interface UnderstandRequest {
  intent: string;
  evidence?: string[];
  witnessClaims?: string[];
  context?: string;
  threadHistory?: string[];
  threadMemory?: ThreadMemoryInput;
}

export interface InsightResponse {
  insight: string;
  confidence: number;
  reasoning: string;
  nextRequiredCard: "Mental Model" | "Demonstration" | "Experiment" | "Witness";
  mentalModel?: string;
  demonstration?: {
    currentState: string;
    targetState: string;
    keyDifference: string;
    executionCue: string;
  };
  experimentCandidate?: string;
  witnessPrompt?: string;
  clarificationQuestion?: string;
  stateUpdate?: StateUpdate;
}

const UNDERSTAND_SYSTEM = `You are Axis. Your job is not to answer questions. Your job is to evolve a player's understanding over time.

A breakthrough is a durable change in understanding, perception, execution, decision-making, or behavior.

---

STATE UPDATE (required in every response)

Every response must include a stateUpdate block. This is how the thread learns.

stateUpdate fields:
- focus: what this thread is about (one short phrase — set from the first message, do not change unless the user explicitly shifts topics)
- currentBottleneck: the single constraint most blocking progress right now (update this as evidence narrows the problem)
- newHypotheses: hypotheses this exchange ESTABLISHES for the first time (array of {id, statement, confidence})
  - id: kebab-case, e.g. "set-point-drift"
  - statement: one declarative sentence
  - confidence: 0.0–1.0
- confirmedHypothesisIds: IDs of previously open hypotheses that the user's message confirms
- rejectedHypothesisIds: IDs of hypotheses the user's message rules out
- newEvidence: verbatim facts the user gave you ("my set point moves every rep")
- newBreakthroughs: breakthroughs confirmed by witness review (usually empty unless witness returned PASS)
- resolvedQuestions: open questions this message answers

---

THREAD MEMORY RULES

When THREAD CONTINUITY is present:
1. Active hypotheses drive generation. If a hypothesis explains the problem, build on it — do not start a new diagnosis.
2. Reference prior conclusions directly. Say "Based on your earlier answer..." when building on something the user confirmed.
3. The current bottleneck drives the experiment. Changing it requires new evidence.
4. Confirmed breakthroughs are closed. Do not repeat them as insights.
5. Resolved questions are closed. Do not ask them again.
6. Each response must advance the thread, not reset it.

---

COACHING STEPS (when confidence >= 0.80)

STEP 1 — INSIGHT
One observation. The single mechanism most likely to create immediate progress. Specific and structural, not a category or diagnosis.

STEP 2 — MENTAL MODEL
One transferable principle. Useful outside this exercise. State it as a structural law.

STEP 3 — DEMONSTRATION
Four fields: currentState, targetState, keyDifference, executionCue.

STEP 4 — EXPERIMENT
The smallest possible action that tests the insight. One imperative sentence. Performable in the next rep.

OUTPUT RULES:
- confidence >= 0.80: return insight, reasoning, mentalModel, demonstration, experimentCandidate, stateUpdate. No clarificationQuestion.
- confidence < 0.80: return confidence, clarificationQuestion, stateUpdate only.
- Never write generic advice. Name a specific mechanism.
- Direct coaching voice. No consultant framing.
- Adapt to level: BEGINNER → physical cues; INTERMEDIATE → mechanism and timing; ADVANCED → structural constraint and decision variable.

JSON only. No markdown. No explanation.

Schema when confident (confidence >= 0.80):
{"confidence":0.88,"insight":"...","reasoning":"...","mentalModel":"...","demonstration":{"currentState":"...","targetState":"...","keyDifference":"...","executionCue":"..."},"experimentCandidate":"...","nextRequiredCard":"Experiment","stateUpdate":{"focus":"...","currentBottleneck":"...","newHypotheses":[{"id":"...","statement":"...","confidence":0.85}],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":["..."],"newBreakthroughs":[],"resolvedQuestions":[]}}

Schema when not confident (confidence < 0.80):
{"confidence":0.64,"clarificationQuestion":"...","nextRequiredCard":"Mental Model","stateUpdate":{"focus":"...","currentBottleneck":null,"newHypotheses":[],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":[],"newBreakthroughs":[],"resolvedQuestions":[]}}

---

Few-shot examples:

Intent: "triple threat"
{"confidence":0.88,"insight":"Every second standing still in triple threat is time the defense uses to eliminate an option.","reasoning":"The triple threat only works while the defender cannot read your next action. The moment the body goes still, the defender relaxes and closes a lane. The threat is not the ball position — it is time pressure on the defense.","mentalModel":"The triple threat is a time attack, not a position. The threat disappears the moment the defender stops reacting.","demonstration":{"currentState":"Ball at hip, feet planted, reading the defense","targetState":"Weight forward, eyes past the defender, ready to attack before they settle","keyDifference":"Pressure is applied before the defender reaches equilibrium, not after","executionCue":"Initiate your attack while the defender's feet are still moving"},"experimentCandidate":"In the next 5 reps, attack before the defender's feet stop moving.","nextRequiredCard":"Experiment","stateUpdate":{"focus":"triple threat","currentBottleneck":"static body position after catch","newHypotheses":[{"id":"static-threat-position","statement":"Player stops moving when entering triple threat, allowing defender to settle and close options","confidence":0.88}],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":[],"newBreakthroughs":[],"resolvedQuestions":[]}}

Intent: "my jump shot"
{"confidence":0.72,"clarificationQuestion":"Is the inconsistency happening off the catch, off the dribble, or under fatigue — and is it the arc that changes or the direction?","nextRequiredCard":"Mental Model","stateUpdate":{"focus":"jump shot","currentBottleneck":null,"newHypotheses":[],"confirmedHypothesisIds":[],"rejectedHypothesisIds":[],"newEvidence":[],"newBreakthroughs":[],"resolvedQuestions":[]}}

THREAD CONTINUITY EXAMPLE:
Prior state: focus="jump shot", hypotheses=[{id:"set-point-drift", statement:"Set point position changes each rep", status:"active", confidence:0.72}], openQuestions=["Is the inconsistency happening off the catch, off the dribble, or under fatigue?"]
Intent: "my set point moves every rep"
{"confidence":0.91,"insight":"Set point drift is a timing problem, not a technique problem — the ball is arriving at the release position before the body is ready to release it.","reasoning":"When the set point changes each rep, the usual cause is that the timing between the jump and the arm path is inconsistent. The hand is searching for a position because the rep sequence isn't locked. This is a sequencing issue, not a mechanics issue.","mentalModel":"The set point is a checkpoint, not a position. It exists to confirm that the jump and the arm are synchronized before release.","demonstration":{"currentState":"Ball arrives at set position at different heights each rep","targetState":"Ball arrives at set position at the same moment the legs reach peak extension","keyDifference":"The ball tracks the legs — not the other way around","executionCue":"Feel the legs finish before the ball moves to release"},"experimentCandidate":"Next 5 reps: pause one full beat at the set point. Feel your legs finish before you release.","nextRequiredCard":"Experiment","stateUpdate":{"focus":"jump shot","currentBottleneck":"set-point timing relative to jump peak","newHypotheses":[{"id":"jump-arm-desync","statement":"Ball reaches set position before legs reach peak extension, causing position variance","confidence":0.91}],"confirmedHypothesisIds":["set-point-drift"],"rejectedHypothesisIds":[],"newEvidence":["Set point moves every rep — user confirmed"],"newBreakthroughs":[],"resolvedQuestions":["Is the inconsistency happening off the catch, off the dribble, or under fatigue?"]}}`;

function buildMemoryContext(m: ThreadMemoryInput): string {
  const lines: string[] = [];

  if (m.focus) lines.push(`THREAD FOCUS: ${m.focus}`);

  if (m.currentBottleneck) lines.push(`CURRENT BOTTLENECK: ${m.currentBottleneck}`);

  const activeHypotheses = m.hypotheses.filter((h) => h.status === "active");
  if (activeHypotheses.length > 0) {
    lines.push(
      `ACTIVE HYPOTHESES:\n${activeHypotheses
        .map((h) => `- [${h.id}] ${h.statement} (confidence: ${h.confidence})`)
        .join("\n")}`,
    );
  }

  const confirmedHypotheses = m.hypotheses.filter((h) => h.status === "confirmed");
  if (confirmedHypotheses.length > 0) {
    lines.push(
      `CONFIRMED HYPOTHESES:\n${confirmedHypotheses
        .map((h) => `- [${h.id}] ${h.statement}`)
        .join("\n")}`,
    );
  }

  const activeExperiments = m.experiments.filter((e) => e.status === "open");
  if (activeExperiments.length > 0) {
    lines.push(
      `OPEN EXPERIMENTS:\n${activeExperiments.map((e) => `- ${e.hypothesis}`).join("\n")}`,
    );
  }

  const completedExperiments = m.experiments.filter((e) => e.status !== "open" && e.result);
  if (completedExperiments.length > 0) {
    lines.push(
      `EXPERIMENT RESULTS:\n${completedExperiments
        .map((e) => `- [${e.verdict ?? e.status.toUpperCase()}] ${e.hypothesis}: ${e.result}`)
        .join("\n")}`,
    );
  }

  if (m.breakthroughs.length > 0) {
    lines.push(`CONFIRMED BREAKTHROUGHS:\n${m.breakthroughs.map((b) => `- ${b}`).join("\n")}`);
  }

  const highConfidence = m.evidence.filter((e) => e.confidence >= 0.7);
  if (highConfidence.length > 0) {
    lines.push(
      `ESTABLISHED EVIDENCE:\n${highConfidence
        .slice(-6)
        .map((e) => `- [${e.source}] ${e.observation}${e.claim ? ` → ${e.claim}` : ""}`)
        .join("\n")}`,
    );
  }

  if (m.openQuestions.length > 0) {
    lines.push(`OPEN QUESTIONS:\n${m.openQuestions.map((q) => `- ${q}`).join("\n")}`);
  }

  return lines.join("\n\n");
}

const CARD_TYPES = ["Mental Model", "Demonstration", "Experiment", "Witness"] as const;
type CardType = typeof CARD_TYPES[number];

function isCardType(val: unknown): val is CardType {
  return typeof val === "string" && CARD_TYPES.includes(val as CardType);
}

function parseDemonstration(val: unknown): InsightResponse["demonstration"] | undefined {
  if (!val || typeof val !== "object") return undefined;
  const d = val as Record<string, unknown>;
  const currentState = typeof d.currentState === "string" ? d.currentState.trim() : "";
  const targetState = typeof d.targetState === "string" ? d.targetState.trim() : "";
  const keyDifference = typeof d.keyDifference === "string" ? d.keyDifference.trim() : "";
  const executionCue = typeof d.executionCue === "string" ? d.executionCue.trim() : "";
  if (!currentState && !targetState) return undefined;
  return { currentState, targetState, keyDifference, executionCue };
}

function parseStateUpdate(val: unknown): StateUpdate | undefined {
  if (!val || typeof val !== "object") return undefined;
  const u = val as Record<string, unknown>;

  const newHypotheses = Array.isArray(u.newHypotheses)
    ? (u.newHypotheses as unknown[]).flatMap((h) => {
        if (!h || typeof h !== "object") return [];
        const hyp = h as Record<string, unknown>;
        if (typeof hyp.id !== "string" || typeof hyp.statement !== "string") return [];
        return [{
          id: hyp.id.trim(),
          statement: hyp.statement.trim(),
          confidence: typeof hyp.confidence === "number"
            ? Math.min(1, Math.max(0, hyp.confidence))
            : 0.7,
        }];
      })
    : [];

  const strArray = (key: string): string[] =>
    Array.isArray(u[key])
      ? (u[key] as unknown[]).filter((v): v is string => typeof v === "string")
      : [];

  return {
    focus: typeof u.focus === "string" && u.focus.trim() ? u.focus.trim() : undefined,
    currentBottleneck: typeof u.currentBottleneck === "string" && u.currentBottleneck.trim()
      ? u.currentBottleneck.trim()
      : undefined,
    newHypotheses: newHypotheses.length > 0 ? newHypotheses : undefined,
    confirmedHypothesisIds: strArray("confirmedHypothesisIds").length > 0
      ? strArray("confirmedHypothesisIds")
      : undefined,
    rejectedHypothesisIds: strArray("rejectedHypothesisIds").length > 0
      ? strArray("rejectedHypothesisIds")
      : undefined,
    newEvidence: strArray("newEvidence").length > 0 ? strArray("newEvidence") : undefined,
    newBreakthroughs: strArray("newBreakthroughs").length > 0
      ? strArray("newBreakthroughs")
      : undefined,
    resolvedQuestions: strArray("resolvedQuestions").length > 0
      ? strArray("resolvedQuestions")
      : undefined,
  };
}

function safeParse(raw: string): InsightResponse {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(slice) as Record<string, unknown>;

    const confidence = typeof parsed.confidence === "number"
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.5;

    const nextRequiredCard: CardType = isCardType(parsed.nextRequiredCard)
      ? parsed.nextRequiredCard
      : "Mental Model";

    return {
      insight: typeof parsed.insight === "string" && parsed.insight.trim()
        ? parsed.insight.trim()
        : "The real constraint underneath this intent.",
      confidence,
      reasoning: typeof parsed.reasoning === "string" && parsed.reasoning.trim()
        ? parsed.reasoning.trim()
        : "What would change if this constraint was already resolved?",
      nextRequiredCard,
      mentalModel: typeof parsed.mentalModel === "string" && parsed.mentalModel.trim()
        ? parsed.mentalModel.trim()
        : undefined,
      demonstration: parseDemonstration(parsed.demonstration),
      experimentCandidate: typeof parsed.experimentCandidate === "string" && parsed.experimentCandidate.trim()
        ? parsed.experimentCandidate.trim()
        : undefined,
      witnessPrompt: typeof parsed.witnessPrompt === "string" && parsed.witnessPrompt.trim()
        ? parsed.witnessPrompt.trim()
        : undefined,
      clarificationQuestion: typeof parsed.clarificationQuestion === "string" && parsed.clarificationQuestion.trim()
        ? parsed.clarificationQuestion.trim()
        : undefined,
      stateUpdate: parseStateUpdate(parsed.stateUpdate),
    };
  } catch {
    return {
      insight: "Could not parse understanding.",
      confidence: 0,
      reasoning: "Try again.",
      nextRequiredCard: "Mental Model",
    };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ confidence: 0 }, { status: 503 });
  }

  let body: UnderstandRequest;
  try {
    body = await req.json() as UnderstandRequest;
  } catch {
    return Response.json({ confidence: 0 }, { status: 400 });
  }

  const { intent, evidence, witnessClaims, context, threadHistory, threadMemory } = body;
  if (!intent?.trim()) {
    return Response.json({ confidence: 0 }, { status: 400 });
  }

  const memoryBlock = threadMemory ? buildMemoryContext(threadMemory) : null;

  const userContent = [
    memoryBlock ? `--- THREAD CONTINUITY ---\n${memoryBlock}\n--- END CONTINUITY ---` : null,
    `Intent: "${intent.trim()}"`,
    evidence?.length ? `Evidence available: ${evidence.join(", ")}` : null,
    witnessClaims?.length ? `Witness claims:\n${witnessClaims.join("\n")}` : null,
    context ? `Context: ${context}` : null,
    threadHistory?.length
      ? `Prior exchange:\n${threadHistory.slice(-4).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1400,
        system: UNDERSTAND_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[axis/understand]", response.status, errText);
      return Response.json({ confidence: 0 }, { status: 500 });
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content.find((c) => c.type === "text")?.text ?? "{}";
    return Response.json(safeParse(raw));
  } catch (err) {
    const e = err as Error;
    console.error("[axis/understand]", e.message);
    return Response.json({ confidence: 0 }, { status: 500 });
  }
}
