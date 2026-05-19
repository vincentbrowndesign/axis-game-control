"use client"

import { useEffect, useState } from "react"
import type { RunPlayer } from "@/lib/run/runState"
import type { SignalResult, SignalSide, SignalStat } from "@/lib/run/signals"

type PendingEvent = {
  side: SignalSide
  result: SignalResult
  stat?: SignalStat
}

const plusStats: SignalStat[] = ["PTS", "REB", "AST", "STL", "BLK"]
const minusStats: SignalStat[] = ["TO", "FOUL", "MISS"]

export function ControlPad({
  home,
  away,
  players,
  onSignal,
  onAddPlayer,
  onUndo,
}: {
  home: string
  away: string
  players: RunPlayer[]
  onSignal: (
    side: SignalSide,
    result: SignalResult,
    detail: { stat: SignalStat; playerId?: string }
  ) => void
  onAddPlayer: (side: SignalSide, player: { number: string; name?: string }) => RunPlayer
  onUndo: () => void
}) {
  const [pending, setPending] = useState<PendingEvent | null>(null)
  const [selectedPlayerBySide, setSelectedPlayerBySide] = useState<
    Partial<Record<SignalSide, string>>
  >({})

  useEffect(() => {
    if (!pending || typeof window === "undefined") return

    const timeout = window.setTimeout(() => setPending(null), 5200)

    return () => window.clearTimeout(timeout)
  }, [pending])

  function commit(stat: SignalStat, playerId = pending ? selectedPlayerBySide[pending.side] : undefined) {
    if (!pending) return

    onSignal(pending.side, pending.result, {
      stat,
      playerId,
    })
    setPending(null)
  }

  function selectPlayer(side: SignalSide, playerId: string) {
    setSelectedPlayerBySide((current) => ({
      ...current,
      [side]: playerId,
    }))
  }

  return (
    <section className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <BehaviorLane
          side="home"
          name={home}
          active={pending?.side === "home"}
          onPick={(result) => setPending({ side: "home", result })}
        />
        <BehaviorLane
          side="away"
          name={away}
          active={pending?.side === "away"}
          onPick={(result) => setPending({ side: "away", result })}
        />
      </div>

      {pending ? (
        <DisclosurePanel
          pending={pending}
          teamName={pending.side === "home" ? home : away}
          players={players.filter((player) => player.team === pending.side)}
          selectedPlayerId={selectedPlayerBySide[pending.side]}
          onSelectPlayer={(playerId) => selectPlayer(pending.side, playerId)}
          onStat={(stat) => commit(stat)}
          onCommit={commit}
          onCancel={() => setPending(null)}
          onAddPlayer={(side, player) => {
            const nextPlayer = onAddPlayer(side, player)

            selectPlayer(side, nextPlayer.id)

            return nextPlayer
          }}
        />
      ) : null}

      <button
        type="button"
        onClick={onUndo}
        className="axis-glass mx-auto h-11 w-full max-w-44 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 transition active:scale-[0.99] hover:border-zinc-500 hover:text-white"
      >
        Undo
      </button>
    </section>
  )
}

function BehaviorLane({
  side,
  name,
  active,
  onPick,
}: {
  side: SignalSide
  name: string
  active: boolean
  onPick: (result: SignalResult) => void
}) {
  const [holding, setHolding] = useState<SignalResult | null>(null)
  const positiveTone =
    side === "home"
      ? "border-orange-300/35 bg-orange-300/10 text-orange-100 hover:border-orange-200/70"
      : "border-sky-300/35 bg-sky-300/10 text-sky-100 hover:border-sky-200/70"
  const negativeTone =
    side === "home"
      ? "border-orange-400/20 bg-black/45 text-orange-300/80 hover:border-orange-300/55"
      : "border-sky-400/20 bg-black/45 text-sky-300/80 hover:border-sky-300/55"

  return (
    <div
      className={`axis-glass relative grid min-h-32 grid-cols-[1fr_auto] gap-2 overflow-hidden rounded-lg p-2 transition duration-300 ${
        active ? "border-zinc-500/70 opacity-100" : "opacity-72 hover:opacity-100"
      }`}
    >
      <div
        className={`absolute inset-y-3 w-1 rounded-full ${
          side === "home" ? "left-0 bg-orange-300/55" : "right-0 bg-sky-300/55"
        }`}
      />
      <div className="grid content-between p-2">
        <span className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          {name}
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-700">
          {side === "home" ? "Left edge" : "Right edge"}
        </span>
      </div>
      <div className="grid gap-2">
      <button
        type="button"
        onPointerDown={() => setHolding("plus")}
        onPointerLeave={() => setHolding(null)}
        onPointerUp={() => setHolding(null)}
        onClick={() => onPick("plus")}
        className={`relative grid h-16 w-20 place-items-center overflow-hidden rounded-full border font-mono text-4xl font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-200 active:scale-[0.97] sm:h-20 sm:w-24 ${
          holding === "plus" ? "scale-[1.03]" : ""
        } ${positiveTone}`}
        aria-label={`${name} positive event`}
      >
        +
      </button>

      <button
        type="button"
        onPointerDown={() => setHolding("minus")}
        onPointerLeave={() => setHolding(null)}
        onPointerUp={() => setHolding(null)}
        onClick={() => onPick("minus")}
        className={`relative grid h-11 w-20 place-items-center overflow-hidden rounded-full border font-mono text-3xl font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 active:scale-[0.97] sm:w-24 ${
          holding === "minus" ? "scale-[1.03]" : ""
        } ${negativeTone}`}
        aria-label={`${name} negative event`}
      >
        -
      </button>
      </div>
    </div>
  )
}

function DisclosurePanel({
  pending,
  teamName,
  players,
  selectedPlayerId,
  onSelectPlayer,
  onStat,
  onCommit,
  onCancel,
  onAddPlayer,
}: {
  pending: PendingEvent
  teamName: string
  players: RunPlayer[]
  selectedPlayerId?: string
  onSelectPlayer: (playerId: string) => void
  onStat: (stat: SignalStat) => void
  onCommit: (stat: SignalStat, playerId?: string) => void
  onCancel: () => void
  onAddPlayer: (side: SignalSide, player: { number: string; name?: string }) => RunPlayer
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [number, setNumber] = useState("")
  const [name, setName] = useState("")
  const stats = pending.result === "plus" ? plusStats : minusStats

  function addPlayer() {
    const cleanNumber = number.trim()
    if (!cleanNumber) return

    const player = onAddPlayer(pending.side, {
      number: cleanNumber,
      name: name.trim() || undefined,
    })

    onSelectPlayer(player.id)
    if (pending.stat) onCommit(pending.stat, player.id)
    setNumber("")
    setName("")
    setIsAdding(false)
  }

  return (
    <div className="axis-glass rounded-[1.5rem] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
          {teamName} {pending.result === "plus" ? "+" : "-"}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600 transition hover:text-zinc-300"
        >
          Close
        </button>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pt-1">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => onSelectPlayer(player.id)}
            className={`h-11 min-w-14 rounded-full border px-4 font-mono text-sm font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition active:scale-[0.98] ${
              selectedPlayerId === player.id
                ? "border-zinc-200 bg-zinc-100 text-black"
                : "border-zinc-800 bg-black text-zinc-300 hover:border-zinc-600"
            }`}
            title={player.name || `#${player.number}`}
          >
            {player.number}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsAdding((current) => !current)}
          className="h-11 min-w-11 rounded-full border border-dashed border-zinc-700 bg-black px-4 font-mono text-sm font-black text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-zinc-500 hover:text-zinc-200"
          aria-label="Add player"
          title="Add player"
        >
          +
        </button>
      </div>

      {isAdding ? (
        <div className="mt-3 grid grid-cols-[0.36fr_1fr_auto] gap-2 rounded-lg border border-zinc-900 bg-black/70 p-2">
          <input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            inputMode="numeric"
            placeholder="#"
            aria-label="Jersey number"
            className="h-10 rounded-full border border-zinc-800 bg-black px-3 font-mono text-sm font-black text-zinc-100 outline-none placeholder:text-zinc-700"
          />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            aria-label="Player name"
            className="h-10 rounded-full border border-zinc-800 bg-black px-3 text-sm font-bold text-zinc-100 outline-none placeholder:text-zinc-700"
          />
          <button
            type="button"
            onClick={addPlayer}
            className="h-10 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-4 text-xs font-black uppercase tracking-[0.14em] text-emerald-200 transition active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {stats.map((stat) => (
          <button
            key={stat}
            type="button"
            onClick={() => onStat(stat)}
            className="h-11 min-w-14 rounded-full border border-zinc-800 bg-black/80 px-4 font-black uppercase tracking-[0.14em] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition active:scale-[0.98] hover:border-zinc-500 hover:bg-zinc-900"
          >
            {stat}
          </button>
        ))}
      </div>
    </div>
  )
}
