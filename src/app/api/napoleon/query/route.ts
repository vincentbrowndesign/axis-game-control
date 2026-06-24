import { NextResponse } from "next/server";
import { createNapoleonMockResult } from "../../../../lib/napoleon/seed";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { input?: unknown } | null;
  const input = typeof body?.input === "string" ? body.input.trim() : "";

  if (!input) {
    return NextResponse.json(
      { ok: false, error: "Ask Napoleon what you want to turn into money." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    result: createNapoleonMockResult(input),
  });
}
