"use client"

import { useState } from "react"
import AxisReplayClient from "@/components/AxisReplayClient"
import MobileVideoUpload from "@/components/MobileVideoUpload"

export default function HomePage() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")

  async function handleFile(file: File) {
    const localUrl = URL.createObjectURL(file)

    setVideoUrl(localUrl)
    setProgress(100)
    setStatus("Behavioral memory stored.")
  }

  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-10">
          <p className="mb-4 text-[12px] uppercase tracking-[0.45em] text-zinc-600">
            Axis Session
          </p>

          <h1 className="text-[74px] font-black leading-[0.88] tracking-[-0.08em]">
            AXIS
            <br />
            REPLAY
          </h1>

          <p className="mt-8 text-2xl text-zinc-400">
            Axis remembers how you play.
          </p>
        </div>

        {!videoUrl && (
          <MobileVideoUpload onFileSelected={handleFile} />
        )}

        {videoUrl && (
          <AxisReplayClient
            videoUrl={videoUrl}
            className="mt-8"
          />
        )}

        <div className="mt-8">
          <div className="h-6 w-full overflow-hidden rounded-full bg-zinc-950">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lime-300 to-sky-300 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] uppercase tracking-[0.45em] text-zinc-600">
              Behavioral Memory Upload
            </p>

            <p className="text-5xl text-zinc-400">{progress}%</p>
          </div>

          {status && (
            <p className="mt-6 text-2xl text-zinc-400">
              {status}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}