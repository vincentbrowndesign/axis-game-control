"use client"

import MuxPlayer from "@mux/mux-player-react"
import { motion } from "framer-motion"

type Props = {
  playbackId: string
}

const timeline = [
  {
    time: "0:04",
    label: "BALL MOVE",
  },
  {
    time: "0:06",
    label: "DRIVE",
  },
  {
    time: "0:07",
    label: "PAINT TOUCH",
    active: true,
  },
  {
    time: "0:08",
    label: "OPEN",
  },
  {
    time: "0:09",
    label: "SHOT",
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
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex w-full max-w-md flex-col px-4 pb-32 pt-6">

        {/* HEADER */}
        <div className="mb-8">
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
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

        {/* ACTIVE EVENT */}
        <div className="mt-5 rounded-[30px] border border-white/10 bg-zinc-950 p-6">

          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">

              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />

              <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
                Live Sequence
              </p>
            </div>

            <p className="text-[10px] uppercase tracking-[0.35em] text-white">
              0:07
            </p>
          </div>

          <h2 className="text-[42px] leading-[0.9] font-black tracking-[-0.07em]">
            PAINT
            <br />
            TOUCH
          </h2>
        </div>

        {/* TIMELINE */}
        <div className="mt-8">

          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zinc-600">
              Timeline
            </p>

            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-700">
              Auto Infer
            </p>
          </div>

          <div className="flex flex-col gap-3">

            {timeline.map((event, index) => (
              <motion.button
                whileTap={{ scale: 0.985 }}
                key={index}
                className={`flex items-center justify-between rounded-[26px] border px-5 py-5 transition-all ${
                  event.active
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-zinc-950 text-white"
                }`}
              >
                <div className="flex items-center gap-4">

                  <div
                    className={`h-2 w-2 rounded-full ${
                      event.active
                        ? "bg-black"
                        : "bg-zinc-500"
                    }`}
                  />

                  <div className="flex flex-col items-start">
                    <p
                      className={`text-[10px] uppercase tracking-[0.35em] ${
                        event.active
                          ? "text-black/50"
                          : "text-zinc-600"
                      }`}
                    >
                      {event.time}
                    </p>

                    <p className="text-[20px] font-black tracking-[-0.05em]">
                      {event.label}
                    </p>
                  </div>
                </div>

                <div
                  className={`h-3 w-3 rounded-full ${
                    event.active
                      ? "bg-black"
                      : "bg-zinc-800"
                  }`}
                />
              </motion.button>
            ))}
          </div>
        </div>

        {/* SCRUB */}
        <div className="mt-6">
          <div className="relative h-[3px] overflow-hidden rounded-full bg-white/10">

            <div className="absolute left-0 top-0 h-full w-[68%] rounded-full bg-white" />

            <div className="absolute left-[68%] top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)]" />
          </div>
        </div>

        {/* AI */}
        <div className="mt-10">

          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zinc-600">
              AI Suggestions
            </p>

            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-700">
              Confirm
            </p>
          </div>

          <div className="flex flex-col gap-3">

            {aiSuggestions.map((item, index) => (
              <motion.div
                whileTap={{ scale: 0.985 }}
                key={index}
                className="flex items-center justify-between rounded-[26px] border border-white/10 bg-zinc-950 px-5 py-5"
              >
                <div className="flex items-center gap-3">

                  <div className="h-2 w-2 rounded-full bg-white" />

                  <p className="text-[18px] font-bold tracking-[0.08em]">
                    {item}
                  </p>
                </div>

                <div className="flex items-center gap-2">

                  <button className="rounded-full border border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                    No
                  </button>

                  <button className="rounded-full bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-black">
                    Yes
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}