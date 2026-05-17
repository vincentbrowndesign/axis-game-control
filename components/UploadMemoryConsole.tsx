"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import ModeNav from "@/components/ModeNav"
import {
  parseUploadResponseText,
  type AxisUploadResponse,
} from "@/lib/uploadResponse"

type ReplayMoment = {
  id: string
  sessionId: string
  title: string
  caption: string
  detail: string
  timestamp: string
  videoUrl?: string | null
  sessionTitle: string
}

type RecentSession = {
  id: string
  title: string
  time: string
  videoUrl?: string | null
  captions: string[]
}

type PlayerMoment = {
  name: string
  phrase: string
  count: number
}

type Props = {
  replayMoments: ReplayMoment[]
  recentSessions: RecentSession[]
  playerMoments: PlayerMoment[]
}

const waveformBars = [42, 72, 48, 86, 56, 64, 94, 44, 78, 52, 88, 60, 46, 82]

function uploadStatus(data: AxisUploadResponse) {
  if (data.ok) return "Memory processing"
  if (data.error) return data.error.toLowerCase()

  return "Upload failed"
}

function readDuration(file: File) {
  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")

    video.preload = "metadata"
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0

      URL.revokeObjectURL(url)
      resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    video.src = url
  })
}

export default function UploadMemoryConsole({
  replayMoments,
  recentSessions,
  playerMoments,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState("")
  const [selectedMoment, setSelectedMoment] = useState(replayMoments[0])

  async function chooseFile(file: File | undefined) {
    if (!file || isUploading) return

    setIsUploading(true)
    setStatus("Uploading video")

    try {
      const duration = await readDuration(file)
      const formData = new FormData()
      formData.append("file", file)
      formData.append("source", "upload")
      formData.append("environment", "practice")
      formData.append("mission", "Replay memory")
      formData.append("player", "Unassigned")
      formData.append("duration", String(duration))

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const text = await response.text()
      const result = parseUploadResponseText(text)

      setStatus(uploadStatus(result))
    } catch (error) {
      console.error("UPLOAD MEMORY FAILED", error)
      setStatus("Upload failed")
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const activeMoment = selectedMoment || replayMoments[0]

  return (
    <main className="min-h-screen bg-[#0a0907] px-4 py-5 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black text-white/85">
            Axis
          </Link>
          <ModeNav active="record" />
        </header>

        <section
          id="upload"
          className="grid min-h-[78vh] gap-10 py-8 lg:grid-cols-[1fr_420px] lg:items-center"
        >
          <div>
            <p className="text-sm font-bold text-white/38">Memory extraction</p>
            <h1 className="mt-4 max-w-4xl text-6xl font-black leading-[0.9] tracking-[-0.065em] text-white sm:text-8xl">
              Upload the footage.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/48">
              Axis turns long basketball video into replay moments, captions,
              timestamps, and player memory.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="rounded-full bg-stone-100 px-8 py-5 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:bg-amber-100 disabled:opacity-50"
              >
                {isUploading ? "Uploading" : "Choose file"}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => void chooseFile(event.target.files?.[0])}
              />
              {status ? (
                <p className="text-sm font-bold text-white/42">{status}</p>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] bg-[#16120d] shadow-[0_42px_140px_rgba(0,0,0,0.55)]">
            <div className="aspect-[9/14] bg-black">
              {activeMoment?.videoUrl ? (
                <video
                  src={activeMoment.videoUrl}
                  className="h-full w-full object-cover opacity-80"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_center,#2a2117_0%,#090806_68%)] px-8 text-center">
                  <p className="text-4xl font-black leading-none tracking-[-0.05em] text-white">
                    Replay memory appears here.
                  </p>
                </div>
              )}
            </div>
            <div className="p-6">
              <p className="text-sm font-bold text-amber-100/65">
                {activeMoment?.timestamp || "0:00"}
              </p>
              <p className="mt-3 text-4xl font-black leading-[0.95] tracking-[-0.05em] text-white">
                {activeMoment?.caption || "CHOOSE FILE"}
              </p>
              <p className="mt-4 text-sm leading-6 text-white/42">
                {activeMoment?.detail ||
                  "AI extracts candidate moments. Coach adds the meaning."}
              </p>
              <div className="mt-6 flex h-12 items-end gap-1">
                {waveformBars.map((height, index) => (
                  <span
                    key={`${height}-${index}`}
                    className="w-full rounded-full bg-white/16"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-12 border-t border-white/8 py-12">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-sm font-bold text-white/38">Replay memory</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
                Recent moments.
              </h2>
            </div>
            <Link
              href="/sessions"
              className="w-fit text-sm font-bold text-white/42 transition hover:text-white"
            >
              Sessions
            </Link>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
            <div className="grid gap-4 sm:grid-cols-2">
              {replayMoments.slice(0, 6).map((moment) => (
                <button
                  key={moment.id}
                  type="button"
                  onClick={() => setSelectedMoment(moment)}
                  className="group overflow-hidden rounded-[1.5rem] bg-white/[0.035] text-left transition hover:bg-white/[0.06]"
                >
                  <div className="aspect-video bg-black">
                    {moment.videoUrl ? (
                      <video
                        src={moment.videoUrl}
                        className="h-full w-full object-cover opacity-70 transition group-hover:opacity-90"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <p className="text-sm font-bold text-amber-100/65">
                      {moment.timestamp}
                    </p>
                    <p className="mt-2 text-2xl font-black leading-tight tracking-[-0.04em] text-white">
                      {moment.caption}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-white/38">
                      {moment.sessionTitle}
                    </p>
                  </div>
                </button>
              ))}
              {replayMoments.length === 0 ? (
                <div className="py-16">
                  <p className="max-w-xl text-3xl font-black tracking-[-0.04em] text-white">
                    Choose a video and Axis will build replay moments.
                  </p>
                </div>
              ) : null}
            </div>

            <aside className="grid h-fit gap-9">
              <section>
                <h3 className="text-sm font-bold text-white/38">
                  Recent sessions
                </h3>
                <div className="mt-4 grid gap-4">
                  {recentSessions.slice(0, 5).map((session) => (
                    <Link
                      key={session.id}
                      href={`/replay/${session.id}`}
                      className="block rounded-[1.25rem] bg-white/[0.035] p-4 transition hover:bg-white/[0.06]"
                    >
                      <p className="text-lg font-black text-white">
                        {session.title}
                      </p>
                      <p className="mt-1 text-sm text-white/35">{session.time}</p>
                      {session.captions[0] ? (
                        <p className="mt-4 text-sm font-black text-white/72">
                          {session.captions[0]}
                        </p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-white/38">
                  Player resurfacing
                </h3>
                <div className="mt-4 grid gap-4">
                  {playerMoments.slice(0, 5).map((player) => (
                    <Link
                      key={player.name}
                      href={`/players?player=${encodeURIComponent(player.name)}`}
                      className="transition hover:text-amber-100"
                    >
                      <p className="text-lg font-black text-white">
                        {player.name}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white/42">
                        {player.phrase}
                      </p>
                    </Link>
                  ))}
                  {playerMoments.length === 0 ? (
                    <p className="text-sm leading-6 text-white/42">
                      Player moments appear when names show up in captions or notes.
                    </p>
                  ) : null}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}
