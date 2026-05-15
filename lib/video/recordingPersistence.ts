import Dexie, { type Table } from "dexie"

export type PendingMemoryStatus =
  | "pending"
  | "saving"
  | "synced"
  | "failed"

export type PendingMemory = {
  id: string
  blob: Blob
  mimeType: string
  filename: string
  duration: number
  twinId: string
  warmupId: string
  createdAt: number
  status: PendingMemoryStatus
}

export type PendingMemoryInput = Omit<
  PendingMemory,
  "id" | "createdAt" | "status"
> & {
  id?: string
  createdAt?: number
  status?: PendingMemoryStatus
}

class AxisRecordingDatabase extends Dexie {
  pendingMemories!: Table<PendingMemory, string>

  constructor() {
    super("axis-recording-persistence")

    this.version(1).stores({
      pendingMemories:
        "id, status, twinId, warmupId, createdAt",
    })
  }
}

let database: AxisRecordingDatabase | null = null

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window
}

function getDatabase() {
  if (!canUseIndexedDb()) return null

  database ||= new AxisRecordingDatabase()

  return database
}

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID()
  }

  return `pending-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

export async function savePendingMemory(
  input: PendingMemoryInput
): Promise<PendingMemory | null> {
  const db = getDatabase()

  if (!db) return null

  const memory: PendingMemory = {
    id: input.id || createId(),
    blob: input.blob,
    mimeType: input.mimeType || input.blob.type || "video/mp4",
    filename: input.filename,
    duration: input.duration || 0,
    twinId: input.twinId,
    warmupId: input.warmupId,
    createdAt: input.createdAt || Date.now(),
    status: input.status || "pending",
  }

  await db.pendingMemories.put(memory)

  return memory
}

export async function getPendingMemory(id: string) {
  const db = getDatabase()

  if (!db) return null

  return db.pendingMemories.get(id)
}

export async function getPendingMemories(
  status?: PendingMemoryStatus
) {
  const db = getDatabase()

  if (!db) return []

  if (!status) {
    return db.pendingMemories
      .orderBy("createdAt")
      .reverse()
      .toArray()
  }

  return db.pendingMemories
    .where("status")
    .equals(status)
    .reverse()
    .sortBy("createdAt")
}

export async function updatePendingMemoryStatus(
  id: string,
  status: PendingMemoryStatus
) {
  const db = getDatabase()

  if (!db) return null

  await db.pendingMemories.update(id, { status })

  return db.pendingMemories.get(id)
}

export async function deletePendingMemory(id: string) {
  const db = getDatabase()

  if (!db) return

  await db.pendingMemories.delete(id)
}

export async function retryPendingMemory(
  id: string,
  syncMemory?: (memory: PendingMemory) => Promise<void>
) {
  const memory = await getPendingMemory(id)

  if (!memory) {
    throw new Error("Pending memory not found")
  }

  if (!syncMemory) {
    return updatePendingMemoryStatus(id, "pending")
  }

  await updatePendingMemoryStatus(id, "saving")

  try {
    await syncMemory(memory)
    return updatePendingMemoryStatus(id, "synced")
  } catch (error) {
    await updatePendingMemoryStatus(id, "failed")
    throw error
  }
}
