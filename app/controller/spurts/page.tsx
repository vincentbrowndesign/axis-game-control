"use client";

import { useMemo, useState } from "react";

import {
  createAxisEvent,
  getNextTeam,
} from "@/lib/engine/possession";

import { buildReview } from "@/lib/reviewEngine";

import type {
  AxisEvent,
  AxisOutcome,
  AxisTeam,
} from "@/lib/engine/types";

export default function SpurtsPage() {
  const [activeTeam, setActiveTeam] = useState<AxisTeam>("HOME");
  const [events, setEvents] = useState<AxisEvent[]>([]);

  const read = useMemo(() => buildReview(events), [events]);

  const homeScore = events
    .filter((event) => event.team === "HOME")
    .reduce((sum, event) => sum + event.value, 0);

  const awayScore = events
    .filter((event) => event.team === "AWAY")
    .reduce((sum, event) => sum + event.value, 0);

  const possessionCount = events.length;

  const homeControl = read.control.HOME;
  const awayControl = read.control.AWAY;

  const atmosphereStrength = Math.min(1, possessionCount / 18);

  const homeField = Math.max(
    0,
    (homeControl / 100) * atmosphereStrength
  );

  const awayField = Math.max(
    0,
    (awayControl / 100) * atmosphereStrength
  );

  const homeOpacity = 0.06 + homeField * 0.62;
  const awayOpacity = 0.06 + awayField * 0.62;

  const homeSpread = 18 + homeField * 82;
  const awaySpread = 18 + awayField * 82;

  const gridOpacity = 0.04 + atmosphereStrength * 0.12;

  function resolvePossession(outcome: AxisOutcome) {
    const event = createAxisEvent({
      team: activeTeam,
      outcome,
      possessionNumber: events.length + 1,
    });

    setEvents((prev) => [...prev, event]);
    setActiveTeam(getNextTeam(activeTeam));
  }

  function undoLast() {
    const last = events[events.length - 1];
    if (!last) return;

    setEvents((prev) => prev.slice(0, -1));
    setActiveTeam(last.team);
  }

  function resetGame() {
    setEvents([]);
    setActiveTeam("HOME");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#030303] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col px-5 pb-[188px] pt-5">

        {/* LIVE ATMOSPHERIC MEMORY SURFACE */}
        <section className="relative min-h-[560px] overflow-hidden border border-white/10 bg-[#050505]">

          {/* DORMANT BASE */}
          <div className="absolute inset-0 bg-[#050505]" />

          {/* HOME ATMOSPHERE — GROWS FROM LEFT */}
          <div
            className="absolute bottom-0 left-0 top-0 transition-all duration-700 ease-out"
            style={{
              width: `${homeSpread}%`,
              opacity: homeOpacity,
              background:
                "radial-gradient(circle at 18% 58%, rgba(34,211,238,0.95), rgba(34,211,238,0.32) 38%, rgba(34,211,238,0.08) 70%, transparent 100%)",
            }}
          />

          {/* AWAY ATMOSPHERE — GROWS FROM RIGHT */}
          <div
            className="absolute bottom-0 right-0 top-0 transition-all duration-700 ease-out"
            style={{
              width: `${awaySpread}%`,
              opacity: awayOpacity,
              background:
                "radial-gradient(circle at 82% 58%, rgba(250,204,21,0.95), rgba(250,204,21,0.3) 38%, rgba(250,204,21,0.08) 70%, transparent 100%)",
            }}
          />

          {/* ENVIRONMENTAL RESIDUE */}
          <div
            className="absolute inset-0 transition-opacity duration-700"
            style={{
              opacity: atmosphereStrength * 0.55,
              background:
                "linear-gradient(120deg, rgba(255,255,255,0.04), transparent 26%, rgba(255,255,255,0.03) 52%, transparent 78%)",
            }}
          />

          {/* GRID REVEALS AS GAME ACCUMULATES */}
          <div
            className="absolute inset-0 transition-opacity duration-700"
            style={{
              opacity: gridOpacity,
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.65) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
            }}
          />

          {/* CONTROL TERRITORY FLOOR */}
          <div className="absolute bottom-0 left-0 right-0 h-[34px] bg-white/5">
            <div
              className="absolute bottom-0 left-0 top-0 bg-cyan-300 transition-all duration-700 ease-out"
              style={{
                width: `${homeControl}%`,
                opacity: 0.22 + atmosphereStrength * 0.78,
              }}
            />

            <div
              className="absolute bottom-0 right-0 top-0 bg-yellow-300 transition-all duration-700 ease-out"
              style={{
                width: `${awayControl}%`,
                opacity: 0.22 + atmosphereStrength * 0.78,
              }}
            />
          </div>

          {/* CONTENT */}
          <div className="relative z-10 flex min-h-[560px] flex-col justify-between p-5">

            {/* META */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] tracking-[0.42em] text-white/35">
                  AXIS
                </div>

                <div className="mt-2 text-[12px] font-black tracking-[0.24em] text-white/45">
                  LIVE STATE SURFACE
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] tracking-[0.35em] text-white/35">
                  POSSESSION
                </div>

                <div className="mt-2 text-[18px] font-black tracking-[-0.03em]">
                  ● {activeTeam} BALL
                </div>
              </div>
            </div>

            {/* STATE */}
            <div className="py-12">
              <h1 className="max-w-[450px] text-[54px] font-black leading-[0.88] tracking-[-0.08em]">
                {possessionCount === 0
                  ? "AWAITING FIRST SIGNAL"
                  : read.headline}
              </h1>

              <div className="mt-5 text-[13px] font-bold uppercase tracking-[0.24em] text-white/50">
                {possessionCount === 0
                  ? "DORMANT SURFACE"
                  : read.state}
              </div>
            </div>

            {/* SCORE + CONTROL */}
            <div className="pb-8">
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] tracking-[0.32em] text-white/35">
                    HOME
                  </div>

                  <div className="mt-1 text-[72px] font-black leading-none tracking-[-0.09em]">
                    {homeScore}
                  </div>

                  <div className="mt-2 text-[12px] font-black tracking-[0.2em] text-cyan-200/80">
                    CONTROL {homeControl}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] tracking-[0.32em] text-white/35">
                    AWAY
                  </div>

                  <div className="mt-1 text-[72px] font-black leading-none tracking-[-0.09em] text-yellow-300">
                    {awayScore}
                  </div>

                  <div className="mt-2 text-[12px] font-black tracking-[0.2em] text-yellow-200/80">
                    CONTROL {awayControl}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* EVIDENCE */}
        <section className="mt-4 grid grid-cols-3 gap-2">
          {read.evidence.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="min-h-[72px] border border-white/10 bg-white/[0.025] p-3"
            >
              <div className="text-[10px] font-black uppercase leading-[1.25] tracking-[-0.01em] text-white/70">
                {item}
              </div>
            </div>
          ))}
        </section>

        {/* TELEMETRY */}
        <section className="mt-4 border border-white/5 bg-white/[0.01] p-3">
          <div className="mb-2 text-[10px] tracking-[0.35em] text-white/20">
            TELEMETRY
          </div>

          <div className="grid grid-cols-9 gap-1">
            {events
              .slice(-27)
              .reverse()
              .map((event) => (
                <div
                  key={event.id}
                  className="border border-white/5 bg-white/[0.015] p-1 text-center"
                >
                  <div className="text-[8px] text-white/20">
                    {event.team === "HOME" ? "H" : "A"}
                  </div>

                  <div className="mt-1 text-[10px] font-black text-white/35">
                    {event.outcome === "EMPTY" ? "Ø" : `+${event.value}`}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>

      {/* OPERATOR HARDWARE */}
      <section className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#050505]/95 px-4 pb-4 pt-3 backdrop-blur">
        <div className="mx-auto max-w-[560px]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] tracking-[0.35em] text-white/30">
                OPERATOR
              </div>

              <div className="mt-1 text-[22px] font-black tracking-[-0.04em]">
                ● {activeTeam} BALL
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={undoLast}
                className="border border-white/10 px-3 py-2 text-[11px] font-black tracking-[0.16em] text-white/45 active:bg-white/10"
              >
                UNDO
              </button>

              <button
                onClick={resetGame}
                className="border border-white/10 px-3 py-2 text-[11px] font-black tracking-[0.16em] text-white/35 active:bg-white/10"
              >
                RESET
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => resolvePossession("EMPTY")}
              className="h-[86px] border border-white/10 bg-white/[0.025] text-[24px] font-black tracking-[-0.05em] text-white/75 active:bg-white/10"
            >
              EMPTY
            </button>

            {(["1", "2", "3"] as AxisOutcome[]).map((value) => (
              <button
                key={value}
                onClick={() => resolvePossession(value)}
                className="h-[86px] border border-white/10 bg-white/[0.025] text-[38px] font-black tracking-[-0.08em] active:bg-white/10"
              >
                +{value}
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}