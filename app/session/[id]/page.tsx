import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import type { TemporalSessionRecord } from "@/lib/temporalEventGraph"
import { SessionReplayCanvas } from "./SessionReplayCanvas"

type SessionPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="grid min-h-dvh place-items-center bg-black px-6 text-center text-zinc-100">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
            SESSION ACCESS REQUIRED
          </p>
          <Link
            href="/auth"
            className="mt-7 inline-flex border border-white/10 bg-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black"
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .eq("operator_id", user.id)
    .maybeSingle<TemporalSessionRecord>()

  if (!session) {
    return (
      <main className="grid min-h-dvh place-items-center bg-black px-6 text-center text-zinc-100">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
            RECORD NOT FOUND
          </p>
          <Link
            href="/live"
            className="mt-7 inline-flex border border-white/10 bg-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black"
          >
            Return live
          </Link>
        </div>
      </main>
    )
  }

  return <SessionReplayCanvas session={session} />
}
