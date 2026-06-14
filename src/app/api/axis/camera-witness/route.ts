import OpenAI from "openai";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Camera Witness API
//
// Receives: frames (base64 JPEG data URLs) + constraint + experiment context
// Calls:    OpenAI Vision (gpt-4o-mini, detail: "low")
// Returns:  { verdict, summary, confidence }
//
// The camera observes. It does not judge.
// ---------------------------------------------------------------------------

interface CameraWitnessRequest {
  frames: string[];
  constraint: string;
  hypothesis?: string;
  experiment_id: string;
}

interface WitnessObservation {
  verdict: "satisfied" | "partial" | "violated" | "unobservable";
  summary: string;
  confidence: number;
}

const WITNESS_SYSTEM =
  `You are a camera witness observing an athletic drill. ` +
  `Report only what you can actually see in the frames. ` +
  `Do not infer or guess beyond what is visible. ` +
  `If the relevant body part or movement is not clearly visible, say so with "unobservable".`;

function buildPrompt(constraint: string, hypothesis: string | undefined, frameCount: number): string {
  return (
    `Constraint: "${constraint}"\n` +
    (hypothesis ? `Hypothesis: ${hypothesis}\n` : "") +
    `\n${frameCount} frames were captured from a live camera during a 90-second drill.\n` +
    `\nQuestion: Based on what you can see in these ${frameCount} frames, ` +
    `did the athlete appear to satisfy the constraint "${constraint}"?\n` +
    `\nReturn JSON only:\n` +
    `{\n` +
    `  "verdict": "satisfied" | "partial" | "violated" | "unobservable",\n` +
    `  "summary": "one sentence describing what you actually observed",\n` +
    `  "confidence": 0.0 to 1.0\n` +
    `}`
  );
}

const VALID_VERDICTS = ["satisfied", "partial", "violated", "unobservable"];

function safeParse(raw: string): WitnessObservation {
  try {
    const start = raw.indexOf("{");
    const parsed = JSON.parse(start >= 0 ? raw.slice(start) : raw) as Record<string, unknown>;
    return {
      verdict: VALID_VERDICTS.includes(parsed.verdict as string)
        ? (parsed.verdict as WitnessObservation["verdict"])
        : "unobservable",
      summary: typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "No observation available.",
      confidence: typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.5,
    };
  } catch {
    return { verdict: "unobservable", summary: "Could not parse witness response.", confidence: 0 };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { verdict: "unobservable", summary: "No API key configured.", confidence: 0 },
      { status: 503 },
    );
  }

  let body: CameraWitnessRequest;
  try {
    body = await req.json() as CameraWitnessRequest;
  } catch {
    return Response.json(
      { verdict: "unobservable", summary: "Invalid request.", confidence: 0 },
      { status: 400 },
    );
  }

  const { frames, constraint, hypothesis } = body;

  if (!frames?.length || !constraint) {
    return Response.json(
      { verdict: "unobservable", summary: "No frames or constraint provided.", confidence: 0 },
      { status: 400 },
    );
  }

  const openai = new OpenAI({ apiKey });

  try {
    const imageContent: OpenAI.Chat.ChatCompletionContentPartImage[] = frames
      .slice(0, 10)
      .map((frame) => ({
        type: "image_url" as const,
        image_url: { url: frame, detail: "low" as const },
      }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 150,
      messages: [
        { role: "system", content: WITNESS_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt(constraint, hypothesis, frames.length) },
            ...imageContent,
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    return Response.json(safeParse(raw));
  } catch (err) {
    console.error("[axis/camera-witness]", err);
    return Response.json(
      { verdict: "unobservable", summary: "Vision API error.", confidence: 0 },
      { status: 500 },
    );
  }
}
