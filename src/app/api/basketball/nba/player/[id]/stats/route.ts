import { NextResponse } from "next/server";
import { getPlayerStats } from "@/lib/basketball/nba";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    return NextResponse.json({
      stats: await getPlayerStats(id),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "NBA_PLAYER_STATS_FAILED",
      },
      { status: 502 },
    );
  }
}
