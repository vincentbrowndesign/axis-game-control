"use client"

import MuxPlayer from "@mux/mux-player-react"
import AxisInsights from "@/engine/AxisInsights"

const mockInsights = [
  "ADVANTAGE CREATED",
  "DEFENSE SHIFTED",
  "HELP DEFENDER COMMITTED",
  "GAP OPENED",
  "STACK ACTION FORMED",
]

type Props = {
  playbackId: string
}

export default function AxisReplayClient({
  playbackId,
}: Props) {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto flex max-w-md flex-col gap-8">
        <h1 className="text-[64px] leading-[0.9] font-black tracking-[0.35em]">
          AXIS
          <br />
          REPLAY
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