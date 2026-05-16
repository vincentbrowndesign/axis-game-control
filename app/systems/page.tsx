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

export default async function SystemsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
            Systems
          </p>
          <h1 className="mt-4 text-5xl font-black tracking-[-0.04em] sm:text-7xl">
            Sign in to manage tactical systems.
          </h1>
          <Link
            href="/auth"
            className="mt-8 w-fit border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-white/70 transition hover:border-white/35 hover:text-white"
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
  const activeCorrection = active.clips[0]
    ? correctionFromSession(
        active.clips[0],
        active.repeatClips.some((clip) => clip.id === active.clips[0]?.id)
      )
    : null

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
              Systems mode
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Tactical systems
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              Manage the environments where corrections must survive pressure,
              time, and changing spacing.
            </p>
          </div>
          <ModeNav active="systems" />
        </header>

        <section className="mb-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b border-white/10 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
                  Current focus
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                  {active.system.name}
                </h2>
              </div>
              <Link
                href={systemHref(active.system)}
                className="border border-lime-300/25 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-lime-100 transition hover:border-lime-200/45"
              >
                Review clips
              </Link>
            </div>
            <div className="mt-4">
              <TacticalCourt
                title={active.system.name}
                highlight={active.system.courtZone}
                labels={[
                  active.triggers[0] || active.system.defaultTrigger,
                  active.constraint,
                  `Phase: ${active.phase}`,
                  `${active.repeatClips.length} repeat`,
                ]}
              />
            </div>
          </div>

          <aside className="border-b border-white/10 pb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
              System state
            </p>
            <div className="mt-4 grid gap-3 text-sm">
              <p className="text-lime-100/85">
                Trigger: {active.triggers[0] || active.system.defaultTrigger}
              </p>
              <p className="text-white/65">Constraint: {active.constraint}</p>
              <p className="text-white/65">Issue: {active.issue}</p>
              <p className="text-white/65">Phase: {active.phase}</p>
              <p className="text-white/65">
                Players: {active.players.length ? active.players.join(", ") : "None tagged"}
              </p>
              <p className="text-white/65">
                Repeat: {active.repeatClips.length} clips tomorrow
              </p>
              <p className="text-white/65">
                Construction: {active.activeConstruction.length ? "Active" : "Cleared"}
              </p>
            </div>
            {activeCorrection ? (
              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                  Latest correction
                </p>
                <p className="mt-2 text-sm text-white/70">
                  {activeCorrection.flaw || "No flaw tagged yet"}
                </p>
                <p className="mt-2 text-sm text-white/50">
                  {activeCorrection.correction || "Add correction in Review."}
                </p>
              </div>
            ) : null}
          </aside>
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          {summaries.map((summary) => (
            <Link
              key={summary.system.id}
              href={systemHref(summary.system)}
              className="border-b border-white/10 py-4 transition hover:border-white/25"
            >
              <TacticalCourt
                title={summary.system.name}
                highlight={summary.system.courtZone}
                labels={[
                  summary.triggers[0] || summary.system.defaultTrigger,
                  summary.constraint,
                ]}
              />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-white">{summary.system.name}</p>
                  <p className="mt-1 text-sm text-white/45">
                    {summary.issue}
                  </p>
                </div>
                <span className="text-xs font-black text-lime-100">
                  {summary.clips.length}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
                <span>{summary.repeatClips.length} repeat</span>
                <span>{summary.corrections.length} corrections</span>
                <span>{summary.phase}</span>
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-8 border-t border-white/10 pt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
            Retrieval queue
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {queue.slice(0, 6).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border border-white/10 px-3 py-3 text-sm text-white/60 transition hover:text-white"
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
