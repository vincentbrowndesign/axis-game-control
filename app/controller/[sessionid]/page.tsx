"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RotateCcw, TimerReset } from "lucide-react";

type Player = {
  id: string;
  name: string;
  number: string;
  position: string;
  dbId?: string;
};

type EventType = "+2" | "+3" | "MISS" | "TO" | "REB" | "AST" | "FOUL";

type LogEvent = {
  id: string;
  type: EventType | "SUB" | "TIMEOUT" | "OPP_SCORE";
  player?: string;
  playerId?: string;
  detail?: string;
  createdAt: string;
};

const FALLBACK_STARTERS: Player[] = [
  { id: "p1", name: "BROWN", number: "11", position: "G" },
  { id: "p2", name: "COLE", number: "12", position: "G" },
  { id: "p3", name: "JAMES", number: "15", position: "F" },
  { id: "p4", name: "GREEN", number: "22", position: "F" },
  { id: "p5", name: "DAVIS", number: "32", position: "C" },
];

const FALLBACK_BENCH: Player[] = [
  { id: "p6", name: "SMITH", number: "2", position: "G" },
  { id: "p7", name: "WILSON", number: "5", position: "G" },
  { id: "p8", name: "THOMAS", number: "24", position: "F" },
];

const EVENTS: { type: EventType; label: string; color: string }[] = [
  { type: "+2", label: "MADE 2", color: "bg-green-600" },
  { type: "+3", label: "MADE 3", color: "bg-green-600" },
  { type: "MISS", label: "SHOT MISS", color: "bg-blue-600" },
  { type: "TO", label: "TURNOVER", color: "bg-red-600" },
  { type: "REB", label: "REBOUND", color: "bg-purple-600" },
  { type: "AST", label: "ASSIST", color: "bg-blue-700" },
  { type: "FOUL", label: "FOUL", color: "bg-red-500" },
];

function mapEvent(type: EventType) {
  return {
    "+2": { event_type: "MAKE_2", value: 2 },
    "+3": { event_type: "MAKE_3", value: 3 },
    MISS: { event_type: "MISS", value: 0 },
    TO: { event_type: "TURNOVER", value: 0 },
    REB: { event_type: "REBOUND", value: 0 },
    AST: { event_type: "ASSIST", value: 0 },
    FOUL: { event_type: "FOUL", value: 0 },
  }[type];
}

function isRealSession(id: string) {
  return id !== "test" && id.length > 20;
}

export default function ControllerPage() {
  const params = useParams();
  const sessionId = String(params.sessionId);
  const backupKey = `axis_log_${sessionId}`;

  const [court, setCourt] = useState<Player[]>(FALLBACK_STARTERS);
  const [bench, setBench] = useState<Player[]>(FALLBACK_BENCH);
  const [pendingEvent, setPendingEvent] = useState<EventType | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEvent[]>([]);
  const [timeouts, setTimeouts] = useState(3);
  const [opponentScore, setOpponentScore] = useState(0);

  useEffect(() => {
    const savedLog = localStorage.getItem(backupKey);
    if (savedLog) setLog(JSON.parse(savedLog));

    const rawPlayers = localStorage.getItem("axis_players");
    const rawSession = localStorage.getItem("axis_session");

    if (rawSession) {
      const session = JSON.parse(rawSession);
      setOpponentScore(session.opponent_score ?? 0);
    }

    if (rawPlayers) {
      const dbPlayers = JSON.parse(rawPlayers);

      const mapped: Player[] = dbPlayers.map((p: any, index: number) => ({
        id: `p${index + 1}`,
        dbId: p.id,
        name: p.last_name,
        number: p.jersey_number,
        position: p.position || "",
      }));

      setCourt(mapped.slice(0, 5));
      setBench(mapped.slice(5, 8));
    }
  }, [backupKey]);

  useEffect(() => {
    localStorage.setItem(backupKey, JSON.stringify(log));
  }, [log, backupKey]);

  const teamScore = log.reduce(
    (sum, event) =>
      sum + (event.type === "+2" ? 2 : event.type === "+3" ? 3 : 0),
    0
  );

  const selectedPlayer = useMemo(() => {
    return [...court, ...bench].find((p) => p.id === selectedPlayerId);
  }, [court, bench, selectedPlayerId]);

  const selectedStats = useMemo(() => {
    if (!selectedPlayer) return null;

    const playerEvents = log.filter((e) => e.playerId === selectedPlayer.id);

    return {
      pts: playerEvents.reduce(
        (sum, e) => sum + (e.type === "+2" ? 2 : e.type === "+3" ? 3 : 0),
        0
      ),
      reb: playerEvents.filter((e) => e.type === "REB").length,
      ast: playerEvents.filter((e) => e.type === "AST").length,
      to: playerEvents.filter((e) => e.type === "TO").length,
      foul: playerEvents.filter((e) => e.type === "FOUL").length,
    };
  }, [log, selectedPlayer]);

  function addLog(event: LogEvent) {
    setLog((prev) => [event, ...prev].slice(0, 150));
  }

  async function saveEvent(type: EventType, player: Player) {
    if (!isRealSession(sessionId)) return;

    const mapped = mapEvent(type);

    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        player_id: player.dbId || null,
        event_type: mapped.event_type,
        event_value: mapped.value,
        video_time_ms: 0,
        game_clock: "06:24",
        period: "1ST QTR",
        lineup_player_ids: court.map((p) => p.dbId).filter(Boolean),
        metadata: {},
      }),
    });
  }

  async function saveOpponent(points: number) {
    if (!isRealSession(sessionId)) return;

    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        player_id: null,
        event_type: `OPP_${points}`,
        event_value: points,
        video_time_ms: 0,
        game_clock: "06:24",
        period: "1ST QTR",
        lineup_player_ids: court.map((p) => p.dbId).filter(Boolean),
        metadata: { opponent: true },
      }),
    });
  }

  async function saveSub(outPlayer: Player, inPlayer: Player) {
    if (!isRealSession(sessionId)) return;

    await fetch("/api/subs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        player_out: outPlayer.dbId,
        player_in: inPlayer.dbId,
        video_time_ms: 0,
        game_clock: "06:24",
        period: "1ST QTR",
      }),
    });
  }

  function handleEvent(type: EventType) {
    setPendingEvent(type);
  }

  function handlePlayerTap(player: Player) {
    setSelectedPlayerId(player.id);

    if (!pendingEvent) return;

    addLog({
      id: crypto.randomUUID(),
      type: pendingEvent,
      player: player.name,
      playerId: player.id,
      createdAt: new Date().toLocaleTimeString(),
    });

    void saveEvent(pendingEvent, player);
    setPendingEvent(null);
  }

  function handleOpponent(points: number) {
    setOpponentScore((prev) => prev + points);

    addLog({
      id: crypto.randomUUID(),
      type: "OPP_SCORE",
      detail: `OPP +${points}`,
      createdAt: new Date().toLocaleTimeString(),
    });

    void saveOpponent(points);
  }

  function handleUndo() {
    const last = log[0];

    if (last?.type === "OPP_SCORE" && last.detail) {
      const points = Number(last.detail.replace("OPP +", ""));
      if (!Number.isNaN(points)) {
        setOpponentScore((prev) => Math.max(0, prev - points));
      }
    }

    if (last?.type === "TIMEOUT") {
      setTimeouts((prev) => Math.min(3, prev + 1));
    }

    setLog((prev) => prev.slice(1));
    setPendingEvent(null);
  }

  function handleResetLocal() {
    setLog([]);
    setOpponentScore(0);
    setTimeouts(3);
    setPendingEvent(null);
    setSelectedPlayerId(null);
    localStorage.removeItem(backupKey);
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

      void saveSub(outPlayer, inPlayer);
    };
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-black text-white">
      <section className="relative h-[18vh] overflow-hidden border-b border-white/10 bg-neutral-950">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 opacity-80" />

        <div className="relative z-10 flex h-full items-start justify-between px-6 py-4">
          <div className="flex items-center gap-3 text-2xl font-black text-red-500">
            <span className="h-4 w-4 rounded-full bg-red-500" />
            REC
            <span className="ml-4 text-sm text-white/50">LOCAL BACKUP ON</span>
          </div>

          <div className="rounded-b-3xl bg-black/80 px-16 py-3 text-center shadow-2xl">
            <div className="grid grid-cols-3 items-center gap-12">
              <div>
                <p className="text-xs font-bold text-white/60">TEAM AXIS</p>
                <p className="text-5xl font-black text-green-500">
                  {teamScore}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-white/60">1ST QTR</p>
                <p className="text-5xl font-black">06:24</p>
              </div>

              <div className="text-right">
                <p className="text-xs font-bold text-white/60">OPPONENT</p>
                <p className="text-5xl font-black text-red-500">
                  {opponentScore}
                </p>

                <div className="mt-2 flex justify-end gap-2">
                  {[1, 2, 3].map((points) => (
                    <button
                      key={points}
                      onClick={() => handleOpponent(points)}
                      className="rounded-xl bg-red-600 px-5 py-2 text-sm font-black transition active:scale-90"
                    >
                      +{points}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleResetLocal}
            className="text-xs font-black text-white/30 transition hover:text-white"
          >
            RESET LOCAL
          </button>
        </div>
      </section>

      <section className="relative h-[47vh] px-6 py-5">
        <div className="grid grid-cols-5 gap-4">
          {court.map((player) => (
            <PlayerTile
              key={player.id}
              player={player}
              status="court"
              selected={selectedPlayerId === player.id}
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
              selected={selectedPlayerId === player.id}
              draggable
              onDragStart={handleDragStart(player)}
              onClick={() => handlePlayerTap(player)}
            />
          ))}
        </div>

        {selectedPlayer && selectedStats && (
          <div className="absolute right-6 top-5 w-[390px] rounded-3xl border border-white/10 bg-black/90 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-white/40">
                  #{selectedPlayer.number}
                </p>
                <p className="text-3xl font-black">{selectedPlayer.name}</p>
              </div>
              <p className="text-2xl font-black text-green-500">
                {selectedPlayer.position}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-5 gap-3 text-center">
              <Stat label="PTS" value={selectedStats.pts} />
              <Stat label="REB" value={selectedStats.reb} color="purple" />
              <Stat label="AST" value={selectedStats.ast} color="blue" />
              <Stat label="TO" value={selectedStats.to} color="red" />
              <Stat label="FOUL" value={selectedStats.foul} color="orange" />
            </div>
          </div>
        )}
      </section>

      <section className="h-[35vh] px-6 pb-6">
        <div className="grid h-full grid-cols-[1fr_300px] gap-5">
          <div className="grid grid-cols-4 gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            {EVENTS.map((event) => (
              <button
                key={event.type}
                onClick={() => handleEvent(event.type)}
                className={`${event.color} rounded-2xl border border-white/10 text-center shadow-lg transition active:scale-95 ${
                  pendingEvent === event.type
                    ? "ring-4 ring-white/80"
                    : "ring-0"
                } ${
                  event.type === "REB"
                    ? "shadow-[0_0_20px_rgba(168,85,247,0.35)]"
                    : ""
                } ${
                  event.type === "TO" || event.type === "FOUL"
                    ? "shadow-[0_0_20px_rgba(239,68,68,0.35)]"
                    : ""
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
            className="h-full rounded-3xl border border-orange-400 bg-black shadow-[0_0_30px_rgba(251,146,60,0.25)] transition active:scale-95"
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
        <div className="fixed left-1/2 top-[19vh] -translate-x-1/2 rounded-full border border-white/10 bg-black/80 px-5 py-2 text-sm font-bold text-white">
          {log[0].type} {log[0].player ? `— ${log[0].player}` : log[0].detail}
        </div>
      )}
    </main>
  );
}

function PlayerTile({
  player,
  status,
  selected,
  draggable = false,
  onClick,
  onDragStart,
  onDrop,
}: {
  player: Player;
  status: "court" | "bench";
  selected?: boolean;
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
        selected ? "ring-4 ring-white/80" : ""
      } ${
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

function Stat({
  label,
  value,
  color = "green",
}: {
  label: string;
  value: number;
  color?: "green" | "purple" | "blue" | "red" | "orange";
}) {
  const colors = {
    green: "text-green-500",
    purple: "text-purple-500",
    blue: "text-blue-500",
    red: "text-red-500",
    orange: "text-orange-400",
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] py-3">
      <p className="text-xs font-black text-white/40">{label}</p>
      <p className={`text-2xl font-black ${colors[color]}`}>{value}</p>
    </div>
  );
}