import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const teamName = body.team_name || "Team Axis";
    const opponentName = body.opponent_name || "Opponent";
    const players = body.players || [];

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert([{ name: teamName }])
      .select()
      .single();

    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 500 });
    }

    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .insert([
        {
          team_id: team.id,
          opponent_name: opponentName,
          our_score: 0,
          opponent_score: 0,
          period: "1ST QTR",
          game_clock: body.game_clock || "08:00",
          status: "live",
        },
      ])
      .select()
      .single();

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    const playerRows = players.map((player: any) => ({
      team_id: team.id,
      first_name: "",
      last_name: player.name,
      jersey_number: player.number,
      position: player.position || "",
      is_active: true,
    }));

    const { data: createdPlayers, error: playersError } = await supabase
      .from("players")
      .insert(playerRows)
      .select();

    if (playersError) {
      return NextResponse.json({ error: playersError.message }, { status: 500 });
    }

    return NextResponse.json({
      session,
      team,
      players: createdPlayers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not create session" },
      { status: 400 }
    );
  }
}

export async function GET() {
  const { data, error } = await supabase
    .from("game_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions: data });
}