"use client";

import { useEffect, useMemo, useState } from "react";

import Scorebug from "@/components/Scorebug";

import { buildTimeline } from "@/lib/session/timeline";

import {
  getSession,
  saveSession,
} from "@/lib/session/sessionStore";

import { captureSnapshot } from "@/lib/ocr/captureSnapshot";
import { parseScoreboard } from "@/lib/ocr/parseScoreboard";

import type {
  PossessionEvent,
  SnapshotEvent,
  SpurtsSession,
} from "@/lib/session/types";

export default function SessionPage() {
  const [session, setSession] =
    useState<SpurtsSession | null>(null);

  useEffect(() => {
    const id = "demo-session";

    const existing =
      getSession(id);

    if (existing) {
      setSession(existing);
      return;
    }

    const fresh: SpurtsSession = {
      id,
      homeTeam: "HOME",
      awayTeam: "AWAY",
      createdAt: Date.now(),

      events: [],
      snapshots: [],
      markers: [],
    };

    saveSession(fresh);

    setSession(fresh);
  }, []);

  const timeline = useMemo(() => {
    if (!session) return [];

    return buildTimeline(
      session.events
    );
  }, [session]);

  if (!session) {
    return null;
  }

  function addScore(
    value: 0 | 1 | 2 | 3,
    team: "HOME" | "AWAY"
  ) {
    const event: PossessionEvent = {
      id: crypto.randomUUID(),

      type: "possession",

      team,
      value,

      createdAt: Date.now(),

      sessionTime: Date.now(),
    };

    const next: SpurtsSession = {
      id: session.id,
      homeTeam:
        session.homeTeam,
      awayTeam:
        session.awayTeam,
      createdAt:
        session.createdAt,

      events: [
        ...session.events,
        event,
      ],

      snapshots:
        session.snapshots,

      markers:
        session.markers,
    };

    saveSession(next);

    setSession(next);
  }

  async function handleSnapshot(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    if (!file) return;

    const imageUrl =
      await captureSnapshot(file);

    const parsed =
      await parseScoreboard();

    const snapshot: SnapshotEvent =
      {
        id: crypto.randomUUID(),

        type: "snapshot",

        imageUrl,

        period: parsed.period,
        clock: parsed.clock,

        homeScore:
          parsed.homeScore,

        awayScore:
          parsed.awayScore,

        confidence:
          parsed.confidence,

        createdAt: Date.now(),
      };

    const next: SpurtsSession = {
      id: session.id,
      homeTeam:
        session.homeTeam,
      awayTeam:
        session.awayTeam,
      createdAt:
        session.createdAt,

      events:
        session.events,

      snapshots: [
        snapshot,
        ...session.snapshots,
      ],

      markers:
        session.markers,
    };

    saveSession(next);

    setSession(next);
  }

  const homeScore =
    session.events
      .filter(
        (e) =>
          e.team === "HOME"
      )
      .reduce(
        (sum, e) =>
          sum + e.value,
        0
      );

  const awayScore =
    session.events
      .filter(
        (e) =>
          e.team === "AWAY"
      )
      .reduce(
        (sum, e) =>
          sum + e.value,
        0
      );

  const latestSnapshot =
    session.snapshots[0];

  const quarter =
    latestSnapshot?.period ||
    "Q1";

  const pressureTone =
    Math.abs(
      homeScore - awayScore
    ) >= 15
      ? "danger"
      : Math.abs(
          homeScore -
            awayScore
        ) >= 8
      ? "warning"
      : "neutral";

  const pressureLabel =
    pressureTone ===
    "danger"
      ? "BREAKING CONTROL"
      : pressureTone ===
        "warning"
      ? "PRESSURE BUILDING"
      : "STABLE FLOW";

  const runLabel =
    homeScore > awayScore
      ? "HOME RUN"
      : awayScore >
        homeScore
      ? "AWAY RUN"
      : "EVEN";

  const possession =
    session.events[
      session.events.length -
        1
    ]?.team || "HOME";

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <Scorebug
          homeScore={
            homeScore
          }
          awayScore={
            awayScore
          }
          possession={
            possession
          }
          quarter={quarter}
          runLabel={runLabel}
          pressureLabel={
            pressureLabel
          }
          pressureTone={
            pressureTone
          }
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="text-xs tracking-[0.2em] text-white/40">
              HOME
            </div>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  addScore(
                    1,
                    "HOME"
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                +1
              </button>

              <button
                onClick={() =>
                  addScore(
                    2,
                    "HOME"
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                +2
              </button>

              <button
                onClick={() =>
                  addScore(
                    3,
                    "HOME"
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                +3
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs tracking-[0.2em] text-white/40">
              AWAY
            </div>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  addScore(
                    1,
                    "AWAY"
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                +1
              </button>

              <button
                onClick={() =>
                  addScore(
                    2,
                    "AWAY"
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                +2
              </button>

              <button
                onClick={() =>
                  addScore(
                    3,
                    "AWAY"
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                +3
              </button>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs tracking-[0.24em] text-white/35">
              SNAPSHOTS
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={
                handleSnapshot
              }
              className="text-xs"
            />
          </div>

          <div className="space-y-3">
            {session.snapshots.map(
              (
                snapshot
              ) => (
                <div
                  key={
                    snapshot.id
                  }
                  className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/30 p-3"
                >
                  <img
                    src={
                      snapshot.imageUrl
                    }
                    alt="snapshot"
                    className="h-16 w-24 rounded-lg object-cover"
                  />

                  <div className="space-y-1">
                    <div className="text-lg font-black">
                      {
                        snapshot.homeScore
                      }
                      {" - "}
                      {
                        snapshot.awayScore
                      }
                    </div>

                    <div className="text-xs text-white/50">
                      {
                        snapshot.period
                      }
                      {" • "}
                      {
                        snapshot.clock
                      }
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
          <div className="mb-4 text-xs tracking-[0.24em] text-white/35">
            TIMELINE
          </div>

          <div className="space-y-2">
            {timeline
              .slice()
              .reverse()
              .map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-black/30 p-3"
                >
                  {
                    item.label
                  }
                </div>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}