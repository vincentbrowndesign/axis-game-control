"use client";

import { useState } from "react";

export default function Page() {
  const [score, setScore] = useState(0);
  const [oppScore, setOppScore] = useState(14);

  const players = [
    { num: 11, name: "BROWN" },
    { num: 12, name: "COLE" },
    { num: 15, name: "JAMES" },
    { num: 22, name: "GREEN" },
    { num: 32, name: "DAVIS" },
  ];

  return (
    <main className="min-h-screen bg-black text-white p-4">
      
      {/* SCOREBOARD */}
      <div className="flex justify-between items-center mb-4 text-center">
        <div>
          <p className="text-xs text-gray-400">TEAM AXIS</p>
          <p className="text-2xl text-green-400 font-bold">{score}</p>
        </div>

        <div>
          <p className="text-xs text-gray-400">1ST QTR</p>
          <p className="text-xl font-bold">06:24</p>
        </div>

        <div>
          <p className="text-xs text-gray-400">OPPONENT</p>
          <p className="text-2xl text-red-400 font-bold">{oppScore}</p>
        </div>
      </div>

      {/* PLAYER GRID */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {players.map((p) => (
          <div
            key={p.num}
            className="border border-green-500 rounded-xl p-4 text-center"
          >
            <p className="text-xl text-green-400 font-bold">{p.num}</p>
            <p className="text-sm">{p.name}</p>
          </div>
        ))}
      </div>

      {/* ACTION BUTTONS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <button
          onClick={() => setScore(score + 2)}
          className="bg-green-500 py-4 rounded-xl font-bold"
        >
          +2
        </button>

        <button
          onClick={() => setScore(score + 3)}
          className="bg-green-600 py-4 rounded-xl font-bold"
        >
          +3
        </button>

        <button className="bg-blue-500 py-4 rounded-xl font-bold">
          MISS
        </button>

        <button className="bg-red-500 py-4 rounded-xl font-bold">
          TO
        </button>
      </div>

      {/* SECOND ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <button className="bg-purple-500 py-4 rounded-xl font-bold">
          REB
        </button>

        <button className="bg-blue-600 py-4 rounded-xl font-bold">
          AST
        </button>

        <button className="bg-red-600 py-4 rounded-xl font-bold">
          FOUL
        </button>

        <button className="bg-gray-600 py-4 rounded-xl font-bold">
          UNDO
        </button>
      </div>

      {/* OPPONENT CONTROL */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setOppScore(oppScore + 2)}
          className="bg-red-500 py-4 rounded-xl font-bold"
        >
          OPP +2
        </button>

        <button
          onClick={() => setOppScore(oppScore + 3)}
          className="bg-red-600 py-4 rounded-xl font-bold"
        >
          OPP +3
        </button>
      </div>
    </main>
  );
}