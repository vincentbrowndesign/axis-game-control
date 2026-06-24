import { NextResponse } from "next/server";
import type { MoneyMap, MoneyMapShare } from "../../../../lib/midheaven/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { moneyMap?: MoneyMap } | null;

  if (!body?.moneyMap?.id) {
    return NextResponse.json({ error: "Create a Money Map first." }, { status: 400 });
  }

  const share: MoneyMapShare = {
    id: `share-${body.moneyMap.id}`,
    moneyMapId: body.moneyMap.id,
    url: `/money-map/${body.moneyMap.id}`,
    createdAt: new Date().toISOString(),
  };

  return NextResponse.json({ share });
}
