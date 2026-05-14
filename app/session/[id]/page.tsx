"use client"

import { useState } from "react"
import PlayerFoundCard from "@/components/PlayerFoundCard"
import ObservationFeed from "@/components/ObservationFeed"
import MemoryProfile from "@/components/MemoryProfile"
import { generateObservations } from "@/engine/observationEngine"

export default function SessionPage() {
  const [identified, setIdentified] = useState(false)

  const observations = generateObservations()

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
            Axis Session
          </div>

          <h1 className="mt-4 text-6xl font-black leading-none">
            AXIS
            <br />
            REPLAY
          </h1>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-white/10">
          <video
            controls
            className="aspect-[9/16] w-full object-cover"
            src="https://stream.mux.com/x00QBrN3kU2Kj2rKk2hA4v1m9XQ5w.m3u8"
          />
        </div>

        {!identified ? (
          <PlayerFoundCard
            onContinue={() => setIdentified(true)}
          />
        ) : (
          <>
            <MemoryProfile sessions={11} />

            <ObservationFeed observations={observations} />
          </>
        )}
      </div>
    </main>
  )
}