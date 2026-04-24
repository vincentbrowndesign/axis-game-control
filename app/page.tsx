"use client";

import { useMemo, useState } from "react";
import { RotateCcw, TimerReset } from "lucide-react";

type Player = {
  id: string;
  name: string;
  number: string;
  position: string;
};

type EventType = "+2" | "+3" | "MISS" | "TO" | "REB" | "AST" | "FOUL";

type LogEvent = {
  id: string;
  type: EventType | "SUB" | "TIMEOUT";
  player?: string;
  detail?: string;
  createdAt: string;
};

const STARTERS: Player[] = [
  { id: "p1", name: "BROWN", number: "11", position: "G" },
  { id: "p2", name: "COLE", number: "12", position: "G" },
  { id: "p3", name: "JAMES", number: "15", position: "F" },
  { id: "p4", name: "GREEN", number: "22", position: "F" },
  { id: "p5", name: "DAVIS", number: "32", position: "C" },
];

const BENCH: Player[] = [
  { id: "p6", name: "SMITH", number: "2", position: "G" },
  { id: "p7", name: "WILSON", number: "5", position: "G" },
  { id: "p8", name: "THOMAS", number: "24", position: "F" },
];

const EVENTS: { type: EventType; label: string; color: string }[] = [
  { type: "+2", label: "MADE 2", color: "bg-green-700" },
  { type: "+3", label: "MADE 3", color: "bg-green-700" },
  { type: "MISS", label: "SHOT MISS", color: "bg-blue-700" },
  { type: "TO", label: "TURNOVER", color: "bg-red-700" },
  { type: "REB", label: "REBOUND", color: "bg-purple-700" },
  { type: "AST", label: "ASSIST", color: "bg-blue-800" },
  { type: "FOUL", label: "FOUL", color: "bg-orange-600" },
];

export default function Page() {
  const [court, setCourt] = useState<Player[]>(STARTERS);
  const [bench, setBench] = useState<Player[]>(BENCH);
  const [pendingEvent, setPendingEvent] = useState<EventType | null>(null);
  const [log, setLog] = useState<LogEvent[]>([]);
  const [timeouts, setTimeouts] = useState(3);

  const score = useMemo(() => {
    return log.reduce(
      (sum, event) =>
        sum +
        (event.type === "+2" ? 2 : event.type === "+3" ? 3 : 0),
      0
    );
  }, [log]);

  function addLog(event: LogEvent) {
    setLog((prev) => [event, ...prev].slice(0, 20));
  }

  function handleEvent(type: EventType) {
    setPendingEvent(type);
  }

  function handlePlayerTap(player: Player) {
    if (!pendingEvent) return;

    addLog({
      id: crypto.randomUUID(),
      type: pendingEvent,
      player: player.name,
      createdAt: new Date().toLocaleTimeString(),
    });

    setPendingEvent(null);
  }

  function handleUndo() {
    setLog((prev) => prev.slice(1));
  }

  function handleTimeout() {
    if (timeouts <= 0) return;

    setTimeouts((prev) => prev - 1);

    addLog({
      id: crypto.randomUUID(),
      type: "TIMEOUT",
      detail: "Timeout taken",
      createdAt: new Date().toLocaleTimeString(),
    });
  }

  function handleDragStart(player: Player) {
    return (event: React.DragEvent) => {
      event.dataTransfer.setData("playerId", player.id);
    };
  }

  function handleDropOnCourt(outPlayer: Player) {
    return (event: React.DragEvent) => {
      event.preventDefault();

      const inPlayerId = event.dataTransfer.getData("playerId");
      const inPlayer = bench.find((p) => p.id === inPlayerId);

      if (!inPlayer) return;

      setCourt((prev) =>
        prev.map((p) => (p.id === outPlayer.id ? inPlayer : p))
      );

      setBench((prev) =>
        prev.map((p) => (p.id === inPlayer.id ? outPlayer : p))
      );

      addLog({
        id: crypto.randomUUID(),
        type: "SUB",
        detail: `${inPlayer.name} ↔ ${outPlayer.name}`,
        createdAt: new Date().toLocaleTimeString(),
      });
    };
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-black text-white">
      <section className="h-[18vh] border-b border-white/10 bg-neutral-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 opacity-80" />

        <div className="relative z-10 flex h-full items-start justify-between px-6 py-4">
          <div className="flex items-center gap-3 text-red-500 font-black text-2xl">
            <span className="h-4 w-4 rounded-full bg-red-500" />
            REC
            <span className="ml-4 text-sm text-white/50">1080p · 60fps</span>
          </div>

          <div className="rounded-b-3xl bg-black/80 px-16 py-3 text-center shadow-2xl">
            <div className="grid grid-cols-3 gap-12 items-center">
              <div>
                <p className="text-xs font-bold text-white/60">TEAM AXIS</p>
                <p className="text-5xl font-black text-green-500">{score}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-white/60">1ST QTR</p>
                <p className="text-5xl font-black">06:24</p>
              </div>
              <div>
                <p className="text-xs font-bold text-white/60">RAPTORS 2031</p>
                <p className="text-5xl font-black">14</p>
              </div>
            </div>
          </div>

          <div className="text-xl font-bold">100%</div>
        </div>
      </section>

      <section className="h-[47vh] px-6 py-5">
        <div className="grid grid-cols-5 gap-4">
          {court.map((player) => (
            <PlayerTile
              key={player.id}
              player={player}
              status="court"
              onClick={() => handlePlayerTap(player)}
              onDrop={handleDropOnCourt(player)}
            />
          ))}
        </div>

        <div className="mt-5 flex justify-center gap-4">
          {bench.map((player) => (
            <PlayerTile
              key={player.id}
              player={player}
              status="bench"
              draggable
              onDragStart={handleDragStart(player)}
              onClick={() => handlePlayerTap(player)}
            />
          ))}
        </div>
      </section>

      <section className="h-[35vh] px-6 pb-6">
        <div className="grid h-full grid-cols-[1fr_280px] gap-5">
          <div className="grid grid-cols-4 gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            {EVENTS.map((event) => (
              <button
                key={event.type}
                onClick={() => handleEvent(event.type)}
                className={`${event.color} rounded-2xl border border-white/10 text-center shadow-lg transition active:scale-95 ${
                  pendingEvent === event.type
                    ? "ring-4 ring-white/80"
                    : "ring-0"
                }`}
              >
                <div className="text-5xl font-black">{event.type}</div>
                <div className="mt-2 text-sm font-bold tracking-wide">
                  {event.label}
                </div>
              </button>
            ))}

            <button
              onClick={handleUndo}
              className="rounded-2xl border border-white/15 bg-neutral-800 text-white/70 transition active:scale-95"
            >
              <RotateCcw className="mx-auto mb-2 h-8 w-8" />
              <div className="text-3xl font-black">UNDO</div>
              <div className="text-sm">UNDO LAST</div>
            </button>
          </div>

          <button
            onClick={handleTimeout}
            className="rounded-3xl border border-orange-400 bg-black shadow-[0_0_30px_rgba(251,146,60,0.25)] transition active:scale-95"
          >
            <TimerReset className="mx-auto mb-5 h-12 w-12 text-orange-400" />
            <div className="text-5xl font-black text-orange-400">TIMEOUT</div>
            <div className="mt-6 text-5xl font-black">{timeouts}</div>
            <div className="text-sm text-white/50">TIMEOUTS LEFT</div>
          </button>
        </div>
      </section>

      {pendingEvent && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white px-6 py-2 text-sm font-black text-black">
          {pendingEvent} SELECT PLAYER
        </div>
      )}

      {log[0] && (
        <div className="fixed top-[19vh] left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-5 py-2 text-sm font-bold text-white border border-white/10">
          {log[0].type} {log[0].player ? `— ${log[0].player}` : log[0].detail}
        </div>
      )}
    </main>
  );
}

function PlayerTile({
  player,
  status,
  draggable = false,
  onClick,
  onDragStart,
  onDrop,
}: {
  player: Player;
  status: "court" | "bench";
  draggable?: boolean;
  onClick?: () => void;
  onDragStart?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
}) {
  return (
    <button
      draggable={draggable}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={`relative h-36 rounded-2xl border p-5 text-left transition active:scale-95 ${
        status === "court"
          ? "border-green-500 bg-neutral-950 shadow-[0_0_18px_rgba(34,197,94,0.15)]"
          : "w-72 border-blue-500 bg-neutral-950/80 shadow-[0_0_18px_rgba(59,130,246,0.12)]"
      }`}
    >
      <div
        className={`text-5xl font-black ${
          status === "court" ? "text-green-500" : "text-blue-500"
        }`}
      >
        {player.number}
      </div>

      <div className="mt-2 text-2xl font-black tracking-tight">
        {player.name}
      </div>

      <div className="text-xl font-black text-white/35">{player.position}</div>

      <div
        className={`absolute bottom-4 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full ${
          status === "court" ? "bg-green-500" : "bg-blue-500"
        }`}
      />
    </button>
  );
}