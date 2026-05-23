"use client"

import { useMemo, useState } from "react"

type Action = "make2" | "make3" | "miss" | "foul" | "rebound" | "assist" | "turnover" | "timeout" | "sub"
type EventTone = "make" | "miss" | "neutral" | "pressure"

type Player = {
  assists: number
  fouls: number
  id: string
  minutes: number
  name: string
  number: number
  onFloor: boolean
  plusMinus: number
  points: number
  rebounds: number
  shotAttempts: number
  shotMakes: number
}

type TimelineEvent = {
  action: Action
  detail: string
  id: string
  playerId: string | null
  score: string
  teamDelta: number
  time: string
  tone: EventTone
}

type Session = {
  awayScore: number
  eventIndex: number
  homeScore: number
  lineupStartedAt: number
  players: Player[]
  possessionCount: number
  timeline: TimelineEvent[]
}

const initialPlayers: Player[] = [
  makePlayer("nae", "Nae", 1, true, 18.7, 10, 5, 3, 1, 5, 9, 8),
  makePlayer("scoota", "Scoota", 3, true, 17.1, 8, 2, 5, 2, 3, 7, 4),
  makePlayer("aj", "AJ", 5, true, 15.5, 8, 4, 1, 0, 4, 6, 6),
  makePlayer("myles", "Myles", 12, true, 14.8, 4, 6, 2, 2, 2, 5, -1),
  makePlayer("black", "Black", 22, true, 12.6, 5, 3, 1, 1, 2, 4, 3),
  makePlayer("carter", "Carter", 7, false, 8.2, 3, 2, 1, 2, 1, 3, -2),
  makePlayer("wings", "Wings", 15, false, 6.9, 2, 1, 0, 1, 1, 2, 1),
]

const initialTimeline: TimelineEvent[] = [
  makeEvent(1, "make2", "nae", "Corner touch pulled low help", "43-38", 2, "6:42", "make"),
  makeEvent(2, "sub", null, "Dead ball reset, same five stay", "43-38", 0, "6:18", "neutral"),
  makeEvent(3, "foul", "myles", "Slot drive, weak-side foul", "43-39", 0, "5:54", "pressure"),
  makeEvent(4, "miss", "scoota", "Early push after miss", "43-39", 0, "5:31", "miss"),
  makeEvent(5, "make2", "aj", "Second-side touch, paint collapse", "45-39", 2, "5:02", "make"),
  makeEvent(6, "timeout", null, "Timeout before run extends", "45-39", 0, "4:47", "neutral"),
]

const actionLabels: Array<{ action: Action; label: string }> = [
  { action: "make2", label: "+2" },
  { action: "make3", label: "+3" },
  { action: "miss", label: "Miss" },
  { action: "foul", label: "Foul" },
  { action: "rebound", label: "Reb" },
  { action: "assist", label: "Ast" },
  { action: "turnover", label: "TO" },
  { action: "timeout", label: "Time" },
  { action: "sub", label: "Sub" },
]

export function MeasuresSurface() {
  const [activePlayerId, setActivePlayerId] = useState("nae")
  const [session, setSession] = useState<Session>({
    awayScore: 39,
    eventIndex: initialTimeline.length,
    homeScore: 45,
    lineupStartedAt: 0,
    players: initialPlayers,
    possessionCount: 6,
    timeline: initialTimeline,
  })

  const activePlayer = session.players.find((player) => player.id === activePlayerId) ?? session.players[0]
  const activeLineup = session.players.filter((player) => player.onFloor)
  const bench = session.players.filter((player) => !player.onFloor)
  const flow = useMemo(() => readGameFlow(session.timeline), [session.timeline])
  const rhythm = useMemo(() => buildRhythmMarkers(session.timeline), [session.timeline])

  function commit(action: Action) {
    setSession((current) => {
      const eventIndex = current.eventIndex + 1
      const playerId = actionRequiresPlayer(action) ? activePlayerId : null
      const selected = current.players.find((player) => player.id === activePlayerId) ?? current.players[0]
      const teamDelta = action === "make2" ? 2 : action === "make3" ? 3 : 0
      const homeScore = current.homeScore + teamDelta
      const awayScore = action === "foul" && eventIndex % 3 === 0 ? current.awayScore + 1 : current.awayScore
      const time = clockForEvent(eventIndex)
      const tone = toneForAction(action)
      const detail = detailForAction(action, selected.name)

      const players = applyActionToPlayers(current.players, action, activePlayerId, teamDelta)
      const nextSession: Session = {
        ...current,
        awayScore,
        eventIndex,
        homeScore,
        players: action === "sub" ? rotateLineup(players, activePlayerId) : players,
        possessionCount: actionCountsPossession(action) ? current.possessionCount + 1 : current.possessionCount,
        timeline: [
          makeEvent(eventIndex, action, playerId, detail, `${homeScore}-${awayScore}`, teamDelta, time, tone),
          ...current.timeline,
        ].slice(0, 18),
      }

      return nextSession
    })
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#030303] text-[#f4f0e7]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-8%,rgba(244,240,231,0.12),rgba(244,240,231,0.035)_30%,rgba(0,0,0,0)_58%),linear-gradient(115deg,rgba(216,196,155,0.06),rgba(0,0,0,0)_42%)]" />
      <div className="absolute inset-x-10 top-20 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <section className="relative z-10 flex h-full flex-col gap-5 px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
        <header className="grid shrink-0 grid-cols-[1fr_auto] items-start gap-6">
          <div>
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.32em] text-white/30">Axis Measures</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[#fffaf0] sm:text-6xl">Q3 rhythm</h1>
          </div>
          <div className="rounded-[1.65rem] border border-white/8 bg-white/[0.045] px-5 py-4 text-right shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
            <p className="font-mono text-4xl tracking-[-0.09em] text-[#fffaf0] sm:text-6xl">
              {session.homeScore}-{session.awayScore}
            </p>
            <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.24em] text-white/34">
              {clockForEvent(session.eventIndex)} third
            </p>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[0.78fr_1.44fr_0.78fr]">
          <aside className="flex min-h-0 flex-col gap-4">
            <section className="rounded-[1.7rem] border border-white/8 bg-white/[0.035] p-4 shadow-[0_22px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-white/32">on floor</p>
                <p className="font-mono text-xs text-white/38">{formatMinutes(lineupMinutes(activeLineup))}</p>
              </div>
              <div className="mt-5 space-y-2">
                {activeLineup.map((player) => (
                  <button
                    className={[
                      "flex w-full items-center justify-between rounded-full border px-4 py-3 text-left transition-colors",
                      player.id === activePlayerId
                        ? "border-[#f4f0e7]/70 bg-[#f4f0e7] text-black"
                        : "border-white/8 bg-white/[0.035] text-white/62 hover:bg-white/[0.07]",
                    ].join(" ")}
                    key={player.id}
                    onClick={() => setActivePlayerId(player.id)}
                    type="button"
                  >
                    <span className="text-sm font-semibold">{player.name}</span>
                    <span className="font-mono text-xs opacity-55">{formatPlusMinus(player.plusMinus)}</span>
                  </button>
                ))}
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/7">
                <div className="h-full rounded-full bg-[#f4f0e7]/70" style={{ width: `${Math.min(86, 38 + flow.runValue * 6)}%` }} />
              </div>
            </section>

            <section className="min-h-0 flex-1 rounded-[1.7rem] border border-white/8 bg-white/[0.026] p-4 shadow-[0_22px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-white/32">{activePlayer.name}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {actionLabels.map(({ action, label }) => (
                  <button
                    className="rounded-full border border-white/8 bg-white/[0.035] px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/58 transition-colors hover:bg-[#f4f0e7] hover:text-black"
                    key={action}
                    onClick={() => commit(action)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {bench.length > 0 ? (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {bench.map((player) => (
                    <button
                      className="shrink-0 rounded-full border border-white/7 px-3 py-2 text-xs font-medium text-white/38 transition-colors hover:text-white/70"
                      key={player.id}
                      onClick={() => setActivePlayerId(player.id)}
                      type="button"
                    >
                      {player.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          </aside>

          <section className="relative min-h-0 overflow-hidden rounded-[2rem] border border-white/8 bg-white/[0.032] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.46)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(244,240,231,0.07),rgba(244,240,231,0)_34%)]" />
            <div className="pointer-events-none absolute inset-y-24 left-[4.85rem] w-px bg-gradient-to-b from-transparent via-white/18 to-transparent" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.62rem] font-medium uppercase tracking-[0.26em] text-white/32">possession spine</p>
                <p className="mt-2 max-w-lg text-2xl font-medium tracking-[-0.035em] text-[#fffaf0]">
                  {flow.runLabel} / {flow.droughtLabel}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {[`${session.possessionCount} poss`, `lineup ${lineupPlusMinus(activeLineup)}`, "live"].map((value) => (
                  <span className="rounded-full bg-white/[0.055] px-3 py-1.5 font-mono text-[0.68rem] text-white/48" key={value}>
                    {value}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mt-6 rounded-[1.35rem] border border-white/7 bg-black/16 px-4 py-3">
              <div className="flex h-12 items-end gap-1.5">
                {rhythm.map((marker) => (
                  <div className="flex flex-1 items-end" key={marker.id}>
                    <div
                      className={[
                        "w-full rounded-full transition-all duration-500",
                        markerClass(marker.tone),
                      ].join(" ")}
                      style={{ height: `${marker.height}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between font-mono text-[0.64rem] uppercase tracking-[0.18em] text-white/28">
                <span>earlier</span>
                <span>rhythm</span>
                <span>now</span>
              </div>
            </div>

            <div className="mt-5 h-[calc(100%-11.4rem)] min-h-0 space-y-1.5 overflow-y-auto pr-1">
              {session.timeline.map((event, index) => (
                <article
                  className={[
                    "relative grid grid-cols-[3.6rem_1fr_auto] items-center gap-4 rounded-[1.15rem] border px-4 py-3.5 transition-colors",
                    index === 0 ? "border-white/14 bg-white/[0.075] shadow-[0_18px_70px_rgba(0,0,0,0.22)]" : "border-white/0 bg-transparent hover:bg-white/[0.035]",
                  ].join(" ")}
                  key={event.id}
                >
                  <div className={["absolute left-[3.45rem] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-4", dotClass(event.tone)].join(" ")} />
                  <time className="font-mono text-sm text-white/42">{event.time}</time>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className={["font-mono text-xs tracking-[0.18em]", toneClass(event.tone)].join(" ")}>{labelForAction(event.action)}</span>
                      <p className="min-w-0 truncate text-sm text-white/76">{event.detail}</p>
                    </div>
                    {index === 0 ? (
                      <p className="mt-1 text-xs text-white/30">latest possession written into the game rail</p>
                    ) : null}
                  </div>
                  <span className="font-mono text-sm text-white/46">{event.score}</span>
                </article>
              ))}
            </div>
          </section>

          <aside className="min-h-0 rounded-[1.7rem] border border-white/8 bg-white/[0.026] p-4 shadow-[0_22px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-white/32">player line</p>
              <p className="font-mono text-xs text-white/28">min pf +/-</p>
            </div>
            <div className="mt-4 h-[calc(100%-2rem)] space-y-2 overflow-y-auto pr-1">
              {session.players.map((player) => (
                <button
                  className={[
                    "w-full rounded-[1.05rem] border p-3 text-left transition-colors",
                    player.id === activePlayerId ? "border-[#f4f0e7]/36 bg-white/[0.075]" : "border-white/6 bg-black/14 hover:bg-white/[0.04]",
                  ].join(" ")}
                  key={player.id}
                  onClick={() => setActivePlayerId(player.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold tracking-[-0.02em] text-[#fffaf0]">{player.name}</h2>
                      <p className="mt-1 font-mono text-[0.68rem] text-white/30">#{player.number}</p>
                    </div>
                    <span className="font-mono text-sm text-white/44">{formatPlusMinus(player.plusMinus)}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-y-2 font-mono text-xs text-white/58">
                    <span>{formatMinutes(player.minutes)}</span>
                    <span>{player.fouls}f</span>
                    <span>{player.points}p</span>
                    <span>{player.rebounds}r</span>
                    <span>{player.assists}a</span>
                    <span>
                      {player.shotMakes}-{player.shotAttempts}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

function makePlayer(
  id: string,
  name: string,
  number: number,
  onFloor: boolean,
  minutes: number,
  points: number,
  rebounds: number,
  assists: number,
  fouls: number,
  shotMakes: number,
  shotAttempts: number,
  plusMinus: number
): Player {
  return { assists, fouls, id, minutes, name, number, onFloor, plusMinus, points, rebounds, shotAttempts, shotMakes }
}

function makeEvent(
  index: number,
  action: Action,
  playerId: string | null,
  detail: string,
  score: string,
  teamDelta: number,
  time: string,
  tone: EventTone
): TimelineEvent {
  return { action, detail, id: `event-${index}`, playerId, score, teamDelta, time, tone }
}

function applyActionToPlayers(players: Player[], action: Action, activePlayerId: string, teamDelta: number) {
  return players.map((player) => {
    const active = player.id === activePlayerId
    const onFloorBonus = player.onFloor && teamDelta > 0 ? teamDelta : 0
    const onFloorPenalty = player.onFloor && action === "turnover" ? -1 : 0

    if (!active) {
      return { ...player, plusMinus: player.plusMinus + onFloorBonus + onFloorPenalty }
    }

    return {
      ...player,
      assists: player.assists + (action === "assist" ? 1 : 0),
      fouls: player.fouls + (action === "foul" ? 1 : 0),
      plusMinus: player.plusMinus + onFloorBonus + onFloorPenalty,
      points: player.points + teamDelta,
      rebounds: player.rebounds + (action === "rebound" ? 1 : 0),
      shotAttempts: player.shotAttempts + (action === "make2" || action === "make3" || action === "miss" ? 1 : 0),
      shotMakes: player.shotMakes + (action === "make2" || action === "make3" ? 1 : 0),
    }
  })
}

function rotateLineup(players: Player[], activePlayerId: string) {
  const active = players.find((player) => player.id === activePlayerId)
  const firstOnFloor = players.find((player) => player.onFloor)

  if (!active || active.onFloor || !firstOnFloor) return players

  return players.map((player) => {
    if (player.id === active.id) return { ...player, onFloor: true }
    if (player.id === firstOnFloor.id) return { ...player, onFloor: false }
    return player
  })
}

function readGameFlow(events: TimelineEvent[]) {
  let runValue = 0
  let emptyPossessions = 0

  for (const event of events) {
    if (event.action === "make2" || event.action === "make3") {
      runValue += event.teamDelta
      break
    }

    if (event.action === "miss" || event.action === "turnover") {
      emptyPossessions += 1
      continue
    }

    if (event.action === "foul" || event.action === "timeout" || event.action === "sub") continue
    break
  }

  return {
    droughtLabel: emptyPossessions > 0 ? `${emptyPossessions} empty` : "clean trip",
    runLabel: runValue > 0 ? `${runValue}-0 run` : "level",
    runValue,
  }
}

function buildRhythmMarkers(events: TimelineEvent[]) {
  const ordered = events.slice(0, 12).reverse()

  return ordered.map((event, index) => {
    const weight = event.action === "make3" ? 100 : event.action === "make2" ? 84 : event.action === "foul" ? 64 : event.action === "miss" ? 38 : 50
    const recencyLift = index / Math.max(1, ordered.length - 1)

    return {
      height: Math.min(100, weight * (0.72 + recencyLift * 0.28)),
      id: event.id,
      tone: event.tone,
    }
  })
}

function detailForAction(action: Action, playerName: string) {
  if (action === "make2") return `${playerName} two points`
  if (action === "make3") return `${playerName} corner three`
  if (action === "miss") return `${playerName} miss, possession ends`
  if (action === "foul") return `${playerName} foul`
  if (action === "rebound") return `${playerName} rebound`
  if (action === "assist") return `${playerName} assist`
  if (action === "turnover") return `${playerName} turnover`
  if (action === "timeout") return "Timeout, rhythm held"
  return `${playerName} into rotation`
}

function toneForAction(action: Action): EventTone {
  if (action === "make2" || action === "make3") return "make"
  if (action === "miss" || action === "turnover") return "miss"
  if (action === "foul") return "pressure"
  return "neutral"
}

function labelForAction(action: Action) {
  return actionLabels.find((item) => item.action === action)?.label.toUpperCase() ?? action.toUpperCase()
}

function actionRequiresPlayer(action: Action) {
  return action !== "timeout"
}

function actionCountsPossession(action: Action) {
  return action === "make2" || action === "make3" || action === "miss" || action === "turnover"
}

function lineupMinutes(players: Player[]) {
  if (players.length === 0) return 0
  return players.reduce((sum, player) => sum + player.minutes, 0) / players.length
}

function lineupPlusMinus(players: Player[]) {
  const value = players.reduce((sum, player) => sum + player.plusMinus, 0)
  return formatPlusMinus(value)
}

function clockForEvent(eventIndex: number) {
  const total = Math.max(0, 407 - eventIndex * 13)
  const minutes = Math.floor(total / 60)
  const seconds = `${total % 60}`.padStart(2, "0")
  return `${minutes}:${seconds}`
}

function toneClass(tone: EventTone) {
  if (tone === "make") return "text-[#f4f0e7]"
  if (tone === "miss") return "text-white/36"
  if (tone === "pressure") return "text-[#d8c49b]"
  return "text-white/46"
}

function dotClass(tone: EventTone) {
  if (tone === "make") return "bg-[#f4f0e7] ring-[#f4f0e7]/10"
  if (tone === "miss") return "bg-white/22 ring-white/5"
  if (tone === "pressure") return "bg-[#d8c49b] ring-[#d8c49b]/10"
  return "bg-white/34 ring-white/6"
}

function markerClass(tone: EventTone) {
  if (tone === "make") return "bg-[#f4f0e7]/72 shadow-[0_0_28px_rgba(244,240,231,0.16)]"
  if (tone === "miss") return "bg-white/18"
  if (tone === "pressure") return "bg-[#d8c49b]/58 shadow-[0_0_24px_rgba(216,196,155,0.12)]"
  return "bg-white/30"
}

function formatMinutes(value: number) {
  const minutes = Math.floor(value)
  const seconds = Math.round((value - minutes) * 60)
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`
}

function formatPlusMinus(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}
