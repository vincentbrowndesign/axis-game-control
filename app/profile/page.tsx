import Link from "next/link"
import ProfileConsole from "@/components/ProfileConsole"
import { createClient } from "@/lib/supabase/server"
import type { AxisProfile } from "@/types/memory"

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return (
      <main className="min-h-screen bg-black px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-end">
          <p className="text-[10px] uppercase tracking-[0.5em] text-white/30">
            Axis Profile System
          </p>
          <h1 className="mt-5 text-[clamp(4rem,15vw,10rem)] font-black leading-[0.82] tracking-[-0.07em]">
            NO
            <br />
            OWNER
          </h1>
          <Link
            href="/auth"
            className="mt-10 w-fit bg-white px-8 py-5 text-sm font-black uppercase tracking-[0.24em] text-black"
          >
            Enter Axis
          </Link>
        </div>
      </main>
    )
  }

  const [{ data: profile }, { count }] = await Promise.all([
    supabase
      .from("axis_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<AxisProfile>(),
    supabase
      .from("axis_sessions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id),
  ])

  return (
    <ProfileConsole
      email={user.email}
      userId={user.id}
      profile={profile || null}
      sessionCount={count || 0}
    />
  )
}
