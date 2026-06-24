import { NextResponse } from "next/server";
import { createNapoleonId } from "../../../../lib/napoleon/seed";
import type { NapoleonCashLoop } from "../../../../lib/napoleon/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<NapoleonCashLoop> | null;

  const loop: NapoleonCashLoop = {
    id: createNapoleonId("loop"),
    title: body?.title || "Draft Cash Loop",
    status: "idea",
    targetCustomer: body?.targetCustomer || "Warm audience",
    offer: body?.offer || "Draft offer",
    nextAction: body?.nextAction || "Name the first buyer and checkout path",
    proofStatus: body?.proofStatus || "Needs proof",
    createdAt: new Date().toISOString(),
    sourceQueryId: body?.sourceQueryId,
  };

  return NextResponse.json({
    ok: true,
    loop,
  });
}
