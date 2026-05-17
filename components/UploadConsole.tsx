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
import type { ReplaySessionView, WorkflowStage } from "@/types/memory"

type Source = "camera"
type FlowStep = "entry" | "mission" | "brief" | "capture" | "processing"

type Props = {
  email: string
  twinName?: string | null
  initialWarmupId?: string | null
  recentClips?: ReplaySessionView[]
  recentPlayers?: string[]
}

const calibrationMissions = getCalibrationMissions()
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
  stop: () => void
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
  recentClips = [],
  recentPlayers = [],
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const cameraInputRef =
    useRef<HTMLInputElement | null>(null)
  const listeningRef = useRef<AxisSpeechRecognition | null>(null)

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
  const [coachingPhrases, setCoachingPhrases] = useState<string[]>([])
  const [repeatTomorrow, setRepeatTomorrow] = useState(false)
  const [workflowStage] = useState<WorkflowStage>("DRILL")
  const [isQuickTagging, setIsQuickTagging] = useState(false)
  const [flowStep, setFlowStep] = useState<FlowStep>(
    initialWarmupId ? "brief" : "entry"
  )
  const [selectedMissionId] = useState(
    initialWarmupId || calibrationMissions[0]?.id || "none"
  )
  const selectedMission =
    calibrationMissions.find((mission) => mission.id === selectedMissionId) ||
    calibrationMissions[0]
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
          workflowStage,
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
                workflowStage,
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

  async function saveVoicePhrase(phrase: string, sessionId = savedReplayId) {
    const cleanPhrase = phrase.trim()
    if (!cleanPhrase) return

    setCoachingPhrases((phrases) => [cleanPhrase, ...phrases].slice(0, 8))

    if (!behaviorPhrase) {
      setBehaviorPhrase(cleanPhrase)
    }

    if (sessionId) {
      const triggerWord = savedTrigger || suggestTrigger(cleanPhrase)

      if (sessionId === savedReplayId) {
        await quickTagClip(
          triggerWord,
          repeatTomorrow,
          cleanPhrase,
          selectedPlayer
        )
      } else {
        await fetch("/api/session/quick-tag", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            triggerWord,
            behaviorPhrase: cleanPhrase,
            playerName: selectedPlayer,
            workflowStage,
            repeatTomorrow,
          }),
        })
      }

      setLiveClips((clips) =>
        clips.map((clip) =>
          clip.id === sessionId
            ? {
                ...clip,
                coachNote: cleanPhrase,
                triggerWord,
                workflowStage,
              }
            : clip
        )
      )
    }

    try {
      await fetch("/api/practice/voice", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          phrase: cleanPhrase,
          workflowStage,
        }),
      })
    } catch (error) {
      console.error("VOICE PHRASE SAVE FAILED", error)
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
      formData.append("workflowStage", workflowStage)

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
      const latestPhrase = behaviorPhrase || coachingPhrases[0] || ""
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
          workflowStage,
          tags: [],
          coachNote: latestPhrase,
        },
        ...clips,
      ].slice(0, 12))
      if (latestPhrase) {
        void saveVoicePhrase(latestPhrase, replayId)
      }
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

  function startVoiceCapture(requireClip = true) {
    if ((requireClip && !savedReplayId) || isListening) return

    const speechWindow = window as AxisSpeechWindow
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setStatus("Voice unavailable")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.continuous = !requireClip
    recognition.interimResults = false
    recognition.onend = () => {
      listeningRef.current = null
      setIsListening(false)
    }
    recognition.onerror = () => {
      setIsListening(false)
      setStatus("Voice unavailable")
    }
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1]
      const phrase = result?.[0]?.transcript?.trim() || ""

      if (phrase) {
        if (requireClip) saveBehaviorPhrase(phrase)
        else void saveVoicePhrase(phrase)
      }
    }

    listeningRef.current = recognition
    setIsListening(true)
    setStatus("Listening")
    recognition.start()
  }

  function stopVoiceCapture() {
    listeningRef.current?.stop()
    listeningRef.current = null
    setIsListening(false)
    setStatus("")
  }

  return (
    <main className="min-h-screen bg-[#0b0a08] px-4 py-5 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black text-white/85">
            Axis
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <ModeNav active="today" />
            <button
              type="button"
              onClick={signOut}
              className="px-2 py-2 text-xs font-bold text-white/30 transition hover:text-white"
            >
              Exit
            </button>
          </div>
        </header>

        <section className="grid gap-8">
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/45">
              <p className="font-bold text-white/65">Today</p>
              <button
                type="button"
                onClick={() => {
                  if (isListening) stopVoiceCapture()
                  else startVoiceCapture(false)
                }}
                className={`px-3 py-2 font-bold transition ${
                  isListening
                    ? "bg-white/[0.08] text-white"
                    : "hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {isListening ? "Listening" : "Listen"}
              </button>
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
              className="min-h-[44vh] w-full bg-stone-100 px-8 py-14 text-5xl font-black tracking-[-0.05em] text-black transition hover:bg-amber-100 disabled:opacity-50 sm:text-7xl"
            >
              Record
            </button>

            {status ? (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white/70">{status}</p>
                  {progress > 0 ? (
                    <p className="text-xs text-white/35">{progress}%</p>
                  ) : null}
                </div>
                {progress > 0 ? (
                  <div className="mt-2 h-1 overflow-hidden bg-white/10">
                    <div
                      className="h-full bg-amber-100 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {savedReplayId ? (
              <div className="grid gap-4">
                <p className="text-sm text-white/45">
                  Saved. Add player and sentence.
                </p>
                <div className="flex flex-wrap gap-2">
              {playerChips.map((player) => (
                <button
                  key={player}
                  type="button"
                  disabled={!savedReplayId || isQuickTagging}
                  onClick={() => assignPlayer(player)}
                      className={`px-4 py-3 text-sm font-bold transition disabled:opacity-35 ${
                    selectedPlayer === player
                          ? "bg-stone-100 text-black"
                          : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {player}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowAddPlayer((value) => !value)}
                    className="px-4 py-3 text-sm font-bold text-white/40 transition hover:bg-white/[0.05] hover:text-white"
              >
                Add Player
              </button>
                </div>

            {showAddPlayer ? (
                  <div className="flex flex-wrap gap-2">
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
                      className="bg-white/[0.08] px-4 py-3 text-xs font-bold text-white/70 transition hover:bg-white hover:text-black"
                >
                  Save
                </button>
              </div>
            ) : null}

                <div className="flex flex-wrap gap-2">
              {behaviorPhrases.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  disabled={!savedReplayId || isQuickTagging}
                  onClick={() => saveBehaviorPhrase(phrase)}
                  className={`px-4 py-3 text-sm font-bold transition disabled:opacity-35 ${
                    behaviorPhrase === phrase
                          ? "bg-stone-100 text-black"
                          : "bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {phrase}
                </button>
              ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!savedReplayId || isListening || isQuickTagging}
                onClick={() => startVoiceCapture(true)}
                    className="bg-white/[0.04] px-4 py-3 text-sm font-bold text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
              >
                    {isListening ? "Listening" : "Speak"}
              </button>
              <input
                value={behaviorPhrase}
                disabled={!savedReplayId || isQuickTagging}
                onChange={(event) => setBehaviorPhrase(event.target.value)}
                onBlur={() => saveBehaviorPhrase(behaviorPhrase)}
                    placeholder="Say what to repeat"
                className="min-w-[240px] flex-1 bg-black/35 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25 disabled:opacity-35"
              />
                </div>
                {coachingPhrases.length ? (
                  <div className="flex flex-wrap gap-2 text-sm text-white/35">
                    {coachingPhrases.slice(0, 4).map((phrase) => (
                      <button
                        key={phrase}
                        type="button"
                        onClick={() => saveBehaviorPhrase(phrase)}
                        className="transition hover:text-white"
                      >
                        {phrase}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
              <Link
                href={savedReplayId ? `/replay/${savedReplayId}` : "/sessions"}
                    className="px-4 py-3 text-sm font-bold text-white/45 transition hover:bg-white/[0.05] hover:text-white"
              >
                    Watch
              </Link>
                <button
                  type="button"
                  onClick={resetLiveMode}
                    className="px-4 py-3 text-sm font-bold text-white/45 transition hover:bg-white/[0.05] hover:text-white"
                >
                    Done
                </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-10">
          <div className="grid gap-8 md:grid-cols-2">
            {liveClips.slice(0, 9).map((clip) => (
              <article key={clip.id} className="group">
                <Link
                  href={`/replay/${clip.id}`}
                  className="block aspect-video overflow-hidden bg-black/70"
                >
                  {isClipProcessing(clip.status) ? (
                    <div className="grid h-full place-items-center text-sm font-bold text-white/35">
                      Clip processing...
                    </div>
                  ) : isClipError(clip.status) ? (
                    <div className="grid h-full place-items-center text-sm font-bold text-white/35">
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
                    <div className="grid h-full place-items-center text-sm font-bold text-white/30">
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
                      className="text-sm font-bold text-white/40 transition hover:text-white"
                    >
                      Watch
                    </Link>
                    <button
                      type="button"
                      onClick={() => deleteClip(clip.id)}
                      className="text-sm font-bold text-white/25 transition hover:text-red-200"
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
