import { createClient } from "@supabase/supabase-js"
import { create } from "zustand"
import type {
  TemporalEventPayload,
  TemporalEventRecord,
  TemporalEventType,
} from "@/lib/temporalEventGraph"

export type ChronologyUiStatus = "idle" | "loading" | "ready" | "seeking" | "error"
export type GlobalSyncStatus = "SYNCED" | "SYNCING" | "FAILED" | "RETRYING"
export type AxisSyncTelemetry =
  | "SYSTEM_SYNCED"
  | `SYNCING_QUEUE ${number}`
  | `OFFLINE_BUFFERING ${number}`
  | "RETRYING_CONNECT"
  | `SYNC_FAILED ${number}`
export type EventPersistenceStatus = "PENDING" | "PERSISTED" | "FAILED" | "RETRYING"

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

export type AxisChronologyEvent = TemporalEventRecord & {
  persistenceStatus: EventPersistenceStatus
  retryCount: number
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
  isProcessingQueue: boolean
  uiStatus: ChronologyUiStatus
  globalSyncStatus: GlobalSyncStatus
  syncTelemetry: AxisSyncTelemetry
  duration: number
  events: AxisChronologyEvent[]
  pendingEvents: AxisChronologyEvent[]
  persistedEvents: AxisChronologyEvent[]
  failedEvents: AxisChronologyEvent[]
  playback: ChronologyPlaybackState
  nextSequenceOrder: number
  hydrateChronology: (input: HydrateChronologyInput) => void
  setUiStatus: (status: ChronologyUiStatus) => void
  setPlaybackState: (playback: Partial<ChronologyPlaybackState>) => void
  syncMediaPlayback: (playback: Partial<ChronologyPlaybackState>) => void
  requestEventJump: (eventId: string) => TimelineAnchor | null
  triggerAttentionSignal: (
    type: TemporalEventType | string,
    sessionTime: number,
    payload?: TemporalEventPayload
  ) => AxisChronologyEvent | null
  processPersistenceQueue: () => Promise<void>
  retryFailedEvents: () => void
  completeInternalSeek: () => void
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [key: string]: JsonValue
    }

type AxisChronologyDatabase = {
  public: {
    Tables: {
      events: {
        Row: {
          id: string
          session_id: string
          type: string
          session_time: number
          sequence_order: number
          created_at: string
          payload: JsonValue
        }
        Insert: {
          id: string
          session_id: string
          type: string
          session_time: number
          sequence_order: number
          created_at: string
          payload: JsonValue
        }
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

let supabaseClient: ReturnType<typeof createClient<AxisChronologyDatabase>> | null = null

function chronologySupabase() {
  if (supabaseClient) return supabaseClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SUPABASE_CLIENT_ENV_MISSING")
  }

  supabaseClient = createClient<AxisChronologyDatabase>(supabaseUrl, supabaseAnonKey)
  return supabaseClient
}

function createId(prefix = "axis-event") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function eventPreroll(event: TemporalEventRecord) {
  const before = event.payload?.replay_window?.before

  return Number.isFinite(before) ? Number(before) : 0
}

function eventAnchor(event: TemporalEventRecord): TimelineAnchor {
  const sessionTime = Number(event.session_time) || 0

  return {
    eventId: event.id,
    sessionTime,
    targetTime: Math.max(0, sessionTime - eventPreroll(event)),
    requestedAt: Date.now(),
  }
}

function persistedEvent(event: TemporalEventRecord): AxisChronologyEvent {
  return {
    ...event,
    sequence_order: Number(event.sequence_order) || 0,
    persistenceStatus: "PERSISTED",
    retryCount: 0,
  }
}

function syncTelemetry(
  status: GlobalSyncStatus,
  pendingCount: number,
  failedCount: number
): AxisSyncTelemetry {
  if (status === "RETRYING") return "RETRYING_CONNECT"
  if (failedCount) return `SYNC_FAILED ${failedCount}`
  if (pendingCount && typeof navigator !== "undefined" && !navigator.onLine) {
    return `OFFLINE_BUFFERING ${pendingCount}`
  }
  if (pendingCount) return `SYNCING_QUEUE ${pendingCount}`
  return "SYSTEM_SYNCED"
}

function sortEvents(events: AxisChronologyEvent[]) {
  return [...events].sort((a, b) => {
    const timeDelta = Number(a.session_time) - Number(b.session_time)
    if (timeDelta !== 0) return timeDelta

    const orderDelta = Number(a.sequence_order) - Number(b.sequence_order)
    if (orderDelta !== 0) return orderDelta

    return a.created_at.localeCompare(b.created_at)
  })
}

function mergeEvents(events: AxisChronologyEvent[]) {
  const byId = new Map<string, AxisChronologyEvent>()
  events.forEach((event) => byId.set(event.id, event))

  return sortEvents([...byId.values()])
}

async function persistEvent(event: AxisChronologyEvent) {
  const { error } = await chronologySupabase().from("events").insert({
    id: event.id,
    session_id: event.session_id,
    type: event.type,
    session_time: event.session_time,
    sequence_order: event.sequence_order,
    created_at: event.created_at,
    payload: event.payload as JsonValue,
  })

  if (error && error.code !== "23505") {
    throw error
  }
}

export const useAxisChronologyStore = create<AxisChronologyState>((set, get) => ({
  sessionId: null,
  activeEventId: null,
  currentTimelineAnchor: null,
  isInternalSeeking: false,
  isProcessingQueue: false,
  uiStatus: "idle",
  globalSyncStatus: "SYNCED",
  syncTelemetry: "SYSTEM_SYNCED",
  duration: 0,
  events: [],
  pendingEvents: [],
  persistedEvents: [],
  failedEvents: [],
  playback: {
    currentTime: 0,
    paused: true,
    readyState: 0,
  },
  nextSequenceOrder: 0,
  hydrateChronology: ({ sessionId, duration, events }) => {
    const current = get()
    const isNewSession = current.sessionId !== sessionId
    const persisted = events.map(persistedEvent)
    const localPending = isNewSession
      ? []
      : current.pendingEvents.filter((event) => event.session_id === sessionId)
    const localFailed = isNewSession
      ? []
      : current.failedEvents.filter((event) => event.session_id === sessionId)
    const visibleEvents = mergeEvents([...persisted, ...localPending, ...localFailed])
    const nextSequenceOrder =
      visibleEvents.reduce(
        (maxSequenceOrder, event) =>
          Math.max(maxSequenceOrder, Number(event.sequence_order) || 0),
        -1
      ) + 1
    const globalSyncStatus = localFailed.length
      ? "FAILED"
      : localPending.length
        ? current.globalSyncStatus === "RETRYING"
          ? "RETRYING"
          : "SYNCING"
        : "SYNCED"

    set({
      sessionId,
      duration: Math.max(0, Number(duration) || 0),
      events: visibleEvents,
      pendingEvents: localPending,
      persistedEvents: persisted,
      failedEvents: localFailed,
      nextSequenceOrder,
      activeEventId: isNewSession ? null : current.activeEventId,
      currentTimelineAnchor: isNewSession ? null : current.currentTimelineAnchor,
      isInternalSeeking: isNewSession ? false : current.isInternalSeeking,
      globalSyncStatus,
      syncTelemetry: syncTelemetry(globalSyncStatus, localPending.length, localFailed.length),
      uiStatus: "ready",
      playback: isNewSession
        ? {
            currentTime: 0,
            paused: true,
            readyState: 0,
          }
        : current.playback,
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
  syncMediaPlayback: (playback) => {
    set((state) => {
      const nextPlayback = {
        ...state.playback,
        ...playback,
      }
      if (state.isInternalSeeking) {
        return {
          playback: nextPlayback,
        }
      }

      const currentTime = Number(nextPlayback.currentTime) || 0
      const nearestEvent = state.events.reduce<AxisChronologyEvent | null>(
        (nearest, event) => {
          const distance = Math.abs(Number(event.session_time) - currentTime)
          if (distance > 1.25) return nearest
          if (!nearest) return event

          return distance < Math.abs(Number(nearest.session_time) - currentTime)
            ? event
            : nearest
        },
        null
      )

      return {
        playback: nextPlayback,
        activeEventId: nearestEvent?.id ?? state.activeEventId,
        currentTimelineAnchor: nearestEvent
          ? {
              ...eventAnchor(nearestEvent),
              targetTime: currentTime,
            }
          : state.currentTimelineAnchor,
      }
    })
  },
  requestEventJump: (eventId) => {
    const event = get().events.find((candidate) => candidate.id === eventId)
    if (!event) return null

    const anchor = eventAnchor(event)

    set({
      activeEventId: eventId,
      currentTimelineAnchor: anchor,
      isInternalSeeking: true,
      uiStatus: "seeking",
      playback: {
        ...get().playback,
        currentTime: anchor.targetTime,
        paused: true,
      },
    })

    return anchor
  },
  triggerAttentionSignal: (type, sessionTime, payload = {}) => {
    const sessionId = get().sessionId
    if (!sessionId) return null

    const event: AxisChronologyEvent = {
      id: createId(),
      session_id: sessionId,
      type,
      session_time: Number(sessionTime) || 0,
      sequence_order: get().nextSequenceOrder,
      created_at: new Date().toISOString(),
      payload,
      persistenceStatus: "PENDING",
      retryCount: 0,
    }
    const anchor = eventAnchor(event)

    set((state) => ({
      activeEventId: event.id,
      currentTimelineAnchor: anchor,
      isInternalSeeking: true,
      uiStatus: "seeking",
      globalSyncStatus: "SYNCING",
      syncTelemetry: syncTelemetry("SYNCING", state.pendingEvents.length + 1, state.failedEvents.length),
      events: mergeEvents([...state.events, event]),
      pendingEvents: mergeEvents([...state.pendingEvents, event]),
      nextSequenceOrder: state.nextSequenceOrder + 1,
      playback: {
        ...state.playback,
        currentTime: anchor.targetTime,
        paused: true,
      },
    }))

    queueMicrotask(() => {
      void get().processPersistenceQueue()
    })

    return event
  },
  processPersistenceQueue: async () => {
    if (get().isProcessingQueue) return

    set({
      isProcessingQueue: true,
      globalSyncStatus: get().globalSyncStatus === "RETRYING" ? "RETRYING" : "SYNCING",
      syncTelemetry: syncTelemetry(
        get().globalSyncStatus === "RETRYING" ? "RETRYING" : "SYNCING",
        get().pendingEvents.length,
        get().failedEvents.length
      ),
    })

    try {
      while (get().pendingEvents.length > 0) {
        const event = get().pendingEvents[0]

        try {
          await persistEvent(event)

          const savedEvent: AxisChronologyEvent = {
            ...event,
            persistenceStatus: "PERSISTED",
          }

          set((state) => ({
            pendingEvents: state.pendingEvents.filter((candidate) => candidate.id !== event.id),
            failedEvents: state.failedEvents.filter((candidate) => candidate.id !== event.id),
            persistedEvents: mergeEvents([...state.persistedEvents, savedEvent]),
            events: mergeEvents(
              state.events.map((candidate) =>
                candidate.id === event.id ? savedEvent : candidate
              )
            ),
            syncTelemetry: syncTelemetry(
              state.globalSyncStatus,
              Math.max(0, state.pendingEvents.length - 1),
              state.failedEvents.length
            ),
          }))
        } catch {
          const failedEvent: AxisChronologyEvent = {
            ...event,
            persistenceStatus: "FAILED",
          }

          set((state) => ({
            pendingEvents: state.pendingEvents.filter((candidate) => candidate.id !== event.id),
            failedEvents: mergeEvents([...state.failedEvents, failedEvent]),
            events: mergeEvents(
              state.events.map((candidate) =>
                candidate.id === event.id ? failedEvent : candidate
              )
            ),
            globalSyncStatus: "FAILED",
            syncTelemetry: syncTelemetry(
              "FAILED",
              Math.max(0, state.pendingEvents.length - 1),
              state.failedEvents.length + 1
            ),
          }))
        }
      }
    } finally {
      const state = get()

      set({
        isProcessingQueue: false,
        globalSyncStatus: state.failedEvents.length ? "FAILED" : "SYNCED",
        syncTelemetry: syncTelemetry(
          state.failedEvents.length ? "FAILED" : "SYNCED",
          state.pendingEvents.length,
          state.failedEvents.length
        ),
      })
    }
  },
  retryFailedEvents: () => {
    const failedEvents = get().failedEvents
    if (!failedEvents.length) return

    const retryingEvents = failedEvents.map((event) => ({
      ...event,
      persistenceStatus: "RETRYING" as const,
      retryCount: event.retryCount + 1,
    }))

    set((state) => ({
      failedEvents: [],
      pendingEvents: mergeEvents([...state.pendingEvents, ...retryingEvents]),
      events: mergeEvents(
        state.events.map((event) => {
          const retrying = retryingEvents.find((candidate) => candidate.id === event.id)
          return retrying || event
        })
      ),
      globalSyncStatus: "RETRYING",
      syncTelemetry: syncTelemetry("RETRYING", state.pendingEvents.length + retryingEvents.length, 0),
    }))

    queueMicrotask(() => {
      void get().processPersistenceQueue()
    })
  },
  completeInternalSeek: () => {
    set({
      isInternalSeeking: false,
      uiStatus: "ready",
    })
  },
}))
