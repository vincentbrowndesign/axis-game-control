import type { SessionEnvironment, SessionSource } from "@/types/memory"

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "m4v",
  "webm",
  "quicktime",
])

export function sanitizeFileName(name: string) {
  const fallback = `axis-replay-${Date.now()}.mp4`
  const raw = name.trim() || fallback
  const normalized = raw.normalize("NFKD")
  const safe = normalized
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")

  return safe || fallback
}

export function getFileExtension(name: string, type?: string) {
  const extension = name.split(".").pop()?.toLowerCase()

  if (extension) return extension

  if (type?.includes("quicktime")) return "mov"
  if (type?.includes("mp4")) return "mp4"
  if (type?.includes("webm")) return "webm"

  return "mp4"
}

export function isSupportedReplayFile(file: {
  name: string
  type?: string
  size: number
}) {
  if (!file.size) return false

  const extension = getFileExtension(file.name, file.type)
  const type = file.type || ""

  if (type.startsWith("video/")) return true

  return VIDEO_EXTENSIONS.has(extension)
}

export function createStoragePath({
  userId,
  sessionId,
  fileName,
  type,
}: {
  userId: string
  sessionId: string
  fileName: string
  type?: string
}) {
  const safeName = sanitizeFileName(fileName)
  const extension = getFileExtension(safeName, type)
  const baseName = safeName
    .replace(/\.[^.]+$/, "")
    .slice(0, 80)

  return `${userId}/${Date.now()}-${sessionId}-${baseName}.${extension}`
}

export function normalizeSource(value: FormDataEntryValue | null): SessionSource {
  return value === "camera" ? "camera" : "upload"
}

export function normalizeEnvironment(
  value: FormDataEntryValue | null
): SessionEnvironment {
  if (
    value === "game" ||
    value === "mission" ||
    value === "workout"
  ) {
    return value
  }

  return "practice"
}

export function cleanText(
  value: FormDataEntryValue | null,
  fallback: string
) {
  if (typeof value !== "string") return fallback

  const clean = value.trim()

  return clean || fallback
}
