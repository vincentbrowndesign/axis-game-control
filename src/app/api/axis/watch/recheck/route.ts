import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 30;

type RecheckFrame = {
  imageDataUrl: string;
  timestampSeconds: number;
};

export type RecheckResult = {
  attempt?: boolean;
  confidence: number;
  contestVisible?: boolean;
  limitation: string;
  note: string;
  outcomeEstimate?: "make" | "miss" | "unknown";
  outcomeVisible?: boolean;
  releaseVisible?: boolean;
  title: string;
};

export async function POST(request: Request): Promise<Response> {
  let body: {
    frames?: RecheckFrame[];
    isShot?: boolean;
    momentNote?: string;
    momentTitle?: string;
    query?: string;
    timeEnd?: number;
    timeStart?: number;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const frames = (body.frames ?? []).slice(0, 12);
  if (frames.length === 0) {
    return NextResponse.json({ error: "No frames provided." }, { status: 400 });
  }

  const momentTitle = body.momentTitle ?? "Moment";
  const momentNote = body.momentNote ?? "";
  const timeStart = body.timeStart ?? 0;
  const timeEnd = body.timeEnd ?? timeStart + 3;
  const isShot = body.isShot ?? false;
  const query = body.query ?? "";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      confidence: 0.44,
      limitation: "OpenAI key not configured. Recheck requires vision analysis.",
      note: momentNote || "Recheck unavailable — no vision provider configured.",
      title: momentTitle,
    } satisfies RecheckResult);
  }

  try {
    const result = await recheckWithOpenAI(apiKey, frames, {
      isShot,
      momentNote,
      momentTitle,
      query,
      timeEnd,
      timeStart,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Recheck could not complete." }, { status: 500 });
  }
}

async function recheckWithOpenAI(
  apiKey: string,
  frames: RecheckFrame[],
  opts: {
    isShot: boolean;
    momentNote: string;
    momentTitle: string;
    query: string;
    timeEnd: number;
    timeStart: number;
  },
): Promise<RecheckResult> {
  const openai = new OpenAI({ apiKey });

  const shotFields = opts.isShot
    ? `,
  "attempt": true or false (was a shot attempt visible),
  "releaseVisible": true or false (was the release point visible),
  "contestVisible": true or false (was a defender within a step),
  "outcomeVisible": true or false (can ball trajectory be tracked to the basket),
  "outcomeEstimate": "make", "miss", or "unknown"`
    : "";

  const prompt = `You are reviewing a specific basketball moment for a coach. Report only what is VISIBLE in these frames. Do not guess.

Moment: "${opts.momentTitle}" at ${opts.timeStart.toFixed(1)}–${opts.timeEnd.toFixed(1)}s.
Coach context: "${opts.momentNote || opts.query}"

Return ONLY valid JSON — no prose:
{
  "title": "brief coach-facing assessment title (max 60 chars)",
  "note": "what you can confirm from visible evidence only",
  "confidence": 0.0 to 1.0${shotFields},
  "limitation": "one short sentence about what cannot be determined from these frames"
}

Rules: no identity claims, no rim certainty unless rim and ball trajectory are clearly visible across multiple frames, no score assumptions.`;

  const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = frames
    .filter((f) => f.imageDataUrl?.startsWith("data:"))
    .slice(0, 8)
    .map((f) => ({
      image_url: { detail: "low" as const, url: f.imageDataUrl },
      type: "image_url" as const,
    }));

  const response = await openai.chat.completions.create({
    max_tokens: 320,
    messages: [
      {
        content: [{ text: prompt, type: "text" }, ...imageContent],
        role: "user",
      },
    ],
    model: "gpt-4o-mini",
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";

  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const json = raw.slice(start, end + 1);
    const parsed = JSON.parse(json) as Partial<RecheckResult>;

    return {
      attempt: parsed.attempt,
      confidence:
        typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      contestVisible: parsed.contestVisible,
      limitation:
        typeof parsed.limitation === "string"
          ? parsed.limitation
          : "Assessment limited by frame quality.",
      note:
        typeof parsed.note === "string" ? parsed.note : "Visible content could not be assessed.",
      outcomeEstimate: parsed.outcomeEstimate,
      outcomeVisible: parsed.outcomeVisible,
      releaseVisible: parsed.releaseVisible,
      title:
        typeof parsed.title === "string" ? parsed.title.slice(0, 80) : opts.momentTitle,
    };
  } catch {
    return {
      confidence: 0.44,
      limitation: "Response could not be parsed.",
      note: "Recheck result was not readable.",
      title: opts.momentTitle,
    };
  }
}
