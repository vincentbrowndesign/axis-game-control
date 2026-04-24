"use client";

import { useState } from "react";

export default function ControllerPage() {
  const [teamScore, setTeamScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(14);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeouts, setTimeouts] = useState(3);

  const players = [
    { id: 11, name: "BROWN", pos: "G" },
    { id: 12, name: "COLE", pos: "G" },
    { id: 15, name: "JAMES", pos: "F" },
    { id: 22, name: "GREEN", pos: "F" },
    { id: 32, name: "DAVIS", pos: "C" },
    { id: 2, name: "SMITH", pos: "G" },
    { id: 5, name: "WILSON", pos: "G" },
    { id: 24, name: "THOMAS", pos: "F" },
  ];

  function score(points: number) {
    if (selected === null) return;
    setTeamScore((s) => s + points);
  }

  function opp(points: number) {
    setOpponentScore((s) => s + points);
  }

  function handleTimeout() {
    setTimeouts((t) => Math.max(0, t - 1));
  }

  return (
    <main className="min-h-screen bg-black text-white p-4">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2 text-red-500 font-black">
          ● REC
          <span className="text-white/40 text-sm ml-2">1080p • 60fps</span>
        </div>

        <div className="text-center">
          <p className="text-sm text-white/50">1ST QTR</p>
          <p className="text-4xl font-black">06:24</p>
        </div>

        <div className="text-sm text-white/40">100%</div>
      </div>

      {/* SCOREBOARD */}
      <div className="flex justify-between items-center mb-6 px-6 py-3 rounded-3xl bg-neutral-900">
        <div>
          <p className="text-xs text-white/40">TEAM AXIS</p>
          <p className="text-3xl font-black text-green-500">{teamScore}</p>
        </div>

        <div>
          <p className="text-xs text-white/40 text-right">OPPONENT</p>
          <p className="text-3xl font-black text-red-500 text-right">
            {opponentScore}
          </p>
        </div>
      </div>

      {/* PLAYERS */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {players.slice(0, 5).map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            selected={selected === p.id}
            onClick={() => setSelected(p.id)}
            accent="green"
          />
        ))}
      </div>

      <div className="flex gap-3 justify-center mb-6">
        {players.slice(5).map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            selected={selected === p.id}
            onClick={() => setSelected(p.id)}
            accent="blue"
            small
          />
        ))}
      </div>

      {/* ACTION GRID */}
      <div className="grid grid-cols-4 gap-3">

        <Button color="green" onClick={() => score(2)}>+2</Button>
        <Button color="green" onClick={() => score(3)}>+3</Button>
        <Button color="blue">MISS</Button>
        <Button color="red">TO</Button>

        <Button color="purple">REB</Button>
        <Button color="blue">AST</Button>
        <Button color="red">FOUL</Button>
        <Button color="gray" onClick={() => {
          setTeamScore(0);
          setOpponentScore(0);
        }}>RESET</Button>

        {/* OPPONENT CONTROLS */}
        <Button color="red" onClick={() => opp(1)}>OPP +1</Button>
        <Button color="red" onClick={() => opp(2)}>OPP +2</Button>
        <Button color="red" onClick={() => opp(3)}>OPP +3</Button>

        {/* TIMEOUT */}
        <div
          onClick={handleTimeout}
          className="col-span-1 flex flex-col justify-center items-center rounded-2xl border border-orange-400 text-orange-400 p-3"
        >
          <p className="text-lg font-black">TIMEOUT</p>
          <p className="text-3xl font-black">{timeouts}</p>
        </div>
      </div>
    </main>
  );
}

/* ---------- COMPONENTS ---------- */

function PlayerCard({
  player,
  selected,
  onClick,
  accent,
  small = false,
}: any) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-3 text-left ${
        accent === "green"
          ? "border-green-500 text-green-400"
          : "border-blue-500 text-blue-400"
      } ${selected ? "bg-white/10" : ""} ${small ? "w-40" : ""}`}
    >
      <p className="text-2xl font-black">{player.id}</p>
      <p className="text-lg">{player.name}</p>
      <p className="text-xs opacity-50">{player.pos}</p>
    </button>
  );
}

function Button({ children, onClick, color }: any) {
  const map: any = {
    green: "bg-green-500 text-black",
    blue: "bg-blue-500",
    red: "bg-red-500",
    purple: "bg-purple-500",
    gray: "bg-gray-600",
  };

  return (
    <button
      onClick={onClick}
      className={`${map[color]} p-5 rounded-2xl text-xl font-black transition active:scale-95`}
    >
      {children}
    </button>
  );
}