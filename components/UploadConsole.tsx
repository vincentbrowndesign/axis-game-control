"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  isSupportedReplayFile,
  normalizeReplayFile,
} from "@/lib/replayStorage"
import { parseUploadResponseText } from "@/lib/uploadResponse"
import { getCalibrationMissions } from "@/lib/missions/getCalibrationMissions"
import type { CalibrationMission } from "@/lib/missions/types"
import { getActiveTwin } from "@/lib/twin/getOrCreateTwin"
import { getSupportedRecordingMime } from "@/lib/video/getSupportedRecordingMime"
import {
  savePendingMemory,
  updatePendingMemoryStatus,
} from "@/lib/video/recordingPersistence"

type Source = "camera"
type FlowStep = "entry" | "mission" | "brief" | "capture" | "processing"

type Props = {
  email: string
  twinName?: string | null
  initialWarmupId?: string | null
}

const calibrationMissions = getCalibrationMissions()

function toAxisErrorState(error: unknown) {
  const message =
    error instanceof Error ? error.message : "MEMORY WAITING"

  if (message.includes("NON_JSON_RESPONSE")) {
    return "MEMORY PROCESSING"
  }

  if (
    message.includes("INVALID FILE OBJECT") ||
    message.includes("INVALID FINAL NAME") ||
    message.includes("INVALID STORAGE PATH")
  ) {
    return "STORAGE KEY INVALID"
  }

  if (
    message.includes("NO FILE") ||
    message.includes("MEMORY LOAD FAILED")
  ) {
    return "MEMORY INGEST FAILED"
  }

  if (
    message.includes("INVALID MEMORY FORMAT") ||
    message.includes("unsupported")
  ) {
    return "INVALID MEMORY FORMAT"
  }

  if (
    message.includes("expected pattern") ||
    message.includes("Load failed") ||
    message.includes("Failed")
  ) {
    return "MEMORY WAITING"
  }

  if (
    message === "MEMORY WAITING" ||
    message === "AUTH REQUIRED" ||
    message === "MEMORY INGEST FAILED" ||
    message === "INVALID MEMORY FORMAT" ||
    message === "STORAGE KEY INVALID" ||
    message === "MEMORY PROCESSING"
  ) {
    return message
  }

  return "MEMORY INGEST FAILED"
}

function parseUploadResponse(text: string) {
  try {
    return parseUploadResponseText(text)
  } catch (error) {
    console.error("AXIS JSON PARSE FAILURE", error)

    return {
      ok: false,
      error: "MEMORY PROCESSING",
      detail: "UPLOAD RESPONSE UNAVAILABLE",
    }
  }
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

function missionName(mission: CalibrationMission) {
  return mission.title
}

function displayName(value?: string | null) {
  return value?.trim() || "Local Player"
}

function MissionCard({
  mission,
  onSelect,
}: {
  mission: CalibrationMission
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="min-h-80 border border-white/10 bg-white/[0.03] p-5 text-left text-white transition hover:border-lime-300 hover:bg-lime-300 hover:text-black"
    >
      <h2 className="text-4xl font-black uppercase leading-none tracking-[-0.04em]">
        {missionName(mission)}
      </h2>
      <p className="mt-8 text-sm uppercase tracking-[0.28em] opacity-55">
        Carry forward
      </p>
    </button>
  )
}

export default function UploadConsole({
  email,
  twinName = null,
  initialWarmupId = null,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const cameraInputRef =
    useRef<HTMLInputElement | null>(null)

  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [flowStep, setFlowStep] = useState<FlowStep>(
    initialWarmupId ? "brief" : "entry"
  )
  const [selectedMissionId, setSelectedMissionId] = useState(
    initialWarmupId || calibrationMissions[0]?.id || "none"
  )
  const selectedMission =
    calibrationMissions.find((mission) => mission.id === selectedMissionId) ||
    calibrationMissions[0]

  async function signOut() {
    await supabase.auth.signOut()
    router.refresh()
  }

  async function saveSession(file: File, source: Source) {
    if (isUploading) return

    if (!file) {
      throw new Error("NO FILE")
    }

    if (!(file instanceof File)) {
      throw new Error("INVALID FILE OBJECT")
    }

    const normalized = normalizeReplayFile(file)

    if (!normalized.finalName) {
      throw new Error("INVALID FINAL NAME")
    }

    console.log("AXIS FILE", file)
    console.log("AXIS NAME", normalized.originalName)
    console.log("AXIS MIME", normalized.mime)
    console.log("AXIS FINAL", normalized.finalName)

    if (!isSupportedReplayFile(file)) {
      setProgress(0)
      setStatus("INVALID MEMORY FORMAT")
      return
    }

    let pendingMemoryId: string | null = null

    try {
      setFlowStep("processing")
      setIsUploading(true)
      setProgress(12)
      setStatus("ADDING MEMORY")

      const duration = await readDuration(file)
      const activeTwin = getActiveTwin(twinName)
      const pendingMemory = await savePendingMemory({
        blob: file,
        mimeType:
          normalized.mime ||
          file.type ||
          getSupportedRecordingMime() ||
          "video/mp4",
        filename: normalized.finalName,
        duration,
        twinId: activeTwin.id,
        warmupId: selectedMission?.id || "open-session",
        status: "saving",
      })

      pendingMemoryId = pendingMemory?.id || null

      setProgress(36)
      setStatus("ADDING MEMORY")

      if (!navigator.onLine) {
        if (pendingMemoryId) {
          await updatePendingMemoryStatus(pendingMemoryId, "pending")
        }

        setProgress(100)
        setStatus("MEMORY STORED")
        if (pendingMemoryId) {
          setTimeout(() => {
            router.push(`/replay/${pendingMemoryId}`)
          }, 900)
        }
        return
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        if (pendingMemoryId) {
          await updatePendingMemoryStatus(pendingMemoryId, "pending")
        }

        throw new Error("AUTH REQUIRED")
      }

      const uploadPath = `${user.id}/${normalized.finalName}`

      if (!uploadPath.includes("/")) {
        throw new Error("INVALID STORAGE PATH")
      }

      console.log("AXIS PATH", uploadPath)

      const formData = new FormData()
      formData.append("file", file)
      formData.append("source", source)
      formData.append("duration", String(duration))
      formData.append("environment", selectedMission ? "mission" : "practice")
      formData.append(
        "mission",
        selectedMission
          ? `WARMUP ${selectedMission.order
              .toString()
              .padStart(2, "0")} - ${selectedMission.title}`
          : "None"
      )
      formData.append("player", activeTwin.displayName)
      formData.append("originalName", normalized.originalName)
      formData.append("mime", normalized.mime)
      formData.append("finalName", normalized.finalName)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const contentType =
        response.headers.get("content-type") || ""

      if (!contentType.includes("application/json")) {
        const text = await response.text()

        console.error("AXIS NON JSON RESPONSE TEXT", text)
        console.log("UPLOAD_RESPONSE_RAW", text)

        throw new Error(`NON_JSON_RESPONSE: ${text}`)
      }

      const text = await response.text()
      console.log("UPLOAD_RESPONSE_RAW", text)
      const result = parseUploadResponse(text)

      if (!response.ok || !result.ok || !result.replayId) {
        throw new Error(
          result.error || result.detail || "MEMORY INGEST FAILED"
        )
      }

      if (!result.videoUrl) {
        throw new Error("MEMORY INGEST FAILED")
      }

      setProgress(100)
      setStatus("MEMORY STORED")

      if (pendingMemoryId) {
        await updatePendingMemoryStatus(pendingMemoryId, "synced")
      }

      setTimeout(() => {
        router.push(`/replay/${result.replayId}`)
      }, 900)
    } catch (error) {
      console.error(error)
      if (pendingMemoryId) {
        await updatePendingMemoryStatus(pendingMemoryId, "failed")
        setStatus("MEMORY STORED")
        setProgress(100)
        setTimeout(() => {
          router.push(`/replay/${pendingMemoryId}`)
        }, 900)
      } else {
        setStatus(toAxisErrorState(error))
        setProgress(0)
      }
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <main className="axis-atmosphere min-h-screen bg-black px-5 pb-24 pt-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between gap-6 border-b border-white/10 pb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.5em] text-white/30">
              Axis
            </p>
            <p className="mt-2 text-sm text-white/35">
              {email}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/archive"
              className="border border-white/10 px-5 py-4 text-xs font-black uppercase tracking-[0.25em] text-white/55 transition hover:text-white"
            >
              Archive
            </Link>
            <Link
              href="/player/local"
              className="border border-white/10 px-5 py-4 text-xs font-black uppercase tracking-[0.25em] text-white/55 transition hover:text-white"
            >
              Player
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="border border-white/10 px-5 py-4 text-xs font-black uppercase tracking-[0.25em] text-white/35 transition hover:text-white"
            >
              Exit
            </button>
          </div>
        </header>

        {flowStep === "entry" ? (
          <section className="flex min-h-[calc(100vh-13rem)] flex-col justify-end pb-10">
            <p className="text-[10px] uppercase tracking-[0.55em] text-white/30">
              {displayName(twinName)}
            </p>
            <h1 className="mt-6 text-[clamp(4.8rem,18vw,12rem)] font-black leading-[0.78] tracking-[-0.07em]">
              {displayName(twinName)}
              <br />
              RETURNING
            </h1>
            <p className="mt-8 max-w-xl text-xl leading-relaxed text-white/45">
              Continuity active.
            </p>
            <button
              type="button"
              onClick={() => setFlowStep("mission")}
              className="mt-10 w-fit bg-white px-9 py-5 text-sm font-black uppercase tracking-[0.28em] text-black transition hover:bg-lime-300"
            >
              Carry Forward
            </button>
          </section>
        ) : null}

        {flowStep === "mission" ? (
          <section className="pb-10">
            <div className="mb-8">
              <p className="text-[10px] uppercase tracking-[0.5em] text-white/30">
                Player Continuity
              </p>
              <h1 className="mt-4 text-[clamp(4rem,14vw,9rem)] font-black leading-[0.82] tracking-[-0.07em]">
                THREADS
                <br />
                ACTIVE
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/45">
                Choose what carries forward.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-5">
              {calibrationMissions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onSelect={() => {
                    setSelectedMissionId(mission.id)
                    setFlowStep("brief")
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}

        {flowStep === "brief" && selectedMission ? (
          <section className="grid min-h-[calc(100vh-13rem)] gap-10 pb-10 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <button
                type="button"
                onClick={() => setFlowStep("mission")}
                className="mb-8 text-xs uppercase tracking-[0.35em] text-white/35 transition hover:text-white"
              >
                Sources
              </button>
              <p className="text-[10px] uppercase tracking-[0.5em] text-lime-300">
                Player Continuity
              </p>
              <h1 className="mt-5 text-[clamp(4.2rem,16vw,10rem)] font-black leading-[0.78] tracking-[-0.07em]">
                {displayName(twinName)}
                <br />
                RETURNING
              </h1>
              <p className="mt-6 max-w-xl text-xl leading-relaxed text-white/55">
                {missionName(selectedMission)} continuity active.
              </p>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  setFlowStep("capture")
                  setStatus("ADDING MEMORY")
                  cameraInputRef.current?.click()
                }}
                className="mt-8 w-full bg-lime-300 px-6 py-5 text-sm font-black uppercase tracking-[0.24em] text-black transition hover:bg-white disabled:opacity-50"
              >
                Carry Forward
              </button>
            </div>
          </section>
        ) : null}

        {flowStep === "capture" || flowStep === "processing" ? (
          <section className="flex min-h-[calc(100vh-13rem)] flex-col justify-end pb-10">
            <p className="text-[10px] uppercase tracking-[0.5em] text-white/30">
              {flowStep === "capture" ? "Live Capture" : "Memory Processing"}
            </p>
            <h1 className="mt-5 text-[clamp(3.8rem,14vw,9rem)] font-black leading-[0.82] tracking-[-0.07em]">
              {status || "ADDING MEMORY"}
            </h1>
            <p className="mt-6 text-sm uppercase tracking-[0.32em] text-white/35">
              {selectedMission?.title || "Memory"}
            </p>
            {flowStep === "processing" && progress === 100 ? (
              <p className="mt-4 text-sm uppercase tracking-[0.32em] text-lime-300">
                MEMORY ADDED
              </p>
            ) : null}

            <div className="mt-10 h-5 overflow-hidden bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-lime-300 via-cyan-300 to-white transition-all duration-500"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
            <div className="mt-5 flex items-end justify-between gap-5">
              <p className="max-w-md text-sm leading-relaxed text-white/45">
                Memory carries forward.
              </p>
              <p className="text-[clamp(4rem,18vw,8rem)] font-black leading-none tracking-[-0.08em] text-white/70">
                {progress}%
              </p>
            </div>
          </section>
        ) : null}

        <input
          ref={cameraInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]

            if (file) void saveSession(file, "camera")
            else {
              setStatus("")
              setFlowStep("brief")
            }
            event.target.value = ""
          }}
        />
      </div>
    </main>
  )
}
