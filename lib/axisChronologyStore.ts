import { createClient } from "@supabase/supabase-js"
import { create } from "zustand"
import type {
  TemporalEventPayload,
  TemporalEventRecord,
  TemporalSnapshotRecord,
  TemporalEventType,
} from "@/lib/temporalEventGraph"
import { defaultReplayWindow } from "@/lib/temporalEventGraph"

export type ChronologyUiStatus = "idle" | "loading" | "ready" | "seeking" | "error"
export type GlobalSyncStatus = "SYNCED" | "SYNCING" | "FAILED" | "RETRYING"
export type AxisSyncTelemetry =
  | "SYSTEM_SYNCED"
  | `SYNCING_QUEUE ${number}`
  | `OFFLINE_BUFFERING ${number}`
  | "RETRYING_CONNECT"
  | `SYNC_FAILED ${number}`
export type EventPersistenceStatus = "PENDING" | "PERSISTED" | "FAILED" | "RETRYING"
export type ExportStatus =
  | "IDLE"
  | "DOWNLOADING"
  | "PREPARING_TRANSFER"
  | "SUCCESS"
  | "FAILED"
export type SnapshotPersistenceStatus =
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "FAILED"
  | "RETRYING"

export type ChronologyPlaybackState = {
  currentTime: number
  currentTimelineAnchor: number
  isPlaying: boolean
  isSeeking: boolean
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

export type AxisSnapshot = {
  id: string
  session_id: string
  session_time: number
  localUrl: string | null
  image_url: string | null
  annotation: string
  status: SnapshotPersistenceStatus
  created_at: string
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
  exportStatus: ExportStatus
  exportProgress: number
  duration: number
  events: AxisChronologyEvent[]
  pendingEvents: AxisChronologyEvent[]
  persistedEvents: AxisChronologyEvent[]
  failedEvents: AxisChronologyEvent[]
  snapshots: AxisSnapshot[]
  pendingSnapshots: AxisSnapshot[]
  failedSnapshots: AxisSnapshot[]
  isProcessingSnapshotQueue: boolean
  playback: ChronologyPlaybackState
  nextSequenceOrder: number
  hydrateChronology: (input: HydrateChronologyInput) => void
  setUiStatus: (status: ChronologyUiStatus) => void
  setPlaybackState: (playback: Partial<ChronologyPlaybackState>) => void
  beginSeekTransaction: (targetTime: number, eventId?: string | null) => void
  completeSeekTransaction: (currentTime: number) => void
  syncMediaPlayback: (playback: Partial<ChronologyPlaybackState>) => void
  requestEventJump: (eventId: string) => TimelineAnchor | null
  triggerAttentionSignal: (
    type: TemporalEventType | string,
    sessionTime: number,
    payload?: TemporalEventPayload
  ) => AxisChronologyEvent | null
  hydrateSnapshots: (snapshots: TemporalSnapshotRecord[]) => void
  triggerSnapshotCapture: (
    sessionTime: number,
    blob: Blob,
    localUrl: string,
    payload?: TemporalEventPayload
  ) => AxisSnapshot | null
  processSnapshotQueue: () => Promise<void>
  retryFailedSnapshots: () => void
  updateSnapshotAnnotation: (snapshotId: string, annotation: string) => void
  executeNativeExport: (sessionPlaybackUrl: string, sessionTitle: string) => Promise<void>
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
      snapshots: {
        Row: {
          id: string
          session_id: string
          session_time: number
          image_url: string
          annotation: string | null
          created_at: string
        }
        Insert: {
          id: string
          session_id: string
          session_time: number
          image_url: string
          annotation?: string | null
          created_at: string
        }
        Update: {
          annotation?: string | null
        }
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
const snapshotBlobBuffer = new Map<string, Blob>()
const snapshotAnnotationTimers = new Map<string, number>()

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

  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (value) =>
      (
        Number(value) ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(value) / 4)))
      ).toString(16)
    )
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

function syncedSnapshot(snapshot: TemporalSnapshotRecord): AxisSnapshot {
  return {
    id: snapshot.id,
    session_id: snapshot.session_id,
    session_time: Number(snapshot.session_time) || 0,
    localUrl: snapshot.image_url,
    image_url: snapshot.image_url,
    annotation: snapshot.annotation || "",
    status: "SYNCED",
    created_at: snapshot.created_at,
    retryCount: 0,
  }
}

function sortSnapshots(snapshots: AxisSnapshot[]) {
  return [...snapshots].sort((a, b) => {
    const timeDelta = Number(a.session_time) - Number(b.session_time)
    if (timeDelta !== 0) return timeDelta

    return a.created_at.localeCompare(b.created_at)
  })
}

function mergeSnapshots(snapshots: AxisSnapshot[]) {
  const byId = new Map<string, AxisSnapshot>()
  snapshots.forEach((snapshot) => byId.set(snapshot.id, snapshot))

  return sortSnapshots([...byId.values()])
}

function normalizeAnnotation(annotation: string) {
  return annotation.replace(/\s+/g, " ").trim().slice(0, 120)
}

async function persistSnapshotAnnotation(snapshotId: string, annotation: string) {
  const { error } = await chronologySupabase()
    .from("snapshots")
    .update({
      annotation: annotation || null,
    })
    .eq("id", snapshotId)

  if (error) {
    throw error
  }
}

function safeExportTitle(value: string) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)

  return cleaned || "axis-recording"
}

function fileExtensionForContentType(contentType: string) {
  if (contentType.includes("webm")) return "webm"
  if (contentType.includes("quicktime")) return "mov"
  return "mp4"
}

async function fetchPlaybackBlob(
  url: string,
  onProgress: (progress: number) => void
): Promise<Blob> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error("EXPORT_FETCH_FAILED")
  }

  const contentLength = Number(response.headers.get("content-length")) || 0

  if (!response.body || !contentLength) {
    const blob = await response.blob()
    onProgress(100)
    return blob
  }

  const reader = response.body.getReader()
  const chunks: ArrayBuffer[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
    received += value.length
    onProgress(Math.min(99, Math.round((received / contentLength) * 100)))
  }

  return new Blob(chunks, {
    type: response.headers.get("content-type") || "video/mp4",
  })
}

function scheduleObjectUrlCleanup(url: string) {
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 10000)
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

async function persistSnapshot(snapshot: AxisSnapshot, blob: Blob) {
  const path = `${snapshot.session_id}/${snapshot.id}.jpg`
  const client = chronologySupabase()
  const uploaded = await client.storage.from("session-snapshots").upload(path, blob, {
    cacheControl: "3600",
    contentType: "image/jpeg",
    upsert: false,
  })

  if (uploaded.error && !uploaded.error.message.toLowerCase().includes("already exists")) {
    throw uploaded.error
  }

  const { data } = client.storage.from("session-snapshots").getPublicUrl(path)
  const imageUrl = data.publicUrl

  if (!imageUrl) {
    throw new Error("SNAPSHOT_PUBLIC_URL_MISSING")
  }

  const { error } = await client.from("snapshots").insert({
    id: snapshot.id,
    session_id: snapshot.session_id,
    session_time: snapshot.session_time,
    image_url: imageUrl,
    annotation: snapshot.annotation || null,
    created_at: snapshot.created_at,
  })

  if (error && error.code !== "23505") {
    throw error
  }

  return imageUrl
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
  exportStatus: "IDLE",
  exportProgress: 0,
  duration: 0,
  events: [],
  pendingEvents: [],
  persistedEvents: [],
  failedEvents: [],
  snapshots: [],
  pendingSnapshots: [],
  failedSnapshots: [],
  isProcessingSnapshotQueue: false,
  playback: {
    currentTime: 0,
    currentTimelineAnchor: 0,
    isPlaying: false,
    isSeeking: false,
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
      snapshots: isNewSession ? [] : current.snapshots,
      pendingSnapshots: isNewSession ? [] : current.pendingSnapshots,
      failedSnapshots: isNewSession ? [] : current.failedSnapshots,
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
          currentTimelineAnchor: 0,
          isPlaying: false,
          isSeeking: false,
          paused: true,
          readyState: 0,
        }
        : current.playback,
    })
  },
  hydrateSnapshots: (snapshots) => {
    const current = get()
    const sessionId = current.sessionId
    const persisted = snapshots.map(syncedSnapshot)
    const localPending = sessionId
      ? current.pendingSnapshots.filter((snapshot) => snapshot.session_id === sessionId)
      : []
    const localFailed = sessionId
      ? current.failedSnapshots.filter((snapshot) => snapshot.session_id === sessionId)
      : []

    set({
      snapshots: mergeSnapshots([...persisted, ...localPending, ...localFailed]),
    })
  },
  triggerSnapshotCapture: (sessionTime, blob, localUrl, payload = {}) => {
    const sessionId = get().sessionId
    if (!sessionId) return null

    const snapshot: AxisSnapshot = {
      id: createId("axis-snapshot"),
      session_id: sessionId,
      session_time: Number(sessionTime) || 0,
      localUrl,
      image_url: null,
      annotation: "",
      status: "PENDING",
      created_at: new Date().toISOString(),
      retryCount: 0,
    }

    snapshotBlobBuffer.set(snapshot.id, blob)

    set((state) => ({
      snapshots: mergeSnapshots([...state.snapshots, snapshot]),
      pendingSnapshots: mergeSnapshots([...state.pendingSnapshots, snapshot]),
      syncTelemetry: syncTelemetry(
        state.globalSyncStatus === "FAILED" ? "FAILED" : "SYNCING",
        state.pendingEvents.length + state.pendingSnapshots.length + 1,
        state.failedEvents.length + state.failedSnapshots.length
      ),
    }))

    get().triggerAttentionSignal("SNAPSHOT", snapshot.session_time, {
      replay_window: defaultReplayWindow(),
      snapshot_id: snapshot.id,
      ...(payload || {}),
    })

    queueMicrotask(() => {
      void get().processSnapshotQueue()
    })

    return snapshot
  },
  processSnapshotQueue: async () => {
    if (get().isProcessingSnapshotQueue) return

    set((state) => ({
      isProcessingSnapshotQueue: true,
      syncTelemetry: syncTelemetry(
        state.globalSyncStatus === "RETRYING" ? "RETRYING" : "SYNCING",
        state.pendingEvents.length + state.pendingSnapshots.length,
        state.failedEvents.length + state.failedSnapshots.length
      ),
    }))

    try {
      while (get().pendingSnapshots.length > 0) {
        const snapshot = get().pendingSnapshots[0]
        const blob = snapshotBlobBuffer.get(snapshot.id)

        if (!blob) {
          const failedSnapshot: AxisSnapshot = {
            ...snapshot,
            status: "FAILED",
          }

          set((state) => ({
            pendingSnapshots: state.pendingSnapshots.filter(
              (candidate) => candidate.id !== snapshot.id
            ),
            failedSnapshots: mergeSnapshots([...state.failedSnapshots, failedSnapshot]),
            snapshots: mergeSnapshots(
              state.snapshots.map((candidate) =>
                candidate.id === snapshot.id ? failedSnapshot : candidate
              )
            ),
            syncTelemetry: syncTelemetry(
              "FAILED",
              state.pendingEvents.length + Math.max(0, state.pendingSnapshots.length - 1),
              state.failedEvents.length + state.failedSnapshots.length + 1
            ),
          }))
          continue
        }

        const syncingSnapshot: AxisSnapshot = {
          ...snapshot,
          status: "SYNCING",
        }

        set((state) => ({
          snapshots: mergeSnapshots(
            state.snapshots.map((candidate) =>
              candidate.id === snapshot.id ? syncingSnapshot : candidate
            )
          ),
        }))

        try {
          const latestBeforePersist =
            get().snapshots.find((candidate) => candidate.id === snapshot.id) || snapshot
          const imageUrl = await persistSnapshot(latestBeforePersist, blob)
          const latestAfterPersist =
            get().snapshots.find((candidate) => candidate.id === snapshot.id) ||
            latestBeforePersist

          if (latestAfterPersist.annotation) {
            await persistSnapshotAnnotation(
              snapshot.id,
              normalizeAnnotation(latestAfterPersist.annotation)
            )
          }

          const savedSnapshot: AxisSnapshot = {
            ...latestAfterPersist,
            image_url: imageUrl,
            localUrl: latestAfterPersist.localUrl || imageUrl,
            status: "SYNCED",
          }

          set((state) => ({
            pendingSnapshots: state.pendingSnapshots.filter(
              (candidate) => candidate.id !== snapshot.id
            ),
            failedSnapshots: state.failedSnapshots.filter(
              (candidate) => candidate.id !== snapshot.id
            ),
            snapshots: mergeSnapshots(
              state.snapshots.map((candidate) =>
                candidate.id === snapshot.id ? savedSnapshot : candidate
              )
            ),
            syncTelemetry: syncTelemetry(
              state.globalSyncStatus,
              state.pendingEvents.length + Math.max(0, state.pendingSnapshots.length - 1),
              state.failedEvents.length + state.failedSnapshots.length
            ),
          }))
        } catch {
          const failedSnapshot: AxisSnapshot = {
            ...snapshot,
            status: "FAILED",
          }

          set((state) => ({
            pendingSnapshots: state.pendingSnapshots.filter(
              (candidate) => candidate.id !== snapshot.id
            ),
            failedSnapshots: mergeSnapshots([...state.failedSnapshots, failedSnapshot]),
            snapshots: mergeSnapshots(
              state.snapshots.map((candidate) =>
                candidate.id === snapshot.id ? failedSnapshot : candidate
              )
            ),
            globalSyncStatus: "FAILED",
            syncTelemetry: syncTelemetry(
              "FAILED",
              state.pendingEvents.length + Math.max(0, state.pendingSnapshots.length - 1),
              state.failedEvents.length + state.failedSnapshots.length + 1
            ),
          }))
        }
      }
    } finally {
      const state = get()
      const pendingCount = state.pendingEvents.length + state.pendingSnapshots.length
      const failedCount = state.failedEvents.length + state.failedSnapshots.length

      set({
        isProcessingSnapshotQueue: false,
        globalSyncStatus: failedCount ? "FAILED" : pendingCount ? "SYNCING" : "SYNCED",
        syncTelemetry: syncTelemetry(
          failedCount ? "FAILED" : pendingCount ? "SYNCING" : "SYNCED",
          pendingCount,
          failedCount
        ),
      })
    }
  },
  retryFailedSnapshots: () => {
    const failedSnapshots = get().failedSnapshots
    if (!failedSnapshots.length) return

    const retryingSnapshots = failedSnapshots.map((snapshot) => ({
      ...snapshot,
      status: "RETRYING" as const,
      retryCount: snapshot.retryCount + 1,
    }))

    set((state) => ({
      failedSnapshots: [],
      pendingSnapshots: mergeSnapshots([...state.pendingSnapshots, ...retryingSnapshots]),
      snapshots: mergeSnapshots(
        state.snapshots.map((snapshot) => {
          const retrying = retryingSnapshots.find((candidate) => candidate.id === snapshot.id)
          return retrying || snapshot
        })
      ),
      globalSyncStatus: "RETRYING",
      syncTelemetry: syncTelemetry(
        "RETRYING",
        state.pendingEvents.length + state.pendingSnapshots.length + retryingSnapshots.length,
        state.failedEvents.length
      ),
    }))

    queueMicrotask(() => {
      void get().processSnapshotQueue()
    })
  },
  updateSnapshotAnnotation: (snapshotId, annotation) => {
    const nextAnnotation = annotation.slice(0, 120)

    set((state) => ({
      snapshots: mergeSnapshots(
        state.snapshots.map((snapshot) =>
          snapshot.id === snapshotId
            ? {
                ...snapshot,
                annotation: nextAnnotation,
              }
            : snapshot
        )
      ),
      pendingSnapshots: mergeSnapshots(
        state.pendingSnapshots.map((snapshot) =>
          snapshot.id === snapshotId
            ? {
                ...snapshot,
                annotation: nextAnnotation,
              }
            : snapshot
        )
      ),
      failedSnapshots: mergeSnapshots(
        state.failedSnapshots.map((snapshot) =>
          snapshot.id === snapshotId
            ? {
                ...snapshot,
                annotation: nextAnnotation,
              }
            : snapshot
        )
      ),
    }))

    if (typeof window === "undefined") return

    const snapshot = get().snapshots.find((candidate) => candidate.id === snapshotId)
    if (!snapshot?.image_url) return

    const existingTimer = snapshotAnnotationTimers.get(snapshotId)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }

    const timer = window.setTimeout(() => {
      const latest = get().snapshots.find((candidate) => candidate.id === snapshotId)
      snapshotAnnotationTimers.delete(snapshotId)
      if (!latest?.image_url) return

      void persistSnapshotAnnotation(snapshotId, normalizeAnnotation(latest.annotation)).catch(
        () => undefined
      )
    }, 500)

    snapshotAnnotationTimers.set(snapshotId, timer)
  },
  executeNativeExport: async (sessionPlaybackUrl, sessionTitle) => {
    if (!sessionPlaybackUrl || typeof window === "undefined") {
      set({
        exportStatus: "FAILED",
        exportProgress: 0,
      })
      return
    }

    set({
      exportStatus: "DOWNLOADING",
      exportProgress: 0,
    })

    try {
      const blob = await fetchPlaybackBlob(sessionPlaybackUrl, (progress) => {
        set({
          exportProgress: progress,
        })
      })

      if (!blob.size) {
        throw new Error("EXPORT_FILE_EMPTY")
      }

      set({
        exportStatus: "PREPARING_TRANSFER",
        exportProgress: 100,
      })

      const contentType = blob.type || "video/mp4"
      const fileName = `${safeExportTitle(sessionTitle)}.${fileExtensionForContentType(contentType)}`
      const file =
        typeof File !== "undefined"
          ? new File([blob], fileName, {
              type: contentType,
              lastModified: Date.now(),
            })
          : null

      if (file && navigator.share) {
        const sharePayload = {
          files: [file],
          title: sessionTitle || "Axis recording",
        }

        if (!navigator.canShare || navigator.canShare(sharePayload)) {
          await navigator.share(sharePayload)
          set({
            exportStatus: "SUCCESS",
            exportProgress: 100,
          })
          return
        }
      }

      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = fileName
      anchor.rel = "noopener"
      anchor.style.display = "none"
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      scheduleObjectUrlCleanup(objectUrl)

      set({
        exportStatus: "SUCCESS",
        exportProgress: 100,
      })
    } catch {
      set({
        exportStatus: "FAILED",
      })
    }
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
  beginSeekTransaction: (targetTime, eventId = null) => {
    const safeTargetTime = Math.max(0, Number(targetTime) || 0)

    set((state) => ({
      activeEventId: eventId ?? state.activeEventId,
      currentTimelineAnchor: eventId
        ? {
            eventId,
            sessionTime: safeTargetTime,
            targetTime: safeTargetTime,
            requestedAt: Date.now(),
          }
        : state.currentTimelineAnchor,
      isInternalSeeking: true,
      uiStatus: "seeking",
      playback: {
        ...state.playback,
        currentTime: safeTargetTime,
        currentTimelineAnchor: safeTargetTime,
        isPlaying: false,
        isSeeking: true,
        paused: true,
      },
    }))
  },
  completeSeekTransaction: (currentTime) => {
    const safeCurrentTime = Math.max(0, Number(currentTime) || 0)

    set((state) => ({
      isInternalSeeking: false,
      uiStatus: "ready",
      playback: {
        ...state.playback,
        currentTime: safeCurrentTime,
        currentTimelineAnchor: safeCurrentTime,
        isPlaying: false,
        isSeeking: false,
        paused: true,
      },
    }))
  },
  syncMediaPlayback: (playback) => {
    set((state) => {
      const nextPlayback = {
        ...state.playback,
        ...playback,
      }
      if (state.isInternalSeeking || state.playback.isSeeking || nextPlayback.isSeeking) {
        return {
          playback: nextPlayback,
        }
      }

      if (nextPlayback.paused || !nextPlayback.isPlaying) {
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
        activeEventId: nearestEvent?.id ?? state.activeEventId,
        playback: {
          ...nextPlayback,
          currentTimelineAnchor: currentTime,
        },
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
    if (get().playback.isSeeking) return null

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
        currentTimelineAnchor: anchor.targetTime,
        isPlaying: false,
        isSeeking: false,
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
      syncTelemetry: syncTelemetry(
        "SYNCING",
        state.pendingEvents.length + state.pendingSnapshots.length + 1,
        state.failedEvents.length + state.failedSnapshots.length
      ),
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
              Math.max(0, state.pendingEvents.length - 1) + state.pendingSnapshots.length,
              state.failedEvents.length + state.failedSnapshots.length
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
              Math.max(0, state.pendingEvents.length - 1) + state.pendingSnapshots.length,
              state.failedEvents.length + state.failedSnapshots.length + 1
            ),
          }))
        }
      }
    } finally {
      const state = get()
      const pendingCount = state.pendingEvents.length + state.pendingSnapshots.length
      const failedCount = state.failedEvents.length + state.failedSnapshots.length

      set({
        isProcessingQueue: false,
        globalSyncStatus: failedCount ? "FAILED" : pendingCount ? "SYNCING" : "SYNCED",
        syncTelemetry: syncTelemetry(
          failedCount ? "FAILED" : pendingCount ? "SYNCING" : "SYNCED",
          pendingCount,
          failedCount
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
      syncTelemetry: syncTelemetry(
        "RETRYING",
        state.pendingEvents.length + state.pendingSnapshots.length + retryingEvents.length,
        state.failedSnapshots.length
      ),
    }))

    queueMicrotask(() => {
      void get().processPersistenceQueue()
    })
  },
  completeInternalSeek: () => {
    set((state) => ({
      isInternalSeeking: false,
      uiStatus: "ready",
      playback: {
        ...state.playback,
        isPlaying: false,
        isSeeking: false,
        paused: true,
      },
    }))
  },
}))
