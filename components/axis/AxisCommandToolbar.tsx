"use client"

import { useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
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
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [command, setCommand] = useState("")
  const [lastAction, setLastAction] = useState("READY")

  function runCommand(value: string) {
    const parsed = parseAxisCommand(value)
    if (!parsed) return

    window.dispatchEvent(new CustomEvent("axis-command", { detail: parsed }))
    setLastAction(parsed.intent.label.toUpperCase())
    setCommand("")
    window.requestAnimationFrame(() => {
      inputRef.current?.focus({
        preventScroll: true,
      })
    })

    if (liveMemory) return

    if (parsed.intent.kind === "stat") {
      if (pathname !== "/live") router.push("/live")
      return
    }

    if (parsed.intent.kind === "navigate") {
      router.push(parsed.intent.href)
    }
  }

  return (
    <section className={`axis-command-shell ${compact ? "axis-command-shell-compact" : ""} ${className}`}>
      <div
        className="axis-command-bar"
        role="group"
        aria-label="Axis memory rail"
      >
        <span className="axis-command-prompt">&gt;</span>
        <input
          ref={inputRef}
          value={command}
          onChange={(event) => setCommand(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            runCommand(command)
          }}
          placeholder={liveMemory ? "HOME 3 / NAE REB / CLIP LAST" : "FIND REBOUNDS / SHOW LAST RUN / CLIP THIS"}
          className="axis-command-input"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="send"
          spellCheck={false}
          aria-label="Axis command"
        />
      </div>
      <div className="axis-command-meta">
        <span>{lastAction}</span>
      </div>
    </section>
  )
}
