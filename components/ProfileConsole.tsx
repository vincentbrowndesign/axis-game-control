"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
  const [role, setRole] = useState(profile?.role || "")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    setStatus("")

    const response = await fetch("/api/profile/ensure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName,
        playerName,
        role,
      })
    })

    setLoading(false)

    if (!response.ok) {
      setStatus("MEMORY LOAD FAILED")
      return
    }

    setStatus("Profile memory updated.")
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-end">
          <p className="text-[10px] uppercase tracking-[0.55em] text-white/30">
            Axis Profile System
          </p>
          <h1 className="mt-6 text-[clamp(4.5rem,15vw,10rem)] font-black leading-[0.82] tracking-[-0.07em]">
            PLAYER
            <br />
            MEMORY
          </h1>
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
                Sessions
              </p>
              <p className="mt-3 text-5xl font-black text-lime-300">
                {sessionCount}
              </p>
            </div>
          </div>
        </section>

        <section className="self-end border border-white/10 bg-white/[0.03] p-6">
          <p className="text-[10px] uppercase tracking-[0.45em] text-white/30">
            Identity Metadata
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
              placeholder="Player name"
              className="w-full border border-white/10 bg-black px-5 py-5 text-lg outline-none placeholder:text-white/25"
            />
            <input
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Role / context"
              className="w-full border border-white/10 bg-black px-5 py-5 text-lg outline-none placeholder:text-white/25"
            />
          </div>

          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="mt-6 w-full bg-white px-6 py-5 text-lg font-black uppercase tracking-[0.12em] text-black disabled:opacity-40"
          >
            {loading ? "STORING..." : "STORE PROFILE"}
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
