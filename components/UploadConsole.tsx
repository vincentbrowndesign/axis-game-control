"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import ModeNav from "@/components/ModeNav"
import { suggestTrigger } from "@/lib/axis-ai/suggestTrigger"
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
import type { ReplaySessionView } from "@/types/memory"

type Source = "camera"
type FlowStep = "entry" | "mission" | "brief" | "capture" | "processing"

type Props = {
  email: string
  twinName?: string | null
  initialWarmupId?: string | null
  recentTriggers?: string[]
  repeatCount?: number
  reviewCount?: number
  recentClips?: ReplaySessionView[]
  recentPlayers?: string[]
}

const calibrationMissions = getCalibrationMissions()
const coreTriggers = ["TIGHT", "SINK", "LOW", "HIT", "ICE", "HOLD", "KICK"]
const behaviorPhrases = [
  "Stay low and explode.",
  "Tag first before closing out.",
  "Don't drift wide.",
  "Beat him to the spot.",
  "Sprint back.",
  "Stop floating.",
]

type AxisSpeechRecognitionResult = {
  readonly isFinal: boolean
  readonly 0: {
    readonly transcript: string
  }
}

type AxisSpeechRecognitionEvent = {
  readonly results: {
    readonly length: number
    readonly [index: number]: AxisSpeechRecognitionResult
  }
}

type AxisSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: AxisSpeechRecognitionEvent) => void) | null
  start: () => void
}

type AxisSpeechRecognitionConstructor = new () => AxisSpeechRecognition
type AxisSpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: AxisSpeechRecognitionConstructor
    webkitSpeechRecognition?: AxisSpeechRecognitionConstructor
  }

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

function isClipProcessing(status?: string) {
  return status === "uploaded" || status === "processing" || status === "created"
}

function isClipError(status?: string) {
  return status === "error"
}

export default function UploadConsole({
  twinName = null,
  initialWarmupId = null,
  recentTriggers = [],
  recentClips = [],
  recentPlayers = [],
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
  const [behaviorPhrase, setBehaviorPhrase] = useState("")
  const [selectedPlayer, setSelectedPlayer] = useState("")
  const [roster, setRoster] = useState<string[]>(() => {
    if (typeof window === "undefined") return []

    try {
      const saved = window.localStorage.getItem("axis-roster")
      const parsed = saved ? JSON.parse(saved) : []

      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : []
    } catch {
      return []
    }
  })
  const [newPlayerName, setNewPlayerName] = useState("")
  const [newPlayerGrade, setNewPlayerGrade] = useState("")
  const [newPlayerTeam, setNewPlayerTeam] = useState("")
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [liveClips, setLiveClips] = useState(recentClips)
  const [isListening, setIsListening] = useState(false)
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
  const liveTriggers = [
    ...new Set([...recentTriggers, ...coreTriggers]),
  ].slice(0, 9)
  const playerChips = [
    ...new Set([...roster, ...recentPlayers, "AJ", "Liam", "Kendal"]),
  ]
    .filter((player) => player && player !== "Local player")
    .slice(0, 10)

  function saveRoster(nextRoster: string[]) {
    const cleanRoster = [...new Set(nextRoster.map((name) => name.trim()).filter(Boolean))]
    setRoster(cleanRoster)
    window.localStorage.setItem("axis-roster", JSON.stringify(cleanRoster))
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.refresh()
  }

  async function quickTagClip(
    triggerWord: string,
    repeat = repeatTomorrow,
    phrase = behaviorPhrase,
    player = selectedPlayer
  ) {
    if (!savedReplayId || isQuickTagging) return

    setIsQuickTagging(true)
    setSavedTrigger(triggerWord)
    setRepeatTomorrow(repeat)
    setBehaviorPhrase(phrase)
    setStatus(phrase ? "Sentence saved" : triggerWord ? "Saved" : "Saved")

    try {
      const response = await fetch("/api/session/quick-tag", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionId: savedReplayId,
          triggerWord,
          behaviorPhrase: phrase,
          playerName: player,
          repeatTomorrow: repeat,
        }),
      })

      if (!response.ok) {
        throw new Error("Quick tag failed")
      }

      setLiveClips((clips) =>
        clips.map((clip) =>
          clip.id === savedReplayId
            ? {
                ...clip,
                coachNote: phrase || clip.coachNote,
                triggerWord: triggerWord || clip.triggerWord,
                player: player || clip.player,
                repeatTomorrow: repeat,
              }
            : clip
        )
      )
      router.refresh()
    } catch (error) {
      console.error(error)
      setStatus("Clip saved")
    } finally {
      setIsQuickTagging(false)
    }
  }

  async function assignPlayer(player: string) {
    const cleanPlayer = player.trim()
    if (!cleanPlayer) return

    setSelectedPlayer(cleanPlayer)

    if (!savedReplayId || isQuickTagging) return

    await quickTagClip(savedTrigger, repeatTomorrow, behaviorPhrase, cleanPlayer)
    setLiveClips((clips) =>
      clips.map((clip) =>
        clip.id === savedReplayId ? { ...clip, player: cleanPlayer } : clip
      )
    )
  }

  function addPlayer() {
    const cleanPlayer = newPlayerName.trim()
    if (!cleanPlayer) return

    saveRoster([cleanPlayer, ...roster])
    window.localStorage.setItem(
      `axis-player-${cleanPlayer.toLowerCase()}`,
      JSON.stringify({
        name: cleanPlayer,
        grade: newPlayerGrade.trim(),
        team: newPlayerTeam.trim(),
      })
    )
    setNewPlayerName("")
    setNewPlayerGrade("")
    setNewPlayerTeam("")
    setShowAddPlayer(false)
    void assignPlayer(cleanPlayer)
  }

  async function deleteClip(sessionId: string) {
    setLiveClips((clips) => clips.filter((clip) => clip.id !== sessionId))
    if (savedReplayId === sessionId) resetLiveMode()

    const response = await fetch("/api/session/delete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
      }),
    })

    if (!response.ok) {
      router.refresh()
    }
  }

  function resetLiveMode() {
    setSavedReplayId("")
    setSavedTrigger("")
    setBehaviorPhrase("")
    setSelectedPlayer("")
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

      const replayId = result.replayId
      const videoUrl = result.videoUrl
      const environment: ReplaySessionView["environment"] = selectedMission
        ? "mission"
        : "practice"

      setProgress(100)
      setStatus("Session saved")

      if (pendingMemoryId) {
        await updatePendingMemoryStatus(pendingMemoryId, "synced")
      }

      setSavedReplayId(replayId)
      setSelectedPlayer(activeTwin.displayName)
      setLiveClips((clips) => [
        {
          id: replayId,
          createdAt: Date.now(),
          source,
          videoUrl,
          title: "Clip saved",
          mission: selectedMission ? missionName(selectedMission) : "Open session",
          player: activeTwin.displayName,
          environment,
          duration,
          status: "stored",
          tags: [],
          coachNote: "",
        },
        ...clips,
      ].slice(0, 12))
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

  function saveBehaviorPhrase(phrase: string) {
    const cleanPhrase = phrase.trim()
    if (!cleanPhrase) return

    const trigger = savedTrigger || suggestTrigger(cleanPhrase)
    void quickTagClip(trigger, repeatTomorrow, cleanPhrase)
  }

  function startVoiceCapture() {
    if (!savedReplayId || isListening) return

    const speechWindow = window as AxisSpeechWindow
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setStatus("Voice unavailable")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => {
      setIsListening(false)
      setStatus("Voice unavailable")
    }
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1]
      const phrase = result?.[0]?.transcript?.trim() || ""

      if (phrase) saveBehaviorPhrase(phrase)
    }

    setIsListening(true)
    setStatus("Listening")
    recognition.start()
  }

  return (
    <main className="min-h-screen bg-[#090806] px-5 py-7 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black tracking-[-0.02em] text-white">
            Axis
          </Link>
          <div className="flex flex-wrap gap-2">
            <ModeNav active="live" />
            <button
              type="button"
              onClick={signOut}
              className="px-2 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/30 transition hover:text-white"
            >
              Exit
            </button>
          </div>
        </header>

        <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-7xl">
                  That&apos;s the clip.
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-white/45">
                  Record it. Say the sentence. Keep coaching.
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
                className="min-h-32 min-w-44 bg-amber-200 px-9 py-6 text-2xl font-black uppercase tracking-[0.1em] text-black transition hover:bg-stone-100 disabled:opacity-50"
              >
                Record
              </button>
            </div>

            <div className="mt-10 flex flex-wrap gap-2">
              {playerChips.map((player) => (
                <button
                  key={player}
                  type="button"
                  disabled={!savedReplayId || isQuickTagging}
                  onClick={() => assignPlayer(player)}
                  className={`px-4 py-3 text-sm font-black transition disabled:opacity-35 ${
                    selectedPlayer === player
                      ? "bg-amber-200 text-black"
                      : "bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {player}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowAddPlayer((value) => !value)}
                className="px-4 py-3 text-sm font-bold text-white/45 transition hover:bg-white/[0.05] hover:text-white"
              >
                Add Player
              </button>
            </div>

            {showAddPlayer ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={newPlayerName}
                  onChange={(event) => setNewPlayerName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addPlayer()
                  }}
                  placeholder="Name"
                  className="min-w-[180px] bg-black/35 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25"
                />
                <input
                  value={newPlayerGrade}
                  onChange={(event) => setNewPlayerGrade(event.target.value)}
                  placeholder="Grade"
                  className="w-24 bg-black/35 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25"
                />
                <input
                  value={newPlayerTeam}
                  onChange={(event) => setNewPlayerTeam(event.target.value)}
                  placeholder="Team"
                  className="w-28 bg-black/35 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25"
                />
                <button
                  type="button"
                  onClick={addPlayer}
                  className="bg-white/[0.08] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/70 transition hover:bg-white hover:text-black"
                >
                  Save
                </button>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {behaviorPhrases.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  disabled={!savedReplayId || isQuickTagging}
                  onClick={() => saveBehaviorPhrase(phrase)}
                  className={`px-4 py-3 text-sm font-bold transition disabled:opacity-35 ${
                    behaviorPhrase === phrase
                      ? "bg-amber-200 text-black"
                      : "bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {phrase}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!savedReplayId || isListening || isQuickTagging}
                onClick={startVoiceCapture}
                className="bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
              >
                {isListening ? "Listening" : "Speak correction"}
              </button>
              <input
                value={behaviorPhrase}
                disabled={!savedReplayId || isQuickTagging}
                onChange={(event) => setBehaviorPhrase(event.target.value)}
                onBlur={() => saveBehaviorPhrase(behaviorPhrase)}
                placeholder="Type a quick behavior phrase"
                className="min-w-[240px] flex-1 bg-black/35 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25 disabled:opacity-35"
              />
            </div>

            <details className="mt-5 pt-1">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.18em] text-white/40 transition hover:text-white">
                Cue
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
              {liveTriggers.map((trigger) => (
                <button
                  key={trigger}
                  type="button"
                  disabled={!savedReplayId || isQuickTagging}
                  onClick={() => quickTagClip(trigger)}
                  className={`px-4 py-3 text-sm font-black uppercase tracking-[0.16em] transition disabled:opacity-35 ${
                    savedTrigger === trigger
                      ? "bg-amber-200 text-black"
                      : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {trigger}
                </button>
              ))}
              </div>
            </details>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!savedReplayId || isQuickTagging}
                onClick={() => {
                  const nextRepeat = !repeatTomorrow
                  setRepeatTomorrow(nextRepeat)
                  void quickTagClip(savedTrigger, nextRepeat, behaviorPhrase)
                }}
                className={`px-4 py-3 text-xs font-black uppercase tracking-[0.18em] transition disabled:opacity-35 ${
                  repeatTomorrow
                    ? "bg-white/[0.08] text-amber-100"
                    : "text-white/45 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                Watch again
              </button>
              <Link
                href={savedReplayId ? `/replay/${savedReplayId}` : "/sessions"}
                className="px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/45 transition hover:bg-white/[0.05] hover:text-white"
              >
                Watch later
              </Link>
              {savedReplayId ? (
                <button
                  type="button"
                  onClick={resetLiveMode}
                  className="px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/45 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Next clip
                </button>
              ) : null}
            </div>
          </div>

          <aside className="pt-1">
            <select
              value={selectedMissionId}
              onChange={(event) => {
                setSelectedMissionId(event.target.value)
                setStatus("")
                setProgress(0)
              }}
              className="mt-3 w-full bg-black/35 px-3 py-3 text-sm text-white outline-none"
            >
              {calibrationMissions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {missionName(mission)}
                </option>
              ))}
            </select>
            {status ? (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white">{status}</p>
                  <p className="text-xs text-white/40">{progress}%</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden bg-white/10">
                  <div
                    className="h-full bg-amber-200 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}

            {savedReplayId ? (
              <p className="mt-3 text-sm text-amber-100/80">
                Saved. Add the sentence and keep going.
              </p>
            ) : null}
          </aside>
        </section>

        <section className="mt-12">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {liveClips.slice(0, 9).map((clip) => (
              <article key={clip.id} className="group">
                <Link
                  href={`/replay/${clip.id}`}
                  className="block aspect-video overflow-hidden bg-black/70"
                >
                  {isClipProcessing(clip.status) ? (
                    <div className="grid h-full place-items-center text-xs font-black uppercase tracking-[0.18em] text-white/35">
                      Clip processing...
                    </div>
                  ) : isClipError(clip.status) ? (
                    <div className="grid h-full place-items-center text-xs font-black uppercase tracking-[0.18em] text-white/35">
                      Clip unavailable
                    </div>
                  ) : clip.videoUrl ? (
                    <video
                      src={clip.videoUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover opacity-85 transition group-hover:opacity-100"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-xs font-black uppercase tracking-[0.18em] text-white/30">
                      Clip saved
                    </div>
                  )}
                </Link>
                <div className="mt-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-white">
                      {clip.player || "Player"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/55">
                      {clip.coachNote || "Add a sentence."}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Link
                      href={`/replay/${clip.id}`}
                      className="text-xs font-black uppercase tracking-[0.16em] text-white/40 transition hover:text-white"
                    >
                      Watch
                    </Link>
                    <button
                      type="button"
                      onClick={() => deleteClip(clip.id)}
                      className="text-xs font-black uppercase tracking-[0.16em] text-white/28 transition hover:text-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {flowStep === "processing" && progress > 0 ? (
          <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#090806]/95 px-5 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-4">
              <p className="w-32 text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                {status || "Saving clip"}
              </p>
              <div className="h-2 flex-1 overflow-hidden bg-white/10">
                <div
                  className="h-full bg-amber-200 transition-all duration-300"
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
