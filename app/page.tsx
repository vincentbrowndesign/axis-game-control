"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SetupPlayer = {
  name: string;
  number: string;
  position: string;
};

const DEFAULT_PLAYERS: SetupPlayer[] = [
  { name: "BROWN", number: "11", position: "G" },
  { name: "COLE", number: "12", position: "G" },
  { name: "JAMES", number: "15", position: "F" },
  { name: "GREEN", number: "22", position: "F" },
  { name: "DAVIS", number: "32", position: "C" },
  { name: "SMITH", number: "2", position: "G" },
  { name: "WILSON", number: "5", position: "G" },
  { name: "THOMAS", number: "24", position: "F" },
];

export default function Page() {
  const router = useRouter();

  const [teamName, setTeamName] = useState("TEAM AXIS");
  const [opponentName, setOpponentName] = useState("RAPTORS 2031");
  const [gameClock, setGameClock] = useState("08:00");
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);
  const [loading, setLoading] = useState(false);

  function updatePlayer(index: number, field: keyof SetupPlayer, value: string) {
    setPlayers((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, [field]: value.toUpperCase() } : p
      )
    );
  }

  async function startSession() {
    setLoading(true);

    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_name: teamName,
        opponent_name: opponentName,
        game_clock: gameClock,
        players,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Session failed");
      setLoading(false);
      return;
    }

    localStorage.setItem("axis_session", JSON.stringify(data.session));
    localStorage.setItem("axis_players", JSON.stringify(data.players));

    router.push(`/controller/${data.session.id}`);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 bg-neutral-950 px-6 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 text-2xl font-black text-green-500">
            AXIS
            <span className="ml-4 text-sm text-white/50">SESSION SETUP</span>
          </div>

          <div className="rounded-b-3xl bg-black/80 px-12 py-3 text-center shadow-2xl">
            <div className="grid grid-cols-3 items-center gap-10">
              <div>
                <p className="text-xs font-bold text-white/60">TEAM</p>
                <p className="text-2xl font-black text-green-500">{teamName}</p>
              </div>

              <div>
                <p className="text-xs font-bold text-white/60">CLOCK</p>
                <p className="text-4xl font-black">{gameClock}</p>
              </div>

              <div>
                <p className="text-xs font-bold text-white/60">OPPONENT</p>
                <p className="text-2xl font-black text-red-500">
                  {opponentName}
                </p>
              </div>
            </div>
          </div>

          <div className="text-xl font-bold text-orange-400">READY</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Field label="Team" value={teamName} onChange={setTeamName} color="green" />
          <Field label="Opponent" value={opponentName} onChange={setOpponentName} color="red" />
          <Field label="Game Clock" value={gameClock} onChange={setGameClock} color="orange" />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight">
                GAME CONTROL SETUP
              </h1>
              <p className="mt-1 text-sm font-bold text-white/40">
                FIRST 5 START · LAST 3 BENCH
              </p>
            </div>

            <div className="rounded-2xl border border-orange-400 bg-black px-5 py-3 text-sm font-black text-orange-400">
              SUNDAY READY
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {players.slice(0, 5).map((player, index) => (
              <PlayerSetupCard
                key={index}
                player={player}
                index={index}
                status="court"
                updatePlayer={updatePlayer}
              />
            ))}
          </div>

          <div className="mt-5 flex justify-center gap-4">
            {players.slice(5).map((player, idx) => (
              <PlayerSetupCard
                key={idx + 5}
                player={player}
                index={idx + 5}
                status="bench"
                updatePlayer={updatePlayer}
                compact
              />
            ))}
          </div>
        </div>

        <button
          onClick={startSession}
          disabled={loading}
          className="mt-6 w-full rounded-3xl border border-green-500 bg-green-500 py-6 text-3xl font-black text-black shadow-[0_0_30px_rgba(34,197,94,0.25)] active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? "CREATING SESSION..." : "START GAME CONTROL"}
        </button>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  color: "green" | "red" | "orange";
}) {
  const focus =
    color === "green"
      ? "focus:border-green-500"
      : color === "red"
      ? "focus:border-red-500"
      : "focus:border-orange-400";

  return (
    <label>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className={`w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-4 text-xl font-black outline-none ${focus}`}
      />
    </label>
  );
}

function PlayerSetupCard({
  player,
  index,
  status,
  compact = false,
  updatePlayer,
}: {
  player: SetupPlayer;
  index: number;
  status: "court" | "bench";
  compact?: boolean;
  updatePlayer: (index: number, field: keyof SetupPlayer, value: string) => void;
}) {
  const green = status === "court";

  return (
    <div
      className={`relative rounded-2xl border bg-neutral-950 p-4 ${
        compact ? "w-72" : "h-40"
      } ${
        green
          ? "border-green-500 shadow-[0_0_18px_rgba(34,197,94,0.15)]"
          : "border-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.12)]"
      }`}
    >
      <input
        value={player.number}
        onChange={(e) => updatePlayer(index, "number", e.target.value)}
        className={`w-20 bg-transparent text-5xl font-black outline-none ${
          green ? "text-green-500" : "text-blue-500"
        }`}
      />

      <input
        value={player.name}
        onChange={(e) => updatePlayer(index, "name", e.target.value)}
        className="mt-2 block w-full bg-transparent text-2xl font-black tracking-tight outline-none"
      />

      <input
        value={player.position}
        onChange={(e) => updatePlayer(index, "position", e.target.value)}
        className="block w-16 bg-transparent text-xl font-black text-white/35 outline-none"
      />

      <div
        className={`absolute bottom-4 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full ${
          green ? "bg-green-500" : "bg-blue-500"
        }`}
      />
    </div>
  );
}