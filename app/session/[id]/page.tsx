// app/session/[id]/page.tsx

"use client"

import { useState } from "react"

import MobileVideoUpload from "@/components/MobileVideoUpload"

import MuxPlayer from "@mux/mux-player-react"

export default function SessionPage() {
  const [playbackId, setPlaybackId] =
    useState<string | null>(null)

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-4">
        <h1 className="text-3xl font-bold">
          AXIS SESSION
        </h1>

        <MobileVideoUpload
          onReady={(id) =>
            setPlaybackId(id)
          }
        />

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          {playbackId ? (
            <MuxPlayer
              playbackId={playbackId}
              streamType="on-demand"
              autoPlay={false}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-zinc-500">
              Loading replay...
            </div>
          )}
        </div>
      </div>
    </main>
  )
}