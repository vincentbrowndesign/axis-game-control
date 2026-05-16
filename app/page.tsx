import Link from "next/link"
import { redirect } from "next/navigation"
import ContinuityWorld from "@/components/ContinuityWorld"
import UploadConsole from "@/components/UploadConsole"
import { getWarmupById } from "@/lib/world/getNextWarmup"
import { createClient } from "@/lib/supabase/server"
import type { AxisProfile } from "@/types/memory"

type Props = {
  searchParams?: Promise<{
    warmup?: string
  }>
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.email) {
    const { data: profile } = await supabase
      .from("axis_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<AxisProfile>()

    if (!profile?.player_name || !profile.role) {
      redirect("/profile?next=/")
    }

    const warmup = getWarmupById(params?.warmup)

    if (warmup) {
      return (
        <UploadConsole
          email={user.email}
          twinName={profile.player_name || profile.display_name}
          initialWarmupId={warmup.id}
        />
      )
    }

    const playerName = profile.player_name || profile.display_name || "Player"

    return (
      <ContinuityWorld
        eyebrow="Returning"
        title={`${playerName} returning`}
        line="Continuity active."
        primaryHref="/archive"
        primaryLabel="Carry Forward"
        identityName={playerName}
      />
    )
  }

  return (
    <main className="axis-atmosphere min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-end">
        <p className="text-[10px] uppercase tracking-[0.55em] text-white/30">
          Axis
        </p>
        <h1 className="mt-6 text-[clamp(4.5rem,16vw,11rem)] font-black leading-[0.8] tracking-[-0.07em]">
          START
          <br />
          MEMORY
        </h1>
        <p className="mt-8 max-w-2xl text-xl leading-relaxed text-white/45">
          Enter your basketball continuity.
        </p>
        <Link
          href="/auth"
          className="mt-10 w-fit bg-white px-8 py-5 text-sm font-black uppercase tracking-[0.24em] text-black"
        >
          Start Memory
        </Link>
      </div>
    </main>
  )
}
