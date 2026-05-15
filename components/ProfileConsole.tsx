"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { saveLocalTwin } from "@/lib/twin/getOrCreateTwin"
import type { AxisProfile } from "@/types/memory"

type Props = {
  email: string
  profile: AxisProfile | null
  sessionCount: number
}

export default function ProfileConsole({
  email,
  profile,
  sessionCount,
}: Props) {
  const router = useRouter()

  const [displayName, setDisplayName] = useState(
    profile?.display_name || ""
  )
  const [playerName, setPlayerName] = useState(
    profile?.player_name || ""
  )
  const [dominantHand, setDominantHand] = useState("right")
  const [role, setRole] = useState(profile?.role || "player")
  const [cameraOrientation, setCameraOrientation] = useState("rear")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)

  async function save() {
    const twinName = displayName.trim() || playerName.trim()

    if (!twinName || !dominantHand || !role) {
      setStatus("TWIN DETAILS REQUIRED")
      return
    }

    setLoading(true)
    setStatus("")

    const response = await fetch("/api/profile/ensure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: twinName,
        playerName: playerName.trim() || twinName,
        role,
      })
    })

    setLoading(false)

    if (!response.ok) {
      setStatus("MEMORY LOAD FAILED")
      return
    }

    saveLocalTwin({
      displayName: playerName.trim() || twinName,
      dominantHand,
      role,
      cameraOrientation,
    })

    setStatus("DIGITAL TWIN CREATED")
    router.push("/")
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-end">
          <p className="text-[10px] uppercase tracking-[0.55em] text-white/30">
            Axis World Model
          </p>
          <h1 className="mt-6 text-[clamp(4.5rem,15vw,10rem)] font-black leading-[0.82] tracking-[-0.07em]">
            DIGITAL
            <br />
            TWIN
          </h1>
          <p className="mt-8 max-w-xl text-xl leading-relaxed text-white/45">
            Create the memory anchor for warmups, replay continuity,
            and future comparison reads.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-2 gap-3">
            <div className="border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
                Owner
              </p>
              <p className="mt-3 break-words text-sm text-white/60">
                {email}
              </p>
            </div>
            <div className="border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">
                Memory Count
              </p>
              <p className="mt-3 text-5xl font-black text-lime-300">
                {sessionCount.toString().padStart(2, "0")}
              </p>
            </div>
          </div>

          <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-3">
            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[9px] uppercase tracking-[0.32em] text-white/25">
                Last Signal
              </p>
              <p className="mt-3 text-sm uppercase tracking-[0.18em] text-white/70">
                {sessionCount ? "Today" : "Waiting"}
              </p>
            </div>
            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[9px] uppercase tracking-[0.32em] text-white/25">
                Archive Status
              </p>
              <p className="mt-3 text-sm uppercase tracking-[0.18em] text-lime-300">
                {sessionCount ? "Active" : "Ready"}
              </p>
            </div>
            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[9px] uppercase tracking-[0.32em] text-white/25">
                Digital Twin
              </p>
              <p className="mt-3 text-sm uppercase tracking-[0.18em] text-white/70">
                {profile?.player_name ? "Linked" : "Open"}
              </p>
            </div>
          </div>

          <p className="mt-8 max-w-xl text-sm uppercase tracking-[0.35em] text-white/35">
            {sessionCount
              ? "Previous session located."
              : "Memory online."}
          </p>
        </section>

        <section className="self-end border border-white/10 bg-white/[0.03] p-6">
          <p className="text-[10px] uppercase tracking-[0.45em] text-white/30">
            Create Digital Twin
          </p>

          <div className="mt-8 space-y-4">
            <input
              value={displayName}
              onChange={(event) =>
                setDisplayName(event.target.value)
              }
              placeholder="Display name"
              className="w-full border border-white/10 bg-black px-5 py-5 text-lg outline-none placeholder:text-white/25"
            />
            <input
              value={playerName}
              onChange={(event) =>
                setPlayerName(event.target.value)
              }
              placeholder="Memory name"
              className="w-full border border-white/10 bg-black px-5 py-5 text-lg outline-none placeholder:text-white/25"
            />
            <select
              value={dominantHand}
              onChange={(event) => setDominantHand(event.target.value)}
              className="w-full border border-white/10 bg-black px-5 py-5 text-lg outline-none"
            >
              <option value="right">Right hand</option>
              <option value="left">Left hand</option>
              <option value="both">Both hands</option>
            </select>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="w-full border border-white/10 bg-black px-5 py-5 text-lg outline-none"
            >
              <option value="player">Player</option>
              <option value="trainer">Trainer</option>
              <option value="coach">Coach</option>
            </select>
            <select
              value={cameraOrientation}
              onChange={(event) =>
                setCameraOrientation(event.target.value)
              }
              className="w-full border border-white/10 bg-black px-5 py-5 text-lg outline-none"
            >
              <option value="rear">Rear camera</option>
              <option value="front">Front camera</option>
            </select>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="mt-6 w-full bg-white px-6 py-5 text-lg font-black uppercase tracking-[0.12em] text-black disabled:opacity-40"
          >
            {loading ? "MEMORY INDEXING" : "CREATE DIGITAL TWIN"}
          </button>

          {status && (
            <p className="mt-5 text-sm leading-relaxed text-white/45">
              {status}
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
