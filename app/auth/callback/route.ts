import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = activeV1Path(url.searchParams.get("next") || "/")

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, url.origin))
}

function activeV1Path(path: string) {
  const allowed = new Set([
    "/",
    "/org/bridge/start",
    "/org/city2city/start",
    "/org/bridge/train",
    "/org/city2city/train",
    "/org/bridge/coach",
    "/org/city2city/coach",
  ])

  return allowed.has(path) ? path : "/"
}
