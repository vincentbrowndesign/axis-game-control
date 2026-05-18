import Link from "next/link"
import UploadMemoryConsole from "@/components/UploadMemoryConsole"
import { createClient } from "@/lib/supabase/server"

export default async function TapPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return (
      <main className="min-h-screen bg-[#050505] px-5 py-10 text-zinc-100">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-500">
            Axis
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-[-0.05em] sm:text-7xl">
            Tap the signal.
          </h1>
          <p className="mt-5 max-w-xl text-base font-bold leading-7 text-zinc-500">
            Track the shift.
          </p>
          <Link
            href="/auth"
            className="mt-8 w-fit rounded-full bg-zinc-100 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-black transition hover:bg-emerald-200"
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  return <UploadMemoryConsole initialMode="tap" />
}
