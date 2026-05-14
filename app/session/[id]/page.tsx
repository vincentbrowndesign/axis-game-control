"use client";

import { useMemo } from "react";
import Link from "next/link";

export default function SessionReplayPage() {
  const markers = useMemo(
    () => [
      {
        time: "00:12",
        label: "CONTROL SHIFT",
        detail: "Tempo acceleration detected",
      },
      {
        time: "00:27",
        label: "PRESSURE SPIKE",
        detail: "Decision latency increased",
      },
      {
        time: "00:41",
        label: "BEHAVIORAL BREAK",
        detail: "Structure instability detected",
      },
      {
        time: "01:08",
        label: "RECOVERY WINDOW",
        detail: "Control stabilization returning",
      },
    ],
    []
  );

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden">
      {/* TOP TELEMETRY */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/70 border-b border-white/10">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-[10px] tracking-[0.45em] text-white/30 uppercase">
              Axis Replay System
            </p>

            <h1 className="text-xl font-semibold tracking-tight">
              Behavioral Memory Active
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-lime-400 animate-pulse" />

            <p className="text-xs tracking-[0.3em] text-white/40 uppercase">
              Processing
            </p>
          </div>
        </div>
      </div>

      {/* MAIN SYSTEM */}
      <div className="flex">
        {/* LEFT MEMORY RAIL */}
        <aside className="hidden lg:flex w-[300px] border-r border-white/10 min-h-screen flex-col p-5">
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-white/25 mb-3">
              Session Archive
            </p>

            <div className="space-y-3">
              {markers.map((marker) => (
                <div
                  key={marker.time}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs tracking-[0.3em] text-lime-300 uppercase">
                      {marker.label}
                    </p>

                    <p className="text-xs text-white/40">
                      {marker.time}
                    </p>
                  </div>

                  <p className="text-sm text-white/60 leading-relaxed">
                    {marker.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[10px] uppercase tracking-[0.45em] text-white/30 mb-4">
                Session Metadata
              </p>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/40">Environment</span>
                  <span>Practice</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-white/40">Player</span>
                  <span>Unassigned</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-white/40">Duration</span>
                  <span>0:09</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-white/40">Source</span>
                  <span>Upload</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER STAGE */}
        <section className="flex-1 min-h-screen">
          <div className="max-w-6xl mx-auto px-5 py-10">
            {/* HERO */}
            <div className="mb-12">
              <p className="text-[10px] uppercase tracking-[0.5em] text-white/30 mb-5">
                Axis Behavioral Replay
              </p>

              <h1 className="text-6xl md:text-8xl font-black leading-[0.9] tracking-tight max-w-4xl">
                Axis remembers
                <br />
                how you play.
              </h1>

              <p className="mt-6 text-lg text-white/50 max-w-2xl leading-relaxed">
                Session behavior mapped into replay memory architecture.
              </p>
            </div>

            {/* REPLAY WINDOW */}
            <div className="relative rounded-[40px] overflow-hidden border border-white/10 bg-white/[0.03]">
              <div className="aspect-video bg-gradient-to-br from-white/[0.05] to-transparent flex items-center justify-center">
                <button className="h-28 w-28 rounded-full bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur-xl transition hover:scale-105">
                  <div className="ml-2 h-0 w-0 border-y-[18px] border-y-transparent border-l-[28px] border-l-white" />
                </button>
              </div>

              {/* OVERLAY */}
              <div className="absolute top-5 left-5 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-lime-400 animate-pulse" />

                <p className="text-xs tracking-[0.35em] uppercase text-white/50">
                  Replay Active
                </p>
              </div>

              <div className="absolute bottom-5 left-5">
                <p className="text-xs tracking-[0.35em] uppercase text-white/40 mb-2">
                  Behavioral Upload
                </p>

                <h2 className="text-3xl font-bold">
                  Memory Stored
                </h2>
              </div>
            </div>

            {/* MOBILE MEMORY */}
            <div className="lg:hidden mt-8 space-y-4">
              {markers.map((marker) => (
                <div
                  key={marker.time}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex justify-between mb-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-lime-300">
                      {marker.label}
                    </p>

                    <p className="text-xs text-white/40">
                      {marker.time}
                    </p>
                  </div>

                  <p className="text-sm text-white/60">
                    {marker.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* BOTTOM TIMELINE */}
      <div className="sticky bottom-0 border-t border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="px-5 py-5">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[10px] uppercase tracking-[0.45em] text-white/30">
              Session Timeline
            </p>

            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-[68%] bg-gradient-to-r from-lime-300 via-cyan-300 to-cyan-400 rounded-full" />
          </div>

          <div className="flex justify-between mt-3 text-xs text-white/40">
            <span>00:00</span>
            <span>00:09</span>
          </div>
        </div>
      </div>
    </main>
  );
}