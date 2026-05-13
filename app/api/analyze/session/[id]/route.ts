import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || "";

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          error: "Missing Supabase env vars",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    );

    const { data: session, error } = await supabase
      .from("axis_sessions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(session);
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e.message || "Server error",
      },
      { status: 500 }
    );
  }
}