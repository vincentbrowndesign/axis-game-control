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
    <main className="fixed inset-0 overflow-hidden bg-[#050505] text-[#f4f0e7]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.08),rgba(255,255,255,0)_34%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0)_42%)]" />
      <section className="relative z-10 flex h-full flex-col px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
        <header className="flex shrink-0 items-start justify-between gap-5">
          <div>
            <p className="text-[0.66rem] font-medium uppercase tracking-[0.26em] text-white/38">Axis Measures</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#fffaf0] sm:text-5xl">Q3 rhythm</h1>
          </div>
          <div className="text-right">
            <p className="font-mono text-3xl tracking-[-0.08em] text-[#fffaf0] sm:text-5xl">
              {session.homeScore}-{session.awayScore}
            </p>
            <p className="mt-1 text-[0.66rem] font-medium uppercase tracking-[0.22em] text-white/36">
              {clockForEvent(session.eventIndex)} third
            </p>
          </div>
        </header>

        <div className="mt-5 grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] gap-4 lg:grid-cols-[0.9fr_1.45fr] lg:grid-rows-[auto_1fr]">
          <section className="rounded-[1.35rem] border border-white/8 bg-white/[0.035] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-white/38">on floor</p>
              <p className="font-mono text-xs text-white/42">{formatMinutes(lineupMinutes(activeLineup))} together</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {activeLineup.map((player) => (
                <button
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition-colors",
                    player.id === activePlayerId
                      ? "border-[#f4f0e7] bg-[#f4f0e7] text-black"
                      : "border-white/10 bg-white/[0.06] text-white/66 hover:bg-white/[0.1]",
                  ].join(" ")}
                  key={player.id}
                  onClick={() => setActivePlayerId(player.id)}
                  type="button"
                >
                  {player.name}
                </button>
              ))}
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-[#f4f0e7]/78" style={{ width: `${Math.min(86, 38 + flow.runValue * 6)}%` }} />
            </div>
          </section>

          <section className="rounded-[1.35rem] border border-white/8 bg-white/[0.035] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.35)] lg:row-span-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-white/38">possession flow</p>
              <div className="flex gap-2">
                {[flow.runLabel, flow.droughtLabel, `${session.possessionCount} poss`, `lineup ${lineupPlusMinus(activeLineup)}`].map((value) => (
                  <span className="rounded-full bg-white/[0.055] px-3 py-1 font-mono text-[0.68rem] text-white/54" key={value}>
                    {value}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 min-h-0 space-y-3 overflow-y-auto pr-1">
              {session.timeline.map((event) => (
                <article
                  className="grid grid-cols-[3.4rem_4.7rem_1fr_auto] items-center gap-3 border-b border-white/7 pb-3 last:border-b-0"
                  key={event.id}
                >
                  <time className="font-mono text-sm text-white/42">{event.time}</time>
                  <span className={["font-mono text-xs tracking-[0.16em]", toneClass(event.tone)].join(" ")}>{labelForAction(event.action)}</span>
                  <p className="min-w-0 truncate text-sm text-white/78">{event.detail}</p>
                  <span className="font-mono text-sm text-white/48">{event.score}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[1.35rem] border border-white/8 bg-white/[0.035] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-white/38">{activePlayer.name}</p>
              <p className="font-mono text-xs text-white/34">1 tap</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {actionLabels.map(({ action, label }) => (
                <button
                  className="rounded-full border border-white/9 bg-white/[0.04] px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/64 transition-colors hover:bg-white/[0.08] hover:text-white"
                  key={action}
                  onClick={() => commit(action)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            {bench.length > 0 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {bench.map((player) => (
                  <button
                    className="shrink-0 rounded-full border border-white/7 px-3 py-2 text-xs font-medium text-white/44 hover:text-white/70"
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

          <section className="min-h-0 rounded-[1.35rem] border border-white/8 bg-white/[0.035] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.35)] lg:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-white/38">player line</p>
              <p className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-white/28">min / pf / +/- / pts / reb / ast</p>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-5">
              {session.players.map((player) => (
                <button
                  className={[
                    "rounded-[1rem] border p-3 text-left transition-colors",
                    player.id === activePlayerId ? "border-[#f4f0e7]/50 bg-white/[0.09]" : "border-white/7 bg-black/18 hover:bg-white/[0.045]",
                  ].join(" ")}
                  key={player.id}
                  onClick={() => setActivePlayerId(player.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold tracking-[-0.02em] text-[#fffaf0]">{player.name}</h2>
                    <span className="font-mono text-sm text-white/44">{formatPlusMinus(player.plusMinus)}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-y-2 font-mono text-sm text-white/68">
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
          </section>
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

function formatMinutes(value: number) {
  const minutes = Math.floor(value)
  const seconds = Math.round((value - minutes) * 60)
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`
}

function formatPlusMinus(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}
