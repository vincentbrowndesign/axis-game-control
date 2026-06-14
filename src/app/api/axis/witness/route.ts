export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Axis Witness Planner
//
// Input:  { insight, reasoning?, witnessPrompt? }
// Output: { witnesses: WitnessRequirement[] }
//
// Job: determine which witnesses are required, what each must observe,
// and what claim each witness is expected to produce.
//
// Not all 7 witnesses are needed for every insight.
// The planner determines the minimum required set.
// ---------------------------------------------------------------------------

interface WitnessPlannerRequest {
  insight: string;
  reasoning?: string;
  witnessPrompt?: string;
}

const WITNESS_TYPES = [
  "Camera",
  "Computer Vision",
  "Coach",
  "User",
  "Research",
  "Audio",
  "Sensor",
] as const;

type WitnessType = typeof WITNESS_TYPES[number];
type ConfidenceImportance = "Critical" | "High" | "Medium" | "Low";

export interface WitnessRequirement {
  witness: WitnessType;
  purpose: string;
  expectedClaim: string;
  confidenceImportance: ConfidenceImportance;
  requiredEvidence: string;
}

export interface WitnessPlan {
  witnesses: WitnessRequirement[];
}

const WITNESS_SYSTEM = `You are the Axis Witness Planner.

Determine which witnesses are required to validate or observe this insight.

Available witnesses:
- Camera: visual capture of physical events — body position, movement, ball, environment
- Computer Vision: automated analysis of video — pose estimation, object tracking, spatial measurement
- Coach: expert human observer — pattern recognition, intent reading, situational judgment
- User: first-person self-report — perceived timing, felt sensations, internal state
- Research: existing literature or data — prior findings on this mechanism in this domain
- Audio: sound events — contact sounds, timing signals, verbal cues, crowd/environment
- Sensor: quantified physical data — force, acceleration, heart rate, velocity, contact pressure

Do not assign all 7 witnesses. Select only the witnesses that are genuinely required for this specific insight.

For each required witness, output:
- witness: one of the 7 available types
- purpose: 1 sentence. Why this witness specifically is needed for this insight.
- expectedClaim: 1-2 sentences. The specific observation or finding this witness is likely to produce.
- confidenceImportance: one of "Critical" | "High" | "Medium" | "Low" — how much this witness's claim changes confidence in the insight.
- requiredEvidence: 1 sentence. The minimum evidence this witness must produce for its claim to be interpretable.

Order witnesses by confidenceImportance descending (Critical first).

Rules:
- Minimum 2 witnesses, maximum 5. Never all 7.
- If Camera is selected, Computer Vision may augment it but does not replace it.
- User self-report is always "Medium" or "Low" — never Critical, because self-perception lags and distorts physical reality.
- Research is "Medium" unless the insight directly contradicts established findings.
- Sensor is "Critical" or "High" only when the variable cannot be observed by camera alone.
- Expected claims must be specific — not "the witness will observe improvement" but "defender weight shift visible 0.2 seconds before contact."

JSON only. No markdown.

Few-shot examples:

Insight: "Every second standing still in triple threat is time the defense uses to take an option away."
{"witnesses":[{"witness":"Camera","purpose":"Capture the defender's foot position and weight shift in direct response to the player's stillness versus movement.","expectedClaim":"In still reps, defender weight moves to neutral within 1 second. In live reps, defender remains split and reactive. The difference is visible as a postural change in the defender's base.","confidenceImportance":"Critical","requiredEvidence":"Side-angle video capturing both player and defender from waist down, allowing foot pressure and weight distribution to be read across reps."},{"witness":"Coach","purpose":"Identify whether the defender's response is to the player's stillness or to the ball position — a distinction camera alone cannot determine.","expectedClaim":"Coach will report whether the defender is reading the player's hips or the ball, which determines whether the stillness or the ball trajectory is the controlling cue.","confidenceImportance":"High","requiredEvidence":"Coach verbal report after each 5-rep set, naming what the defender appeared to be reading before the attack began."},{"witness":"User","purpose":"Capture the player's perceived moment of attack initiation relative to the defender's movement.","expectedClaim":"Player will report attacking after the defender commits — but video will likely show the attack happened earlier or later than perceived, revealing a timing calibration gap.","confidenceImportance":"Low","requiredEvidence":"Player verbal estimate of when they attacked relative to the defender's movement, collected before video review."}]}

Insight: "Jump shot inconsistency most often lives in when in the jump the shot fires — the timing variable is shifting, not the mechanics."
{"witnesses":[{"witness":"Camera","purpose":"Record vertical body position at ball-hand separation across all repetitions to make release-point variance visible.","expectedClaim":"Release point varies across repetitions, appearing as scatter in the frame where ball leaves fingertips — some reps firing at 60% of peak height, others at 90%.","confidenceImportance":"Critical","requiredEvidence":"Slow-motion side-angle video at fixed position and zoom, capturing full body from feet through peak of jump for all repetitions in a single session."},{"witness":"Computer Vision","purpose":"Measure vertical body position at release with frame-level precision across all reps to produce a numeric distribution.","expectedClaim":"Release height as a percentage of peak jump height varies by more than 15 percentage points across repetitions, confirming timing as the variable rather than hand mechanics.","confidenceImportance":"High","requiredEvidence":"Pose estimation output marking wrist or ball position at the ball-separation frame, expressed as vertical height relative to peak jump height, for each rep."},{"witness":"User","purpose":"Capture the player's perceived release timing to identify the gap between felt timing and actual timing.","expectedClaim":"Player perceives release at peak height in most reps, but video shows earlier departure — a perception lag of 0.1 to 0.2 seconds is common and creates the false belief that mechanics are the problem.","confidenceImportance":"Low","requiredEvidence":"Player verbal report of where in the jump they believe they released, collected after each set of 5 reps before reviewing video."}]}`;

const IMPORTANCE_ORDER: Record<ConfidenceImportance, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

function isWitnessType(val: unknown): val is WitnessType {
  return typeof val === "string" && WITNESS_TYPES.includes(val as WitnessType);
}

function isImportance(val: unknown): val is ConfidenceImportance {
  return typeof val === "string" &&
    ["Critical", "High", "Medium", "Low"].includes(val as string);
}

function safeParse(raw: string): WitnessPlan {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(slice) as Record<string, unknown>;

    const rawList = Array.isArray(parsed.witnesses) ? parsed.witnesses : [];
    const witnesses: WitnessRequirement[] = rawList
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((w: any) => isWitnessType(w?.witness))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((w: any): WitnessRequirement => ({
        witness: w.witness as WitnessType,
        purpose: typeof w.purpose === "string" ? w.purpose.trim() : "Observe this insight.",
        expectedClaim: typeof w.expectedClaim === "string" ? w.expectedClaim.trim() : "Observation pending.",
        confidenceImportance: isImportance(w.confidenceImportance) ? w.confidenceImportance : "Medium",
        requiredEvidence: typeof w.requiredEvidence === "string" ? w.requiredEvidence.trim() : "Evidence not specified.",
      }))
      .sort((a, b) => IMPORTANCE_ORDER[a.confidenceImportance] - IMPORTANCE_ORDER[b.confidenceImportance])
      .slice(0, 5);

    return { witnesses };
  } catch {
    return { witnesses: [] };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ witnesses: [] }, { status: 503 });
  }

  let body: WitnessPlannerRequest;
  try {
    body = await req.json() as WitnessPlannerRequest;
  } catch {
    return Response.json({ witnesses: [] }, { status: 400 });
  }

  const { insight, reasoning, witnessPrompt } = body;
  if (!insight?.trim()) {
    return Response.json({ witnesses: [] }, { status: 400 });
  }

  const userContent = [
    `Insight: "${insight.trim()}"`,
    reasoning?.trim() ? `Reasoning: ${reasoning.trim()}` : null,
    witnessPrompt?.trim() ? `Observation focus: ${witnessPrompt.trim()}` : null,
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
        max_tokens: 1500,
        system: WITNESS_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[axis/witness]", response.status, errText);
      return Response.json({ witnesses: [] }, { status: 500 });
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content.find((c) => c.type === "text")?.text ?? "{}";
    return Response.json(safeParse(raw));
  } catch (err) {
    const e = err as Error;
    console.error("[axis/witness]", e.message);
    return Response.json({ witnesses: [] }, { status: 500 });
  }
}
