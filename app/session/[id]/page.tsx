import { createClient } from "@supabase/supabase-js"
import AxisReplayClient from "@/components/AxisReplayClient"

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function SessionPage({
  params,
}: Props) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: session } = await supabase
    .from("axis_sessions")
    .select("*")
    .eq("id", id)
    .single()

  if (!session) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center text-white">
        <p className="text-white/40">
          Session not found.
        </p>
      </main>
    )
  }

  return (
    <AxisReplayClient
      playbackId={
        session.playback_id ||
        "vWQzB00Wy019K7t5YqzB6Q02qhF00nR5Y00nK7x2Vh2qg"
      }
    />
  )
}