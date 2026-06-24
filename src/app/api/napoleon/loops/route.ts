import { NextResponse } from "next/server";
import { createNapoleonId } from "../../../../lib/napoleon/seed";
import type { NapoleonCashLoop } from "../../../../lib/napoleon/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<NapoleonCashLoop> | null;

  const loop: NapoleonCashLoop = {
    id: createNapoleonId("loop"),
    title: body?.title || "Draft Cash Loop",
    status: "idea",
    incomeType: body?.incomeType || "profit_income",
    wealthLayer: body?.wealthLayer || "leveraged_accelerator",
    cashStreamSystem: body?.cashStreamSystem || "digital_content_funnel",
    systemBlueprint: body?.systemBlueprint || "Digital Content Funnel",
    targetCustomer: body?.targetCustomer || "Warm audience",
    offer: body?.offer || "Draft offer",
    fastestCashPath: body?.fastestCashPath || "Ask one warm buyer for a clear yes or no",
    automationPath: body?.automationPath || "Query -> offer -> checkout path -> proof follow-up",
    reinvestmentRule: body?.reinvestmentRule || "Use first cash to improve the repeatable loop",
    leakRule: body?.leakRule || "Do not build more before the cash path is named",
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
