export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Axis Experiment Engine
//
// Input:  { insight, reasoning?, experimentCandidate? }
// Output: smallest experiment capable of validating the insight
//
// The experiment must reveal reality.
// Not a drill. Not a program. One experiment.
// ---------------------------------------------------------------------------

interface ExperimentRequest {
  insight: string;
  reasoning?: string;
  experimentCandidate?: string;
}

export interface ExperimentSpec {
  hypothesis: string;
  constraint: string;
  repetitions: string;
  successCriteria: string;
  failureCriteria: string;
  evidenceRequired: string;
  expectedLearning: string;
}

const EXPERIMENT_SYSTEM = `You are the Axis Experiment Engine.

Create the smallest experiment capable of validating the insight.

The experiment must reveal reality — not reinforce a belief, not build a habit, not train a skill. Reveal whether the insight is true for this player in this context.

Rules:
- hypothesis: 1 sentence. The specific claim the experiment will test. Falsifiable. Not a goal — a prediction about what will happen.
- constraint: 1 sentence. The one behavioral restriction during the experiment. The constraint must isolate the variable the hypothesis depends on.
- repetitions: 1 sentence. The minimum number of repetitions needed for a valid result. Specific count or duration. Not a range — commit to a number.
- successCriteria: 1 sentence. The observable result that confirms the hypothesis. Must be specific and visible — not "feels better" or "plays well."
- failureCriteria: 1 sentence. The observable result that disproves or complicates the hypothesis. Must also be specific and visible.
- evidenceRequired: 1 sentence. What must be captured or observed for the result to be interpretable. Minimum required — not ideal.
- expectedLearning: 1-2 sentences. What the player will know after the experiment regardless of outcome — success or failure both produce useful information.

Design constraints:
- Smallest valid experiment. Not a training session. Not a program. One test.
- The constraint must be specific enough to reproduce exactly. No ambiguity.
- Repetitions must be achievable in a single session.
- Success and failure criteria must be distinguishable by a neutral observer.

Language: precise. Scientific but not academic. No motivational framing. No "try your best."

JSON only. No markdown.

Few-shot examples:

Insight: "Every second standing still in triple threat is time the defense uses to take an option away."
{"hypothesis":"If the player initiates movement before the defender's weight reaches neutral, the defender's first-step reaction will arrive late in more than 6 of 10 reps.","constraint":"Begin the attack at the first visible sign of the defender's weight settling — not after it completes.","repetitions":"10 isolated 1-on-1 possessions from a standing triple threat start, all against the same defender.","successCriteria":"In 7 or more of 10 reps, the defender takes a catch-up step rather than a mirror step — visible in the first half-second of movement.","failureCriteria":"The defender matches the first step cleanly in 5 or more of 10 reps, suggesting the timing read is still miscalibrated.","evidenceRequired":"Side-angle video capturing both the player's initial weight shift and the defender's foot reaction in the same frame.","expectedLearning":"Whether the gap is in the timing of the read, the timing of the attack, or both — and which side of that gap is costing the most."}

Insight: "Jump shot inconsistency most often lives in when in the jump the shot fires — the timing variable is shifting, not the mechanics."
{"hypothesis":"If the player fixes a single release point within the jump — peak height — arc angle will become consistent across repetitions even if hand mechanics vary.","constraint":"Release the ball only at peak jump height. Abort any shot where the release fires before or after peak.","repetitions":"20 catch-and-shoot attempts from the same spot, same distance, same catch position.","successCriteria":"Arc angle varies by less than 10 degrees across all 20 makes and misses when reviewed on slow-motion side-angle video.","failureCriteria":"Arc angle varies by more than 10 degrees despite consistent release timing, indicating the variable lives in hand mechanics, not timing.","evidenceRequired":"Slow-motion side-angle video at a fixed position — same angle and zoom for all 20 reps — to measure arc consistency across attempts.","expectedLearning":"Whether timing is the controlling variable for this player's arc, or whether the inconsistency lives further upstream in hand position or grip."}

Insight: "Players are finding space where the defense isn't — not where the next pass goes."
{"hypothesis":"If an off-ball player positions themselves at the spot where the ball will be in 2 seconds rather than where there is current open space, the number of available catches per 5-minute possession set will increase.","constraint":"Before cutting or relocating, the player must identify where the ball will be in 2 seconds and move to that position — not to open space.","repetitions":"Two 5-minute possession sets — one without the constraint, one with it.","successCriteria":"The constrained set produces at least 2 more catchable ball touches than the unconstrained set, counted by a neutral observer.","failureCriteria":"No difference in catchable touches between sets, suggesting the positioning variable is not the bottleneck.","evidenceRequired":"A neutral observer counting catchable touches per set, defined as a pass that reaches the player with enough time and space to make a decision.","expectedLearning":"Whether repositioning relative to ball trajectory changes touch opportunity, or whether the constraint is elsewhere in the possession sequence."}`;

function safeParse(raw: string): ExperimentSpec {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(slice) as Record<string, unknown>;
    return {
      hypothesis: typeof parsed.hypothesis === "string" && parsed.hypothesis.trim()
        ? parsed.hypothesis.trim()
        : "Hypothesis not generated.",
      constraint: typeof parsed.constraint === "string" && parsed.constraint.trim()
        ? parsed.constraint.trim()
        : "Constraint not specified.",
      repetitions: typeof parsed.repetitions === "string" && parsed.repetitions.trim()
        ? parsed.repetitions.trim()
        : "Repetitions not specified.",
      successCriteria: typeof parsed.successCriteria === "string" && parsed.successCriteria.trim()
        ? parsed.successCriteria.trim()
        : "Success criteria not specified.",
      failureCriteria: typeof parsed.failureCriteria === "string" && parsed.failureCriteria.trim()
        ? parsed.failureCriteria.trim()
        : "Failure criteria not specified.",
      evidenceRequired: typeof parsed.evidenceRequired === "string" && parsed.evidenceRequired.trim()
        ? parsed.evidenceRequired.trim()
        : "Evidence not specified.",
      expectedLearning: typeof parsed.expectedLearning === "string" && parsed.expectedLearning.trim()
        ? parsed.expectedLearning.trim()
        : "Expected learning not specified.",
    };
  } catch {
    return {
      hypothesis: "Could not parse experiment.",
      constraint: "",
      repetitions: "",
      successCriteria: "",
      failureCriteria: "",
      evidenceRequired: "",
      expectedLearning: "",
    };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ hypothesis: "" }, { status: 503 });
  }

  let body: ExperimentRequest;
  try {
    body = await req.json() as ExperimentRequest;
  } catch {
    return Response.json({ hypothesis: "" }, { status: 400 });
  }

  const { insight, reasoning, experimentCandidate } = body;
  if (!insight?.trim()) {
    return Response.json({ hypothesis: "" }, { status: 400 });
  }

  const userContent = [
    `Insight: "${insight.trim()}"`,
    reasoning?.trim() ? `Reasoning: ${reasoning.trim()}` : null,
    experimentCandidate?.trim() ? `Candidate experiment: ${experimentCandidate.trim()}` : null,
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
        max_tokens: 600,
        system: EXPERIMENT_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[axis/experiment]", response.status, errText);
      return Response.json({ hypothesis: "" }, { status: 500 });
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content.find((c) => c.type === "text")?.text ?? "{}";
    return Response.json(safeParse(raw));
  } catch (err) {
    const e = err as Error;
    console.error("[axis/experiment]", e.message);
    return Response.json({ hypothesis: "" }, { status: 500 });
  }
}
