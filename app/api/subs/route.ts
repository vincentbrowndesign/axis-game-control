import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { data, error } = await supabase
      .from("sub_events")
      .insert([
        {
          session_id: body.session_id,
          player_out: body.player_out,
          player_in: body.player_in,
          video_time_ms: body.video_time_ms || 0,
          game_clock: body.game_clock || "08:00",
          period: body.period || "1ST QTR",
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sub: data });
  } catch {
    return NextResponse.json({ error: "Could not save sub" }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sub_events")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subs: data });
}