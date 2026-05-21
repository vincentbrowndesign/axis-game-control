export type AxisViewState = "live" | "memory" | "replay" | "inspect"

export type AxisQueryIntent =
  | {
      kind: "state"
      view: AxisViewState
      label: string
    }
  | {
      kind: "retrieval"
      view: "memory"
      query: string
      filter: "all" | "rebounds" | "clips" | "stops" | "scoring" | "semantic"
      label: string
    }
  | {
      kind: "replay"
      view: "replay"
      query: string
      action: "open" | "anchor"
      label: string
    }
  | {
      kind: "inspect"
      view: "inspect"
      focus: "form" | "player" | "continuity"
      query: string
      label: string
    }
  | {
      kind: "analytics"
      view: "memory"
      query: string
      metric: "score" | "player" | "run" | "review" | "momentum"
      label: string
    }
  | {
      kind: "overlay_control"
      view: AxisViewState
      action: "on" | "off"
      target: "subject_frames"
      label: string
    }
  | {
      kind: "memory"
      view: AxisViewState
      text: string
      label: string
    }
  | {
      kind: "rewind"
      view: AxisViewState
      query: string
      label: string
    }

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function retrievalFilter(query: string): Extract<AxisQueryIntent, { kind: "retrieval" }>["filter"] {
  const normalized = query.toLowerCase()
  if (/\brebounds?\b|\bboards?\b/.test(normalized)) return "rebounds"
  if (/\bclips?\b|\bmoments?\b/.test(normalized)) return "clips"
  if (/\bstops?\b|\bsteals?\b|\bblocks?\b/.test(normalized)) return "stops"
  if (/\bscore|scored|made|makes?|bucket\b/.test(normalized)) return "scoring"
  return "semantic"
}

export function parseAxisQueryIntent(value: string, currentView: AxisViewState): AxisQueryIntent | null {
  const raw = normalizeQuery(value)
  if (!raw) return null

  const normalized = raw.toLowerCase()

  if (
    /^(undo|undo last|take it back|remove last)$/.test(normalized) ||
    /\b(actually\s+[123]|that was\s+[123]|wrong player|remove turnover|no turnover|remove rebound|no rebound)\b/.test(normalized)
  ) {
    return {
      kind: "rewind",
      view: currentView,
      query: raw,
      label: "Corrected",
    }
  }

  if (/^(live|camera|start live)$/.test(normalized)) {
    return {
      kind: "state",
      view: "live",
      label: "Live",
    }
  }

  if (/^(memory|find|show memory|show clips)$/.test(normalized)) {
    return {
      kind: "state",
      view: "memory",
      label: "Memory",
    }
  }

  if (/^(replay|open replay)$/.test(normalized)) {
    return {
      kind: "state",
      view: "replay",
      label: "Replay",
    }
  }

  if (/^(overlay|overlays|frames?|subject frames?)\s+(off|hide|down)$/.test(normalized) || /^(hide|remove)\s+(overlay|overlays|frames?|subject frames?)$/.test(normalized)) {
    return {
      kind: "overlay_control",
      view: currentView,
      action: "off",
      target: "subject_frames",
      label: "Overlay off",
    }
  }

  if (/^(overlay|overlays|frames?|subject frames?)\s+(on|show|up)$/.test(normalized) || /^(show|restore)\s+(overlay|overlays|frames?|subject frames?)$/.test(normalized)) {
    return {
      kind: "overlay_control",
      view: currentView,
      action: "on",
      target: "subject_frames",
      label: "Overlay on",
    }
  }

  if (/\b(analyze|inspect|form|pose|balance|release|jumper|movement|shoulder|foot|feet|landmarks?)\b/.test(normalized)) {
    return {
      kind: "inspect",
      view: "inspect",
      focus: /\b(player|nae|who)\b/.test(normalized)
        ? "player"
        : /\b(collapse|pressure|continuity|movement)\b/.test(normalized)
          ? "continuity"
          : "form",
      query: raw,
      label: "Inspect",
    }
  }

  if (/\b#?\d+\s*(stats?|impact|points|rebounds?)\b/.test(normalized) || /\bwho has\b/.test(normalized)) {
    return {
      kind: "analytics",
      view: "memory",
      query: raw,
      metric: "player",
      label: "Memory",
    }
  }

  if (/\b(last run|caused the run|changed momentum|changed the game|what changed)\b/.test(normalized)) {
    return {
      kind: "analytics",
      view: "memory",
      query: raw,
      metric: /\bmomentum|changed/.test(normalized) ? "momentum" : "run",
      label: "Memory",
    }
  }

  if (/\bwhat should we review|review\b/.test(normalized)) {
    return {
      kind: "analytics",
      view: "memory",
      query: raw,
      metric: "review",
      label: "Memory",
    }
  }

  if (/\b(clip last|save clip|clip that)\b/.test(normalized)) {
    return {
      kind: "replay",
      view: "replay",
      query: raw,
      action: "anchor",
      label: "Replay anchor",
    }
  }

  if (/^(replay|open|show replay)\b/.test(normalized)) {
    return {
      kind: "replay",
      view: "replay",
      query: raw.replace(/^(replay|open|show replay)\s*/i, "") || "latest memory",
      action: "open",
      label: "Replay",
    }
  }

  if (/^(find|show|get|where)\b/.test(normalized) || /\b(rebound|clip|stop|score|steal|block|memory|moment)\b/.test(normalized)) {
    return {
      kind: "retrieval",
      view: "memory",
      query: raw.replace(/^(find|show|get)\s*/i, "") || raw,
      filter: retrievalFilter(raw),
      label: "Memory",
    }
  }

  return {
    kind: "memory",
    view: currentView,
    text: raw,
    label: "Remembered",
  }
}
