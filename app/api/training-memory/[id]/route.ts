import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = {
  params: Promise<{
    id: string
  }>
}

function storagePathFromPublicUrl(frameUrl: string, sessionId: string, id: string) {
  try {
    const url = new URL(frameUrl)
    const marker = "/training-frames/"
    const index = url.pathname.indexOf(marker)
    if (index >= 0) {
      return decodeURIComponent(url.pathname.slice(index + marker.length))
    }
  } catch {
    return `${sessionId}/${id}.jpg`
  }

  return `${sessionId}/${id}.jpg`
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "ACCESS_REQUIRED",
        },
        {
          status: 401,
        }
      )
    }

    const memory = await supabase
      .from("training_memories")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (memory.error || !memory.data) {
      return NextResponse.json(
        {
          ok: false,
          error: "TRAINING_MEMORY_NOT_FOUND",
        },
        {
          status: memory.error ? 500 : 404,
        }
      )
    }

    const path = storagePathFromPublicUrl(memory.data.frame_url, memory.data.session_id, id)

    await supabaseAdmin.from("training_memories").delete().eq("id", id)
    await supabaseAdmin.storage.from("training-frames").remove([path])

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "TRAINING_MEMORY_DELETE_FAILED",
      },
      {
        status: 500,
      }
    )
  }
}
