"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"

type ReplaySession = {
  id: string
  createdAt: number
  source: "camera" | "upload"
  videoUrl: string
  title: string
  mission: string
  player: string
}

export default function HomePage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")

  function saveSession(file: File, source: "camera" | "upload") {
    try {
      setProgress(10)
      setStatus("Preparing behavioral memory...")

      const localUrl = URL.createObjectURL(file)
      const id = crypto.randomUUID()

      const session: ReplaySession = {
        id,
        createdAt: Date.now(),
        source,
        videoUrl: localUrl,
        title: file.name || "Axis Session",
        mission: "None",
        player: "Unassigned",
      }

      localStorage.setItem(`axis-session-${id}`, JSON.stringify(session))

      const existing = JSON.parse(
        localStorage.getItem("axis-sessions") || "[]"
      ) as string[]

      localStorage.setItem(
        "axis-sessions",
        JSON.stringify([id, ...existing.filter((x) => x !== id)])
      )

      setProgress(100)
      setStatus("Behavioral memory stored.")

      setTimeout(() => {
        router.push(`/session/${id}`)
      }, 700)
    } catch (error) {
      console.error(error)
      setProgress(0)
      setStatus("Upload failed.")
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <p className="mb-3 text-xs uppercase tracking-[0.4em] text-zinc-700">
            Axis Session
          </p>

          <h1 className="text-7xl font-black leading-none">
            AXIS
            <br />
            REPLAY
          </h1>

          <p className="mt-6 text-2xl text-zinc-500">
            Axis remembers how you play.
          </p>
        </div>

        <div className="space-y-6">
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-[2rem] border border-zinc-900 bg-black p-8 text-left"
          >
            <div className="text-6xl font-black leading-none">
              CHOOSE
              <br />
              FILE
            </div>

            <div className="mt-8 text-2xl text-lime-300">
              Choose existing clip
            </div>
          </button>

          <label className="block w-full rounded-[2rem] border border-zinc-900 bg-black p-8">
            <div className="text-6xl font-black leading-none">
              RECORD
            </div>

            <div className="mt-8 text-2xl text-cyan-400">
              Record from camera
            </div>

            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) saveSession(file, "camera")
              }}
            />
          </label>

          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) saveSession(file, "upload")
            }}
          />

          <button
            onClick={() => router.push("/sessions")}
            className="w-full rounded-full border border-zinc-900 py-5 text-lg font-bold text-zinc-400"
          >
            View Memories
          </button>

          <div className="mt-10">
            <div className="h-6 overflow-hidden rounded-full bg-zinc-950">
              <div
                className="h-full rounded-full bg-gradient-to-r from-lime-300 to-cyan-300 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.4em] text-zinc-700">
                  Behavioral Memory Upload
                </div>

                <div className="mt-4 text-3xl text-zinc-300">
                  {status}
                </div>
              </div>

              <div className="text-7xl font-black text-zinc-300">
                {progress}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}