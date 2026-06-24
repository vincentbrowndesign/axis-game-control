import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  return NextResponse.json({
    ok: true,
    artifact: {
      id: `artifact-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      ...body,
    },
  });
}
