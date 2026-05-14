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

  let body: { displayName?: unknown } = {}

  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const displayName =
    typeof body.displayName === "string" &&
    body.displayName.trim()
      ? body.displayName.trim()
      : (user.user_metadata.display_name as string | undefined) ||
        null

  const profile = await supabaseAdmin
    .from("axis_profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: displayName,
        updated_at: new Date().toISOString(),
      },
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
