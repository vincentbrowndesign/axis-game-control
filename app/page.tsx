"use client"

import { useRef, useState } from "react"

export default function Page() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [videoUrl, setVideoUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")

  async function uploadFile(file: File) {
    try {
      setUploading(true)
      setProgress(10)
      setStatus("Preparing behavioral memory...")

      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      setProgress(70)

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      const data = await response.json()

      if (!data?.url) {
        throw new Error("No playback URL")
      }

      setProgress(100)

      setVideoUrl(data.url)

      setStatus("Behavioral memory stored.")
    } catch (err) {
      console.error(err)
      setStatus("Upload failed.")
      setProgress(0)
    } finally {
      setUploading(false)
    }
  }

  function handleChooseFile(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]

    if (!file) return

    uploadFile(file)
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="text-xs tracking-[0.4em] text-zinc-600 mb-6">
          AXIS SESSION
        </div>

        <h1 className="text-7xl font-black leading-none mb-6">
          AXIS
          <br />
          REPLAY
        </h1>

        <p className="text-2xl text-zinc-500 mb-10">
          Axis remembers how you play.
        </p>

        <div className="space-y-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-[2rem] border border-zinc-900 bg-black p-8 text-left"
          >
            <div className="text-6xl font-black leading-none">
              CHOOSE
              <br />
              FILE
            </div>

            <div className="mt-8 text-2xl text-lime-400">
              Choose existing clip
            </div>
          </button>

          <label className="w-full rounded-[2rem] border border-zinc-900 bg-black p-8 block">
            <div className="text-6xl font-black leading-none">
              RECORD
            </div>

            <div className="mt-8 text-2xl text-sky-400">
              Record from camera
            </div>

            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={handleChooseFile}
            />
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleChooseFile}
          />

          <div className="mt-10">
            <div className="h-6 rounded-full bg-zinc-900 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-lime-300 to-sky-300 transition-all duration-500"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="flex justify-between mt-4 text-zinc-500 tracking-[0.35em] text-sm">
              <span>BEHAVIORAL MEMORY UPLOAD</span>
              <span>{progress}%</span>
            </div>

            <div className="mt-6 text-2xl text-zinc-400">
              {status}
            </div>
          </div>

          {videoUrl && (
            <div className="mt-10 rounded-[2rem] overflow-hidden border border-zinc-900">
              <video
                src={videoUrl}
                controls
                playsInline
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}