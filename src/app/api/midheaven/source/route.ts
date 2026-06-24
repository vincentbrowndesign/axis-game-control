import { NextResponse } from "next/server";
import { createMidheavenSource } from "../../../../lib/midheaven/seed";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { raw?: unknown } | null;
  const raw = typeof body?.raw === "string" ? body.raw.trim() : "";

  if (!raw) {
    return NextResponse.json({ error: "Add a source first." }, { status: 400 });
  }

  return NextResponse.json({ source: createMidheavenSource(raw) });
}
