import Link from "next/link"
import { redirect } from "next/navigation"
import UploadConsole from "@/components/UploadConsole"
import {
  coachingNoteLine,
  drillName,
  phaseLabel,
  isRepeated,
  normalizeSessions,
  playerName,
  relativeTime,
  repeatCounts,
  tagCounts,
  triggerLabel,
} from "@/lib/archive/sessionRollup"
import { getCalibrationMissions } from "@/lib/missions/getCalibrationMissions"
import { createClient } from "@/lib/supabase/server"
import { getWarmupById } from "@/lib/world/getNextWarmup"
import type { AxisProfile, AxisReplaySession } from "@/types/memory"

type Props = {
  searchParams?: Promise<{
    warmup?: string
  }>
}

function PrimaryNav() {
  return (
    <nav className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
      <Link className="border border-white/10 px-3 py-2 text-white" href="/">
        Today
      </Link>
      <Link className="border border-white/10 px-3 py-2 hover:text-white" href="/sessions">
        Archive
      </Link>
      <Link className="border border-white/10 px-3 py-2 hover:text-white" href="/team/local">
        Team
      </Link>
    </nav>
  )
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return (
      <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
            Axis
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-[-0.04em] sm:text-7xl">
            Basketball film, notes, and team review.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
            Save sessions, find useful clips, and keep practice work organized.
          </p>
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

  const { data: profile } = await supabase
    .from("axis_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<AxisProfile>()

  if (!profile?.player_name || !profile.role) {
    redirect("/profile?next=/")
  }

  const warmup = getWarmupById(params?.warmup)

  if (warmup) {
    return (
      <UploadConsole
        email={user.email}
        twinName={profile.player_name || profile.display_name}
        initialWarmupId={warmup.id}
      />
    )
  }

  const { data } = await supabase
    .from("axis_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12)
    .returns<AxisReplaySession[]>()

  const sessions = normalizeSessions(data)
  const tags = tagCounts(sessions)
  const repeats = repeatCounts(sessions)
  const pendingReview = sessions.filter((session) => !session.coachNote).slice(0, 4)
  const repeatSessions = sessions
    .filter((session) => isRepeated(session, repeats, tags))
    .slice(0, 4)
  const notes = sessions.filter((session) => session.coachNote).slice(0, 4)
  const firstPractice = getCalibrationMissions()[0]
  const continueHref = firstPractice ? `/?warmup=${firstPractice.id}` : "/"
  const lastSession = sessions[0]
  const topReview = repeatSessions[0] || pendingReview[0] || lastSession

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
              Today
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Practice stream
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              Record clips, review notes, and keep repeat work close to practice.
            </p>
          </div>
          <PrimaryNav />
        </header>

        <section className="mb-5 grid gap-3 border-b border-white/10 pb-5 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35">
              Tomorrow prep
            </p>
            <div className="mt-3 grid gap-2 text-sm text-white/65 sm:grid-cols-3">
              <Link href="/sessions?view=repeated" className="hover:text-white">
                {repeatSessions.length
                  ? `${repeatSessions.length} clips tagged repeat`
                  : "No repeat clips tagged yet"}
              </Link>
              <Link href="/sessions?note=missing" className="hover:text-white">
                {pendingReview.length
                  ? `${pendingReview.length} clips need coach notes`
                  : "Coach notes are current"}
              </Link>
              <Link href={topReview ? `/replay/${topReview.id}` : "/sessions"} className="hover:text-white">
                {topReview
                  ? `Review ${playerName(topReview)} - ${drillName(topReview)}`
                  : "Record today's practice"}
              </Link>
            </div>
          </div>
          <Link
            href={continueHref}
            className="w-fit border border-lime-300/20 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-lime-100 transition hover:border-lime-200/45"
          >
            Record clip
          </Link>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-3">
            <section className="border-b border-white/10 pb-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                  Recent clips
                </h2>
                <Link href="/sessions" className="text-xs font-bold text-white/45 hover:text-white">
                  Review archive
                </Link>
              </div>
              <div className="mt-3 grid gap-2">
                {sessions.slice(0, 5).map((session) => (
                  <Link
                    key={session.id}
                    href={`/replay/${session.id}`}
                    className="grid gap-2 border-t border-white/10 py-3 transition hover:border-white/25 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="font-bold text-white">{drillName(session)}</p>
                      <p className="mt-1 text-sm text-white/45">
                        {playerName(session)} / {session.environment}
                      </p>
                      {triggerLabel(session) ? (
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-lime-100">
                          Trigger: {triggerLabel(session)}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-sm text-white/40">{relativeTime(session.createdAt)}</p>
                  </Link>
                ))}
                {sessions.length === 0 && (
                  <p className="text-sm text-white/45">No sessions yet.</p>
                )}
              </div>
            </section>

            <section className="border-b border-white/10 pb-4">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                Needs review
              </h2>
              <div className="mt-3 grid gap-2">
                {pendingReview.map((session) => (
                  <Link
                    key={session.id}
                    href={`/sessions?note=missing&q=${encodeURIComponent(drillName(session))}`}
                    className="border-t border-white/10 py-3 transition hover:text-white"
                  >
                    <p className="font-bold text-white">{drillName(session)}</p>
                    <p className="mt-1 text-sm text-white/45">
                      Add flaw, correction, and trigger for {playerName(session)}.
                    </p>
                  </Link>
                ))}
                {pendingReview.length === 0 && (
                  <p className="text-sm text-white/45">No pending review.</p>
                )}
              </div>
            </section>
          </div>

          <aside className="grid h-fit gap-3">
            <section className="border-b border-white/10 pb-4">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                Coach notes
              </h2>
              <div className="mt-3 grid gap-2">
                {notes.map((session) => (
                  <Link
                    key={session.id}
                    href={`/replay/${session.id}`}
                    className="border-t border-white/10 py-3 transition hover:text-white"
                  >
                    <p className="text-sm text-white/75">{session.coachNote}</p>
                    <p className="mt-2 text-xs text-white/35">
                      {playerName(session)} / {drillName(session)}
                    </p>
                    {triggerLabel(session) ? (
                      <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-lime-100">
                        Trigger: {triggerLabel(session)}
                      </p>
                    ) : null}
                  </Link>
                ))}
                {notes.length === 0 && (
                  <p className="text-sm text-white/45">No coach notes yet.</p>
                )}
              </div>
            </section>

            <section className="border-b border-white/10 pb-4">
              <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/65">
                Repeat clips
              </h2>
              <div className="mt-3 grid gap-2">
                {repeatSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/sessions?view=repeated&player=${encodeURIComponent(playerName(session))}`}
                    className="border-t border-white/10 py-3 transition hover:text-white"
                  >
                    <p className="font-bold text-white">{drillName(session)}</p>
                    <p className="mt-1 text-sm text-white/45">
                      {playerName(session)} / Phase: {phaseLabel(session)}
                    </p>
                    <p className="mt-1 text-sm text-white/55">
                      {coachingNoteLine(session)}
                    </p>
                  </Link>
                ))}
                {repeatSessions.length === 0 && (
                  <p className="text-sm text-white/45">No tagged repeats yet.</p>
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
