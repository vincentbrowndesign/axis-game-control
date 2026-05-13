"use client"

import MuxPlayer from "@mux/mux-player-react"

type Props = {
  playbackId: string
}

export default function AxisReplayClient({
  playbackId,
}: Props) {
  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-[72px] font-black tracking-[0.35em]">
          AXIS
          <br />
          REPLAY
        </h1>

        <div className="mt-10 overflow-hidden rounded-[32px] border border-white/10">
          <MuxPlayer
            playbackId={playbackId}
            streamType="on-demand"
            autoPlay={false}
          />
        </div>
      </div>
    </div>
  )
}