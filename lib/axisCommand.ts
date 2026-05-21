import type { AxisGameAction } from "@/lib/axisEventModel"
import {
  buildContextualMemoryPackage,
  planContextualMemoryOperation,
  type AxisContextualMemoryPackage,
  type AxisPlannerDecision,
} from "@/lib/contextualMemoryLanguage"
import type { LiveStatTeam } from "@/lib/liveBasketballStats"

export type AxisIntentCategory =
  | "navigation"
  | "retrieval"
  | "replay"
  | "pose"
  | "memory"
  | "context"
  | "analytics"
  | "overlay"
  | "state"

type AxisIntentBase = {
  category: AxisIntentCategory
  label: string
}

export type AxisNavigateIntent = AxisIntentBase & {
  kind: "navigate"
  category: "navigation"
  href: string
  target: "live" | "find" | "replay" | "memory"
}

export type AxisRetrievalIntent = AxisIntentBase & {
  kind: "retrieval"
  category: "retrieval"
  query: string
  filter:
    | "all"
    | "rebounds"
    | "assists"
    | "turnovers"
    | "stops"
    | "makes"
    | "last-run"
    | "semantic"
}

export type AxisReplayIntent = AxisIntentBase & {
  kind: "replay"
  category: "replay"
  action: "open" | "anchor" | "context"
  query: string
}

export type AxisPoseIntent = AxisIntentBase & {
  kind: "inspect_pose"
  category: "pose"
  focus: "form" | "alignment" | "release" | "footwork" | "landing"
}

export type AxisMemoryIntent = AxisIntentBase & {
  kind: "stat"
  category: "memory"
  team: LiveStatTeam
  action: AxisGameAction
}

export type AxisContextIntent = AxisIntentBase & {
  kind: "context"
  category: "context"
  topic: "collapse" | "pressure" | "continuity" | "spatial" | "player"
  query: string
}

export type AxisAnalyticsIntent = AxisIntentBase & {
  kind: "analytics"
  category: "analytics"
  metric: "collapse" | "stabilization" | "momentum" | "pressure" | "run"
  query: string
}

export type AxisOverlayIntent = AxisIntentBase & {
  kind: "overlay"
  category: "overlay"
  overlay: "continuity" | "replay_context" | "spatial"
  query: string
}

export type AxisStateIntent = AxisIntentBase & {
  kind: "state"
  category: "state"
  action: "start_live" | "stop_live" | "save_live"
}

export type AxisIntent =
  | AxisNavigateIntent
  | AxisRetrievalIntent
  | AxisReplayIntent
  | AxisPoseIntent
  | AxisMemoryIntent
  | AxisContextIntent
  | AxisAnalyticsIntent
  | AxisOverlayIntent
  | AxisStateIntent

export type AxisCommandIntent = AxisIntent

export type AxisCommandPayload = {
  raw: string
  intent: AxisCommandIntent
  contextPackage: AxisContextualMemoryPackage
  plannerDecision: AxisPlannerDecision
}

export const axisCommandSuggestions = [
  "HOME 3",
  "AWAY TO",
  "NAE REB",
  "CLIP LAST",
  "FOUL HOME",
  "TIMEOUT AWAY",
  "MISS 2 HOME",
  "FIND REBOUNDS",
  "SHOW LAST RUN",
]

const statAliases: Array<{
  pattern: RegExp
  action: AxisGameAction
}> = [
  { pattern: /\b(1|1PT|FT|FREE THROW)\b/, action: "MAKE_1" },
  { pattern: /\b(2|2PT|TWO)\b/, action: "MAKE_2" },
  { pattern: /\b(3|3PT|THREE)\b/, action: "MAKE_3" },
  { pattern: /\b(CASH|GOOD|BUCKET|SCORED|SCORE|HIT)\b/, action: "MAKE_2" },
  { pattern: /\b(MISS 2|MISSED 2|2 MISS)\b/, action: "MISS_2" },
  { pattern: /\b(MISS 3|MISSED 3|3 MISS)\b/, action: "MISS_3" },
  { pattern: /\b(AND 1|AND-1|AND ONE)\b/, action: "AND_1" },
  { pattern: /\b(ASSIST|AST|DIME)\b/, action: "ASSIST" },
  { pattern: /\b(REBOUND|REB|BOARD|BOARDS)\b/, action: "REBOUND" },
  { pattern: /\b(TURNOVER|TO)\b/, action: "TURNOVER" },
  { pattern: /\b(STEAL|STL|STRIP)\b/, action: "STEAL" },
  { pattern: /\b(BLOCK|BLK)\b/, action: "BLOCK" },
  { pattern: /\b(FOUL)\b/, action: "FOUL" },
]

function normalizeCommand(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase()
}

function normalizeBasketballQuery(value: string) {
  return value
    .trim()
    .replace(/\bboards?\b/gi, "rebounds")
    .replace(/\bdimes?\b/gi, "assists")
    .replace(/\bstrips?\b/gi, "steals")
    .replace(/\b(cash|bucket|good)\b/gi, "made shot")
    .replace(/\b(the )?rebound\b/gi, "rebound")
    .replace(/\bthat was a foul\b/gi, "foul")
    .replace(/\bhe missed\b/gi, "missed shot")
    .replace(/\bclip that\b/gi, "clip last")
    .replace(/\s+/g, " ")
    .trim()
}

function teamFromCommand(command: string): LiveStatTeam | null {
  if (/\bHOME\b/.test(command)) return "home"
  if (/\bAWAY\b/.test(command)) return "away"
  return null
}

function statActionFromCommand(command: string): AxisGameAction | null {
  return statAliases.find((alias) => alias.pattern.test(command))?.action || null
}

function poseFocusFromCommand(command: string): AxisPoseIntent | null {
  if (/\b(ANALYZE|INSPECT|SHOW|CHECK)\b/.test(command) && /\b(FORM|SHOT FORM|MECHANICS|POSTURE)\b/.test(command)) {
    return {
      kind: "inspect_pose",
      category: "pose",
      focus: "form",
      label: "Inspect form",
    }
  }

  if (/\b(BODY ALIGNMENT|BALANCE|ALIGNMENT)\b/.test(command)) {
    return {
      kind: "inspect_pose",
      category: "pose",
      focus: "alignment",
      label: "Inspect alignment",
    }
  }

  if (/\b(RELEASE|RELEASE POINT)\b/.test(command)) {
    return {
      kind: "inspect_pose",
      category: "pose",
      focus: "release",
      label: "Inspect release",
    }
  }

  if (/\b(FOOTWORK|FEET|FOOT POSITION|FOOT POSITIONING)\b/.test(command)) {
    return {
      kind: "inspect_pose",
      category: "pose",
      focus: "footwork",
      label: "Inspect footwork",
    }
  }

  if (/\b(LANDING|LANDING ALIGNMENT)\b/.test(command)) {
    return {
      kind: "inspect_pose",
      category: "pose",
      focus: "landing",
      label: "Inspect landing",
    }
  }

  return null
}

function findQueryFromCommand(command: string) {
  return command
    .replace(/^(FIND|SHOW|REPLAY|OPEN|GET)\s+/i, "")
    .replace(/\b(CLIPS?|PLAYS?|REPLAYS?)\b/gi, "")
    .trim()
}

function retrievalFilterFromQuery(query: string): AxisRetrievalIntent["filter"] {
  const normalized = query.toLowerCase()
  if (/\blast\s+run\b/.test(normalized)) return "last-run"
  if (/\brebounds?\b|\bboards?\b/.test(normalized)) return "rebounds"
  if (/\bassists?\b|\bdimes?\b|\bast\b/.test(normalized)) return "assists"
  if (/\bturnovers?\b|\bto\b/.test(normalized)) return "turnovers"
  if (/\bstops?\b|\bsteals?\b|\bblocks?\b|\bstrips?\b/.test(normalized)) return "stops"
  if (/\bmade\b|\bmakes?\b|\bscor(e|ing)\b/.test(normalized)) return "makes"

  return "semantic"
}

function perceptionFocusFromCommand(command: string): AxisOverlayIntent | null {
  if (!/\b(TRACK|WATCH|FOLLOW)\b/.test(command)) return null

  return {
    kind: "overlay",
    category: "overlay",
    overlay: "spatial",
    query: findQueryFromCommand(command.replace(/^(TRACK|WATCH|FOLLOW)\s+/i, "")) || command,
    label: "Focus live context",
  }
}

function analyticsIntentFromQuery(query: string): AxisAnalyticsIntent | null {
  const normalized = query.toLowerCase()
  if (/\bcollapse\b|\bfell apart\b|\blost it\b/.test(normalized)) {
    return {
      kind: "analytics",
      category: "analytics",
      metric: "collapse",
      query,
      label: "Read collapse context",
    }
  }
  if (/\bstabiliz(e|ation)\b|\bsettle\b|\breset\b/.test(normalized)) {
    return {
      kind: "analytics",
      category: "analytics",
      metric: "stabilization",
      query,
      label: "Read stabilization",
    }
  }
  if (/\bmomentum\b|\bswing\b/.test(normalized)) {
    return {
      kind: "analytics",
      category: "analytics",
      metric: "momentum",
      query,
      label: "Read momentum",
    }
  }
  if (/\bpressure\b|\btrap\b|\bsped up\b/.test(normalized)) {
    return {
      kind: "analytics",
      category: "analytics",
      metric: "pressure",
      query,
      label: "Read pressure",
    }
  }
  if (/\blast\s+run\b|\brun\b/.test(normalized)) {
    return {
      kind: "analytics",
      category: "analytics",
      metric: "run",
      query,
      label: "Read last run",
    }
  }

  return null
}

function contextIntentFromQuery(query: string): AxisContextIntent | null {
  const normalized = query.toLowerCase()
  if (/\bwhere\b|\bspot\b|\bside\b|\bcorner\b|\bpaint\b|\barc\b/.test(normalized)) {
    return {
      kind: "context",
      category: "context",
      topic: "spatial",
      query,
      label: "Resolve spatial context",
    }
  }
  if (/\bplayer\b|\bnae\b|\bwho\b/.test(normalized)) {
    return {
      kind: "context",
      category: "context",
      topic: "player",
      query,
      label: "Resolve player context",
    }
  }

  return null
}

function commandPayload(raw: string, intent: AxisCommandIntent): AxisCommandPayload {
  const contextPackage = buildContextualMemoryPackage({
    raw,
    mode: "unknown",
    replayState: intent.category === "replay" || intent.category === "retrieval" ? "unknown" : "idle",
  })

  return {
    raw,
    intent,
    contextPackage,
    plannerDecision: planContextualMemoryOperation(contextPackage),
  }
}

export function parseAxisCommand(rawValue: string): AxisCommandPayload | null {
  const raw = rawValue.trim()
  const normalizedRaw = normalizeBasketballQuery(raw)
  const command = normalizeCommand(normalizedRaw)
  if (!command) return null

  const poseIntent = poseFocusFromCommand(command)
  if (poseIntent) {
    return commandPayload(raw, poseIntent)
  }

  const team = teamFromCommand(command)
  const action = statActionFromCommand(command)
  if (team && action) {
    return commandPayload(raw, {
      kind: "stat",
      category: "memory",
      team,
      action,
      label: `${team.toUpperCase()} ${command.replace(/\b(HOME|AWAY)\b/g, "").trim()}`,
    })
  }

  if (command === "RECORD" || command === "LIVE" || command === "START RECORDING") {
    return commandPayload(raw, {
      kind: "navigate",
      category: "navigation",
      href: "/live",
      target: "live",
      label: "Open live recording",
    })
  }

  if (command === "FIND" || command === "SEARCH" || command === "RETRIEVE") {
    return commandPayload(raw, {
      kind: "navigate",
      category: "navigation",
      href: "/retrieve",
      target: "find",
      label: "Open memory find",
    })
  }

  if (command === "REPLAY" || command === "OPEN REPLAY" || command === "SHOW REPLAY" || command === "SHOW TIMELINE") {
    return commandPayload(raw, {
      kind: "navigate",
      category: "navigation",
      href: "/retrieve",
      target: "replay",
      label: "Open replay recall",
    })
  }

  if (command === "CLIP" || command === "CLIP THAT" || command === "CLIP LAST" || command.startsWith("CLIP ")) {
    const query = findQueryFromCommand(command.replace(/^CLIP\s+/, ""))
    return commandPayload(raw, {
      kind: "replay",
      category: "replay",
      action: "anchor",
      query: query || "last possession",
      label: "Anchor replay memory",
    })
  }

  const perceptionIntent = perceptionFocusFromCommand(command)
  if (perceptionIntent) {
    return commandPayload(raw, perceptionIntent)
  }

  if (/^(FIND|SHOW|REPLAY|OPEN|GET)\b/.test(command)) {
    const query = findQueryFromCommand(normalizedRaw)
    const contextIntent = contextIntentFromQuery(query)
    if (contextIntent) return commandPayload(raw, contextIntent)

    const analyticsIntent = analyticsIntentFromQuery(query)
    if (analyticsIntent) return commandPayload(raw, analyticsIntent)

    return commandPayload(raw, {
      kind: "retrieval",
      category: "retrieval",
      query,
      filter: retrievalFilterFromQuery(query),
      label: "Retrieve memory",
    })
  }

  const contextIntent = contextIntentFromQuery(normalizedRaw)
  if (contextIntent) return commandPayload(raw, contextIntent)

  const analyticsIntent = analyticsIntentFromQuery(normalizedRaw)
  if (analyticsIntent) return commandPayload(raw, analyticsIntent)

  return commandPayload(raw, {
    kind: "retrieval",
    category: "retrieval",
    query: normalizedRaw,
    filter: retrievalFilterFromQuery(normalizedRaw),
    label: "Retrieve memory",
  })
}
