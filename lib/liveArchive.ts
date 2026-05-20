export type LiveSessionStatus =
  | "READY"
  | "STARTING"
  | "LIVE"
  | "RECONNECTING"
  | "FINALIZING"
  | "ARCHIVED"
  | "FAILED"

export type LiveIngestEventType =
  | "session_started"
  | "stream_connected"
  | "reconnect_begin"
  | "reconnect_success"
  | "chunk_recorded"
  | "basketball_stat"
  | "archive_started"
  | "archive_completed"
  | "archive_failed"
  | "session_failed"

export type LiveIngestEvent = {
  id: string
  type: LiveIngestEventType
  createdAt: string
  sessionTime: number
  metadata?: Record<string, unknown>
}

export type LiveArchiveSession = {
  id: string
  status: "ARCHIVED"
  startedAt: string
  endedAt: string
  duration: number
  playbackUrl: string
  videoUrl: string
  storagePath: string
  createdAt: string
  events: LiveIngestEvent[]
}

type StoredArchiveIndex = {
  latestId: string | null
  sessions: LiveArchiveSession[]
}

export const liveArchiveStorageKey = "axis-live-v1-archive"
export const liveArchiveIndexStorageKey = "axis-live-v1-archive-index"

function normalizeArchivedSession(value: unknown): LiveArchiveSession | null {
  if (!value || typeof value !== "object") return null

  const recording = value as Partial<LiveArchiveSession> & {
    videoUrl?: string
  }

  const playbackUrl = recording.playbackUrl || recording.videoUrl

  if (
    typeof recording.id === "string" &&
    typeof playbackUrl === "string" &&
    typeof recording.storagePath === "string" &&
    typeof recording.duration === "number" &&
    typeof recording.startedAt === "string" &&
    typeof recording.endedAt === "string" &&
    recording.status === "ARCHIVED"
  ) {
    return {
      id: recording.id,
      status: "ARCHIVED",
      startedAt: recording.startedAt,
      endedAt: recording.endedAt,
      duration: recording.duration,
      playbackUrl,
      videoUrl: playbackUrl,
      storagePath: recording.storagePath,
      createdAt:
        typeof recording.createdAt === "string"
          ? recording.createdAt
          : recording.startedAt,
      events: Array.isArray(recording.events) ? recording.events : [],
    }
  }

  return null
}

function readArchiveIndex(): StoredArchiveIndex {
  if (typeof window === "undefined") {
    return {
      latestId: null,
      sessions: [],
    }
  }

  try {
    const stored = window.localStorage.getItem(liveArchiveIndexStorageKey)
    if (!stored) {
      const latestStored = window.localStorage.getItem(liveArchiveStorageKey)
      const latest = latestStored ? normalizeArchivedSession(JSON.parse(latestStored)) : null

      return {
        latestId: latest?.id ?? null,
        sessions: latest ? [latest] : [],
      }
    }

    const parsed = JSON.parse(stored) as unknown
    if (!parsed || typeof parsed !== "object") {
      return {
        latestId: null,
        sessions: [],
      }
    }

    const candidate = parsed as Partial<StoredArchiveIndex>
    const sessions = Array.isArray(candidate.sessions)
      ? candidate.sessions
          .map((session) => normalizeArchivedSession(session))
          .filter((session): session is LiveArchiveSession => Boolean(session))
      : []

    return {
      latestId:
        typeof candidate.latestId === "string" ? candidate.latestId : sessions[0]?.id ?? null,
      sessions,
    }
  } catch {
    window.localStorage.removeItem(liveArchiveIndexStorageKey)
    return {
      latestId: null,
      sessions: [],
    }
  }
}

export function loadArchivedRecording(id?: string) {
  if (typeof window === "undefined") return null

  const index = readArchiveIndex()
  const indexed = id
    ? index.sessions.find((session) => session.id === id)
    : index.sessions.find((session) => session.id === index.latestId) ?? index.sessions[0]

  if (indexed) return indexed

  try {
    const stored = window.localStorage.getItem(liveArchiveStorageKey)
    if (!stored) return null

    const normalized = normalizeArchivedSession(JSON.parse(stored))
    if (!normalized) return null
    if (id && normalized.id !== id) return null

    return normalized
  } catch {
    window.localStorage.removeItem(liveArchiveStorageKey)
    return null
  }
}

export function listArchivedRecordings() {
  if (typeof window === "undefined") return []

  return readArchiveIndex().sessions
}

export function saveArchivedRecording(recording: LiveArchiveSession) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(liveArchiveStorageKey, JSON.stringify(recording))

  const index = readArchiveIndex()
  const sessions = [
    recording,
    ...index.sessions.filter((session) => session.id !== recording.id),
  ].slice(0, 12)

  window.localStorage.setItem(
    liveArchiveIndexStorageKey,
    JSON.stringify({
      latestId: recording.id,
      sessions,
    } satisfies StoredArchiveIndex)
  )
}
