// app/page.tsx

"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type UploadState = {
  uploading: boolean
  progress: number
  status: string
}

export default function HomePage() {
  const router = useRouter()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const captureInputRef = useRef<HTMLInputElement>(null)

  const [uploadState, setUploadState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    status: "",
  })

  // restore unfinished upload state
  useEffect(() => {
    const saved = sessionStorage.getItem("axis-upload-state")

    if (saved) {
      setUploadState(JSON.parse(saved))
    }
  }, [])

  // persist upload state
  useEffect(() => {
    sessionStorage.setItem(
      "axis-upload-state",
      JSON.stringify(uploadState)
    )
  }, [uploadState])

  async function handleFile(file: File | null) {
    if (!file) return

    setUploadState({
      uploading: true,
      progress: 10,
      status: "Creating session...",
    })

    try {
      // create session
      const sessionRes = await fetch("/api/session/create", {
        method: "POST",
      })

      const session = await sessionRes.json()

      setUploadState({
        uploading: true,
        progress: 20,
        status: "Preparing behavioral memory...",
      })

      // upload to mux endpoint
      const formData = new FormData()
      formData.append("file", file)

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const uploadData = await uploadRes.json()

      setUploadState({
        uploading: true,
        progress: 60,
        status: "Linking session memory...",
      })

      // connect playback id to session
      await fetch(`/api/session/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
          playbackId: uploadData.playbackId,
        }),
      })

      setUploadState({
        uploading: true,
        progress: 90,
        status: "Generating replay...",
      })

      sessionStorage.setItem(
        "axis-last-session",
        JSON.stringify({
          sessionId: session.id,
          playbackId: uploadData.playbackId,
        })
      )

      setUploadState({
        uploading: false,
        progress: 100,
        status: "Behavioral memory stored.",
      })

      setTimeout(() => {
        router.push(`/replay/${session.id}`)
      }, 1200)
    } catch (error) {
      console.error(error)

      setUploadState({
        uploading: false,
        progress: 0,
        status: "Upload failed.",
      })
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-5 py-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-10">
          <div className="text-[12px] tracking-[0.45em] text-zinc-600 mb-4">
            AXIS SESSION
          </div>

          <h1 className="text-[74px] leading-[0.88] font-black tracking-[-0.08em]">
            AXIS
            <br />
            REPLAY
          </h1>

          <p className="text-zinc-400 text-2xl mt-8">
            Axis remembers how you play.
          </p>
        </div>

        {/* CHOOSE FILE */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-[42px] border border-zinc-900 overflow-hidden mb-6 text-left"
        >
          <div
            className="
              rounded-[42px]
              p-8
              bg-[radial-gradient(circle_at_top_left,rgba(190,242,100,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(20,20,60,0.9),transparent_50%),#030303]
            "
          >
            <div className="text-[72px] leading-[0.88] font-black tracking-[-0.08em]">
              CHOOSE
              <br />
              FILE
            </div>

            <div className="mt-8 text-lime-300 text-2xl">
              Choose existing clip
            </div>
          </div>
        </button>

        {/* RECORD */}
        <button
          onClick={() => captureInputRef.current?.click()}
          className="w-full rounded-[42px] border border-zinc-900 overflow-hidden mb-8 text-left"
        >
          <div
            className="
              rounded-[42px]
              p-8
              bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(10,20,60,0.9),transparent_50%),#030303]
            "
          >
            <div className="text-[72px] leading-[0.88] font-black tracking-[-0.08em]">
              RECORD
            </div>

            <div className="mt-8 text-sky-400 text-2xl">
              Record from camera
            </div>
          </div>
        </button>

        {/* hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) =>
            handleFile(e.target.files?.[0] || null)
          }
        />

        <input
          ref={captureInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={(e) =>
            handleFile(e.target.files?.[0] || null)
          }
        />

        {/* upload state */}
        <div className="mt-8">
          <div className="w-full h-6 rounded-full bg-zinc-950 overflow-hidden">
            <div
              className="
                h-full
                rounded-full
                bg-gradient-to-r
                from-lime-300
                to-sky-300
                transition-all
                duration-500
              "
              style={{
                width: `${uploadState.progress}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-[12px] tracking-[0.45em] text-zinc-600 uppercase">
              Behavioral Memory Upload
            </div>

            <div className="text-5xl text-zinc-400">
              {uploadState.progress}%
            </div>
          </div>

          {uploadState.status && (
            <div className="mt-4 text-zinc-500 text-lg">
              {uploadState.status}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}