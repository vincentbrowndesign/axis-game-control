"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function CreatePlayerForm() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)

  const [name, setName] = useState("")
  const [gradYear, setGradYear] =
    useState("")
  const [height, setHeight] =
    useState("")
  const [weight, setWeight] =
    useState("")
  const [position, setPosition] =
    useState("")
  const [handedness, setHandedness] =
    useState("")

  async function createPlayer() {
    try {
      setLoading(true)

      console.log({
        name,
        gradYear,
        height,
        weight,
        position,
        handedness,
      })

      router.back()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
      <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-600">
        New Player
      </p>

      <h1 className="mt-5 text-5xl font-black tracking-[-0.06em]">
        CREATE
        <br />
        PROFILE
      </h1>

      <p className="mt-5 text-zinc-400 leading-relaxed">
        Save player details so sessions, notes, and clips stay organized.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <input
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          placeholder="Player Name"
          className="rounded-[24px] border border-white/10 bg-black px-5 py-5 text-lg outline-none"
        />

        <input
          value={gradYear}
          onChange={(e) =>
            setGradYear(e.target.value)
          }
          placeholder="Grad Year"
          className="rounded-[24px] border border-white/10 bg-black px-5 py-5 text-lg outline-none"
        />

        <input
          value={height}
          onChange={(e) =>
            setHeight(e.target.value)
          }
          placeholder="Height"
          className="rounded-[24px] border border-white/10 bg-black px-5 py-5 text-lg outline-none"
        />

        <input
          value={weight}
          onChange={(e) =>
            setWeight(e.target.value)
          }
          placeholder="Weight"
          className="rounded-[24px] border border-white/10 bg-black px-5 py-5 text-lg outline-none"
        />

        <input
          value={position}
          onChange={(e) =>
            setPosition(e.target.value)
          }
          placeholder="Position"
          className="rounded-[24px] border border-white/10 bg-black px-5 py-5 text-lg outline-none"
        />

        <input
          value={handedness}
          onChange={(e) =>
            setHandedness(e.target.value)
          }
          placeholder="Right / Left Handed"
          className="rounded-[24px] border border-white/10 bg-black px-5 py-5 text-lg outline-none"
        />
      </div>

      <button
        onClick={createPlayer}
        disabled={loading}
        className="mt-8 w-full rounded-full bg-white py-5 text-lg font-black text-black disabled:opacity-50"
      >
        {loading
          ? "CREATING..."
          : "CREATE PLAYER"}
      </button>
    </section>
  )
}
