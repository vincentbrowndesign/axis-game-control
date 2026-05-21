import type { AxisGameAction } from "@/lib/axisEventModel"
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
  { pattern: /\b(MISS 2|MISSED 2|2 MISS)\b/, action: "MISS_2" },
  { pattern: /\b(MISS 3|MISSED 3|3 MISS)\b/, action: "MISS_3" },
  { pattern: /\b(AND 1|AND-1|AND ONE)\b/, action: "AND_1" },
  { pattern: /\b(ASSIST|AST)\b/, action: "ASSIST" },
  { pattern: /\b(REBOUND|REB|BOARD)\b/, action: "REBOUND" },
  { pattern: /\b(TURNOVER|TO)\b/, action: "TURNOVER" },
  { pattern: /\b(STEAL|STL)\b/, action: "STEAL" },
  { pattern: /\b(BLOCK|BLK)\b/, action: "BLOCK" },
  { pattern: /\b(FOUL)\b/, action: "FOUL" },
]

function normalizeCommand(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase()
}

function teamFromCommand(command: string): LiveStatTeam | null {
  if (/\bHOME\b/.test(command)) return "home"
  if (/\bAWAY\b/.test(command)) return "away"
  return null
}

function statActionFromCommand(command: string): AxisGameAction | null {
  return statAliases.find((alias) => alias.pattern.test(command))?.action || null
}

function findQueryFromCommand(command: string) {
  return command
    .replace(/^(FIND|SHOW|REPLAY|OPEN|GET)\s+/i, "")
    .replace(/\b(CLIPS?|PLAYS?|REPLAYS?)\b/gi, "")
    .trim()
}

export function parseAxisCommand(rawValue: string): AxisCommandPayload | null {
  const raw = rawValue.trim()
  const command = normalizeCommand(raw)
  if (!command) return null

  const team = teamFromCommand(command)
  const action = statActionFromCommand(command)
  if (team && action) {
    return {
      raw,
      intent: {
        kind: "stat",
        team,
        action,
        label: `${team.toUpperCase()} ${command.replace(/\b(HOME|AWAY)\b/g, "").trim()}`,
      },
    }
  }

  if (command === "RECORD" || command === "LIVE" || command === "START RECORDING") {
    return {
      raw,
      intent: {
        kind: "navigate",
        href: "/live",
        label: "Open live recording",
      },
    }
  }

  if (command === "REPLAY" || command === "SHOW REPLAY" || command === "SHOW TIMELINE") {
    return {
      raw,
      intent: {
        kind: "navigate",
        href: "/retrieve",
        label: "Open replay recall",
      },
    }
  }

  if (command.startsWith("CLIP ")) {
    const query = findQueryFromCommand(command.replace(/^CLIP\s+/, ""))
    const href = `/retrieve?q=${encodeURIComponent(query || "last possession")}`
    return {
      raw,
      intent: {
        kind: "clip",
        query: query || "last possession",
        href,
        label: "Find clip window",
      },
    }
  }

  if (/^(FIND|SHOW|REPLAY|OPEN|GET)\b/.test(command)) {
    const query = findQueryFromCommand(raw)
    const href = query ? `/retrieve?q=${encodeURIComponent(query)}` : "/retrieve"
    return {
      raw,
      intent: {
        kind: "find",
        query,
        href,
        label: "Find replay memory",
      },
    }
  }

  return {
    raw,
    intent: {
      kind: "find",
      query: raw,
      href: `/retrieve?q=${encodeURIComponent(raw)}`,
      label: "Find replay memory",
    },
  }
}
