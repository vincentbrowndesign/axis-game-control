import { notFound } from "next/navigation"

import AxisReplayClient from "@/components/AxisReplayClient"
import { supabase } from "@/lib/supabase"

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function Page({
  params,
}: Props) {
  const { id } = await params

  const { data: session } = await supabase
    .from("axis_sessions")
    .select("*")
    .eq("id", id)
    .single()

  if (!session?.playback_id) {
    notFound()
  }

  return (
    <AxisReplayClient
      playbackId={session.playback_id}
    />
  )
}