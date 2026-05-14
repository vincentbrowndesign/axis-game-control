"use client"

import { motion } from "framer-motion"
import MuxPlayer from "@mux/mux-player-react"
import { useMemo, useState } from "react"

type Props = {
  playbackId: string
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
      id: "paint-pressure",
      title: "Paint pressure created the cleanest scoring window.",
      proof: "This session connected DRIVE → PAINT TOUCH → SHOT.",
      why:
        "Paint touches force the defense to react. When that reaction is late, the next shot usually gets cleaner.",
      confidence: 91,
    },
    {
      id: "sequence-memory",
      title: "Axis connected this possession to your memory profile.",
      proof: "4 events were attached to this replay: DRIVE, PAINT TOUCH, SHOT, MAKE.",
      why:
        "The value is not one clip. The value is remembering what keeps showing up over time.",
      confidence: 86,
    },
    {
      id: "development-signal",
      title: "This is now a behavior signal, not just a highlight.",
      proof: "The possession produced pressure, a finish window, and an outcome.",
      why:
        "Axis learns how you create advantages so future sessions can compare what is changing.",
      confidence: 79,
    },
  ]
}

export default function AxisReplayClient({ playbackId }: Props) {
  const [playerConfirmed, setPlayerConfirmed] = useState(false)

  const observations = useMemo(() => {
    if (!playerConfirmed) return []
    return buildObservations()
  }, [playerConfirmed])

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

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[34px] border border-white/10 bg-zinc-950"
        >
          <MuxPlayer
            playbackId={playbackId}
            streamType="on-demand"
            autoPlay={false}
            accentColor="#ffffff"
          />
        </motion.div>

        {!playerConfirmed ? (
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
              Possible match attached to this session.
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

              <p className="mt-4 text-zinc-400">
                This clip can now be connected to the player memory profile.
              </p>
            </div>

            <button
              onClick={() => setPlayerConfirmed(true)}
              className="mt-7 w-full rounded-full bg-white py-4 text-base font-black text-black"
            >
              Continue
            </button>

            <button
              onClick={() => setPlayerConfirmed(true)}
              className="mt-4 w-full rounded-full border border-white/10 py-4 text-sm font-bold text-zinc-500"
            >
              This isn&apos;t me
            </button>
          </motion.section>
        ) : (
          <>
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6"
            >
              <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-600">
                Axis Memory
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-4xl font-black">1</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    session
                  </p>
                </div>

                <div>
                  <p className="text-4xl font-black">
                    {sessionEvents.length}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    events
                  </p>
                </div>

                <div>
                  <p className="text-4xl font-black">
                    {observations.length}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    reads
                  </p>
                </div>
              </div>
            </motion.section>

            <section className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-600">
                  Session Events
                </p>

                <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
                  Connected
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {sessionEvents.map((event, index) => (
                  <div
                    key={event}
                    className="flex items-center justify-between rounded-[24px] border border-white/10 bg-black px-5 py-4"
                  >
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-600">
                        0:0{index + 4}
                      </p>

                      <p className="mt-1 text-xl font-black">
                        {event}
                      </p>
                    </div>

                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              {observations.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
                      Observation
                    </p>

                    <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-600">
                      {confidenceLabel(item.confidence)}
                    </p>
                  </div>

                  <h2 className="mt-5 text-3xl font-black leading-tight">
                    {item.title}
                  </h2>

                  <div className="mt-6 rounded-[24px] border border-white/10 bg-black p-4">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-600">
                      Proof
                    </p>

                    <p className="mt-2 text-zinc-300">
                      {item.proof}
                    </p>
                  </div>

                  <div className="mt-4 rounded-[24px] border border-white/10 bg-black p-4">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-600">
                      Why it matters
                    </p>

                    <p className="mt-2 text-zinc-300">
                      {item.why}
                    </p>
                  </div>

                  <p className="mt-5 text-sm text-zinc-500">
                    {item.confidence}% confidence
                  </p>
                </motion.div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  )
}