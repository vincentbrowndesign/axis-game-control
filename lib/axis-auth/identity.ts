import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabase/server"

export type AxisRequestIdentity = {
  clerkUserId: string | null
  kind: "clerk" | "supabase"
  storageKey: string
  supabaseUserId: string | null
}

export async function getAxisRequestIdentity(): Promise<AxisRequestIdentity | null> {
  const clerk = await auth().catch(() => null)

  if (clerk?.userId) {
    return {
      clerkUserId: clerk.userId,
      kind: "clerk",
      storageKey: clerk.userId,
      supabaseUserId: null,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  return {
    clerkUserId: null,
    kind: "supabase",
    storageKey: user.id,
    supabaseUserId: user.id,
  }
}
