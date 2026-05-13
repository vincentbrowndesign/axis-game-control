"use client"

import MuxPlayer from "@mux/mux-player-react"
import { motion } from "framer-motion"

type Props = {
  playbackId: string
}

const events = [
  {
    time: "0:04",
    label: "BALL MOVE",
    active: false,
  },
  {
    time: "0:06",
    label: "DRIVE",
    active: true,
  },
  {
    time: "0:07",
    label: "PAINT TOUCH",
    active: true,
  },
  {
    time: "0:08",
    label: "OPEN",
    active: false,
  },
  {
    time: "0:09",
    label: "SHOT",
    active: false,
  },
]

const aiSuggestions = [
  "OPEN?",
  "HELP?",
  "ADVANTAGE?",
]

export default function AxisReplayClient({
  playbackId,
}: Props) {
  return (
    <main className="min-h-screen bg-black text-white overflow-hidden">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-32 pt-6">

        {/* HEADER */}
        <div className="relative z-20 mb-6">
          <p className="mb-2 text-[10px] uppercase tracking-[0.45em] text-zinc-600">
            Axis Session
          </p>

          <h1 className="text-[56px] leading-[0.82] font-black tracking-[-0.08em]">
            AXIS
            <br />
            REPLAY
          </h1>
        </div>

        {/* VIDEO */}
        <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-zinc-950">

          <MuxPlayer
            playbackId={playbackId}
            streamType="on-demand"
            autoPlay={false}
            accentColor="#ffffff"
          />

          {/* LIVE OVERLAY */}
          <div className="pointer-events-none absolute inset-0">

            {/* TOP STATUS */}
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 backdrop-blur-xl">
              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />

              <p className="text-[10px] uppercase tracking-[0.35em] text-white/80">
                Live
              </p>
            </div>

            {/* ACTIVE EVENT */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-24 left-4 right-4"
            >
              <div className="rounded-[28px] border border-white/10 bg-black/70 p-4 backdrop-blur-2xl">

                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
                    Active Sequence
                  </p>

                  <p className="text-[10px] uppercase tracking-[0.35em] text-white">
                    0:07
                  </p>
                </div>

                <h2 className="text-[34px] leading-none font-black tracking-[-0.06em]">
                  PAINT
                  <br />
                  TOUCH
                </h2>
              </div>
            </motion.div>

            {/* TIMELINE */}
            <div className="absolute bottom-8 left-4 right-4">

              <div className="mb-4 flex items-center gap-2 overflow-x-auto no-scrollbar">

                {events.map((event, index) => (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    key={index}
                    className={`shrink-0 rounded-full border px-4 py-2 transition-all ${
                      event.active
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-black/70 text-white"
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-[9px] uppercase tracking-[0.3em] opacity-60">
                        {event.time}
                      </span>

                      <span className="text-xs font-semibold tracking-[-0.03em]">
                        {event.label}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* SCRUB BAR */}
              <div className="relative h-[3px] overflow-hidden rounded-full bg-white/10">

                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "64%" }}
                  transition={{ duration: 1.4 }}
                  className="absolute left-0 top-0 h-full rounded-full bg-white"
                />

                <motion.div
                  animate={{
                    x: ["0%", "64%"],
                  }}
                  transition={{
                    duration: 1.4,
                  }}
                  className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-black bg-white shadow-[0_0_24px_rgba(255,255,255,0.8)]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* AI SUGGESTIONS */}
        <div className="mt-8 flex flex-col gap-3">

          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-600">
              AI Suggestions
            </p>

            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-700">
              Confirm
            </p>
          </div>

          {aiSuggestions.map((item, index) => (
            <motion.button
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.01 }}
              key={index}
              className="flex items-center justify-between rounded-[26px] border border-white/10 bg-zinc-950 px-5 py-5 transition-all hover:border-white/20"
            >
              <div className="flex items-center gap-3">

                <div className="h-2 w-2 rounded-full bg-white" />

                <span className="text-sm font-semibold tracking-[0.12em]">
                  {item}
                </span>
              </div>

              <div className="flex items-center gap-2">

                <button className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                  No
                </button>

                <button className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-black">
                  Yes
                </button>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </main>
  )
}