import {
  constructionZoneLabel,
  drillName,
  isRepeated,
  phaseLabel,
  playerName,
  situationLabel,
  tagCounts,
  repeatCounts,
  triggerLabel,
} from "@/lib/archive/sessionRollup"
import type { ReplaySessionView } from "@/types/memory"

export type TimelineEventType =
  | "CLIP_CAPTURED"
  | "FLAW_TAGGED"
  | "CORRECTION_ADDED"
  | "TRIGGER_ASSIGNED"
  | "CONSTRAINT_ADDED"
  | "REPEAT_MARKED"
  | "RETRIEVED"
  | "STRESS_PHASE_CHANGED"
  | "CONSTRUCTION_CHANGED"
  | "TRANSFER_OBSERVED"
  | "RELAPSE_OBSERVED"

export type CorrectionTimelineEvent = {
  id: string
  type: TimelineEventType
  at: string
  detail: string
}

export type TacticalSystem = {
  id: string
  name: string
  aliases: string[]
  courtZone: "top" | "slot" | "corner" | "paint" | "baseline" | "wing"
  defaultTrigger: string
  defaultConstraint: string
}

export type Correction = {
  id: string
  playerId: string
  clipId: string
  tacticalSystem: string
  flaw: string
  correction: string
  trigger: string
  constraint: string
  constructionStatus: string
  stressPhase: string
  repeatTomorrow: boolean
  timelineEvents: CorrectionTimelineEvent[]
}

export const TACTICAL_SYSTEMS: TacticalSystem[] = [
  {
    id: "high-pnr",
    name: "High PNR",
    aliases: ["High PNR", "High Pick-and-Roll", "Ball Screen Reject"],
    courtZone: "top",
    defaultTrigger: "TIGHT",
    defaultConstraint: "Reject screen",
  },
  {
    id: "weak-side-tag",
    name: "Weak-Side Tag",
    aliases: ["Weak-Side Tag", "Nail Help"],
    courtZone: "paint",
    defaultTrigger: "TAG",
    defaultConstraint: "Tag before closeout",
  },
  {
    id: "screen-help",
    name: "Screen Help",
    aliases: ["Screen Help", "Nail Help"],
    courtZone: "paint",
    defaultTrigger: "LOW",
    defaultConstraint: "No middle drive",
  },
  {
    id: "transition-defense",
    name: "Transition Defense",
    aliases: ["Transition Defense", "Transition Advantage"],
    courtZone: "top",
    defaultTrigger: "MATCH",
    defaultConstraint: "Stop ball first",
  },
  {
    id: "closeout-attack",
    name: "Closeout Attack",
    aliases: ["Closeout Attack"],
    courtZone: "wing",
    defaultTrigger: "SINK",
    defaultConstraint: "2 dribbles max",
  },
  {
    id: "paint-touch",
    name: "Paint Touch",
    aliases: ["Paint Touch"],
    courtZone: "paint",
    defaultTrigger: "HOLD",
    defaultConstraint: "Automatic kick on slot drive",
  },
  {
    id: "slot-drive",
    name: "Slot Drive",
    aliases: ["Slot Drive"],
    courtZone: "slot",
    defaultTrigger: "KICK",
    defaultConstraint: "Automatic kick on slot drive",
  },
  {
    id: "baseline-drift",
    name: "Baseline Drift",
    aliases: ["Baseline Drift"],
    courtZone: "baseline",
    defaultTrigger: "LIFT",
    defaultConstraint: "One-touch finish",
  },
  {
    id: "corner-collapse",
    name: "Corner Collapse",
    aliases: ["Corner Collapse", "Corner Kick"],
    courtZone: "corner",
    defaultTrigger: "NEXT",
    defaultConstraint: "One-touch finish",
  },
  {
    id: "ball-screen-reject",
    name: "Ball Screen Reject",
    aliases: ["Ball Screen Reject"],
    courtZone: "top",
    defaultTrigger: "REJECT",
    defaultConstraint: "Reject screen",
  },
  {
    id: "dho-coverage",
    name: "DHO Coverage",
    aliases: ["DHO Coverage"],
    courtZone: "wing",
    defaultTrigger: "HIT",
    defaultConstraint: "No middle drive",
  },
]

export function makeTimelineEvent(
  type: TimelineEventType,
  detail: string
): CorrectionTimelineEvent {
  return {
    id: `${Date.now()}-${type}-${detail.toLowerCase().replace(/\W+/g, "-")}`,
    type,
    at: new Date().toISOString(),
    detail,
  }
}

export function readCorrectionTimeline(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const record = item as Record<string, unknown>

      if (
        typeof record.id !== "string" ||
        typeof record.type !== "string" ||
        typeof record.at !== "string" ||
        typeof record.detail !== "string"
      ) {
        return null
      }

      return {
        id: record.id,
        type: record.type as TimelineEventType,
        at: record.at,
        detail: record.detail,
      }
    })
    .filter((item): item is CorrectionTimelineEvent => Boolean(item))
}

export function appendTimelineEvents(
  metadata: Record<string, unknown>,
  events: CorrectionTimelineEvent[]
) {
  return [
    ...readCorrectionTimeline(metadata.correctionTimelineEvents),
    ...events,
  ].slice(-24)
}

export function tacticalSystemForSession(session: ReplaySessionView) {
  const situation = session.situation?.trim().toLowerCase()
  const drill = drillName(session).toLowerCase()

  return (
    TACTICAL_SYSTEMS.find((system) =>
      system.aliases.some((alias) => alias.toLowerCase() === situation)
    ) ||
    TACTICAL_SYSTEMS.find((system) =>
      system.aliases.some((alias) => drill.includes(alias.toLowerCase()))
    ) ||
    TACTICAL_SYSTEMS[0]
  )
}

export function correctionFromSession(
  session: ReplaySessionView,
  repeatTomorrow: boolean
): Correction {
  const timelineEvents = session.correctionTimelineEvents?.length
    ? session.correctionTimelineEvents
    : ([
        {
          id: `${session.id}-captured`,
          type: "CLIP_CAPTURED",
          at: new Date(session.createdAt).toISOString(),
          detail: "Clip captured",
        },
      ] satisfies CorrectionTimelineEvent[])

  return {
    id: `correction-${session.id}`,
    playerId: playerName(session),
    clipId: session.id,
    tacticalSystem: tacticalSystemForSession(session).name,
    flaw: session.coachFlaw || "",
    correction: session.coachCorrection || session.coachNote || "",
    trigger: triggerLabel(session),
    constraint: session.constraint || "",
    constructionStatus: constructionZoneLabel(session),
    stressPhase: phaseLabel(session),
    repeatTomorrow,
    timelineEvents,
  }
}

export function systemSummaries(sessions: ReplaySessionView[]) {
  const tags = tagCounts(sessions)
  const repeats = repeatCounts(sessions)

  return TACTICAL_SYSTEMS.map((system) => {
    const attached = sessions.filter(
      (session) => tacticalSystemForSession(session).id === system.id
    )
    const repeatClips = attached.filter((session) =>
      isRepeated(session, repeats, tags)
    )
    const triggers = [
      ...new Set(attached.map(triggerLabel).filter(Boolean)),
    ].slice(0, 4)
    const players = [
      ...new Set(attached.map(playerName).filter(Boolean)),
    ].slice(0, 4)
    const corrections = attached.filter(
      (session) => session.coachFlaw || session.coachCorrection || session.coachNote
    )
    const activeConstruction = attached.filter(
      (session) => constructionZoneLabel(session) !== "Cleared"
    )
    const latest = attached[0]

    return {
      system,
      clips: attached,
      repeatClips,
      triggers,
      players,
      corrections,
      activeConstruction,
      phase: latest ? phaseLabel(latest) : "Block",
      constraint: latest?.constraint || system.defaultConstraint,
      issue: latest?.coachFlaw || "No issue tagged yet",
    }
  })
}

export function systemHref(system: TacticalSystem) {
  const alias = system.aliases[0] || system.name
  return `/sessions?situation=${encodeURIComponent(alias)}`
}

export function systemDisplayName(session: ReplaySessionView) {
  const label = situationLabel(session)
  return label === "Add situation"
    ? tacticalSystemForSession(session).name
    : label
}
