import { createClient } from "@/lib/supabase/server"
import { TrainingSetRoom } from "./TrainingSetRoom"
import {
  AxisEmptyState,
  AxisHeader,
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
      <AxisPage center max="max-w-xl">
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
    <AxisPage className="axis-replay-operating-room">
        <AxisHeader>
          <AxisLinkButton href="/retrieve" tone="retrieval" className="px-3 py-2">
            Find clips
          </AxisLinkButton>
          <p className="axis-mono axis-sync-muted text-[10px] font-semibold uppercase tracking-[0.22em]">
            Saved clips
          </p>
        </AxisHeader>

        <section className="py-8">
          <p className="axis-mono axis-world-kicker text-[10px] font-semibold uppercase tracking-[0.24em]">
            Replay clips
          </p>
          <h1 className="axis-world-title mt-3 max-w-3xl text-4xl font-bold leading-none tracking-normal sm:text-6xl">
            Clips coaches marked for review.
          </h1>
        </section>

        {memories?.length ? (
          <TrainingSetRoom memories={memories} />
        ) : (
          <AxisEmptyState title="No saved clips yet" />
        )}
    </AxisPage>
  )
}
