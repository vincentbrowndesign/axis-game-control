"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAxisStore } from "@/store/useAxisStore"
import styles from "./AxisShell.module.css"

type AxisSpeechAlternative = {
  transcript: string
}

type AxisSpeechResult = {
  isFinal: boolean
  [index: number]: AxisSpeechAlternative
}

type AxisSpeechResultList = {
  length: number
  [index: number]: AxisSpeechResult
}

type AxisSpeechRecognitionEvent = {
  results: AxisSpeechResultList
}

type AxisSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  abort: () => void
  start: () => void
  stop: () => void
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: AxisSpeechRecognitionEvent) => void) | null
}

type AxisSpeechRecognitionConstructor = new () => AxisSpeechRecognition

type AxisSpeechWindow = Window & {
  SpeechRecognition?: AxisSpeechRecognitionConstructor
  webkitSpeechRecognition?: AxisSpeechRecognitionConstructor
}

export function AxisRail() {
  const value = useAxisStore((state) => state.railState.value)
  const setValue = useAxisStore((state) => state.setRailValue)
  const setFocused = useAxisStore((state) => state.setRailFocused)
  const submitRail = useAxisStore((state) => state.submitRail)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<AxisSpeechRecognition | null>(null)
  const latestSpeechRef = useRef("")
  const pendingVoiceSubmitRef = useRef(false)
  const [listening, setListening] = useState(false)
  const [transcriptPreview, setTranscriptPreview] = useState("")

  useEffect(() => {
    inputRef.current?.blur()
  }, [])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = "0px"
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`
  }, [value])

  const submitSpokenRail = useCallback(
    (text: string) => {
      const cleanText = text.trim()
      if (!cleanText) return
      setValue(cleanText)
      requestAnimationFrame(() => {
        void submitRail()
        latestSpeechRef.current = ""
        setTranscriptPreview("")
      })
    },
    [setValue, submitRail],
  )

  useEffect(() => {
    const SpeechRecognition = (window as AxisSpeechWindow).SpeechRecognition ?? (window as AxisSpeechWindow).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"
    recognition.onresult = (event) => {
      let transcript = ""
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? ""
      }
      const cleanTranscript = transcript.trim()
      latestSpeechRef.current = cleanTranscript
      setTranscriptPreview(cleanTranscript)
      setValue(cleanTranscript)
    }
    recognition.onerror = () => {
      pendingVoiceSubmitRef.current = false
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
      if (!pendingVoiceSubmitRef.current) return
      pendingVoiceSubmitRef.current = false
      submitSpokenRail(latestSpeechRef.current)
    }
    recognitionRef.current = recognition

    return () => {
      recognition.abort()
      recognitionRef.current = null
    }
  }, [setValue, submitSpokenRail])

  function submit() {
    if (!value.trim()) return
    submitRail()
  }

  function startHoldToSpeak() {
    setFocused(true)
    setTranscriptPreview("")
    latestSpeechRef.current = ""
    pendingVoiceSubmitRef.current = false

    if (!recognitionRef.current) {
      inputRef.current?.focus({ preventScroll: true })
      return
    }

    try {
      recognitionRef.current.start()
      setListening(true)
    } catch {
      setListening(true)
    }
  }

  function stopHoldToSpeak() {
    if (!recognitionRef.current) return
    pendingVoiceSubmitRef.current = true
    try {
      recognitionRef.current.stop()
    } catch {
      setListening(false)
      pendingVoiceSubmitRef.current = false
      submitSpokenRail(latestSpeechRef.current)
    }
  }

  function cancelHoldToSpeak() {
    pendingVoiceSubmitRef.current = false
    setListening(false)
    recognitionRef.current?.abort()
  }

  return (
    <section className={styles.rail} data-listening={listening ? "true" : "false"} aria-label="Axis memory rail">
      <button
        className={styles.holdToSpeak}
        type="button"
        aria-label="Hold to speak"
        aria-pressed={listening}
        onPointerCancel={cancelHoldToSpeak}
        onPointerDown={(event) => {
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          startHoldToSpeak()
        }}
        onPointerUp={(event) => {
          event.preventDefault()
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          stopHoldToSpeak()
        }}
      >
        <span>{listening ? "Listening" : "Hold to speak"}</span>
        <strong>{transcriptPreview || (listening ? "..." : "late help / dead ball / push after TO")}</strong>
      </button>
      <textarea
        ref={inputRef}
        value={value}
        rows={1}
        inputMode="text"
        enterKeyHint="send"
        spellCheck
        placeholder="Type fallback"
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
