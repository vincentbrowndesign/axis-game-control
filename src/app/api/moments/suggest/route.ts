import OpenAI from "openai";

export const runtime = "nodejs";

type InputFrame = {
  dataUrl: string;
  time: number;
};

type MomentSuggestion = {
  confidence: number;
  duration: number;
  label: string;
  timestamp: number;
};

type RequestBody = {
  frames?: unknown;
  videoDuration?: unknown;
};

const VALID_LABELS = new Set([
  "Assist",
  "Ball Recovered",
  "Block",
  "Loose Ball",
  "Pass Before Basket",
  "Rebound",
  "Second Effort",
  "Shot After Miss",
  "Shot Made",
  "Steal",
]);

function sanitizeFrames(frames: unknown): InputFrame[] {
  if (!Array.isArray(frames)) return [];

  return frames
    .filter((f): f is Record<string, unknown> => Boolean(f && typeof f === "object"))
    .map((f) => ({
      dataUrl: typeof f.dataUrl === "string" ? f.dataUrl : "",
      time: typeof f.time === "number" && Number.isFinite(f.time) ? f.time : 0,
    }))
    .filter((f) => f.dataUrl.startsWith("data:image/"))
    .slice(0, 20);
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ suggestions: [] }, { status: 503 });

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ suggestions: [] }, { status: 400 });
  }

  const frames = sanitizeFrames(body.frames);
  const videoDuration = typeof body.videoDuration === "number" && Number.isFinite(body.videoDuration) ? body.videoDuration : 0;

  if (!frames.length) return Response.json({ suggestions: [] });

  const openai = new OpenAI({ apiKey });
  const frameList = frames.map((f) => `${f.time.toFixed(1)}s`).join(", ");
  const labelList = [...VALID_LABELS].join(", ");

  const prompt = `You are analyzing basketball video frames to identify moments worth saving as short proof clips.

Frame timestamps in this video: ${frameList}
Total video duration: ${videoDuration.toFixed(0)}s

Return a JSON array of interesting moments. For each moment return:
- timestamp: when the moment starts (seconds)
- duration: suggested clip length in seconds (4 to 8)
- label: MUST be exactly one of: ${labelList}
- confidence: 0.0 to 1.0

Rules:
- Return ONLY valid JSON. No markdown. No explanation.
- Only include moments with confidence >= 0.6
- Maximum 12 results
- If nothing interesting, return []

Example output: [{"timestamp":4.5,"duration":6,"label":"Shot After Miss","confidence":0.8}]`;

  try {
    const completion = await openai.chat.completions.create({
      max_tokens: 600,
      messages: [
        {
          content: [
            { text: prompt, type: "text" },
            ...frames.map((f) => ({
              image_url: { detail: "low" as const, url: f.dataUrl },
              type: "image_url" as const,
            })),
          ],
          role: "user",
        },
      ],
      model: "gpt-4o-mini",
      temperature: 0.2,
    });

    const raw = (completion.choices[0]?.message?.content ?? "[]").trim();
    const jsonStart = raw.indexOf("[");
    const jsonText = jsonStart >= 0 ? raw.slice(jsonStart) : "[]";
    const parsed = JSON.parse(jsonText) as unknown[];

    const suggestions: MomentSuggestion[] = parsed
      .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === "object"))
      .map((s) => ({
        confidence: typeof s.confidence === "number" ? s.confidence : 0,
        duration: typeof s.duration === "number" ? Math.min(Math.max(4, s.duration), 10) : 6,
        label: typeof s.label === "string" && VALID_LABELS.has(s.label) ? s.label : "",
        timestamp: typeof s.timestamp === "number" && Number.isFinite(s.timestamp) ? s.timestamp : 0,
      }))
      .filter((s) => s.label && s.confidence >= 0.6)
      .slice(0, 12);

    return Response.json({ suggestions });
  } catch (error) {
    console.error("Moment suggestion error:", error);
    return Response.json({ suggestions: [] }, { status: 500 });
  }
}
