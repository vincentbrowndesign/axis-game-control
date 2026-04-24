"use client";

import { useState } from "react";

export default function ControllerPage() {
  const [teamScore, setTeamScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);

  const [selected, setSelected] = useState<number | null>(null);

  const players = [
    { id: 11, name: "BROWN" },
    { id: 12, name: "COLE" },
    { id: 15, name: "JAMES" },
    { id: 22, name: "GREEN" },
    { id: 32, name: "DAVIS" },
  ];

  function score(points: number) {
    if (selected === null) return;
    setTeamScore((s) => s + points);
  }

  function opp(points: number) {
    setOppScore((s) => s + points);
  }

  return (
    <main className="min-h-screen bg-black text-white p-4">
      
      {/* SCOREBOARD */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-xs text-white/50">TEAM</p>
          <p className="text-4xl font-black text-green-500">{teamScore}</p>
        </div>

        <div className="text-center">
          <p className="text-sm text-white/50">1ST QTR</p>
          <p className="text-3xl font-black">06:24</p>
        </div>

        <div className="text-right">
          <p className="text-xs text-white/50">OPPONENT</p>
          <p className="text-4xl font-black text-red-500">{oppScore}</p>
        </div>
      </div>

      {/* PLAYERS */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`p-4 rounded-2xl border text-left ${
              selected === p.id
                ? "border-green-500 text-green-400"
                : "border-white/20"
            }`}
          >
            <p className="text-2xl font-black">{p.id}</p>
            <p className="text-lg">{p.name}</p>
          </button>
        ))}
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => score(2)}
          className="bg-green-500 text-black p-5 rounded-2xl text-2xl font-black"
        >
          +2
        </button>

        <button
          onClick={() => score(3)}
          className="bg-green-500 text-black p-5 rounded-2xl text-2xl font-black"
        >
          +3
        </button>

        <button className="bg-blue-500 p-5 rounded-2xl text-2xl font-black">
          MISS
        </button>

        <button className="bg-red-500 p-5 rounded-2xl text-2xl font-black">
          TO
        </button>

        <button className="bg-purple-500 p-5 rounded-2xl text-2xl font-black">
          REB
        </button>

        <button className="bg-blue-700 p-5 rounded-2xl text-2xl font-black">
          AST
        </button>

        <button className="bg-red-600 p-5 rounded-2xl text-2xl font-black">
          FOUL
        </button>

        <button
          onClick={() => {
            setTeamScore(0);
            setOppScore(0);
          }}
          className="bg-gray-600 p-5 rounded-2xl text-2xl font-black"
        >
          RESET
        </button>

        {/* OPPONENT CONTROLS */}
        <button
          onClick={() => opp(2)}
          className="col-span-1 bg-red-500 p-5 rounded-2xl text-2xl font-black"
        >
          OPP +2
        </button>

        <button
          onClick={() => opp(3)}
          className="col-span-1 bg-red-600 p-5 rounded-2xl text-2xl font-black"
        >
          OPP +3
        </button>
      </div>
    </main>
  );
}