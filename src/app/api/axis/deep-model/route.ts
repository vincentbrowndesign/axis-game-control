import { NextResponse } from "next/server";
import { generateDeepModel } from "../../../../lib/axis-anthropic";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      intent?: string;
      insight?: string;
      discoveries?: Array<{ statement: string; relevance?: string; source?: string }>;
    };

    if (!body.intent?.trim()) {
      return NextResponse.json({ error: "intent required" }, { status: 400 });
    }

    const result = await generateDeepModel({
      intent: body.intent.trim(),
      openAiInsight: body.insight,
      discoveries: body.discoveries,
    });

    if (!result) {
      return NextResponse.json({ error: "deep model unavailable" }, { status: 503 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[deep-model]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
