import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CreateSessionBody = {
  id?: string
  startedAt?: string
  status?: string
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const body = (await request.json().catch(() => ({}))) as CreateSessionBody
    const sessionId = body.id && isUuid(body.id) ? body.id : crypto.randomUUID()
    const startedAt = body.startedAt || new Date().toISOString()

    const inserted = await supabaseAdmin
      .from("sessions")
      .insert({
        id: sessionId,
        operator_id: user?.id ?? null,
        status: body.status || "STARTING",
        started_at: startedAt,
      })
      .select("*")
      .single()

    if (inserted.error) {
      return NextResponse.json(
        {
          ok: false,
          error: inserted.error.message,
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      ok: true,
      session: inserted.data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "SESSION_CREATE_FAILED",
      },
      {
        status: 500,
      }
    )
  }
}
