"use client"

import MuxPlayer from "@mux/mux-player-react"
import AxisInsights from "./AxisInsights"

const mockInsights = [
  "Advantage created.",
  "Defense shifted.",
  "Help defender committed.",
]

type Props = {
  playbackId: string
}

export default function AxisReplayClient({
  playbackId,
}: Props) {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-md mx-auto flex flex-col gap-8">
        <h1 className="text-[64px] leading-[0.9] font-black tracking-[0.35em] uppercase">
          Axis Replay
        </h1>

        <div className="overflow-hidden rounded-[32px] border border-white/10">
          <MuxPlayer
            playbackId={playbackId}
            streamType="on-demand"
            autoPlay={false}
          />
        </div>

        <AxisInsights insights={mockInsights} />
      </div>
    </main>
  )
}