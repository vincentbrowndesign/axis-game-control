import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Authentication required",
        },
        {
          status: 401,
        }
      )
    }

    let body: { sessionId?: unknown } = {}

    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId : ""

    if (!sessionId) {
      return NextResponse.json(
        {
          error: "Session required",
        },
        {
          status: 400,
        }
      )
    }

    const existing = await supabase
      .from("axis_sessions")
      .select("file_path")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single<{ file_path: string | null }>()

    if (existing.error) {
      return NextResponse.json(
        {
          error: existing.error.message,
        },
        {
          status: 404,
        }
      )
    }

    await supabaseAdmin
      .from("axis_uploads")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_id", user.id)

    const deleted = await supabase
      .from("axis_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id)

    if (deleted.error) {
      return NextResponse.json(
        {
          error: deleted.error.message,
        },
        {
          status: 500,
        }
      )
    }

    if (existing.data.file_path) {
      await supabaseAdmin.storage
        .from("axis-replays")
        .remove([existing.data.file_path])
    }

    revalidatePath("/")
    revalidatePath("/sessions")
    revalidatePath("/team/local")

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error("DELETE SESSION ERROR:", error)

    return NextResponse.json(
      {
        error: "Delete failed",
      },
      {
        status: 500,
      }
    )
  }
}
