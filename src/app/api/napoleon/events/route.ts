import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const event = await request.json().catch(() => null);

  return NextResponse.json({
    ok: true,
    event,
  });
}
