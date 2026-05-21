import { createClient } from "@/lib/supabase/server"
import { TrainingSetRoom } from "./TrainingSetRoom"
import {
  AxisEmptyState,
  AxisLinkButton,
  AxisPage,
} from "@/components/axis/AxisPrimitives"

export const dynamic = "force-dynamic"

export default async function TrainingSetPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <AxisPage center max="max-w-xl" mode="SIGN IN" telemetry="AXIS">
        <div>
          <p className="axis-mono axis-sync-muted text-[11px] font-black uppercase tracking-[0.28em]">
            SESSION ACCESS REQUIRED
          </p>
          <AxisLinkButton href="/auth" tone="primary" className="mt-7 inline-flex">
            Sign in
          </AxisLinkButton>
        </div>
      </AxisPage>
    )
  }

  const { data: memories } = await supabase
    .from("training_memories")
    .select("*")
    .order("created_at", {
      ascending: false,
    })

  return (
    <AxisPage className="axis-replay-operating-room" mode="MEMORY" telemetry="Saved moments">
      <section className="pb-7">
        <p className="axis-mono axis-world-kicker text-[10px] font-semibold uppercase tracking-[0.24em]">
          Preserved memory
        </p>
        <h1 className="axis-world-title mt-3 max-w-3xl text-4xl font-bold leading-none tracking-normal sm:text-6xl">
          Moments held for review.
        </h1>
        <div className="axis-mono mt-5 flex gap-x-5 text-[10px] font-black uppercase tracking-[0.16em] text-white/32">
          <AxisLinkButton href="/retrieve" tone="ghost" className="px-0 py-0">
            Memory stream
          </AxisLinkButton>
          <AxisLinkButton href="/live" tone="ghost" className="px-0 py-0">
            Live
          </AxisLinkButton>
        </div>
      </section>

      {memories?.length ? (
        <TrainingSetRoom memories={memories} />
      ) : (
        <AxisEmptyState title="No saved moments yet" />
      )}
    </AxisPage>
  )
}
