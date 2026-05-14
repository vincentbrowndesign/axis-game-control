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
  environment?: "game" | "practice" | "mission" | "workout"
  duration?: number
}

export default function HomePage() {
  const router = useRouter()

  const uploadInputRef =
    useRef<HTMLInputElement | null>(null)

  const cameraInputRef =
    useRef<HTMLInputElement | null>(null)

  const [progress, setProgress] = useState(0)

  const [status, setStatus] = useState("")

  async function saveSession(
    file: File,
    source: "camera" | "upload"
  ) {
    try {
      setProgress(10)

      setStatus("Preparing behavioral memory...")

      const localUrl = URL.createObjectURL(file)

      const id = crypto.randomUUID()

      const video =
        document.createElement("video")

      video.preload = "metadata"

      video.onloadedmetadata = () => {
        const session: ReplaySession = {
          id,
          createdAt: Date.now(),
          source,
          videoUrl: localUrl,
          title: file.name || "Axis Session",
          mission: "None",
          player: "Unassigned",
          environment: "practice",
          duration: video.duration || 0,
        }

        localStorage.setItem(
          `axis-session-${id}`,
          JSON.stringify(session)
        )

        const existing = JSON.parse(
          localStorage.getItem("axis-sessions") ||
            "[]"
        ) as string[]

        localStorage.setItem(
          "axis-sessions",
          JSON.stringify([id, ...existing])
        )

        setProgress(100)

        setStatus("Behavioral memory stored.")

        setTimeout(() => {
          router.push(`/replay/${id}`)
        }, 500)
      }

      video.src = localUrl
    } catch (error) {
      console.error(error)

      setStatus("Upload failed.")

      setProgress(0)
    }
  }

  return (
    <main className="min-h-screen bg-black px-5 pb-24 pt-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-5 md:grid-cols-2">
          <button
            onClick={() =>
              uploadInputRef.current?.click()
            }
            className="rounded-[2rem] border border-zinc-900 bg-zinc-950 p-8 text-left transition hover:border-zinc-700"
          >
            <p className="text-6xl font-black leading-none">
              CHOOSE
              <br />
              FILE
            </p>

            <p className="mt-8 text-2xl text-lime-400">
              Choose existing clip
            </p>
          </button>

          <button
            onClick={() =>
              cameraInputRef.current?.click()
            }
            className="rounded-[2rem] border border-zinc-900 bg-zinc-950 p-8 text-left transition hover:border-zinc-700"
          >
            <p className="text-6xl font-black leading-none">
              RECORD
            </p>

            <p className="mt-8 text-2xl text-cyan-400">
              Record from camera
            </p>
          </button>
        </div>

        <input
          ref={uploadInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]

            if (!file) return

            saveSession(file, "upload")
          }}
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]

            if (!file) return

            saveSession(file, "camera")
          }}
        />

        <div className="mt-14">
          <div className="h-6 overflow-hidden rounded-full bg-zinc-950">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lime-300 to-cyan-300 transition-all duration-500"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-zinc-700">
                Behavioral Memory Upload
              </p>

              <h2 className="mt-3 text-[clamp(2.5rem,9vw,5rem)] font-black leading-[0.9]">
                {status || "Waiting for upload."}
              </h2>
            </div>

            <div className="text-[clamp(4rem,18vw,8rem)] font-black leading-none tracking-[-0.08em] text-zinc-300">
              {progress}%
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}