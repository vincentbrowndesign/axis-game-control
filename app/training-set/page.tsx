import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { TrainingSetRoom } from "./TrainingSetRoom"

export const dynamic = "force-dynamic"

export default async function TrainingSetPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="axis-display axis-sync-room axis-world-state grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="axis-mono axis-sync-muted text-[11px] font-black uppercase tracking-[0.28em]">
            SESSION ACCESS REQUIRED
          </p>
          <Link
            href="/auth"
            className="axis-mono axis-sync-action mt-7 inline-flex px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]"
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  const { data: memories } = await supabase
    .from("training_memories")
    .select("*")
    .order("created_at", {
      ascending: false,
    })

  return (
    <main className="axis-display axis-sync-room axis-familiar-room axis-world-state min-h-dvh">
      <section className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-4 sm:px-6">
        <header className="axis-world-header flex items-center justify-between py-3">
          <Link
            href="/live"
            className="axis-mono axis-world-link text-[11px] font-bold uppercase tracking-[0.32em] transition"
          >
            AXIS
          </Link>
          <nav className="axis-world-nav">
            <Link
              href="/retrieve"
              className="axis-mono axis-retrieval-link px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition"
            >
              Find clips
            </Link>
            <p className="axis-mono axis-sync-muted text-[10px] font-semibold uppercase tracking-[0.22em]">
              Saved clips
            </p>
          </nav>
        </header>

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
          <div className="axis-sync-surface axis-world-panel grid min-h-64 place-items-center text-center">
            <p className="axis-mono axis-sync-muted text-[10px] font-black uppercase tracking-[0.22em]">
              No saved clips yet
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
