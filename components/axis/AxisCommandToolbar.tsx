"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  axisCommandSuggestions,
  parseAxisCommand,
  type AxisCommandPayload,
} from "@/lib/axisCommand"

declare global {
  interface WindowEventMap {
    "axis-command": CustomEvent<AxisCommandPayload>
  }
}

export function AxisCommandToolbar({
  compact = false,
  className = "",
  liveMemory = false,
}: {
  compact?: boolean
  className?: string
  liveMemory?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [command, setCommand] = useState("")
  const [lastAction, setLastAction] = useState("READY")
  const visibleSuggestions = useMemo(() => {
    const normalized = command.trim().toUpperCase()
    if (!normalized) return axisCommandSuggestions.slice(0, compact ? 4 : 6)

    return axisCommandSuggestions
      .filter((suggestion) => suggestion.includes(normalized))
      .slice(0, compact ? 3 : 5)
  }, [command, compact])

  function runCommand(value: string) {
    const parsed = parseAxisCommand(value)
    if (!parsed) return

    window.dispatchEvent(new CustomEvent("axis-command", { detail: parsed }))
    setLastAction(parsed.intent.label.toUpperCase())
    setCommand("")

    if (liveMemory) return

    if (parsed.intent.kind === "stat") {
      if (pathname !== "/live") router.push("/live")
      return
    }

    router.push(parsed.intent.href)
  }

  return (
    <section className={`axis-command-shell ${compact ? "axis-command-shell-compact" : ""} ${className}`}>
      <form
        className="axis-command-bar"
        onSubmit={(event) => {
          event.preventDefault()
          runCommand(command)
        }}
      >
        <span className="axis-command-prompt">&gt;</span>
        <input
          value={command}
          onChange={(event) => setCommand(event.currentTarget.value)}
          placeholder={liveMemory ? "HOME 3 / NAE REB / CLIP LAST" : "FIND REBOUNDS / SHOW LAST RUN / CLIP THIS"}
          className="axis-command-input"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label="Axis command"
        />
        <button type="submit" className="axis-command-submit">
          RUN
        </button>
      </form>
      <div className="axis-command-meta">
        <span>{lastAction}</span>
        <div className="axis-command-suggestions">
          {visibleSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => runCommand(suggestion)}
              className="axis-command-suggestion"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
