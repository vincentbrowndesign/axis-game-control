import type { AxisMemoryObject } from "@/lib/axis/types"

export type AxisSupabaseMemoryRead = {
  sessionId?: string
  limit?: number
}

export type AxisSupabaseAdapterOutput = {
  memories: AxisMemoryObject[]
  source: "supabase"
}

export type AxisSupabaseAdapter = {
  available: boolean
  readMemories: (input: AxisSupabaseMemoryRead) => Promise<AxisSupabaseAdapterOutput>
}

export function createSupabaseAdapter(): AxisSupabaseAdapter {
  return {
    available: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    async readMemories() {
      return {
        memories: [],
        source: "supabase",
      }
    },
  }
}
