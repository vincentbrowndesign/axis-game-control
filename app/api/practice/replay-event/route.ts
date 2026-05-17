import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { updateReplayMemory } from "@/lib/mcp/replayMemory"
import { createClient } from "@/lib/supabase/server"

function cleanText(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    let body: {
      noteId?: unknown
      eventType?: unknown
    } = {}

    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const noteId = cleanText(body.noteId)
    const eventType = cleanText(body.eventType) || "play"

    if (!noteId) {
      return NextResponse.json({ error: "Landmark required" }, { status: 400 })
    }

    const existing = await supabase
      .from("axis_voice_notes")
      .select("metadata")
      .eq("id", noteId)
      .eq("user_id", user.id)
      .maybeSingle<{ metadata: Record<string, unknown> | null }>()

    if (existing.error) {
      return NextResponse.json({ error: existing.error.message }, { status: 500 })
    }

    if (!existing.data) {
      return NextResponse.json({ error: "Landmark not found" }, { status: 404 })
    }

    const metadata =
      existing.data.metadata && typeof existing.data.metadata === "object"
        ? existing.data.metadata
        : {}
    const replayMemory = updateReplayMemory({
      metadata,
      eventType,
    })

    const updated = await supabase
      .from("axis_voice_notes")
      .update({
        metadata: replayMemory.metadata,
      })
      .eq("id", noteId)
      .eq("user_id", user.id)

    if (updated.error) {
      return NextResponse.json({ error: updated.error.message }, { status: 500 })
    }

    revalidatePath("/")
    revalidatePath("/sessions")
    revalidatePath("/players")

    return NextResponse.json({
      ok: true,
      replayCount: replayMemory.replayCount,
    })
  } catch (error) {
    console.error("REPLAY EVENT ERROR:", error)

    return NextResponse.json({ error: "Replay event failed" }, { status: 500 })
  }
}
