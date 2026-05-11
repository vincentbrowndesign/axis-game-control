"use client";

import { useEffect, useMemo, useState } from "react";

import Scorebug from "@/components/Scorebug";
import EventStream from "@/components/EventStream";

import { addEvent } from "@/lib/events/addEvent";

import { getGameMemory } from "@/lib/gameMemoryEngine";

import { buildTimeline } from "@/lib/session/timeline";

import {
  saveSession,
  loadSession,
} from "@/lib/session/sessionStore";

import { createMarker } from "@/lib/session/markers";

import type {
  MakeEvent,
  MissEvent,
  TurnoverEvent,
  SpurtsEvent,
} from "@/lib/events/eventTypes";

import type { SpurtsSession } from "@/lib/session/types";

type Team = "HOME" | "AWAY";

const initialSession: SpurtsSession = {
  id: crypto.randomUUID(),

  homeTeam: "HOME",

  awayTeam: "AWAY",

  createdAt: Date.now(),

  events: [],
};

export default function SessionPage() {
  const [session, setSession] =
    useState<SpurtsSession>(() => {
      return (
        loadSession() ||
        initialSession
      );
    });

  const memory = useMemo(() => {
    return getGameMemory(
      session.events
    );
  }, [session.events]);

  const timeline = useMemo(() => {
    return buildTimeline(
      session.events
    );
  }, [session.events]);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  function handleMake(
    team: Team,
    value: 1 | 2 | 3
  ) {
    const event: MakeEvent = {
      id: crypto.randomUUID(),

      type: "MAKE",

      team,

      value,

      createdAt: Date.now(),

      sessionTime: Date.now(),
    };

    setSession(
      addEvent(session, event)
    );
  }

  function handleMiss(
    team: Team
  ) {
    const event: MissEvent = {
      id: crypto.randomUUID(),

      type: "MISS",

      team,

      createdAt: Date.now(),

      sessionTime: Date.now(),
    };

    setSession(
      addEvent(session, event)
    );
  }

  function handleTurnover(
    team: Team
  ) {
    const event: TurnoverEvent = {
      id: crypto.randomUUID(),

      type: "TURNOVER",

      team,

      createdAt: Date.now(),

      sessionTime: Date.now(),
    };

    setSession(
      addEvent(session, event)
    );
  }

  function handleMarker(
    label: string
  ) {
    const marker =
      createMarker(label);

    setSession(
      addEvent(session, marker)
    );
  }

  const pressureTone =
    memory.pressure ===
    "BREAKING"
      ? "danger"
      : memory.pressure ===
        "BUILDING"
      ? "warning"
      : "neutral";

  const runLabel =
    memory.runTeam &&
    memory.activeRun > 0
      ? `${memory.runTeam} ${memory.activeRun}-0`
      : "EVEN";

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}

        <div className="mb-8">
          <div className="text-[11px] tracking-[0.5em] text-cyan-400">
            AXIS
          </div>

          <div className="mt-2 text-6xl font-black tracking-[-0.08em]">
            Spurts
          </div>

          <div className="mt-3 text-white/50">
            Live game narrative
            infrastructure.
          </div>
        </div>

        {/* SCOREBUG */}

        <Scorebug
          homeScore={
            memory.homeScore
          }
          awayScore={
            memory.awayScore
          }
          possession={
            memory.lastScoringTeam ||
            "HOME"
          }
          quarter="LIVE"
          runLabel={runLabel}
          pressureLabel={
            memory.state
          }
          pressureTone={
            pressureTone
          }
        />

        {/* CONTROLS */}

        <section className="mt-8 border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs tracking-[0.3em] text-white/40">
            LIVE CONTROL
          </div>

          <div className="mt-5 grid grid-cols-2 gap-6">
            {/* HOME */}

            <div>
              <div className="mb-3 text-xl font-black">
                HOME
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    handleMake(
                      "HOME",
                      1
                    )
                  }
                  className="h-14 w-16 rounded-xl bg-cyan-500 font-black text-black"
                >
                  +1
                </button>

                <button
                  onClick={() =>
                    handleMake(
                      "HOME",
                      2
                    )
                  }
                  className="h-14 w-16 rounded-xl bg-cyan-500 font-black text-black"
                >
                  +2
                </button>

                <button
                  onClick={() =>
                    handleMake(
                      "HOME",
                      3
                    )
                  }
                  className="h-14 w-16 rounded-xl bg-cyan-500 font-black text-black"
                >
                  +3
                </button>

                <button
                  onClick={() =>
                    handleMiss(
                      "HOME"
                    )
                  }
                  className="h-14 rounded-xl border border-white/10 px-5 font-black"
                >
                  MISS
                </button>

                <button
                  onClick={() =>
                    handleTurnover(
                      "HOME"
                    )
                  }
                  className="h-14 rounded-xl border border-red-500/20 bg-red-500/10 px-5 font-black text-red-300"
                >
                  TO
                </button>
              </div>
            </div>

            {/* AWAY */}

            <div>
              <div className="mb-3 text-xl font-black">
                AWAY
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    handleMake(
                      "AWAY",
                      1
                    )
                  }
                  className="h-14 w-16 rounded-xl bg-yellow-400 font-black text-black"
                >
                  +1
                </button>

                <button
                  onClick={() =>
                    handleMake(
                      "AWAY",
                      2
                    )
                  }
                  className="h-14 w-16 rounded-xl bg-yellow-400 font-black text-black"
                >
                  +2
                </button>

                <button
                  onClick={() =>
                    handleMake(
                      "AWAY",
                      3
                    )
                  }
                  className="h-14 w-16 rounded-xl bg-yellow-400 font-black text-black"
                >
                  +3
                </button>

                <button
                  onClick={() =>
                    handleMiss(
                      "AWAY"
                    )
                  }
                  className="h-14 rounded-xl border border-white/10 px-5 font-black"
                >
                  MISS
                </button>

                <button
                  onClick={() =>
                    handleTurnover(
                      "AWAY"
                    )
                  }
                  className="h-14 rounded-xl border border-red-500/20 bg-red-500/10 px-5 font-black text-red-300"
                >
                  TO
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* MARKERS */}

        <section className="mt-8 border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs tracking-[0.3em] text-white/40">
            MARKERS
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {[
              "MOMENTUM SWING",
              "BIG SHOT",
              "CONTROL LOST",
              "TURNING POINT",
            ].map((label) => (
              <button
                key={label}
                onClick={() =>
                  handleMarker(
                    label
                  )
                }
                className="rounded-xl border border-white/10 px-4 py-3 font-black"
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* GAME MEMORY */}

        <section className="mt-8 border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs tracking-[0.3em] text-white/40">
            GAME MEMORY
          </div>

          <div className="mt-4 text-3xl font-black">
            {memory.state}
          </div>

          <div className="mt-2 text-white/40">
            {runLabel}
          </div>
        </section>

        {/* EVENT STREAM */}

        <section className="mt-8 border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs tracking-[0.3em] text-white/40">
            EVENT STREAM
          </div>

          <div className="mt-5">
            <EventStream
              items={timeline}
            />
          </div>
        </section>
      </div>
    </main>
  );
}