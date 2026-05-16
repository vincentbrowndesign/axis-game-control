import Link from "next/link"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  dateLabel,
  drillName,
  isRecent,
  isRepeated,
  normalizeSessions,
  playerName,
  playerSummaries,
  relativeTime,
  repeatCounts,
  tagCounts,
} from "@/lib/archive/sessionRollup"
import {
  type AxisReplaySession,
  type ReplaySessionView,
  type SessionEnvironment,
} from "@/types/memory"

type ArchiveSort = "date" | "player" | "drill" | "practice" | "scrimmage" | "game"
type ArchiveView = "all" | "recent" | "repeated"

const SORT_OPTIONS: { value: ArchiveSort; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "player", label: "Player" },
  { value: "drill", label: "Drill" },
  { value: "practice", label: "Practice" },
  { value: "scrimmage", label: "Scrimmage" },
  { value: "game", label: "Game" },
]

const VIEW_OPTIONS: { value: ArchiveView; label: string }[] = [
  { value: "all", label: "All sessions" },
  { value: "recent", label: "Recent" },
  { value: "repeated", label: "Repeated" },
]

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || ""
}

function sortParam(value: string): ArchiveSort {
  return SORT_OPTIONS.some((option) => option.value === value)
    ? (value as ArchiveSort)
    : "date"
}

function viewParam(value: string): ArchiveView {
  return VIEW_OPTIONS.some((option) => option.value === value)
    ? (value as ArchiveView)
    : "all"
}

function formatDuration(seconds?: number) {
  if (!seconds) return "0s"

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return mins <= 0 ? `${secs}s` : `${mins}m ${secs}s`
}

function sessionText(session: ReplaySessionView) {
  return [
    session.title,
    session.mission,
    session.environment,
    session.coachNote,
    playerName(session),
    ...session.tags,
  ]
    .join(" ")
    .toLowerCase()
}

function matchesType(session: ReplaySessionView, type: string) {
  if (!type) return true

  const normalized = type.toLowerCase()

  if (normalized === "scrimmage") {
    return sessionText(session).includes("scrimmage")
  }

  return session.environment === normalized
}

function sortSessions(sessions: ReplaySessionView[], sort: ArchiveSort) {
  const ordered = [...sessions]

  if (sort === "player") {
    return ordered.sort((a, b) => playerName(a).localeCompare(playerName(b)))
  }

  if (sort === "drill") {
    return ordered.sort((a, b) => drillName(a).localeCompare(drillName(b)))
  }

  if (sort === "practice" || sort === "game") {
    return ordered.sort((a, b) => {
      const aMatch = a.environment === sort ? 0 : 1
      const bMatch = b.environment === sort ? 0 : 1
      return aMatch - bMatch || b.createdAt - a.createdAt
    })
  }

  if (sort === "scrimmage") {
    return ordered.sort((a, b) => {
      const aMatch = sessionText(a).includes("scrimmage") ? 0 : 1
      const bMatch = sessionText(b).includes("scrimmage") ? 0 : 1
      return aMatch - bMatch || b.createdAt - a.createdAt
    })
  }

  return ordered.sort((a, b) => b.createdAt - a.createdAt)
}

function hrefWithSort(sort: ArchiveSort, filters: Record<string, string>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries({ ...filters, sort })) {
    if (value) params.set(key, value)
  }

  return `/sessions?${params.toString()}`
}

async function saveCoachNote(formData: FormData) {
  "use server"

  const sessionId = String(formData.get("sessionId") || "")
  const coachNote = String(formData.get("coachNote") || "")
    .trim()
    .slice(0, 180)

  if (!sessionId) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const existing = await supabase
    .from("axis_sessions")
    .select("metadata")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single<{ metadata: Record<string, unknown> | null }>()

  const metadata =
    existing.data?.metadata && typeof existing.data.metadata === "object"
      ? existing.data.metadata
      : {}

  await supabase
    .from("axis_sessions")
    .update({
      metadata: { ...metadata, coachNote },
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)

  revalidatePath("/sessions")
  revalidatePath("/archive")
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sort = sortParam(textParam(params.sort))
  const view = viewParam(textParam(params.view))
  const filters = {
    q: textParam(params.q).trim(),
    player: textParam(params.player).trim(),
    drill: textParam(params.drill).trim(),
    tag: textParam(params.tag).trim(),
    note: textParam(params.note).trim(),
    type: textParam(params.type).trim(),
    view,
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
            Archive
          </p>
          <h1 className="mt-4 text-5xl font-black tracking-[-0.04em] sm:text-7xl">
            Sign in to review sessions.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
            Open the archive to find clips, notes, players, and practice work.
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

  const { data } = await supabase
    .from("axis_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<AxisReplaySession[]>()

  const rowsWithUrls = await Promise.all(
    (data || []).map(async (session) => {
      if (session.file_path) {
        const signed = await supabaseAdmin.storage
          .from("axis-replays")
          .createSignedUrl(session.file_path, 60 * 60 * 24 * 7)

        session.video_url = signed.data?.signedUrl || session.video_url
      }

      return session
    })
  )
  const sessions = normalizeSessions(rowsWithUrls)

  const sessionRepeats = repeatCounts(sessions)
  const tags = tagCounts(sessions)
  const visibleSessions = sortSessions(
    sessions.filter((session) => {
      const lowerText = sessionText(session)
      const player = filters.player.toLowerCase()
      const drill = filters.drill.toLowerCase()
      const tag = filters.tag.toLowerCase()
      const note = filters.note.toLowerCase()
      const query = filters.q.toLowerCase()

      return (
        (!query || lowerText.includes(query)) &&
        (!player || playerName(session).toLowerCase().includes(player)) &&
        (!drill || drillName(session).toLowerCase().includes(drill)) &&
        (!tag ||
          session.tags.some((item) => item.toLowerCase().includes(tag))) &&
        (!note || session.coachNote?.toLowerCase().includes(note)) &&
        matchesType(session, filters.type) &&
        (view !== "recent" || isRecent(session)) &&
        (view !== "repeated" || isRepeated(session, sessionRepeats, tags))
      )
    }),
    sort
  )
  const players = playerSummaries(sessions)
  const taggedRepeats = sessions.filter((session) =>
    session.tags.some((tag) => tags[tag.toLowerCase()] > 1)
  ).length
  const recentSessions = sessions.filter(isRecent).length

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
              Archive
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Session review
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              Find clips by player, drill, tag, note, and practice type.
            </p>
          </div>

          <Link
            href="/"
            className="w-fit border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-white/70 transition hover:border-white/35 hover:text-white"
          >
            Add session
          </Link>
        </header>

        <section className="mb-4 grid gap-2 md:grid-cols-4">
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Sessions
            </p>
            <p className="mt-1 text-2xl font-black">{sessions.length}</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Players
            </p>
            <p className="mt-1 text-2xl font-black">{players.length}</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Recent
            </p>
            <p className="mt-1 text-2xl font-black">{recentSessions}</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Tagged repeats
            </p>
            <p className="mt-1 text-2xl font-black">{taggedRepeats}</p>
          </div>
        </section>

        <section className="mb-4 border border-white/10 bg-white/[0.03] p-3">
          <form action="/sessions" className="grid gap-2 lg:grid-cols-6">
            <input type="hidden" name="sort" value={sort} />
            <label className="grid gap-2 text-[10px] uppercase tracking-[0.22em] text-white/35 lg:col-span-2">
              Search
              <input
                name="q"
                defaultValue={filters.q}
                placeholder="footwork, repeat, left"
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25"
              />
            </label>
            <label className="grid gap-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Player
              <input
                name="player"
                defaultValue={filters.player}
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none"
              />
            </label>
            <label className="grid gap-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Drill
              <input
                name="drill"
                defaultValue={filters.drill}
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none"
              />
            </label>
            <label className="grid gap-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Tag
              <input
                name="tag"
                defaultValue={filters.tag}
                placeholder="repeat"
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25"
              />
            </label>
            <label className="grid gap-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Note
              <input
                name="note"
                defaultValue={filters.note}
                placeholder="feet"
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25"
              />
            </label>
            <label className="grid gap-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Type
              <select
                name="type"
                defaultValue={filters.type}
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none"
              >
                <option value="">Any</option>
                {(["practice", "scrimmage", "game", "workout"] satisfies (
                  | SessionEnvironment
                  | "scrimmage"
                )[]).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Review
              <select
                name="view"
                defaultValue={view}
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none"
              >
                {VIEW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2 lg:col-span-4">
              <button className="border border-white/15 px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white/75 transition hover:border-white/35 hover:text-white">
                Find clips
              </button>
              <Link
                href="/sessions"
                className="border border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white/40 transition hover:text-white"
              >
                Clear
              </Link>
            </div>
          </form>
        </section>

        <nav className="mb-4 flex flex-wrap gap-2" aria-label="Sort sessions">
          {SORT_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={hrefWithSort(option.value, filters)}
              className={`border px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] transition ${
                sort === option.value
                  ? "border-white/35 text-white"
                  : "border-white/10 text-white/45 hover:text-white"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <section className="mb-8 grid gap-3 lg:grid-cols-[1fr_300px]">
          <div className="grid gap-3">
            {visibleSessions.map((session) => (
              <article
                key={session.id}
                className="grid overflow-hidden border border-white/10 bg-white/[0.03] md:grid-cols-[180px_1fr]"
              >
                <Link
                  href={`/replay/${session.id}`}
                  className="relative aspect-video bg-black md:aspect-auto"
                >
                  {session.videoUrl ? (
                    <video
                      src={session.videoUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover opacity-70"
                    />
                  ) : (
                    <div className="h-full w-full bg-white/[0.04]" />
                  )}
                </Link>

                <div className="grid gap-3 p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/55">
                      {session.environment}
                    </span>
                    <span className="border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/55">
                      {dateLabel(session.createdAt)}
                    </span>
                    <span className="border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/55">
                      {formatDuration(session.duration)}
                    </span>
                    {isRepeated(session, sessionRepeats, tags) && (
                      <span className="border border-lime-300/25 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-lime-200">
                        repeat
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                      {playerName(session)}
                    </p>
                    <Link
                      href={`/replay/${session.id}`}
                      className="mt-1 block text-xl font-black tracking-[-0.03em] text-white transition hover:text-lime-200"
                    >
                      {drillName(session)}
                    </Link>
                    <p className="mt-1 text-sm text-white/45">
                      {relativeTime(session.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {session.tags.length ? (
                      session.tags.map((tag) => (
                        <Link
                          key={tag}
                          href={`/sessions?tag=${encodeURIComponent(tag)}`}
                          className="border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/45 transition hover:text-white"
                        >
                          {tag}
                        </Link>
                      ))
                    ) : (
                      <span className="text-sm text-white/30">No tags yet</span>
                    )}
                  </div>

                  <form action={saveCoachNote} className="grid gap-2">
                    <input type="hidden" name="sessionId" value={session.id} />
                    <label className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                      Coach note
                    </label>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input
                        name="coachNote"
                        defaultValue={session.coachNote || ""}
                        placeholder="Lost rhythm left."
                        className="border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none placeholder:text-white/25"
                      />
                      <button className="border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-white/70 transition hover:border-white/35 hover:text-white">
                        Save note
                      </button>
                    </div>
                  </form>
                </div>
              </article>
            ))}

            {visibleSessions.length === 0 && (
              <div className="border border-white/10 bg-white/[0.03] p-8">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                  No clips found
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
                  Try a different player, drill, tag, or note.
                </h2>
              </div>
            )}
          </div>

          <aside className="grid h-fit gap-3">
            <section className="border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Team
              </p>
              <div className="mt-4 grid gap-3 text-sm text-white/60">
                <div className="flex justify-between gap-3">
                  <span>Players</span>
                  <span className="font-bold text-white">{players.length}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Recent sessions</span>
                  <span className="font-bold text-white">{recentSessions}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Tagged repeats</span>
                  <span className="font-bold text-white">{taggedRepeats}</span>
                </div>
              </div>
            </section>

            <section className="border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Players
              </p>
              <div className="mt-4 grid gap-3">
                {players.map((player) => (
                  <Link
                    key={player.name}
                    href={`/sessions?player=${encodeURIComponent(player.name)}`}
                    className="border border-white/10 bg-black/35 p-3 transition hover:border-white/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-white">{player.name}</p>
                        <p className="mt-1 text-xs text-white/40">
                          Last practice: {player.lastPractice}
                        </p>
                      </div>
                      <span className="text-sm font-black text-white">
                        {player.sessions}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-white/35">
                      <span>{player.recentSessions} recent</span>
                      <span>{player.streak} day streak</span>
                    </div>
                    {player.recentTags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {player.recentTags.map((tag) => (
                          <span
                            key={tag}
                            className="border border-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-white/40"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
                {players.length === 0 && (
                  <p className="text-sm text-white/40">No players yet.</p>
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
