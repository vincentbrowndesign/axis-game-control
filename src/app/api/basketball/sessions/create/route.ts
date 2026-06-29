import { NextResponse } from "next/server";
import { type BasketballSessionType } from "@/lib/basketball";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

const sessionTypes = new Set<BasketballSessionType>([
  "training",
  "practice",
  "game",
  "workout",
]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    title?: string;
    sessionType?: BasketballSessionType;
    location?: string | null;
  } | null;

  const userId = body?.userId;
  const title = body?.title?.trim();
  const sessionType = body?.sessionType;

  if (!userId || !title || !sessionType || !sessionTypes.has(sessionType)) {
    return NextResponse.json({ error: "SESSION_INPUT_INVALID" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("basketball_sessions")
      .insert({
        user_id: userId,
        title,
        session_type: sessionType,
        location: body?.location || null,
        status: "active",
      })
      .select("id,user_id,title,session_type,location,status")
      .single();

    if (!error && data) {
      return NextResponse.json({
        session: {
          id: data.id,
          userId: data.user_id,
          title: data.title,
          sessionType: data.session_type,
          location: data.location || undefined,
          status: data.status,
          persisted: true,
        },
      });
    }
  }

  return NextResponse.json({
    session: {
      id: crypto.randomUUID(),
      userId,
      title,
      sessionType,
      location: body?.location || undefined,
      status: "active",
      persisted: false,
    },
  });
}
