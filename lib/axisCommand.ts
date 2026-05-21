import type { AxisGameAction } from "@/lib/axisEventModel"
import {
  buildContextualMemoryPackage,
  planContextualMemoryOperation,
  type AxisContextualMemoryPackage,
  type AxisPlannerDecision,
} from "@/lib/contextualMemoryLanguage"
import type { LiveStatTeam } from "@/lib/liveBasketballStats"

export type AxisCommandIntent =
  | {
      kind: "navigate"
      href: string
      label: string
    }
  | {
      kind: "find"
      query: string
      href: string
      label: string
    }
  | {
      kind: "inspect_pose"
      focus: "form" | "alignment" | "release" | "footwork" | "landing"
      label: string
    }
  | {
      kind: "stat"
      team: LiveStatTeam
      action: AxisGameAction
      label: string
    }
  | {
      kind: "clip"
      query: string
      href: string
      label: string
    }

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

function poseFocusFromCommand(command: string): AxisCommandIntent & { kind: "inspect_pose" } | null {
  if (/\b(ANALYZE|INSPECT|SHOW|CHECK)\b/.test(command) && /\b(FORM|SHOT FORM|MECHANICS|POSTURE)\b/.test(command)) {
    return {
      kind: "inspect_pose",
      focus: "form",
      label: "Inspect form",
    }
  }

  if (/\b(BODY ALIGNMENT|BALANCE|ALIGNMENT)\b/.test(command)) {
    return {
      kind: "inspect_pose",
      focus: "alignment",
      label: "Inspect alignment",
    }
  }

  if (/\b(RELEASE|RELEASE POINT)\b/.test(command)) {
    return {
      kind: "inspect_pose",
      focus: "release",
      label: "Inspect release",
    }
  }

  if (/\b(FOOTWORK|FEET|FOOT POSITION|FOOT POSITIONING)\b/.test(command)) {
    return {
      kind: "inspect_pose",
      focus: "footwork",
      label: "Inspect footwork",
    }
  }

  if (/\b(LANDING|LANDING ALIGNMENT)\b/.test(command)) {
    return {
      kind: "inspect_pose",
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

function commandPayload(raw: string, intent: AxisCommandIntent): AxisCommandPayload {
  const contextPackage = buildContextualMemoryPackage({
    raw,
    mode: "unknown",
    replayState: intent.kind === "clip" || intent.kind === "find" ? "unknown" : "idle",
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
      team,
      action,
      label: `${team.toUpperCase()} ${command.replace(/\b(HOME|AWAY)\b/g, "").trim()}`,
    })
  }

  if (command === "RECORD" || command === "LIVE" || command === "START RECORDING") {
    return commandPayload(raw, {
      kind: "navigate",
      href: "/live",
      label: "Open live recording",
    })
  }

  if (command === "REPLAY" || command === "SHOW REPLAY" || command === "SHOW TIMELINE") {
    return commandPayload(raw, {
      kind: "navigate",
      href: "/retrieve",
      label: "Open replay recall",
    })
  }

  if (command === "CLIP" || command === "CLIP THAT" || command === "CLIP LAST" || command.startsWith("CLIP ")) {
    const query = findQueryFromCommand(command.replace(/^CLIP\s+/, ""))
    const href = `/retrieve?q=${encodeURIComponent(query || "last possession")}`
    return commandPayload(raw, {
      kind: "clip",
      query: query || "last possession",
      href,
      label: "Find clip window",
    })
  }

  if (/^(FIND|SHOW|REPLAY|OPEN|GET)\b/.test(command)) {
    const query = findQueryFromCommand(normalizedRaw)
    const href = query ? `/retrieve?q=${encodeURIComponent(query)}` : "/retrieve"
    return commandPayload(raw, {
      kind: "find",
      query,
      href,
      label: "Find replay memory",
    })
  }

  return commandPayload(raw, {
    kind: "find",
    query: normalizedRaw,
    href: `/retrieve?q=${encodeURIComponent(normalizedRaw)}`,
    label: "Find replay memory",
  })
}
