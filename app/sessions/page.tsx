import Link from "next/link"
import { revalidatePath } from "next/cache"
import ModeNav from "@/components/ModeNav"
import {
  appendTimelineEvents,
  makeTimelineEvent,
} from "@/lib/axis/reinforcement"
import { buildBehaviorMemory } from "@/lib/axis-ai/buildBehaviorMemory"
import { buildReviewQueue } from "@/lib/axis-ai/buildReviewQueue"
import { clusterBehaviorMoments } from "@/lib/axis-ai/clusterBehaviorMoments"
import {
  WORKFLOW_STAGES,
  mapWorkflowStage,
  stageForSession,
  workflowStageLabel,
} from "@/lib/axis-ai/mapWorkflowStage"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  BASKETBALL_SITUATIONS,
  CONSTRUCTION_ZONE_STATUSES,
  ENVIRONMENTAL_CONSTRAINTS,
  STRESS_PHASES,
  coachingNoteLine,
  constraintLabel,
  constructionZoneLabel,
  dateLabel,
  drillName,
  phaseLabel,
  isRecent,
  isRepeated,
  normalizeSessions,
  playerName,
  playerSummaries,
  relativeTime,
  repeatCounts,
  situationLabel,
  tagCounts,
  triggerLabel,
} from "@/lib/archive/sessionRollup"
import {
  type AxisReplaySession,
  type ConstructionZoneStatus,
  type ReplaySessionView,
  type SessionEnvironment,
  type StressPhase,
  type WorkflowStage,
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

function PrimaryNav() {
  return (
    <ModeNav active="review" />
  )
}

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

function sessionText(session: ReplaySessionView) {
  return [
    session.title,
    session.mission,
    session.environment,
    workflowStageLabel(stageForSession(session)),
    session.situation,
    session.constraint,
    session.coachNote,
    session.coachFlaw,
    session.coachCorrection,
    session.triggerWord,
    session.repeatTomorrow ? "repeat tomorrow" : "",
    session.stressPhase,
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

function collectionLabel(session: ReplaySessionView) {
  if (session.environment === "game") return "Game"
  if (sessionText(session).includes("scrimmage")) return "Scrimmage"

  return "Practice"
}

function clipReason(
  session: ReplaySessionView,
  sessionRepeats: Record<string, number>,
  tags: Record<string, number>
) {
  if (session.coachFlaw || session.coachCorrection || session.coachNote) {
    return coachingNoteLine(session)
  }

  if (isRepeated(session, sessionRepeats, tags)) return "Watch again"

  return "Needs review"
}

function nextAction(
  session: ReplaySessionView,
  sessionRepeats: Record<string, number>,
  tags: Record<string, number>
) {
  if (!session.coachNote) return "Add note"
  if (isRepeated(session, sessionRepeats, tags)) return "Review before practice"

  return "Review clip"
}

function sourceContext(session: ReplaySessionView) {
  return `${playerName(session)} / ${collectionLabel(session)} / ${dateLabel(
    session.createdAt
  )} / ${relativeTime(session.createdAt)}`
}

function behaviorMomentLine(session: ReplaySessionView) {
  return (
    session.coachNote ||
    session.behaviorSentence ||
    session.coachCorrection ||
    session.coachFlaw ||
    "Add the behavior phrase players should repeat."
  )
}

function isClipProcessing(status?: string) {
  return status === "uploaded" || status === "processing" || status === "created"
}

function isClipError(status?: string) {
  return status === "error"
}

async function saveCoachNote(formData: FormData) {
  "use server"

  const sessionId = String(formData.get("sessionId") || "")
  const coachNote = String(formData.get("coachNote") || "")
    .trim()
    .slice(0, 180)
  const situation = String(formData.get("situation") || "")
    .trim()
    .slice(0, 80)
  const constraint = String(formData.get("constraint") || "")
    .trim()
    .slice(0, 80)
  const coachFlaw = String(formData.get("coachFlaw") || "")
    .trim()
    .slice(0, 140)
  const coachCorrection = String(formData.get("coachCorrection") || "")
    .trim()
    .slice(0, 160)
  const triggerWord = String(formData.get("triggerWord") || "")
    .trim()
    .toUpperCase()
    .slice(0, 18)
  const constructionZoneStatusValue = String(
    formData.get("constructionZoneStatus") || "Cleared"
  )
  const constructionZoneStatus: ConstructionZoneStatus =
    CONSTRUCTION_ZONE_STATUSES.includes(
      constructionZoneStatusValue as ConstructionZoneStatus
    )
      ? (constructionZoneStatusValue as ConstructionZoneStatus)
      : "Cleared"
  const stressPhaseValue = String(formData.get("stressPhase") || "Block")
  const stressPhase: StressPhase = STRESS_PHASES.includes(
    stressPhaseValue as StressPhase
  )
    ? (stressPhaseValue as StressPhase)
    : "Block"
  const shouldRepeat = formData.get("repeatTomorrow") === "on"
  const workflowStage = mapWorkflowStage(formData.get("workflowStage"))

  if (!sessionId) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const existing = await supabase
    .from("axis_sessions")
    .select("metadata,tags")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single<{ metadata: Record<string, unknown> | null; tags: string[] | null }>()

  const metadata =
    existing.data?.metadata && typeof existing.data.metadata === "object"
      ? existing.data.metadata
      : {}

  const tags = Array.isArray(existing.data?.tags)
    ? existing.data.tags.filter((tag) => tag.toLowerCase() !== "repeat")
    : []

  if (shouldRepeat) tags.push("repeat")
  const timelineEvents = [
    coachFlaw
      ? makeTimelineEvent("FLAW_TAGGED", `Flaw: ${coachFlaw}`)
      : null,
    coachCorrection
      ? makeTimelineEvent("CORRECTION_ADDED", `Correction: ${coachCorrection}`)
      : null,
    triggerWord
      ? makeTimelineEvent("TRIGGER_ASSIGNED", `Trigger: ${triggerWord}`)
      : null,
    constraint
      ? makeTimelineEvent("CONSTRAINT_ADDED", `Constraint: ${constraint}`)
      : null,
    shouldRepeat
      ? makeTimelineEvent("REPEAT_MARKED", "Repeat tomorrow")
      : null,
    makeTimelineEvent("STRESS_PHASE_CHANGED", `Phase: ${stressPhase}`),
    makeTimelineEvent(
      "CONSTRUCTION_CHANGED",
      `Construction: ${constructionZoneStatus}`
    ),
  ].filter((event): event is NonNullable<typeof event> => Boolean(event))

  await supabase
    .from("axis_sessions")
    .update({
      tags,
      workflow_stage: workflowStage,
      metadata: {
        ...metadata,
        coachNote,
        situation,
        constraint,
        coachFlaw,
        coachCorrection,
        triggerWord,
        repeatTomorrow: shouldRepeat,
        constructionZone: constructionZoneStatus !== "Cleared",
        constructionZoneStatus,
        stressPhase,
        workflowStage,
        correctionTimelineEvents: appendTimelineEvents(
          metadata,
          timelineEvents
        ),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)

  revalidatePath("/sessions")
  revalidatePath("/systems")
  revalidatePath("/team/local")
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
    situation: textParam(params.situation).trim(),
    constraint: textParam(params.constraint).trim(),
    trigger: textParam(params.trigger).trim(),
    tag: textParam(params.tag).trim(),
    note: textParam(params.note).trim(),
    type: textParam(params.type).trim(),
    phase: textParam(params.phase).trim(),
    construction: textParam(params.construction).trim(),
    stage: textParam(params.stage).trim(),
    view,
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-[#090806] px-5 py-10 text-white">
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
      const situation = filters.situation.toLowerCase()
      const constraint = filters.constraint.toLowerCase()
      const trigger = filters.trigger.toLowerCase()
      const tag = filters.tag.toLowerCase()
      const note = filters.note.toLowerCase()
      const query = filters.q.toLowerCase()

      return (
        (!query || lowerText.includes(query)) &&
        (!player || playerName(session).toLowerCase().includes(player)) &&
        (!drill || drillName(session).toLowerCase().includes(drill)) &&
        (!situation ||
          situationLabel(session).toLowerCase().includes(situation)) &&
        (!constraint ||
          constraintLabel(session).toLowerCase().includes(constraint)) &&
        (!trigger || triggerLabel(session).toLowerCase().includes(trigger)) &&
        (!tag ||
          session.tags.some((item) => item.toLowerCase().includes(tag))) &&
        (!note ||
          (note === "missing"
            ? !session.coachNote
            : session.coachNote?.toLowerCase().includes(note))) &&
        matchesType(session, filters.type) &&
        (!filters.phase || phaseLabel(session) === filters.phase) &&
        (!filters.construction ||
          (filters.construction === "active"
            ? constructionZoneLabel(session) === "Active"
            : filters.construction === "stabilizing"
              ? constructionZoneLabel(session) === "Stabilizing"
              : constructionZoneLabel(session) === "Cleared")) &&
        (!filters.stage ||
          stageForSession(session) === mapWorkflowStage(filters.stage)) &&
        (view !== "recent" || isRecent(session)) &&
        (view !== "repeated" || isRepeated(session, sessionRepeats, tags))
      )
    }),
    sort
  )
  const players = playerSummaries(sessions)
  const behaviorClusters = clusterBehaviorMoments(sessions)
  const reviewQueue = buildReviewQueue(sessions).slice(0, 5)
  const behaviorMemory = buildBehaviorMemory({ sessions })
  const lastPractice = sessions.find((session) => session.environment === "practice")
  const filtersActive = Boolean(
    filters.q ||
      filters.player ||
      filters.drill ||
      filters.situation ||
      filters.constraint ||
      filters.trigger ||
      filters.tag ||
      filters.note ||
      filters.type ||
      filters.phase ||
      filters.construction ||
      filters.stage ||
      view !== "all"
  )

  return (
    <main className="min-h-screen bg-[#090806] px-5 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Watch again
            </h1>
          </div>

          <div className="grid gap-3 lg:justify-items-end">
            <PrimaryNav />
            <Link
              href="/"
              className="w-fit bg-amber-200 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-black transition hover:bg-white"
            >
              Record clip
            </Link>
          </div>
        </header>

        <section className="mb-6">
          <form action="/sessions" className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input type="hidden" name="sort" value={sort} />
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Search clips, sentences, players"
              className="bg-black/25 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25"
            />
            <button className="bg-white/[0.08] px-5 py-3 text-sm font-bold text-white/75 transition hover:bg-white hover:text-black">
              Find
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/50">
            <Link
              href="/sessions?view=recent"
              className="transition hover:text-white"
            >
              Recent
            </Link>
            <Link
              href="/sessions?view=repeated"
              className="transition hover:text-white"
            >
              Watch again
            </Link>
            <Link
              href="/sessions?note=missing"
              className="transition hover:text-white"
            >
              Need a sentence
            </Link>
            <Link
              href={lastPractice ? `/replay/${lastPractice.id}` : "/sessions?type=practice"}
              className="transition hover:text-white"
            >
              Last practice
            </Link>
            {WORKFLOW_STAGES.slice(0, 4).map((stage) => (
              <Link
                key={stage.value}
                href={`/sessions?stage=${stage.value}`}
                className="transition hover:text-white"
              >
                {stage.label}
              </Link>
            ))}
          </div>

        </section>

        <details
          className="mb-6"
          open={filtersActive}
        >
          <summary className="cursor-pointer text-sm text-white/40 transition hover:text-white">
            More search
          </summary>
          <form
            action="/sessions"
            className="mt-3 grid gap-2 lg:grid-cols-[repeat(4,minmax(0,1fr))]"
          >
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="q" value={filters.q} />
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Player
              <input
                name="player"
                defaultValue={filters.player}
                className="bg-black/35 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none"
              />
            </label>
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Drill
              <input
                name="drill"
                defaultValue={filters.drill}
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none"
              />
            </label>
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Clip type
              <select
                name="situation"
                defaultValue={filters.situation}
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none"
              >
                <option value="">Any</option>
                {BASKETBALL_SITUATIONS.map((situation) => (
                  <option key={situation} value={situation}>
                    {situation}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Tag
              <input
                name="tag"
                defaultValue={filters.tag}
                placeholder="repeat"
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25"
              />
            </label>
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Focus
              <select
                name="constraint"
                defaultValue={filters.constraint}
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none"
              >
                <option value="">Any</option>
                {ENVIRONMENTAL_CONSTRAINTS.map((constraint) => (
                  <option key={constraint} value={constraint}>
                    {constraint}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Cue
              <input
                name="trigger"
                defaultValue={filters.trigger}
                placeholder="SINK"
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25"
              />
            </label>
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Note
              <input
                name="note"
                defaultValue={filters.note}
                placeholder="feet or missing"
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25"
              />
            </label>
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Speed
              <select
                name="phase"
                defaultValue={filters.phase}
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none"
              >
                <option value="">Any</option>
                {STRESS_PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {phase}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Status
              <select
                name="construction"
                defaultValue={filters.construction}
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none"
              >
                <option value="">Any</option>
                <option value="active">Active</option>
                <option value="stabilizing">Stabilizing</option>
                <option value="cleared">Cleared</option>
              </select>
            </label>
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
              Stage
              <select
                name="stage"
                defaultValue={filters.stage}
                className="border border-white/10 bg-black px-3 py-2 text-sm normal-case tracking-normal text-white outline-none"
              >
                <option value="">Any</option>
                {WORKFLOW_STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
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
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
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
            <div className="flex items-end gap-2">
              <button className="border border-white/15 px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white/75 transition hover:border-white/35 hover:text-white">
                Find
              </button>
              <Link
                href="/sessions"
                className="border border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white/40 transition hover:text-white"
              >
                Clear
              </Link>
            </div>
          </form>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Sort clips">
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
          </div>
        </details>

        <section className="mb-8 grid gap-8 lg:grid-cols-[1fr_260px]">
          <div className="grid gap-8">
            {visibleSessions.map((session) => (
              <article
                key={session.id}
                className="grid gap-5 py-3 lg:grid-cols-[minmax(260px,420px)_1fr]"
              >
                <Link
                  href={`/replay/${session.id}`}
                  className="relative aspect-video bg-black/80"
                >
                  {isClipProcessing(session.status) ? (
                    <div className="grid h-full w-full place-items-center border border-white/10 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Clip processing...
                    </div>
                  ) : isClipError(session.status) ? (
                    <div className="grid h-full w-full place-items-center border border-white/10 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Clip unavailable
                    </div>
                  ) : session.videoUrl ? (
                    <video
                      src={session.videoUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover opacity-85"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center border border-white/10 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Clip saved
                    </div>
                  )}
                </Link>

                <div className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/replay/${session.id}`}
                        className="block text-3xl font-black leading-tight tracking-[-0.04em] text-white transition hover:text-amber-100"
                      >
                        {behaviorMomentLine(session)}
                      </Link>
                      <p className="mt-1 text-sm text-white/45">
                        {sourceContext(session)}
                      </p>
                      <p className="mt-1 text-xs text-white/30">
                        {workflowStageLabel(stageForSession(session))}
                      </p>
                    </div>
                    {isRepeated(session, sessionRepeats, tags) ? (
                      <Link
                        href={`/sessions?view=repeated&player=${encodeURIComponent(playerName(session))}`}
                        className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100"
                      >
                        Watch
                      </Link>
                    ) : null}
                  </div>

                  <div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {triggerLabel(session) ? (
                        <span className="text-xs font-bold text-amber-100/75">
                          {triggerLabel(session)}
                        </span>
                      ) : null}
                      <span className="text-xs font-bold text-white/35">
                        {nextAction(session, sessionRepeats, tags)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/45">
                      {clipReason(session, sessionRepeats, tags)}
                    </p>
                  </div>

                  <details className="pt-1">
                    <summary className="cursor-pointer text-sm text-white/35 transition hover:text-white">
                      More details
                    </summary>
                    <form action={saveCoachNote} className="mt-3 grid gap-2">
                      <input type="hidden" name="sessionId" value={session.id} />
                      <div className="grid gap-2 md:grid-cols-2">
                        <select
                          name="workflowStage"
                          defaultValue={stageForSession(session)}
                          className="border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none"
                        >
                          {WORKFLOW_STAGES.map((stage) => (
                            <option key={stage.value} value={stage.value}>
                              {stage.label}
                            </option>
                          ))}
                        </select>
                        <select
                          name="situation"
                          defaultValue={session.situation || ""}
                          className="border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none"
                        >
                          <option value="">Clip type</option>
                          {BASKETBALL_SITUATIONS.map((situation) => (
                            <option key={situation} value={situation}>
                              {situation}
                            </option>
                          ))}
                        </select>
                        <select
                          name="constraint"
                          defaultValue={session.constraint || ""}
                          className="border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none"
                        >
                          <option value="">Focus</option>
                          {ENVIRONMENTAL_CONSTRAINTS.map((constraint) => (
                            <option key={constraint} value={constraint}>
                              {constraint}
                            </option>
                          ))}
                        </select>
                        <input
                          name="coachFlaw"
                          defaultValue={session.coachFlaw || ""}
                          placeholder="Flaw: Stood tall on catch."
                          className="border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                        />
                        <input
                          name="coachCorrection"
                          defaultValue={session.coachCorrection || ""}
                          placeholder="Correction: Drop hips before catch."
                          className="border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                        />
                        <input
                          name="coachNote"
                          defaultValue={session.coachNote || ""}
                          placeholder="Sentence: Stay low and explode."
                          className="border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                        />
                        <input
                          name="triggerWord"
                          defaultValue={triggerLabel(session)}
                          placeholder="Cue: SINK"
                          className="border border-white/10 bg-black px-3 py-2 text-sm font-black uppercase tracking-[0.12em] text-white outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-white/25"
                        />
                      </div>
                      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                        <label className="flex items-center gap-2 border border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/55">
                          <input
                            type="checkbox"
                            name="repeatTomorrow"
                            defaultChecked={
                              Boolean(session.repeatTomorrow) ||
                              isRepeated(session, sessionRepeats, tags)
                            }
                            className="accent-amber-200"
                          />
                          Repeat
                        </label>
                        <select
                          name="constructionZoneStatus"
                          defaultValue={constructionZoneLabel(session)}
                          className="border border-white/10 bg-black px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/70 outline-none"
                        >
                          {CONSTRUCTION_ZONE_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <select
                          name="stressPhase"
                          defaultValue={phaseLabel(session)}
                          className="border border-white/10 bg-black px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/70 outline-none"
                        >
                          {STRESS_PHASES.map((phase) => (
                            <option key={phase} value={phase}>
                              {phase}
                            </option>
                          ))}
                        </select>
                        <button className="border border-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/70 transition hover:border-white/35 hover:text-white">
                          Save
                        </button>
                      </div>
                    </form>
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                        Saved history
                      </p>
                      <div className="mt-2 grid gap-1.5 text-xs text-white/45">
                        {(session.correctionTimelineEvents?.length
                          ? session.correctionTimelineEvents.slice(-4)
                          : [
                              {
                                id: `${session.id}-captured`,
                                detail: "Clip captured",
                              },
                            ]
                        ).map((event) => (
                          <p key={event.id}>{event.detail}</p>
                        ))}
                      </div>
                    </div>
                  </details>
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
            <section className="border-b border-white/10 pb-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Repeated today
              </p>
              <div className="mt-3 grid gap-3">
                {behaviorMemory.clusters.slice(0, 4).map((cluster) => (
                  <Link
                    key={cluster.id}
                    href={`/sessions?q=${encodeURIComponent(cluster.label)}`}
                    className="border-t border-white/10 py-3 transition hover:text-white"
                  >
                    <p className="text-sm font-bold text-white">
                      {cluster.label}
                    </p>
                    <p className="mt-2 text-xs text-white/35">
                      {cluster.count} clips or phrases
                    </p>
                  </Link>
                ))}
                {behaviorMemory.clusters.length === 0 ? (
                  <p className="text-sm text-white/40">
                    Repeated phrases will appear here.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="border-b border-white/10 pb-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Watch next
              </p>
              <div className="mt-3 grid gap-3">
                {reviewQueue.map((item) => (
                  <Link
                    key={item.session.id}
                    href={`/replay/${item.session.id}`}
                    className="border-t border-white/10 py-3 transition hover:text-white"
                  >
                    <p className="text-sm font-bold text-white">
                      {behaviorMomentLine(item.session)}
                    </p>
                    <p className="mt-2 text-xs text-white/35">
                      {playerName(item.session)} / {item.reason}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="border-b border-white/10 pb-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Similar moments
              </p>
              <div className="mt-3 grid gap-3">
                {behaviorClusters.slice(0, 4).map((cluster) => (
                  <Link
                    key={cluster.id}
                    href={`/sessions?q=${encodeURIComponent(cluster.behavior)}`}
                    className="border-t border-white/10 py-3 transition hover:text-white"
                  >
                    <p className="text-sm font-bold text-white">
                      {cluster.behavior}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                      <span>Cue {cluster.trigger}</span>
                      <span>{cluster.clips.length} clips</span>
                      <span>{cluster.stages.map((stage) => workflowStageLabel(stage as WorkflowStage)).join(", ")}</span>
                    </div>
                    <p className="mt-2 text-xs text-white/35">
                      Grouped quietly. Change it anytime.
                    </p>
                  </Link>
                ))}
                {behaviorClusters.length === 0 ? (
                  <p className="text-sm text-white/40">
                    Saved sentences will appear here.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="border-b border-white/10 pb-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Up next
              </p>
              <div className="mt-3 grid gap-2 text-sm text-white/60">
                <Link href="/sessions?view=repeated" className="hover:text-white">
                  Clips to watch again
                </Link>
                <Link href="/sessions?note=missing" className="hover:text-white">
                  Clips missing a sentence
                </Link>
                <Link href="/team/local" className="hover:text-white">
                  Team prep
                </Link>
              </div>
            </section>

            <section className="border-b border-white/10 pb-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Players to review
              </p>
              <div className="mt-3 grid gap-3">
                {players.slice(0, 5).map((player) => (
                  <Link
                    key={player.name}
                    href={`/sessions?player=${encodeURIComponent(player.name)}`}
                    className="border-t border-white/10 py-3 transition hover:text-white"
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
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-white/35">
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
