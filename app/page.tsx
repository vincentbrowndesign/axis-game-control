import Link from "next/link"
import UploadConsole from "@/components/UploadConsole"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.email) {
    return <UploadConsole email={user.email} />
  }

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-end">
        <p className="text-[10px] uppercase tracking-[0.55em] text-white/30">
          Axis Memory Core
        </p>
        <h1 className="mt-6 text-[clamp(4.5rem,16vw,11rem)] font-black leading-[0.8] tracking-[-0.07em]">
          CLAIM
          <br />
          SESSION
        </h1>
        <p className="mt-8 max-w-2xl text-xl leading-relaxed text-white/45">
          Sign in to persist uploads, replay metadata, and the behavioral
          memory graph that will connect sessions over time.
        </p>
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
