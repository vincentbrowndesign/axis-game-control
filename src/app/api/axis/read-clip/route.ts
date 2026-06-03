import OpenAI from "openai";

export const runtime = "nodejs";

const ZONE_LABELS = [
  "Mid-Range",
  "Three Ball",
  "Corner Three",
  "Free Throw",
  "Paint",
  "Drive",
  "Ball Handling",
  "Conditioning",
] as const;

type ZoneLabel = (typeof ZONE_LABELS)[number];
type Confidence = "high" | "medium" | "low" | "none";

export type ReadClipResult = {
  confidence: Confidence;
  zone: ZoneLabel | null;
};

const CONFIDENCE_LEVELS = new Set<Confidence>(["high", "medium", "low", "none"]);

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ confidence: "none", zone: null } satisfies ReadClipResult);

  let frame: string | null = null;
  try {
    const body = (await request.json()) as { frame?: unknown };
    const candidate = body.frame;
    if (typeof candidate === "string" && candidate.startsWith("data:image/")) {
      frame = candidate;
    }
  } catch {
    return Response.json({ confidence: "none", zone: null } satisfies ReadClipResult);
  }

  if (!frame) return Response.json({ confidence: "none", zone: null } satisfies ReadClipResult);

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      max_tokens: 60,
      messages: [
        {
          content: [
            {
              text: `You are reading a single frame from a basketball training video.
Identify the primary basketball zone or activity visible.
Return valid JSON only: {"zone":"<label>","confidence":"<level>"}
Zone must be exactly one of: ${ZONE_LABELS.join(", ")} — or null if no basketball context.
Confidence: "high" (zone clearly visible), "medium" (basketball context clear, zone inferred from position), "low" (unclear zone), "none" (not basketball or unreadable).
No explanation. No markdown. JSON only.`,
              type: "text",
            },
            { image_url: { detail: "low", url: frame }, type: "image_url" },
          ],
          role: "user",
        },
      ],
      model: "gpt-4o-mini",
      temperature: 0,
    });

    const raw = (completion.choices[0]?.message?.content ?? "").trim();
    const jsonStart = raw.indexOf("{");
    const parsed = JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart) : "{}") as {
      confidence?: unknown;
      zone?: unknown;
    };

    const zone = ZONE_LABELS.includes(parsed.zone as ZoneLabel) ? (parsed.zone as ZoneLabel) : null;
    const confidence = CONFIDENCE_LEVELS.has(parsed.confidence as Confidence)
      ? (parsed.confidence as Confidence)
      : "none";

    return Response.json({ confidence, zone } satisfies ReadClipResult);
  } catch {
    return Response.json({ confidence: "none", zone: null } satisfies ReadClipResult);
  }
}
