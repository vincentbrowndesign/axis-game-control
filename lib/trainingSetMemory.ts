import type { TemporalEventRecord } from "@/lib/temporalEventGraph"

export type TrainingSetMemoryInput = {
  frame: Blob
  sessionId: string
  sessionTime: number
  replayPosition: number
  chronologyPosition: number
  opticalDepth: number
  clipReference: {
    playbackUrl?: string | null
    storagePath?: string | null
  }
  eventContext?: {
    activeEventId?: string | null
    eventType?: string | null
    basketballEvent?: string | null
    reconstructionChapter?: string | null
    nearbyEvents?: Array<{
      id: string
      type: string
      sessionTime: number
    }>
  }
  motionState?: Record<string, unknown> | null
  source: "replay" | "live_review"
}

export type TrainingSetMemoryRecord = TrainingSetMemoryInput & {
  id: string
  createdAt: string
}

const databaseName = "axis-training-set-memory"
const storeName = "training_memories"

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `axis-training-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function openTrainingDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, {
          keyPath: "id",
        })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("TRAINING_MEMORY_DB_FAILED"))
  })
}

export async function saveTrainingSetMemory(input: TrainingSetMemoryInput) {
  if (typeof indexedDB === "undefined") {
    throw new Error("TRAINING_MEMORY_UNAVAILABLE")
  }

  const database = await openTrainingDatabase()
  const record: TrainingSetMemoryRecord = {
    ...input,
    id: createId(),
    createdAt: new Date().toISOString(),
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite")
    const store = transaction.objectStore(storeName)
    const request = store.put(record)

    request.onerror = () => reject(request.error || new Error("TRAINING_MEMORY_SAVE_FAILED"))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error || new Error("TRAINING_MEMORY_SAVE_FAILED"))
  })

  database.close()

  return record
}

export function summarizeNearbyEvents(events: TemporalEventRecord[], sessionTime: number) {
  return events
    .filter((event) => Math.abs(Number(event.session_time) - sessionTime) <= 3)
    .slice(0, 8)
    .map((event) => ({
      id: event.id,
      type: String(event.type),
      sessionTime: Number(event.session_time) || 0,
    }))
}

export async function blobFromUrl(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error("TRAINING_MEMORY_FRAME_UNAVAILABLE")

  return response.blob()
}
