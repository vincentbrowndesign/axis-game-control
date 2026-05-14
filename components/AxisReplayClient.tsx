"use client"

import { motion } from "framer-motion"
import MuxPlayer from "@mux/mux-player-react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type Props = {
  playbackId?: string
  sessionId?: string
}

type AxisObservation = {
  id: string
  title: string
  proof: string
  why: string
  confidence: number
}

const sessionEvents = [
  "DRIVE",
  "PAINT TOUCH",
  "SHOT",
  "MAKE",
]

function confidenceLabel(score: number) {
  if (score >= 88) return "HIGH"
  if (score >= 74) return "MEDIUM"
  return "LOW"
}

function buildObservations(): AxisObservation[] {
  return [
    {
      id: "decision-speed",
      title:
        "Your best scoring windows appeared before help established.",
      proof:
        "This possession created pressure immediately after the first paint touch.",
      why:
        "Early attacks create cleaner reads before the defense stabilizes.",
      confidence: 92,
    },
    {
      id: "paint-memory",
      title:
        "Paint pressure increased overall shot quality.",
      proof:
        "Axis connected DRIVE → PAINT TOUCH → SHOT → MAKE.",
      why:
        "The system remembers what consistently creates advantages over time.",
      confidence: 89,
    },
    {
      id: "behavior-profile",
      title:
        "This session expanded your behavioral memory profile.",
      proof:
        "Movement timing, pressure creation, and finish behavior were attached to your identity layer.",
      why:
        "Axis is building long-term intelligence around how you actually play.",
      confidence: 84,
    },
  ]
}

export default function AxisReplayClient({
  playbackId,
  sessionId,
}: Props) {
  const router = useRouter()

  const [playerConfirmed, setPlayerConfirmed] =
    useState(false)

  const [starting, setStarting] =
    useState(false)

  const observations = useMemo(() => {
    if (!playerConfirmed) return []
    return buildObservations()
  }, [playerConfirmed])

  const hasVideo =
    playbackId &&
    playbackId !== "demo" &&
    playbackId.length > 5

  async function startSession() {
    try {
      setStarting(true)

      const response = await fetch(
        "/api/session/create",
        {
          method: "POST",
        }
      )

      const data = await response.json()

      console.log("SESSION RESPONSE:", data)

      if (
        !response.ok ||
        !data.success ||
        !data.redirect
      ) {
        throw new Error(
          data.error || "Session creation failed"
        )
      }

      router.push(data.redirect)
    } catch (error) {
      console.error(error)

      alert("Something went wrong.")
    } finally {
      setStarting(false)
    }
  }

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">

        <header>
          <p className="text-[11px] uppercase tracking-[0.45em] text-zinc-600">
            Axis Session
          </p>

          <h1 className="mt-4 text-[58px] font-black leading-[0.86] tracking-[-0.08em]">
            AXIS
            <br />
            REPLAY
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-zinc-400">
            Axis remembers how you play.
          </p>
        </header>

        {!sessionId && !playbackId && (
          <button
            onClick={startSession}
            disabled={starting}
            className="w-full rounded-full bg-white py-5 text-xl font-black text-black"
          >
            {starting
              ? "Starting..."
              : "Start Session"}
          </button>
        )}

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[34px] border border-white/10 bg-zinc-950"
        >
          {hasVideo ? (
            <MuxPlayer
              playbackId={playbackId}
              streamType="on-demand"
              autoPlay={false}
              accentColor="#ffffff"
            />
          ) : (
            <div className="flex aspect-[9/16] items-center justify-center bg-black">
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-600">
                  Replay Pending
                </p>

                <h2 className="mt-4 text-3xl font-black">
                  SESSION SAVED
                </h2>

                <p className="mt-4 px-8 text-sm leading-relaxed text-zinc-500">
                  Video processing and behavioral analysis
                  will appear here after upload completes.
                </p>

                {sessionId && (
                  <div className="mt-6 rounded-full border border-white/10 px-4 py-2 text-xs text-zinc-600 inline-block">
                    {sessionId}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {!playerConfirmed && sessionId ? (
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6"
          >
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-600">
              Identity
            </p>

            <h2 className="mt-5 text-4xl font-black tracking-[-0.05em]">
              PLAYER FOUND
            </h2>

            <p className="mt-3 text-zinc-400">
              Axis matched this session to an existing
              behavioral profile.
            </p>

            <div className="mt-6 rounded-[26px] border border-white/10 bg-black p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
                  Match Confidence
                </p>

                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white">
                  92%
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                    Movement
                  </p>

                  <p className="mt-2 text-sm text-zinc-300">
                    Matched
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                    Timing
                  </p>

                  <p className="mt-2 text-sm text-zinc-300">
                    Connected
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                    Pressure
                  </p>

                  <p className="mt-2 text-sm text-zinc-300">
                    Recognized
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                    Behavior
                  </p>

                  <p className="mt-2 text-sm text-zinc-300">
                    Learning
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setPlayerConfirmed(true)}
              className="mt-7 w-full rounded-full bg-white py-4 text-base font-black text-black"
            >
              Continue
            </button>
          </motion.section>
        ) : null}
      </div>
    </main>
  )
}