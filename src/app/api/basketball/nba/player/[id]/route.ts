import { NextResponse } from "next/server";
import { getPlayerProfile, getRecentGames, getTeamInfo } from "@/lib/basketball/nba";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const profile = await getPlayerProfile(id);
    const team = profile?.teamId ? await getTeamInfo(profile.teamId) : null;
    const recentGames = await getRecentGames(id);

    return NextResponse.json({
      profile,
      team,
      recentGames,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "NBA_PLAYER_PROFILE_FAILED",
      },
      { status: 502 },
    );
  }
}
