type PlayerStat = {
  ast: number
  fouls: number
  id: string
  min: string
  name: string
  pm: number
  reb: number
  shots: string
}

type Possession = {
  detail: string
  id: string
  result: string
  score: string
  time: string
  tone: "make" | "miss" | "neutral" | "pressure"
}

type Run = {
  label: string
  value: string
}

const lineup = ["Nae", "Scoota", "AJ", "Myles", "Black"]

const players: PlayerStat[] = [
  { ast: 3, fouls: 1, id: "nae", min: "18:42", name: "Nae", pm: 8, reb: 5, shots: "5-9" },
  { ast: 5, fouls: 2, id: "scoota", min: "17:10", name: "Scoota", pm: 4, reb: 2, shots: "3-7" },
  { ast: 1, fouls: 0, id: "aj", min: "15:28", name: "AJ", pm: 6, reb: 4, shots: "4-6" },
  { ast: 2, fouls: 2, id: "myles", min: "14:50", name: "Myles", pm: -1, reb: 6, shots: "2-5" },
  { ast: 1, fouls: 1, id: "black", min: "12:34", name: "Black", pm: 3, reb: 3, shots: "2-4" },
]

const possessions: Possession[] = [
  { detail: "Corner touch pulled low help", id: "p1", result: "MAKE", score: "41-37", time: "6:42", tone: "make" },
  { detail: "Dead ball reset, same five stay", id: "p2", result: "SUB", score: "41-37", time: "6:18", tone: "neutral" },
  { detail: "Slot drive, weak-side foul", id: "p3", result: "FOUL", score: "41-38", time: "5:54", tone: "pressure" },
  { detail: "Early push after miss", id: "p4", result: "MISS", score: "41-38", time: "5:31", tone: "miss" },
  { detail: "Second-side touch, paint collapse", id: "p5", result: "MAKE", score: "43-38", time: "5:02", tone: "make" },
  { detail: "Timeout before run extends", id: "p6", result: "TIMEOUT", score: "43-38", time: "4:47", tone: "neutral" },
]

const runs: Run[] = [
  { label: "current run", value: "7-2" },
  { label: "pace", value: "fast" },
  { label: "lineup", value: "+8" },
  { label: "fouls", value: "3 / 2" },
]

export function MeasuresSurface() {
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
            <p className="font-mono text-3xl tracking-[-0.08em] text-[#fffaf0] sm:text-5xl">43-38</p>
            <p className="mt-1 text-[0.66rem] font-medium uppercase tracking-[0.22em] text-white/36">4:47 third</p>
          </div>
        </header>

        <div className="mt-5 grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] gap-4 lg:grid-cols-[0.9fr_1.45fr] lg:grid-rows-[auto_1fr]">
          <section className="rounded-[1.35rem] border border-white/8 bg-white/[0.035] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-white/38">on floor</p>
              <p className="font-mono text-xs text-white/42">18:42 together</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {lineup.map((player) => (
                <span
                  className="rounded-full border border-white/10 bg-[#f4f0e7] px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
                  key={player}
                >
                  {player}
                </span>
              ))}
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full w-[68%] rounded-full bg-[#f4f0e7]/78" />
            </div>
          </section>

          <section className="rounded-[1.35rem] border border-white/8 bg-white/[0.035] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.35)] lg:row-span-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-white/38">possession flow</p>
              <div className="flex gap-2">
                {runs.map((run) => (
                  <span className="rounded-full bg-white/[0.055] px-3 py-1 font-mono text-[0.68rem] text-white/54" key={run.label}>
                    {run.value}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 min-h-0 space-y-3 overflow-y-auto pr-1">
              {possessions.map((possession) => (
                <article
                  className="grid grid-cols-[3.4rem_4.7rem_1fr_auto] items-center gap-3 border-b border-white/7 pb-3 last:border-b-0"
                  key={possession.id}
                >
                  <time className="font-mono text-sm text-white/42">{possession.time}</time>
                  <span className={["font-mono text-xs tracking-[0.16em]", toneClass(possession.tone)].join(" ")}>{possession.result}</span>
                  <p className="min-w-0 truncate text-sm text-white/78">{possession.detail}</p>
                  <span className="font-mono text-sm text-white/48">{possession.score}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[1.35rem] border border-white/8 bg-white/[0.035] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.35)]">
            <p className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-white/38">quick actions</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["Make", "Miss", "Foul", "Sub", "Timeout", "Turnover"].map((action) => (
                <button
                  className="rounded-full border border-white/9 bg-white/[0.04] px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/64 transition-colors hover:bg-white/[0.08] hover:text-white"
                  key={action}
                  type="button"
                >
                  {action}
                </button>
              ))}
            </div>
          </section>

          <section className="min-h-0 rounded-[1.35rem] border border-white/8 bg-white/[0.035] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.35)] lg:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-white/38">player line</p>
              <p className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-white/28">min / pf / +/- / fg / reb / ast</p>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-5">
              {players.map((player) => (
                <article className="rounded-[1rem] border border-white/7 bg-black/18 p-3" key={player.id}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold tracking-[-0.02em] text-[#fffaf0]">{player.name}</h2>
                    <span className="font-mono text-sm text-white/44">{formatPlusMinus(player.pm)}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-y-2 font-mono text-sm text-white/68">
                    <span>{player.min}</span>
                    <span>{player.fouls}f</span>
                    <span>{player.shots}</span>
                    <span>{player.reb}r</span>
                    <span>{player.ast}a</span>
                    <span>{player.pm > 0 ? "rise" : "hold"}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

function toneClass(tone: Possession["tone"]) {
  if (tone === "make") return "text-[#f4f0e7]"
  if (tone === "miss") return "text-white/36"
  if (tone === "pressure") return "text-[#d8c49b]"
  return "text-white/46"
}

function formatPlusMinus(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}
