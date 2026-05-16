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
  recentTriggers?: string[]
  repeatCount?: number
  reviewCount?: number
}

const calibrationMissions = getCalibrationMissions()
const coreTriggers = ["TIGHT", "SINK", "LOW", "HIT", "ICE", "HOLD", "KICK"]

function toAxisErrorState(error: unknown) {
  const message =
    error instanceof Error ? error.message : "UPLOAD WAITING"

  if (message.includes("NON_JSON_RESPONSE")) {
    return "UPLOAD PROCESSING"
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
    return "UPLOAD FAILED"
  }

  if (
    message.includes("INVALID MEMORY FORMAT") ||
    message.includes("unsupported")
  ) {
    return "INVALID VIDEO FORMAT"
  }

  if (
    message.includes("expected pattern") ||
    message.includes("Load failed") ||
    message.includes("Failed")
  ) {
    return "UPLOAD WAITING"
  }

  if (
    message === "UPLOAD WAITING" ||
    message === "AUTH REQUIRED" ||
    message === "UPLOAD FAILED" ||
    message === "INVALID VIDEO FORMAT" ||
    message === "STORAGE KEY INVALID" ||
    message === "UPLOAD PROCESSING"
  ) {
    return message
  }

  return "UPLOAD FAILED"
}

function parseUploadResponse(text: string) {
  try {
    return parseUploadResponseText(text)
  } catch (error) {
    console.error("AXIS JSON PARSE FAILURE", error)

    return {
      ok: false,
      error: "UPLOAD PROCESSING",
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
  const title = mission.title.toLowerCase()

  if (title === "handle") return "Ball Handling"
  if (title === "footwork") return "Footwork"
  if (title === "shooting form") return "Shooting Form"
  if (title === "live movement") return "Live Play"
  if (title === "transition") return "Transition Finish"

  return mission.title
}

function displayName(value?: string | null) {
  return value?.trim() || "Local Player"
}

export default function UploadConsole({
  email,
  twinName = null,
  initialWarmupId = null,
  recentTriggers = [],
  repeatCount = 0,
  reviewCount = 0,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const cameraInputRef =
    useRef<HTMLInputElement | null>(null)

  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [savedReplayId, setSavedReplayId] = useState("")
  const [savedTrigger, setSavedTrigger] = useState("")
  const [repeatTomorrow, setRepeatTomorrow] = useState(false)
  const [isQuickTagging, setIsQuickTagging] = useState(false)
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

  async function quickTagClip(triggerWord: string, repeat = repeatTomorrow) {
    if (!savedReplayId || isQuickTagging) return

    setIsQuickTagging(true)
    setSavedTrigger(triggerWord)
    setRepeatTomorrow(repeat)
    setStatus("Trigger saved")

    try {
      const response = await fetch("/api/session/quick-tag", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionId: savedReplayId,
          triggerWord,
          repeatTomorrow: repeat,
        }),
      })

      if (!response.ok) {
        throw new Error("Quick tag failed")
      }

      router.refresh()
    } catch (error) {
      console.error(error)
      setStatus("Clip saved")
    } finally {
      setIsQuickTagging(false)
    }
  }

  function resetLiveMode() {
    setSavedReplayId("")
    setSavedTrigger("")
    setRepeatTomorrow(false)
    setStatus("")
    setProgress(0)
    setFlowStep("brief")
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
      setStatus("INVALID VIDEO FORMAT")
      return
    }

    let pendingMemoryId: string | null = null

    try {
      setFlowStep("processing")
      setIsUploading(true)
      setProgress(12)
      setStatus("Saving clip")

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
      setStatus("Saving clip")

      if (!navigator.onLine) {
        if (pendingMemoryId) {
          await updatePendingMemoryStatus(pendingMemoryId, "pending")
        }

        setProgress(100)
        setStatus("Session saved")
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
          result.error || result.detail || "UPLOAD FAILED"
        )
      }

      if (!result.videoUrl) {
        throw new Error("UPLOAD FAILED")
      }

      setProgress(100)
      setStatus("Session saved")

      if (pendingMemoryId) {
        await updatePendingMemoryStatus(pendingMemoryId, "synced")
      }

      setSavedReplayId(result.replayId)
      setFlowStep("entry")
    } catch (error) {
      console.error(error)
      if (pendingMemoryId) {
        await updatePendingMemoryStatus(pendingMemoryId, "failed")
        setStatus("Session saved")
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
    <main className="min-h-screen bg-zinc-950 px-5 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/35">
              Practice
            </p>
            <p className="mt-2 text-sm text-white/35">
              {email}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="border border-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-white/55 transition hover:text-white"
            >
              Capture
            </Link>
            <Link
              href="/sessions"
              className="border border-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-white/55 transition hover:text-white"
            >
              Archive
            </Link>
            <Link
              href="/team/local"
              className="border border-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-white/55 transition hover:text-white"
            >
              Team
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="border border-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-white/35 transition hover:text-white"
            >
              Exit
            </button>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="border-b border-white/10 pb-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                  Live mode / {displayName(twinName)}
                </p>
                <h1 className="mt-1 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
                  That&apos;s the clip.
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                  Record the moment. Add a trigger if it needs to come back.
                  Save the details for review.
                </p>
              </div>
              <button
                type="button"
                disabled={isUploading || !selectedMission}
                onClick={() => {
                  setSavedReplayId("")
                  setSavedTrigger("")
                  setRepeatTomorrow(false)
                  setFlowStep("capture")
                  setStatus("Saving clip")
                  cameraInputRef.current?.click()
                }}
                className="min-h-24 border border-lime-300/25 bg-lime-300 px-8 py-5 text-xl font-black uppercase tracking-[0.12em] text-black transition hover:bg-white disabled:opacity-50"
              >
                Record
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {(recentTriggers.length ? recentTriggers : coreTriggers).map((trigger) => (
                <button
                  key={trigger}
                  type="button"
                  disabled={!savedReplayId || isQuickTagging}
                  onClick={() => quickTagClip(trigger)}
                  className={`border px-4 py-3 text-sm font-black uppercase tracking-[0.16em] transition disabled:opacity-35 ${
                    savedTrigger === trigger
                      ? "border-lime-300/60 bg-lime-300 text-black"
                      : "border-white/10 text-white/65 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {trigger}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!savedReplayId || isQuickTagging}
                onClick={() => {
                  const nextRepeat = !repeatTomorrow
                  setRepeatTomorrow(nextRepeat)
                  void quickTagClip(savedTrigger, nextRepeat)
                }}
                className={`border px-4 py-3 text-xs font-black uppercase tracking-[0.18em] transition disabled:opacity-35 ${
                  repeatTomorrow
                    ? "border-lime-300/50 text-lime-100"
                    : "border-white/10 text-white/55 hover:text-white"
                }`}
              >
                Repeat tomorrow
              </button>
              <Link
                href={savedReplayId ? `/replay/${savedReplayId}` : "/sessions"}
                className="border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/45 transition hover:text-white"
              >
                Review later
              </Link>
              {savedReplayId ? (
                <button
                  type="button"
                  onClick={resetLiveMode}
                  className="border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/45 transition hover:text-white"
                >
                  Next clip
                </button>
              ) : null}
            </div>
          </div>

          <aside className="border-b border-white/10 pb-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">
              Practice focus
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em]">
              {selectedMission ? missionName(selectedMission) : "Open session"}
            </h2>
            <select
              value={selectedMissionId}
              onChange={(event) => {
                setSelectedMissionId(event.target.value)
                setStatus("")
                setProgress(0)
              }}
              className="mt-3 w-full border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none"
            >
              {calibrationMissions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {missionName(mission)}
                </option>
              ))}
            </select>
            <div className="mt-4 grid gap-2 text-sm text-white/50">
              <Link href="/sessions?view=repeated" className="hover:text-white">
                {repeatCount ? `${repeatCount} repeat clips` : "No repeat clips tagged"}
              </Link>
              <Link href="/sessions?note=missing" className="hover:text-white">
                {reviewCount ? `${reviewCount} clips need review` : "No clips waiting"}
              </Link>
            </div>

            {status ? (
              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white">{status}</p>
                  <p className="text-xs text-white/40">{progress}%</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden bg-white/10">
                  <div
                    className="h-full bg-lime-300 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}

            {flowStep === "processing" && progress > 0 ? (
              <p className="mt-3 text-sm text-white/45">
                Add the details later in review.
              </p>
            ) : null}
            {savedReplayId ? (
              <p className="mt-3 text-sm text-lime-100/80">
                Clip saved. Tap a trigger and get back to practice.
              </p>
            ) : null}
          </aside>
        </section>

        {flowStep === "processing" && progress > 0 ? (
          <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-zinc-950/95 px-5 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-4">
              <p className="w-32 text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                {status || "Saving clip"}
              </p>
              <div className="h-2 flex-1 overflow-hidden bg-white/10">
                <div
                  className="h-full bg-lime-300 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-white/40">{progress}%</p>
            </div>
          </div>
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
