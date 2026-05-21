import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import type { TemporalSessionRecord } from "@/lib/temporalEventGraph"
import { AxisPage } from "@/components/axis/AxisPrimitives"
import { SessionReplayCanvas } from "./SessionReplayCanvas"

type SessionPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    jump?: string
    memory?: string
  }>
}

export default async function SessionPage({ params, searchParams }: SessionPageProps) {
  const { id } = await params
  const { jump, memory } = await searchParams
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
          <Link
            href="/auth"
            className="axis-mono axis-sync-action mt-7 inline-flex px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]"
          >
            Sign in
          </Link>
        </div>
      </AxisPage>
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
      <AxisPage center max="max-w-xl" mode="REPLAY" telemetry="AXIS">
        <div>
          <p className="axis-mono axis-sync-muted text-[11px] font-black uppercase tracking-[0.28em]">
            RECORD NOT FOUND
          </p>
          <Link
            href="/live"
            className="axis-mono axis-sync-action mt-7 inline-flex px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]"
          >
            Return live
          </Link>
        </div>
      </AxisPage>
    )
  }

  return <SessionReplayCanvas session={session} initialEventId={jump || null} initialMemoryId={memory || null} />
}
