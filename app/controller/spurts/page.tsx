"use client";

import { useEffect, useMemo, useState } from "react";

import {
  calculateSpurt,
  getAtmosphere,
  getGameState,
  nextTeam,
  outcomePoints,
  Outcome,
  Possession,
  Team,
} from "@/lib/spurtsEngine";

const PRIMARY: {
  label: string;
  value: Outcome;
}[] = [
  { label: "+1", value: "1PT" },
  { label: "+2", value: "2PT" },
  { label: "+3", value: "3PT" },
];

const SECONDARY: {
  label: string;
  value: Outcome;
}[] = [
  { label: "EMPTY", value: "EMPTY" },
  { label: "TO", value: "TURNOVER" },
  { label: "FOUL", value: "FOUL" },
];

export default function SpurtsPage() {
  const [quarter, setQuarter] = useState(1);

  const [activeTeam, setActiveTeam] =
    useState<Team>("HOME");

  const [homeScore, setHomeScore] = useState(0);

  const [awayScore, setAwayScore] = useState(0);

  const [possessions, setPossessions] = useState<
    Possession[]
  >([]);

  const [scorePulse, setScorePulse] =
    useState<Team | null>(null);

  const spurt = useMemo(() => {
    return calculateSpurt(possessions);
  }, [possessions]);

  const gameState = useMemo(() => {
    return getGameState({
      homeScore,
      awayScore,
      possessions,
      spurt,
    });
  }, [homeScore, awayScore, possessions, spurt]);

  const atmosphere = useMemo(() => {
    return getAtmosphere({
      homeScore,
      awayScore,
      spurt,
    });
  }, [homeScore, awayScore, spurt]);

  useEffect(() => {
    if (!scorePulse) return;

    const timeout = window.setTimeout(() => {
      setScorePulse(null);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [scorePulse]);

  const latestFeed = possessions
    .slice()
    .reverse()
    .slice(0, 3);

  function completePossession(outcome: Outcome) {
    const points = outcomePoints(outcome);

    let nextHome = homeScore;
    let nextAway = awayScore;

    if (activeTeam === "HOME") {
      nextHome += points;

      setHomeScore(nextHome);

      if (points > 0) {
        setScorePulse("HOME");
      }
    } else {
      nextAway += points;

      setAwayScore(nextAway);

      if (points > 0) {
        setScorePulse("AWAY");
      }
    }

    const possession: Possession = {
      id: possessions.length + 1,
      quarter,
      team: activeTeam,
      outcome,
      points,
      homeScore: nextHome,
      awayScore: nextAway,
    };

    setPossessions((previous) => [
      ...previous,
      possession,
    ]);

    setActiveTeam(nextTeam(activeTeam));
  }

  function undoLast() {
    if (possessions.length === 0) return;

    const updated = [...possessions];

    const removed = updated.pop();

    if (!removed) return;

    setPossessions(updated);

    setHomeScore(
      updated.length
        ? updated[updated.length - 1].homeScore
        : 0
    );

    setAwayScore(
      updated.length
        ? updated[updated.length - 1].awayScore
        : 0
    );

    setActiveTeam(removed.team);
  }

  function resetGame() {
    setQuarter(1);

    setActiveTeam("HOME");

    setHomeScore(0);

    setAwayScore(0);

    setPossessions([]);
  }

  const backgroundClass =
    atmosphere.pressureGame
      ? "bg-[#02050a]"
      : atmosphere.gameBreaking
      ? "bg-[#050910]"
      : "bg-[#08111d]";

  const pageGlow =
    atmosphere.gameBreaking
      ? spurt?.team === "HOME"
        ? "shadow-[0_0_220px_rgba(34,211,238,0.18)]"
        : "shadow-[0_0_220px_rgba(249,115,22,0.18)]"
      : atmosphere.dominant
      ? spurt?.team === "HOME"
        ? "shadow-[0_0_160px_rgba(34,211,238,0.12)]"
        : "shadow-[0_0_160px_rgba(249,115,22,0.12)]"
      : "";

  return (
    <main
      className={`min-h-screen overflow-x-hidden text-white transition-all duration-700 ${backgroundClass}`}
    >
      <div
        className={`mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pt-5 pb-14 transition-all duration-700 ${pageGlow}`}
      >
        {/* HEADER */}

        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.45em] text-cyan-400">
              Axis
            </div>

            <h1 className="mt-1 text-4xl font-black tracking-[-0.05em]">
              Spurts
            </h1>
          </div>

          <button
            type="button"
            onClick={() =>
              setQuarter((previous) => previous + 1)
            }
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black backdrop-blur-xl active:scale-[0.96]"
          >
            Q{quarter}
          </button>
        </div>

        {/* SCORE */}

        <div className="mt-10 flex items-end justify-center gap-5">
          <div className="text-center">
            <div className="mb-2 text-[10px] uppercase tracking-[0.35em] text-white/25">
              Home
            </div>

            <div
              className={`text-[118px] font-black leading-[0.82] tracking-[-0.09em] transition-all duration-200 ${
                scorePulse === "HOME"
                  ? "scale-[1.08] text-cyan-300 blur-[0.2px]"
                  : ""
              }`}
            >
              {homeScore}
            </div>
          </div>

          <div className="pb-5 text-4xl text-white/10">
            —
          </div>

          <div className="text-center">
            <div className="mb-2 text-[10px] uppercase tracking-[0.35em] text-white/25">
              Away
            </div>

            <div
              className={`text-[118px] font-black leading-[0.82] tracking-[-0.09em] transition-all duration-200 ${
                scorePulse === "AWAY"
                  ? "scale-[1.08] text-orange-300 blur-[0.2px]"
                  : ""
              }`}
            >
              {awayScore}
            </div>
          </div>
        </div>

        {/* POSSESSION */}

        <div
          className={`mt-8 rounded-[34px] px-6 py-6 text-center transition-all duration-700 ${
            activeTeam === "HOME"
              ? "bg-cyan-400/[0.18] shadow-[0_0_40px_rgba(34,211,238,0.18)]"
              : "bg-orange-400/[0.18] shadow-[0_0_40px_rgba(249,115,22,0.18)]"
          }`}
        >
          <div className="text-[10px] uppercase tracking-[0.45em] text-white/35">
            Possession
          </div>

          <div className="mt-3 text-6xl font-black tracking-[-0.05em]">
            {activeTeam}
          </div>
        </div>

        {/* STATE */}

        <div
          className={`mt-5 rounded-[34px] px-6 py-7 text-center transition-all duration-700 ${
            atmosphere.gameBreaking
              ? "scale-[1.025] bg-white/[0.12] shadow-[0_0_60px_rgba(255,255,255,0.08)]"
              : atmosphere.dominant
              ? "bg-white/[0.08]"
              : "bg-white/[0.04]"
          }`}
        >
          <div className="text-[10px] uppercase tracking-[0.45em] text-white/30">
            Current State
          </div>

          <div className="mt-4 text-[38px] font-black leading-[0.95] tracking-[-0.05em]">
            {gameState}
          </div>

          {spurt && (
            <div className="mt-4 text-lg font-bold text-white/55">
              {spurt.team} ON {spurt.points}-
              {spurt.opponentPoints}
            </div>
          )}
        </div>

        {/* PRIMARY */}

        <div className="mt-10 grid grid-cols-3 gap-4">
          {PRIMARY.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                completePossession(item.value)
              }
              className="h-32 rounded-[30px] bg-white/[0.05] text-5xl font-black tracking-[-0.05em] backdrop-blur-xl transition-all duration-100 active:scale-[0.94] active:bg-white/[0.10]"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* SECONDARY */}

        <div className="mt-4 grid grid-cols-3 gap-4">
          {SECONDARY.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                completePossession(item.value)
              }
              className="h-20 rounded-[22px] bg-white/[0.04] text-lg font-black backdrop-blur-xl transition-all duration-100 active:scale-[0.96]"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* UTIL */}

        <div className="mt-4 grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={undoLast}
            className="h-16 rounded-[20px] bg-white/[0.04] text-base font-black backdrop-blur-xl transition-all duration-100 active:scale-[0.98]"
          >
            UNDO
          </button>

          <button
            type="button"
            onClick={() =>
              setQuarter((previous) => previous + 1)
            }
            className="h-16 rounded-[20px] bg-white/[0.04] text-base font-black backdrop-blur-xl transition-all duration-100 active:scale-[0.98]"
          >
            NEXT Q
          </button>
        </div>

        {/* RESET */}

        <button
          type="button"
          onClick={resetGame}
          className="mt-4 h-16 rounded-[20px] bg-red-500/12 text-base font-black text-red-300 backdrop-blur-xl transition-all duration-100 active:scale-[0.98]"
        >
          RESET
        </button>

        {/* FEED */}

        <div className="mt-10">
          <div className="mb-3 text-[10px] uppercase tracking-[0.45em] text-white/20">
            Last 3
          </div>

          <div className="flex flex-col gap-3">
            {latestFeed.length === 0 && (
              <div className="rounded-2xl bg-white/[0.03] px-4 py-4 text-sm text-white/40">
                No possessions yet.
              </div>
            )}

            {latestFeed.map((possession) => (
              <div
                key={possession.id}
                className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-4 backdrop-blur-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="font-black">
                    {possession.team}
                  </div>

                  <div className="text-white/40">
                    {possession.outcome}
                  </div>
                </div>

                <div className="text-sm text-white/35">
                  {possession.homeScore}
                  {" - "}
                  {possession.awayScore}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}