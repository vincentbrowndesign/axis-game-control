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

  const { data: session, error } = await supabase
    .from("axis_sessions")
    .select("*")
    .eq("id", id)
    .single()

  console.log("SESSION", session)
  console.log("ERROR", error)

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
        session.playback_id || "demo"
      }
      sessionId={session.id}
    />
  )
}