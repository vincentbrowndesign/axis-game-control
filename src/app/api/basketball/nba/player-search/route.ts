import { NextResponse } from "next/server";
import { searchPlayers } from "@/lib/basketball/nba";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";

  try {
    return NextResponse.json({
      players: await searchPlayers(query),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "NBA_PLAYER_SEARCH_FAILED",
        players: [],
      },
      { status: 502 },
    );
  }
}
