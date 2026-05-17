import Link from "next/link"
import ModeNav from "@/components/ModeNav"
import TacticalCourt from "@/components/TacticalCourt"
import {
  correctionFromSession,
  systemHref,
  systemSummaries,
} from "@/lib/axis/reinforcement"
import { retrievalQueue } from "@/lib/axis-ai/retrievalQueue"
import { normalizeSessions } from "@/lib/archive/sessionRollup"
import { createClient } from "@/lib/supabase/server"
import type { AxisReplaySession } from "@/types/memory"

const behaviorFolders: Record<string, string> = {
  "high-pnr": "Don't Get Screened",
  "weak-side-tag": "Help Then Recover",
  "screen-help": "Help Then Recover",
  "transition-defense": "Sprint Back First",
  "closeout-attack": "Stay Low",
  "paint-touch": "Attack Before They Set",
  "slot-drive": "Attack Before They Set",
  "baseline-drift": "Keep Moving",
  "corner-collapse": "Find The Next Pass",
  "ball-screen-reject": "Don't Get Screened",
  "dho-coverage": "Hit First",
}

function behaviorFolderName(systemId: string) {
  return behaviorFolders[systemId] || "Repeat The Behavior"
}

export default async function SystemsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-[#090806] px-5 py-10 text-stone-100">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-400/70">
            Background folders
          </p>
          <h1 className="mt-4 text-5xl font-black tracking-[-0.04em] sm:text-7xl">
            Sign in to manage behavior folders.
          </h1>
          <Link
            href="/auth"
            className="mt-8 w-fit border border-stone-200/15 px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-stone-200/70 transition hover:border-amber-100/35 hover:text-amber-100"
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  const { data } = await supabase
    .from("axis_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<AxisReplaySession[]>()

  const sessions = normalizeSessions(data)
  const summaries = systemSummaries(sessions)
  const queue = retrievalQueue(sessions)
  const active = summaries.find((summary) => summary.clips.length > 0) || summaries[0]
  const activeTrigger = active.triggers[0] || active.system.defaultTrigger
  const activeFolder = behaviorFolderName(active.system.id)
  const activePlayers = active.players.length
    ? active.players.join(" / ")
    : "No players tagged"
  const activeCorrection = active.clips[0]
    ? correctionFromSession(
        active.clips[0],
        active.repeatClips.some((clip) => clip.id === active.clips[0]?.id)
      )
    : null

  return (
    <main className="min-h-screen bg-[#090806] px-5 py-7 text-stone-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_52%_18%,rgba(188,125,46,0.13),transparent_34%),radial-gradient(circle_at_82%_72%,rgba(255,255,255,0.05),transparent_28%)]" />
      <div className="relative mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 border-b border-stone-200/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-400/65">
              Background folders
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
              Behavior reinforcement
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300/58">
              Player language stays out front. Tactical structure sits behind
              the clip so repeat work is easy to find later.
            </p>
          </div>
          <ModeNav active="systems" />
        </header>

        <section className="mb-8 grid gap-3 border-y border-stone-200/10 py-4 md:grid-cols-5">
          {[
            ["Player phrase", activeFolder],
            ["Coach view", active.system.name],
            ["Trigger", activeTrigger],
            ["Players", activePlayers],
            ["Repeat", `${active.repeatClips.length} clips`],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">
                {label}
              </p>
              <p className="mt-1 text-sm font-black text-stone-100">{value}</p>
            </div>
          ))}
        </section>

        <section className="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-100/55">
                  Behavior folder
                </p>
                <h2 className="mt-2 text-4xl font-black tracking-[-0.04em] text-stone-50 sm:text-5xl">
                  {activeFolder}
                </h2>
                <p className="mt-4 max-w-2xl text-xl font-black leading-snug tracking-[-0.03em] text-stone-200/80">
                  {activeCorrection?.correction ||
                    activeCorrection?.flaw ||
                    "Add a simple phrase players can repeat tomorrow."}
                </p>
              </div>
              <Link
                href={systemHref(active.system)}
                className="w-fit border border-amber-100/25 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-amber-100 transition hover:border-amber-100/55"
              >
                Review clips
              </Link>
            </div>

            <div className="mt-6 grid gap-4 border-y border-stone-200/10 py-5 md:grid-cols-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">
                  Player sees
                </p>
                <p className="mt-2 text-sm font-bold text-stone-200">
                  Short behavior phrase and clip.
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">
                  Coach sees
                </p>
                <p className="mt-2 text-sm font-bold text-stone-200">
                  {active.system.name} / {active.constraint}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">
                  Next rep
                </p>
                <p className="mt-2 text-sm font-bold text-stone-200">
                  Trigger {activeTrigger}
                </p>
              </div>
            </div>
          </div>

          <aside className="grid content-start gap-6 border-t border-stone-200/10 pt-5 lg:border-t-0 lg:pt-0">
            <TacticalCourt
              title={active.system.name}
              highlight={active.system.courtZone}
              labels={[active.constraint, `Trigger ${activeTrigger}`]}
              compact
            />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-stone-500">
                Current clip work
              </p>
              <p className="mt-3 text-2xl font-black leading-tight tracking-[-0.03em] text-stone-100">
                {active.issue === "No issue tagged yet"
                  ? "Waiting for behavior phrase"
                  : active.issue}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-400">
                Construction:{" "}
                {active.activeConstruction.length ? "Active" : "Cleared"}
              </p>
            </div>

            <div className="grid gap-3 border-y border-stone-200/10 py-5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">
                  Trigger
                </span>
                <span className="text-2xl font-black tracking-[0.08em] text-amber-100">
                  {activeTrigger}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">
                  Repeat queue
                </span>
                <span className="text-right text-sm font-black text-stone-100">
                  {active.repeatClips.length} clips tomorrow
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">
                  Players
                </span>
                <span className="text-right text-sm font-black text-stone-100">
                  {activePlayers}
                </span>
              </div>
            </div>

            {activeCorrection ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">
                  Latest correction
                </p>
                <p className="mt-3 text-sm leading-6 text-stone-200/78">
                  {activeCorrection.flaw || "No flaw tagged yet"}
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-400">
                  {activeCorrection.correction || "Add correction in Review."}
                </p>
              </div>
            ) : null}
          </aside>
        </section>

        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-stone-500">
                Folder map
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">
                Behavior folders
              </h2>
            </div>
          </div>
          <div className="grid gap-x-6 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
            {summaries.map((summary) => (
              <Link
                key={summary.system.id}
                href={systemHref(summary.system)}
                className="group border-t border-stone-200/10 pt-4 transition hover:border-amber-100/35"
              >
                <TacticalCourt
                  title={summary.system.name}
                  highlight={summary.system.courtZone}
                  labels={[
                    summary.triggers[0] || summary.system.defaultTrigger,
                    summary.constraint,
                  ]}
                  compact
                />
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-black tracking-[-0.03em] text-stone-100 transition group-hover:text-amber-100">
                      {behaviorFolderName(summary.system.id)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-400">
                      {summary.system.name} / {summary.constraint}
                    </p>
                  </div>
                  <span className="text-sm font-black text-stone-300">
                    {summary.phase}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                  <span>{summary.repeatClips.length} repeat</span>
                  <span>{summary.corrections.length} corrections</span>
                  <span>{summary.clips.length} clips</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-t border-stone-200/10 pt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-stone-500">
            Retrieval queue
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {queue.slice(0, 6).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-t border-stone-200/10 py-3 text-sm text-stone-300/70 transition hover:border-amber-100/30 hover:text-amber-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
