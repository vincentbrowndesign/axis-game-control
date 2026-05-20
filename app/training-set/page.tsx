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
      <main className="grid min-h-dvh place-items-center bg-black px-6 text-center text-zinc-100">
        <div>
          <p className="axis-mono text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
            SESSION ACCESS REQUIRED
          </p>
          <Link
            href="/auth"
            className="axis-mono mt-7 inline-flex bg-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black"
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
    <main className="axis-display min-h-dvh bg-black text-[#f2f1ed]">
      <section className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-4 sm:px-6">
        <header className="flex items-center justify-between py-3">
          <Link
            href="/live"
            className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#f2f1ed]"
          >
            AXIS
          </Link>
          <p className="axis-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            TRAINING SET
          </p>
        </header>

        <section className="py-8">
          <p className="axis-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-600">
            MACHINE MEMORY
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-none tracking-normal text-[#f2f1ed] sm:text-6xl">
            Saved reps for the machine to study.
          </h1>
        </section>

        {memories?.length ? (
          <TrainingSetRoom memories={memories} />
        ) : (
          <div className="grid min-h-64 place-items-center bg-white/[0.012] text-center">
            <p className="axis-mono text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
              NO TRAINING MEMORIES YET
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
