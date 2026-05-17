"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import ModeNav from "@/components/ModeNav"

type VoicePhrase = {
  id: string
  phrase: string
  createdAt: string
}

type PhraseCluster = {
  id: string
  label: string
  count: number
}

type PlayerMention = {
  name: string
  count: number
  latestPhrase: string
}

type SessionCard = {
  id: string
  title: string
  time: string
  phrases: string[]
  players: string[]
  landmarks: string[]
}

type Props = {
  recentPhrases: VoicePhrase[]
  repeatedPhrases: PhraseCluster[]
  playerMentions: PlayerMention[]
  recentSessions: SessionCard[]
}

type AxisSpeechRecognitionResult = {
  readonly isFinal: boolean
  readonly 0: {
    readonly transcript: string
  }
}

type AxisSpeechRecognitionEvent = {
  readonly resultIndex: number
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

const demoCaptions = [
  "SPREAD YOUR FEET",
  "STAY LOW",
  "SPRINT BACK",
  "BEAT HIM THERE",
  "DON'T DRIFT",
]

const waveformBars = [
  34, 62, 44, 76, 52, 88, 38, 68, 96, 48, 72, 42, 84, 58, 36, 74,
  54, 92, 46, 66, 40, 78, 50, 86, 60, 44, 70, 98, 52, 64, 38, 82,
]

function cleanPhrase(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function captionText(value: string) {
  return cleanPhrase(value).toUpperCase()
}

export default function VoiceMemoryConsole({
  recentPhrases,
  repeatedPhrases,
  playerMentions,
  recentSessions,
}: Props) {
  const recognitionRef = useRef<AxisSpeechRecognition | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [status, setStatus] = useState("")
  const [manualPhrase, setManualPhrase] = useState("")
  const [livePhrases, setLivePhrases] = useState<VoicePhrase[]>([])
  const [activeCaptionIndex, setActiveCaptionIndex] = useState(0)

  const phrases = useMemo(
    () => [...livePhrases, ...recentPhrases].slice(0, 12),
    [livePhrases, recentPhrases]
  )
  const captions = phrases.length
    ? phrases.map((item) => captionText(item.phrase))
    : demoCaptions
  const activeCaption = captions[activeCaptionIndex % captions.length]
  const landmarks = phrases.length
    ? phrases.slice(0, 6).map((item) => captionText(item.phrase))
    : demoCaptions

  useEffect(() => {
    if (!isPlaying || captions.length === 0) return

    const interval = window.setInterval(() => {
      setActiveCaptionIndex((index) => (index + 1) % captions.length)
    }, 2200)

    return () => window.clearInterval(interval)
  }, [captions.length, isPlaying])

  async function savePhrase(phrase: string) {
    const clean = cleanPhrase(phrase)
    if (!clean) return

    const tempPhrase = {
      id: `${Date.now()}-${clean}`,
      phrase: clean,
      createdAt: new Date().toISOString(),
    }

    setLivePhrases((items) => [tempPhrase, ...items].slice(0, 12))
    setActiveCaptionIndex(0)
    setStatus("Landmark saved")

    try {
      const response = await fetch("/api/practice/voice", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          phrase: clean,
        }),
      })

      if (!response.ok) throw new Error("Phrase save failed")
    } catch (error) {
      console.error(error)
      setStatus("Saved locally")
    }
  }

  function startSession() {
    if (isRecording) return

    const speechWindow = window as AxisSpeechWindow
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setStatus("Type phrases below")
      setIsRecording(true)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const phrase = result?.[0]?.transcript || ""

        if (result?.isFinal && phrase) {
          void savePhrase(phrase)
        }
      }
    }
    recognition.onerror = () => {
      setStatus("Type phrases below")
      setIsRecording(false)
      recognitionRef.current = null
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setIsRecording(false)
      setStatus("Session saved")
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setIsPlaying(true)
    setStatus("Listening")
  }

  function stopSession() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsRecording(false)
    setIsPlaying(false)
    setStatus("Session saved")
  }

  function saveManualPhrase() {
    const phrase = cleanPhrase(manualPhrase)
    if (!phrase) return

    setManualPhrase("")
    void savePhrase(phrase)
  }

  return (
    <main className="min-h-screen bg-[#090806] px-4 py-5 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black text-white/85">
            Axis
          </Link>
          <ModeNav active="record" />
        </header>

        <section
          id="record"
          className="grid min-h-[72vh] gap-8 py-8 lg:grid-cols-[1fr_360px] lg:items-center"
        >
          <div className="grid gap-7">
            <div>
              <p className="text-sm font-bold text-white/42">
                Behavioral playback
              </p>
              <h1 className="mt-3 max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.06em] text-white sm:text-7xl">
                Coaching memory, playable.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/48">
                Record the session. Axis turns the coaching voice into captions, landmarks, and replay moments.
              </p>
            </div>

            <div className="overflow-hidden bg-[#15120d] p-5 shadow-[0_34px_120px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={isRecording ? stopSession : startSession}
                  className={`grid h-24 w-24 place-items-center rounded-full text-sm font-black uppercase tracking-[0.14em] transition ${
                    isRecording
                      ? "bg-amber-100 text-black"
                      : "bg-stone-100 text-black hover:bg-amber-100"
                  }`}
                >
                  {isRecording ? "Stop" : "Record"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlaying((value) => !value)}
                  className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.06] text-sm font-black text-white/70 transition hover:bg-white hover:text-black"
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
              </div>

              <div className="mt-8 min-h-48">
                <p className="text-sm font-bold text-amber-100/70">
                  Live caption
                </p>
                <p className="mt-4 text-5xl font-black leading-[0.95] tracking-[-0.05em] text-white sm:text-6xl">
                  {activeCaption}
                </p>
              </div>

              <div className="mt-8 flex h-20 items-end gap-1">
                {waveformBars.map((height, index) => (
                  <button
                    key={`${height}-${index}`}
                    type="button"
                    onClick={() => setActiveCaptionIndex(index % captions.length)}
                    className={`w-full rounded-full transition ${
                      index % captions.length === activeCaptionIndex % captions.length
                        ? "bg-amber-100"
                        : "bg-white/16 hover:bg-white/30"
                    }`}
                    style={{ height: `${height}%` }}
                    aria-label={`Jump to landmark ${index + 1}`}
                  />
                ))}
              </div>

              {status ? (
                <p className="mt-4 text-sm font-bold text-white/42">{status}</p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={manualPhrase}
                onChange={(event) => setManualPhrase(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveManualPhrase()
                }}
                placeholder="Or type: AJ spread your feet."
                className="bg-black/25 px-4 py-4 text-base text-white outline-none placeholder:text-white/25"
              />
              <button
                type="button"
                onClick={saveManualPhrase}
                className="bg-white/[0.07] px-5 py-4 text-sm font-bold text-white/70 transition hover:bg-white hover:text-black"
              >
                Add landmark
              </button>
            </div>
          </div>

          <aside className="grid gap-5">
            <div>
              <p className="text-sm font-bold text-white/42">Landmarks</p>
              <div className="mt-3 grid gap-2">
                {landmarks.map((landmark, index) => (
                  <button
                    key={`${landmark}-${index}`}
                    type="button"
                    onClick={() => {
                      setActiveCaptionIndex(index)
                      setIsPlaying(true)
                    }}
                    className={`px-4 py-3 text-left text-sm font-black transition ${
                      index === activeCaptionIndex % landmarks.length
                        ? "bg-white text-black"
                        : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {landmark}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section id="today" className="grid gap-12 border-t border-white/8 py-12">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-sm font-bold text-white/42">Today</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
                Replay moments.
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
            <section>
              <h3 className="text-sm font-bold text-white/42">
                Recent sessions
              </h3>
              <div className="mt-4 grid gap-5">
                {recentSessions.slice(0, 4).map((session) => (
                  <Link
                    key={session.id}
                    href="/sessions"
                    className="group block bg-white/[0.035] p-5 transition hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-2xl font-black tracking-[-0.04em] text-white">
                          {session.title}
                        </p>
                        <p className="mt-2 text-sm text-white/38">
                          {session.time}
                        </p>
                      </div>
                      <span className="text-sm font-black text-amber-100/80">
                        Play
                      </span>
                    </div>
                    <div className="mt-5 flex h-10 items-end gap-1">
                      {waveformBars.slice(0, 18).map((height, index) => (
                        <span
                          key={`${session.id}-${height}-${index}`}
                          className="w-full rounded-full bg-white/14 transition group-hover:bg-amber-100/70"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                    <p className="mt-5 text-xl font-black leading-tight tracking-[-0.03em] text-white/86">
                      {session.landmarks[0] || "Session ready"}
                    </p>
                  </Link>
                ))}
                {recentSessions.length === 0 ? (
                  <p className="max-w-xl text-2xl font-black tracking-[-0.04em] text-white">
                    Start recording and session playback will appear here.
                  </p>
                ) : null}
              </div>
            </section>

            <aside className="grid h-fit gap-9">
              <section>
                <h3 className="text-sm font-bold text-white/42">
                  Repeated phrases
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {repeatedPhrases.slice(0, 8).map((cluster) => (
                    <span
                      key={cluster.id}
                      className="bg-white/[0.04] px-4 py-3 text-sm font-bold text-white/62"
                    >
                      {cluster.label}
                    </span>
                  ))}
                  {repeatedPhrases.length === 0 ? (
                    <p className="text-sm leading-6 text-white/42">
                      Repeated phrases collect here as landmarks.
                    </p>
                  ) : null}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-white/42">
                  Player focus
                </h3>
                <div className="mt-4 grid gap-4">
                  {playerMentions.slice(0, 6).map((player) => (
                    <Link
                      key={player.name}
                      href={`/players?player=${encodeURIComponent(player.name)}`}
                      className="transition hover:text-amber-100"
                    >
                      <p className="text-lg font-black text-white">
                        {player.name}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white/42">
                        {player.latestPhrase}
                      </p>
                    </Link>
                  ))}
                  {playerMentions.length === 0 ? (
                    <p className="text-sm leading-6 text-white/42">
                      Player names become replay queues as they are mentioned.
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
