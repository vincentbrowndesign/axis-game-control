"use client"

import { useEffect, useRef } from "react"
import { useAxisStore } from "@/store/useAxisStore"
import styles from "./AxisShell.module.css"

export function AxisRail() {
  const value = useAxisStore((state) => state.railState.value)
  const setValue = useAxisStore((state) => state.setRailValue)
  const setFocused = useAxisStore((state) => state.setRailFocused)
  const submitRail = useAxisStore((state) => state.submitRail)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = "0px"
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`
  }, [value])

  function submit() {
    if (!value.trim()) return
    submitRail()
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
  }

  return (
    <section className={styles.rail} aria-label="Axis memory rail">
      <textarea
        ref={inputRef}
        value={value}
        rows={1}
        inputMode="text"
        enterKeyHint="send"
        spellCheck
        placeholder="What happened?"
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
          event.preventDefault()
          submit()
        }}
      />
    </section>
  )
}
