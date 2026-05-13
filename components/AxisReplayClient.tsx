"use client"

import MuxPlayer from "@mux/mux-player-react"
import { motion } from "framer-motion"
import {
  Play,
  Zap,
  Circle,
  ChevronRight,
} from "lucide-react"

const timeline = [
  {
    time: "0:04",
    label: "BALL MOVE",
    type: "neutral",
  },
  {
    time: "0:06",
    label: "DRIVE",
    type: "attack",
  },
  {
    time: "0:07",
    label: "PAINT TOUCH",
    type: "attack",
  },
  {
    time: "0:08",
    label: "OPEN",
    type: "reaction",
  },
  {
    time: "0:09",
    label: "SHOT",
    type: "result",
  },
]

type Props = {
  playbackId: string
}

export default function AxisReplayClient({
  playbackId,
}: Props) {
  return (
    <main className="min-h-screen bg-black text-white overflow-hidden">
      <div className="mx-auto flex w-full max-w-md flex-col gap-10 px-5 py-10">

        {/* HERO */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-[0.45em] text-zinc-500">
            Axis Session
          </p>

          <h1 className="text-[58px] leading-[0.88] font-black tracking-[-0.08em]">
            AXIS
            <br />
            REPLAY
          </h1>
        </div>

        {/* VIDEO */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="overflow-hidden rounded-[34px] border border-white/10 bg-zinc-950"
        >
          <MuxPlayer
            playbackId={playbackId}
            streamType="on-demand"
            accentColor="#ffffff"
            autoPlay={false}
          />
        </motion.div>

        {/* LIVE STATUS */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between rounded-full border border-white/10 bg-zinc-950 px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>

              <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
            </div>

            <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">
              Live Analysis
            </p>
          </div>

          <Zap className="h-4 w-4 text-zinc-500" />
        </motion.div>

        {/* TIMELINE */}
        <div className="flex flex-col gap-3">

          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Sequence
            </p>

            <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-700">
              Auto Infer
            </p>
          </div>

          {timeline.map((event, index) => (
            <motion.button
              key={index}
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.01 }}
              className="group flex items-center justify-between rounded-[28px] border border-white/10 bg-zinc-950 px-5 py-5 transition-all hover:border-white/20"
            >
              <div className="flex items-center gap-4">

                <div
                  className={`h-3 w-3 rounded-full ${
                    event.type === "attack"
                      ? "bg-white"
                      : event.type === "reaction"
                      ? "bg-zinc-500"
                      : event.type === "result"
                      ? "bg-zinc-300"
                      : "bg-zinc-700"
                  }`}
                />

                <div className="flex flex-col items-start">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-600">
                    {event.time}
                  </p>

                  <p className="text-lg font-semibold tracking-[-0.03em]">
                    {event.label}
                  </p>
                </div>
              </div>

              <ChevronRight className="h-5 w-5 text-zinc-700 transition-all group-hover:text-white" />
            </motion.button>
          ))}
        </div>

        {/* ACTIONS */}
        <div className="grid grid-cols-2 gap-3">

          <button className="flex items-center justify-center gap-3 rounded-[26px] border border-white/10 bg-white px-5 py-5 text-black transition-all hover:scale-[1.02]">
            <Play className="h-4 w-4 fill-black" />

            <span className="text-xs font-semibold uppercase tracking-[0.3em]">
              Replay
            </span>
          </button>

          <button className="flex items-center justify-center gap-3 rounded-[26px] border border-white/10 bg-zinc-950 px-5 py-5 transition-all hover:border-white/20">
            <Circle className="h-3 w-3 fill-white text-white" />

            <span className="text-xs font-semibold uppercase tracking-[0.3em]">
              Tag
            </span>
          </button>
        </div>
      </div>
    </main>
  )
}