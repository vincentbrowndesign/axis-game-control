"use client"

import { useEffect, useRef } from "react"
import { useAxisStore } from "@/store/useAxisStore"

export function AxisRail() {
  const value = useAxisStore((state) => state.railValue)
  const setValue = useAxisStore((state) => state.setRailValue)
  const submitRail = useAxisStore((state) => state.submitRail)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = "0px"
    textarea.style.height = `${Math.min(148, Math.max(48, textarea.scrollHeight))}px`
  }, [value])

  return (
    <footer className="axis-v2-rail-dock" aria-label="Axis memory rail">
      <div className="axis-v2-rail">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            if (event.shiftKey) return
            event.preventDefault()
            submitRail()
          }}
          placeholder="Ask memory, open replay, show rebounds, live..."
          rows={1}
          autoCapitalize="sentences"
          autoComplete="off"
          autoCorrect="on"
          spellCheck
          enterKeyHint="send"
          aria-label="Talk to Axis memory"
        />
      </div>
    </footer>
  )
}
