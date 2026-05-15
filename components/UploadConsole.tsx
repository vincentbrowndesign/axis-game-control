"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { isSupportedReplayFile } from "@/lib/replayStorage"

type Source = "camera" | "upload"

type Props = {
  email: string
}

function readDuration(file: File) {
  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")
    const timeout = window.setTimeout(() => {
      URL.revokeObjectURL(url)
      resolve(0)
    }, 6000)

    video.preload = "metadata"
    video.onloadedmetadata = () => {
      const duration = video.duration || 0

      window.clearTimeout(timeout)
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    video.onerror = () => {
      window.clearTimeout(timeout)
      URL.revokeObjectURL(url)
      resolve(0)
    }
    video.src = url
  })
}

export default function UploadConsole({ email }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const uploadInputRef =
    useRef<HTMLInputElement | null>(null)
  const cameraInputRef =
    useRef<HTMLInputElement | null>(null)

  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [isUploading, setIsUploading] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    router.refresh()
  }

  async function saveSession(file: File, source: Source) {
    if (isUploading) return

    if (!isSupportedReplayFile(file)) {
      setProgress(0)
      setStatus("STORAGE PATH INVALID")
      return
    }

    if (!navigator.onLine) {
      setProgress(0)
      setStatus("SIGNAL INTERRUPTED")
      return
    }

    try {
      setIsUploading(true)
      setProgress(12)
      setStatus("PREPARING BEHAVIORAL MEMORY")

      const localUrl = URL.createObjectURL(file)
      const duration = await readDuration(file)

      setProgress(36)
      setStatus("BINDING MEMORY TO SESSION")

      const formData = new FormData()
      formData.set("file", file)
      formData.set("source", source)
      formData.set("duration", String(duration))
      formData.set("environment", "practice")
      formData.set("mission", "None")
      formData.set("player", "Unassigned")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const result = (await response.json()) as {
        id?: string
        fileName?: string
        videoUrl?: string
        error?: string
      }

      if (!response.ok || !result.id) {
        throw new Error(result.error || "SIGNAL INTERRUPTED")
      }

      const replayUrl = result.videoUrl || localUrl

      if (result.videoUrl) {
        URL.revokeObjectURL(localUrl)
      }

      const session = {
        id: result.id,
        createdAt: Date.now(),
        source,
        videoUrl: replayUrl,
        title: result.fileName || file.name || "Axis Session",
        mission: "None",
        player: "Unassigned",
        environment: "practice",
        duration,
      }

      localStorage.setItem(
        `axis-session-${result.id}`,
        JSON.stringify(session)
      )

      const existing = JSON.parse(
        localStorage.getItem("axis-sessions") || "[]"
      ) as string[]

      localStorage.setItem(
        "axis-sessions",
        JSON.stringify([
          result.id,
          ...existing.filter((id) => id !== result.id),
        ])
      )

      setProgress(100)
      setStatus("MEMORY STORED")

      setTimeout(() => {
        router.push(`/replay/${result.id}`)
      }, 350)
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error
          ? error.message
          : "SIGNAL INTERRUPTED"

      setStatus(
        message.includes("Failed") ||
          message.includes("Load failed")
          ? "SIGNAL INTERRUPTED"
          : message
      )
      setProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black px-5 pb-24 pt-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-6 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.5em] text-white/30">
              Axis Upload Console
            </p>
            <h1 className="mt-4 text-[clamp(4rem,14vw,9rem)] font-black leading-[0.84] tracking-[-0.07em]">
              FEED
              <br />
              MEMORY
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/sessions"
              className="border border-white/10 px-5 py-4 text-xs font-black uppercase tracking-[0.25em] text-white/55 transition hover:text-white"
            >
              Archive
            </Link>
            <Link
              href="/profile"
              className="border border-white/10 px-5 py-4 text-xs font-black uppercase tracking-[0.25em] text-white/55 transition hover:text-white"
            >
              Profile
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="border border-white/10 px-5 py-4 text-xs font-black uppercase tracking-[0.25em] text-white/35 transition hover:text-white"
            >
              Exit
            </button>
          </div>
        </div>

        <div className="mb-8 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-lime-300" />
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">
            Session owner: {email}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => uploadInputRef.current?.click()}
            className="border border-white/10 bg-white/[0.03] p-8 text-left transition hover:border-white/25 disabled:opacity-50"
          >
            <p className="text-[clamp(4rem,10vw,7rem)] font-black leading-[0.82] tracking-[-0.06em]">
              CHOOSE
              <br />
              FILE
            </p>

            <p className="mt-8 text-2xl text-lime-300">
              Attach existing clip
            </p>
          </button>

          <button
            type="button"
            disabled={isUploading}
            onClick={() => cameraInputRef.current?.click()}
            className="border border-white/10 bg-white/[0.03] p-8 text-left transition hover:border-white/25 disabled:opacity-50"
          >
            <p className="text-[clamp(4rem,10vw,7rem)] font-black leading-[0.82] tracking-[-0.06em]">
              RECORD
            </p>

            <p className="mt-8 text-2xl text-cyan-300">
              Capture from camera
            </p>
          </button>
        </div>

        <input
          ref={uploadInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]

            if (file) saveSession(file, "upload")
            else setStatus("MEMORY LOAD FAILED")
            event.target.value = ""
          }}
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]

            if (file) saveSession(file, "camera")
            else setStatus("SIGNAL INTERRUPTED")
            event.target.value = ""
          }}
        />

        <div className="mt-14">
          <div className="h-5 overflow-hidden bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-lime-300 via-cyan-300 to-white transition-all duration-500"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-white/30">
                Behavioral Memory Upload
              </p>

              <h2 className="mt-3 text-[clamp(2.5rem,9vw,5rem)] font-black leading-[0.9]">
                {status || "Waiting for upload."}
              </h2>
            </div>

            <div className="text-[clamp(4rem,18vw,8rem)] font-black leading-none tracking-[-0.08em] text-white/70">
              {progress}%
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
