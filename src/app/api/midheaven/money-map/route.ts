import { NextResponse } from "next/server";
import { createMoneyMapFromSource } from "../../../../lib/midheaven/seed";
import type { MidheavenSource } from "../../../../lib/midheaven/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { source?: MidheavenSource } | null;

  if (!body?.source?.raw) {
    return NextResponse.json({ error: "Add a source first." }, { status: 400 });
  }

  return NextResponse.json({ moneyMap: createMoneyMapFromSource(body.source) });
}
