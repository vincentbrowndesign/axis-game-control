export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Axis Demonstration Engine
//
// Input:  { insight, mentalModel?, reasoning? }
// Output: renderer-agnostic visual demonstration specification
//
// Job: convert insight and mental model into a visual spec.
// Not images. Not videos. A specification any renderer can execute.
// ---------------------------------------------------------------------------

interface DemonstrationRequest {
  insight: string;
  mentalModel?: string;
  reasoning?: string;
}

export interface DemonstrationSpec {
  currentState: string;
  targetState: string;
  keyDifference: string;
  executionCue: string;
  commonFailure: string;
  recommendedViewpoints: string[];
  animationNotes: string;
  comparisonRequired: boolean;
  complexity: "Beginner" | "Intermediate" | "Advanced";
}

const DEMONSTRATION_SYSTEM = `You are the Axis Demonstration Engine.

Your job: convert an insight and mental model into a visual demonstration specification.

Do not generate images.
Do not generate videos.
Generate a renderer-agnostic specification — precise enough that any visual system could execute it.

Describe body position, spatial relationships, timing, and observable state changes using specific anatomical and spatial language. Never use metaphor in place of a physical description.

Output fields:
- currentState: 1-2 sentences. Precise physical description of the current behavior — body position, weight distribution, ball/object position, eyes, timing.
- targetState: 1-2 sentences. Precise physical description of the target behavior.
- keyDifference: 1 sentence. The single most visually important distinction between current and target. Must be observable in a single frame.
- executionCue: 1 sentence. The observable environmental trigger that initiates the transition — what the player sees or senses that signals "now."
- commonFailure: 1 sentence. What the incorrect execution looks like visually — the most common misread or misapplication.
- recommendedViewpoints: array of 2-4 strings. Camera angles or perspectives best suited to capture the key difference. Be specific: "overhead, directly above the ball handler" not "top down."
- animationNotes: 1-2 sentences. If animating the transition from current to target state: what to emphasize, what to slow down, what to highlight.
- comparisonRequired: boolean. True if the demonstration requires side-by-side comparison to be meaningful.
- complexity: "Beginner" | "Intermediate" | "Advanced" — how much prior context a viewer needs to interpret the demonstration correctly.

JSON only. No markdown.

Few-shot examples:

Insight: "Every second standing still in triple threat is time the defense uses to take an option away."
{"currentState":"Player is stationary in triple threat stance. Weight is centered and balanced between both feet. Ball held at hip. Eyes scanning but body still. Defender is upright, weight neutral, watching.","targetState":"Player's weight is loaded toward the attack foot with continuous micro-movement — small weight shifts, live pivot foot. Ball stays in threat position but body is never fully settled. Defender must continuously re-read the threat.","keyDifference":"The attack foot carries active weight pressure in target state; in current state, weight is evenly distributed and still.","executionCue":"The moment the defender's weight shifts to neutral — both feet equidistant and flat — is when the attack window opens.","commonFailure":"Player initiates movement but weight shifts back to center before committing, giving the defender a second read window.","recommendedViewpoints":["Front-facing, chest height — captures weight shift and foot pressure","Side angle, hip height — shows loading on the attack foot","Overhead — shows defender position relative to ball handler's weight distribution"],"animationNotes":"Slow the weight-shift phase to 0.4x speed. Highlight foot pressure with a ground-contact indicator. Show defender posture change as player settles vs. stays live.","comparisonRequired":true,"complexity":"Intermediate"}

Insight: "You're using vision as the control mechanism — when pressure spikes, your eyes drop back to the ball because your hands haven't built enough tactile feedback."
{"currentState":"Player is dribbling with eyes up. As defensive pressure closes within 2 feet, gaze drops to the ball. Dribble becomes lower and tighter. Movement slows or stops. Defender closes gap.","targetState":"Player maintains a fixed gaze line at shoulder height or above regardless of defensive proximity. Dribble rhythm and height remain consistent. Movement direction changes without visual confirmation of the ball.","keyDifference":"In target state, the gaze line does not drop below the defender's chest when pressure arrives.","executionCue":"Defender's feet within 3 feet and closing is the pressure threshold — the moment to verify the gaze is holding.","commonFailure":"Player maintains eye contact with the ball handler they're guarding instead of scanning the secondary defender — mistaking focus for awareness.","recommendedViewpoints":["Eye-line tracking, side angle at eye height — captures exact moment gaze drops","Front-facing, full body — captures relationship between defensive proximity and gaze","Overhead — shows spatial relationship between defender close-out and ball handler's dribble zone"],"animationNotes":"Track a gaze indicator (a line or cone from the player's eyes) and highlight when it drops below the chest plane. Overlay the defender proximity radius as a circle.","comparisonRequired":true,"complexity":"Advanced"}`;

const COMPLEXITY_VALUES = ["Beginner", "Intermediate", "Advanced"] as const;
type Complexity = typeof COMPLEXITY_VALUES[number];

function isComplexity(val: unknown): val is Complexity {
  return typeof val === "string" && COMPLEXITY_VALUES.includes(val as Complexity);
}

function safeParse(raw: string): DemonstrationSpec {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(slice) as Record<string, unknown>;

    const viewpoints = Array.isArray(parsed.recommendedViewpoints)
      ? parsed.recommendedViewpoints.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : [];

    return {
      currentState: typeof parsed.currentState === "string" && parsed.currentState.trim()
        ? parsed.currentState.trim()
        : "Current state not specified.",
      targetState: typeof parsed.targetState === "string" && parsed.targetState.trim()
        ? parsed.targetState.trim()
        : "Target state not specified.",
      keyDifference: typeof parsed.keyDifference === "string" && parsed.keyDifference.trim()
        ? parsed.keyDifference.trim()
        : "Key difference not specified.",
      executionCue: typeof parsed.executionCue === "string" && parsed.executionCue.trim()
        ? parsed.executionCue.trim()
        : "Execution cue not specified.",
      commonFailure: typeof parsed.commonFailure === "string" && parsed.commonFailure.trim()
        ? parsed.commonFailure.trim()
        : "Common failure not specified.",
      recommendedViewpoints: viewpoints.length > 0 ? viewpoints : ["Standard side-angle view"],
      animationNotes: typeof parsed.animationNotes === "string" && parsed.animationNotes.trim()
        ? parsed.animationNotes.trim()
        : "No animation notes provided.",
      comparisonRequired: typeof parsed.comparisonRequired === "boolean"
        ? parsed.comparisonRequired
        : true,
      complexity: isComplexity(parsed.complexity) ? parsed.complexity : "Intermediate",
    };
  } catch {
    return {
      currentState: "Could not parse demonstration spec.",
      targetState: "",
      keyDifference: "",
      executionCue: "",
      commonFailure: "",
      recommendedViewpoints: [],
      animationNotes: "",
      comparisonRequired: false,
      complexity: "Intermediate",
    };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ currentState: "" }, { status: 503 });
  }

  let body: DemonstrationRequest;
  try {
    body = await req.json() as DemonstrationRequest;
  } catch {
    return Response.json({ currentState: "" }, { status: 400 });
  }

  const { insight, mentalModel, reasoning } = body;
  if (!insight?.trim()) {
    return Response.json({ currentState: "" }, { status: 400 });
  }

  const userContent = [
    `Insight: "${insight.trim()}"`,
    mentalModel?.trim() ? `Mental Model: ${mentalModel.trim()}` : null,
    reasoning?.trim() ? `Reasoning: ${reasoning.trim()}` : null,
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
        system: DEMONSTRATION_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[axis/demonstration]", response.status, errText);
      return Response.json({ currentState: "" }, { status: 500 });
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content.find((c) => c.type === "text")?.text ?? "{}";
    return Response.json(safeParse(raw));
  } catch (err) {
    const e = err as Error;
    console.error("[axis/demonstration]", e.message);
    return Response.json({ currentState: "" }, { status: 500 });
  }
}
