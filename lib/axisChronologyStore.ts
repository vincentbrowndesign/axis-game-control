import { create } from "zustand"
import type { TemporalEventRecord } from "@/lib/temporalEventGraph"

export type ChronologyUiStatus = "idle" | "loading" | "ready" | "seeking" | "error"

export type ChronologyPlaybackState = {
  currentTime: number
  paused: boolean
  readyState: number
}

export type TimelineAnchor = {
  eventId: string
  sessionTime: number
  targetTime: number
  requestedAt: number
}

type HydrateChronologyInput = {
  sessionId: string
  duration: number
  events: TemporalEventRecord[]
}

type AxisChronologyState = {
  sessionId: string | null
  activeEventId: string | null
  currentTimelineAnchor: TimelineAnchor | null
  isInternalSeeking: boolean
  uiStatus: ChronologyUiStatus
  duration: number
  events: TemporalEventRecord[]
  playback: ChronologyPlaybackState
  hydrateChronology: (input: HydrateChronologyInput) => void
  setUiStatus: (status: ChronologyUiStatus) => void
  setPlaybackState: (playback: Partial<ChronologyPlaybackState>) => void
  requestEventJump: (eventId: string) => TimelineAnchor | null
  completeInternalSeek: () => void
}

function eventPreroll(event: TemporalEventRecord) {
  const before = event.payload?.replay_window?.before

  return Number.isFinite(before) ? Number(before) : 0
}

export const useAxisChronologyStore = create<AxisChronologyState>((set, get) => ({
  sessionId: null,
  activeEventId: null,
  currentTimelineAnchor: null,
  isInternalSeeking: false,
  uiStatus: "idle",
  duration: 0,
  events: [],
  playback: {
    currentTime: 0,
    paused: true,
    readyState: 0,
  },
  hydrateChronology: ({ sessionId, duration, events }) => {
    const currentSessionId = get().sessionId
    const isNewSession = currentSessionId !== sessionId

    set({
      sessionId,
      duration: Math.max(0, Number(duration) || 0),
      events,
      activeEventId: isNewSession ? null : get().activeEventId,
      currentTimelineAnchor: isNewSession ? null : get().currentTimelineAnchor,
      isInternalSeeking: isNewSession ? false : get().isInternalSeeking,
      uiStatus: "ready",
      playback: isNewSession
        ? {
            currentTime: 0,
            paused: true,
            readyState: 0,
          }
        : get().playback,
    })
  },
  setUiStatus: (status) => {
    set({
      uiStatus: status,
    })
  },
  setPlaybackState: (playback) => {
    set((state) => ({
      playback: {
        ...state.playback,
        ...playback,
      },
    }))
  },
  requestEventJump: (eventId) => {
    const event = get().events.find((candidate) => candidate.id === eventId)
    if (!event) return null

    const sessionTime = Number(event.session_time) || 0
    const targetTime = Math.max(0, sessionTime - eventPreroll(event))
    const anchor = {
      eventId,
      sessionTime,
      targetTime,
      requestedAt: Date.now(),
    }

    set({
      activeEventId: eventId,
      currentTimelineAnchor: anchor,
      isInternalSeeking: true,
      uiStatus: "seeking",
      playback: {
        ...get().playback,
        currentTime: targetTime,
        paused: true,
      },
    })

    return anchor
  },
  completeInternalSeek: () => {
    set({
      isInternalSeeking: false,
      uiStatus: "ready",
    })
  },
}))
