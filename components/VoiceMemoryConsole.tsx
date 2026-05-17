"use client"

import Link from "next/link"
import { useRef, useState } from "react"
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

type Props = {
  recentPhrases: VoicePhrase[]
  repeatedPhrases: PhraseCluster[]
  playerMentions: PlayerMention[]
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

function cleanPhrase(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Today"

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function VoiceMemoryConsole({
  recentPhrases,
  repeatedPhrases,
  playerMentions,
}: Props) {
  const recognitionRef = useRef<AxisSpeechRecognition | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState("")
  const [manualPhrase, setManualPhrase] = useState("")
  const [livePhrases, setLivePhrases] = useState<VoicePhrase[]>([])

  const phrases = [...livePhrases, ...recentPhrases].slice(0, 12)

  async function savePhrase(phrase: string) {
    const clean = cleanPhrase(phrase)
    if (!clean) return

    const tempPhrase = {
      id: `${Date.now()}-${clean}`,
      phrase: clean,
      createdAt: new Date().toISOString(),
    }

    setLivePhrases((items) => [tempPhrase, ...items].slice(0, 12))
    setStatus("Saved")

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
      setStatus("Session stopped")
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setStatus("Listening")
  }

  function stopSession() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsRecording(false)
    setStatus("Session stopped")
  }

  function saveManualPhrase() {
    const phrase = cleanPhrase(manualPhrase)
    if (!phrase) return

    setManualPhrase("")
    void savePhrase(phrase)
  }

  return (
    <main className="min-h-screen bg-[#0c0b09] px-4 py-5 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black text-white/85">
            Axis
          </Link>
          <ModeNav active="record" />
        </header>

        <section id="record" className="grid min-h-[64vh] content-center gap-8 py-8">
          <div>
            <p className="text-sm font-bold text-white/42">
              Coaching memory
            </p>
            <h1 className="mt-3 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-7xl">
              Tap record. Coach normally.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/48">
              Axis listens for repeated coaching phrases, player names, and the corrections that keep coming back.
            </p>
          </div>

          <button
            type="button"
            onClick={isRecording ? stopSession : startSession}
            className={`min-h-56 w-full px-8 py-14 text-5xl font-black tracking-[-0.05em] shadow-[0_28px_80px_rgba(0,0,0,0.35)] transition sm:text-7xl ${
              isRecording
                ? "bg-amber-100 text-black"
                : "bg-stone-100 text-black hover:bg-amber-100"
            }`}
          >
            {isRecording ? "Stop" : "Record"}
          </button>

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
              Save phrase
            </button>
          </div>

          {status ? (
            <p className="text-sm font-bold text-white/42">{status}</p>
          ) : null}
        </section>

        <section id="today" className="grid gap-12 border-t border-white/8 py-12">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-sm font-bold text-white/42">Today</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
                What kept coming up.
              </h2>
            </div>
            <Link
              href="/players"
              className="w-fit text-sm font-bold text-white/42 transition hover:text-white"
            >
              Players
            </Link>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
            <section>
              <h3 className="text-sm font-bold text-white/42">
                Recent phrases
              </h3>
              <div className="mt-4 grid gap-4">
                {phrases.map((item) => (
                  <article key={item.id} className="border-b border-white/8 pb-4">
                    <p className="text-2xl font-black leading-tight tracking-[-0.04em] text-white">
                      {item.phrase}
                    </p>
                    <p className="mt-2 text-sm text-white/35">
                      {timeLabel(item.createdAt)}
                    </p>
                  </article>
                ))}
                {phrases.length === 0 ? (
                  <p className="max-w-xl text-2xl font-black tracking-[-0.04em] text-white">
                    Start a session and coaching phrases will appear here.
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
                      Repeated corrections will collect here as practice runs.
                    </p>
                  ) : null}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-white/42">
                  Player mentions
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
                      Say a player name during practice to start a memory.
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
