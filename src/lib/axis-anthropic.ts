export interface DeepModelInput {
  intent: string;
  openAiInsight?: string;
  discoveries?: Array<{
    statement: string;
    relevance?: string;
    source?: string;
  }>;
}

export interface DeepModelResult {
  deepModel: string;
  leveragePoint: string;
  caution?: string;
}

const SYSTEM_PROMPT = `You are the Axis deep reasoning layer. Your job is structural analysis, not instruction.

You receive a player's intent, a first-pass insight from another model, and optional discovery statements from research.

Do not summarize.
Do not repeat what was already said.
Do not give generic sports advice.

Answer one question: What is the deeper structure underneath this intent?

Produce:
1. deepModel — The underlying pattern or mechanism. State it as a structural truth, not advice. 1–3 sentences.
2. leveragePoint — The smallest place to intervene. One action or distinction. 1 sentence.
3. caution — What Axis should not over-prescribe about this. What the system should avoid turning into a rule. Optional but include when relevant.

Examples of deepModel (write like this):
- "A jump shot is not one motion. It is a transfer chain. The release only exposes whether the earlier transfer was organized."
- "Handles are not a skill. They are a consequence of deception. The ball moves fast when the defender's weight moves first."
- "Looking at the ball is a symptom, not a habit. The eyes default to the ball when the hands don't have a plan."

Examples of leveragePoint (write like this):
- "Separate gather, load, and release instead of treating the shot as one event."
- "Practice the decision before the dribble, not the dribble itself."
- "Give the hands a destination before the catch."

Return JSON only:
{"deepModel":"...","leveragePoint":"...","caution":"..."}

No markdown. No explanation. JSON only.`;

export async function generateDeepModel(
  input: DeepModelInput,
): Promise<DeepModelResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const parts: string[] = [`Intent: "${input.intent}"`];

  if (input.openAiInsight) {
    parts.push(`First-pass insight: "${input.openAiInsight}"`);
  }

  if (input.discoveries && input.discoveries.length > 0) {
    const discoveryLines = input.discoveries
      .map((d, i) => `Discovery ${i + 1}: "${d.statement}"${d.relevance ? ` — ${d.relevance}` : ""}`)
      .join("\n");
    parts.push(`Research discoveries:\n${discoveryLines}`);
  }

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
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: parts.join("\n\n") }],
      }),
    });

    if (!response.ok) {
      console.error("[axis-anthropic] API error", response.status);
      return null;
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content.find((c) => c.type === "text")?.text ?? "{}";

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;

    const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<DeepModelResult>;

    if (!parsed.deepModel || !parsed.leveragePoint) return null;

    return {
      deepModel: parsed.deepModel,
      leveragePoint: parsed.leveragePoint,
      caution: parsed.caution || undefined,
    };
  } catch (err) {
    console.error("[axis-anthropic]", err);
    return null;
  }
}
