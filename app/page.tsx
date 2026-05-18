import Link from "next/link"
import UploadMemoryConsole from "@/components/UploadMemoryConsole"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return (
      <main className="min-h-screen bg-[#0c0b09] px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center">
          <p className="text-sm font-bold text-white/42">Axis</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-[-0.05em] sm:text-7xl">
            Tally behavior.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
            Sign in, choose a session, and let Axis keep the memory.
          </p>
          <Link
            href="/auth"
            className="mt-8 w-fit bg-stone-100 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-100"
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  return <UploadMemoryConsole />
}
