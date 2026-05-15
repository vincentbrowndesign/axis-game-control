import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      {
        error: "Authentication required",
      },
      {
        status: 401,
      }
    )
  }

  let body: {
    displayName?: unknown
    playerName?: unknown
    role?: unknown
  } = {}

  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const displayName =
    typeof body.displayName === "string"
      ? body.displayName.trim() || null
      : undefined
  const playerName =
    typeof body.playerName === "string"
      ? body.playerName.trim() || null
      : undefined
  const role =
    typeof body.role === "string"
      ? body.role.trim() || null
      : undefined

  const fallbackDisplayName =
    (user.user_metadata.display_name as string | undefined) ||
    null
  const profilePayload: {
    user_id: string
    display_name?: string | null
    player_name?: string | null
    role?: string | null
    updated_at: string
  } = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  }

  if (displayName !== undefined) {
    profilePayload.display_name = displayName
  } else {
    const existing = await supabaseAdmin
      .from("axis_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!existing.data) {
      profilePayload.display_name = fallbackDisplayName
    }
  }

  if (playerName !== undefined) {
    profilePayload.player_name = playerName
  }

  if (role !== undefined) {
    profilePayload.role = role
  }

  const profile = await supabaseAdmin
    .from("axis_profiles")
    .upsert(
      profilePayload,
      {
        onConflict: "user_id",
      }
    )
    .select("id")
    .single()

  if (profile.error) {
    return NextResponse.json(
      {
        error: profile.error.message,
      },
      {
        status: 500,
      }
    )
  }

  return NextResponse.json({
    success: true,
    profileId: profile.data.id,
  })
}
