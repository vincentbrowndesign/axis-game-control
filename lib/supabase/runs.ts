import type { SupabaseClient } from "@supabase/supabase-js"
import type { Run } from "@/lib/run/runState"

export async function saveRunMemory({
  supabase,
  run,
}: {
  supabase: SupabaseClient
  run: Run
}) {
  return supabase.from("axis_sessions").upsert({
    id: run.id,
    session_name: `${run.home} / ${run.away}`,
    metadata: {
      system: "tap-track-store",
      home: run.home,
      away: run.away,
      signals: run.signals,
      moments: run.moments,
      memories: run.memories,
    },
    updated_at: new Date().toISOString(),
  })
}
