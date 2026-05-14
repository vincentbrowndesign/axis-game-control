"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  const inputRef = useRef<HTMLInputElement | null>(null)

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")

  async function handleFile(file: File) {
    try {
      setUploading(true)
      setProgress(10)
      setStatus("Preparing behavioral memory...")

      const localUrl = URL.createObjectURL(file)

      const id = crypto.randomUUID()

      const session = {
        id,
        createdAt: Date.now(),
        source: "mobile",
        videoUrl: localUrl,
      }

      localStorage.setItem(
        `axis-session-${id}`,
        JSON.stringify(session)
      )

      setProgress(100)
      setStatus("Behavioral memory stored.")

      setTimeout(() => {
        router.push(`/session/${id}`)
      }, 700)
    } catch (error) {
      console.error(error)

      setStatus("Upload failed.")
      setProgress(0)
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <div className="mb-3 text-xs uppercase tracking-[0.4em] text-zinc-700">
            Axis Session
          </div>

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

                if (file) {
                  handleFile(file)
                }
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

              if (file) {
                handleFile(file)
              }
            }}
          />

          <div className="mt-10">
            <div className="h-6 overflow-hidden rounded-full bg-zinc-950">
              <div
                className="h-full rounded-full bg-gradient-to-r from-lime-300 to-cyan-300 transition-all duration-500"
                style={{
                  width: `${progress}%`,
                }}
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